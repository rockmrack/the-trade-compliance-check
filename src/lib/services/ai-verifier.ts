import OpenAI from 'openai';
import type {
  AIDocumentAnalysis,
  ExtractedDocumentData,
  FraudIndicator,
  FraudIndicatorType
} from '@/types';
import { MINIMUM_COVERAGE_REQUIREMENTS } from '@/lib/utils';

// ============ OPENAI CLIENT ============

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ============ TYPES ============

interface VerificationResult {
  success: boolean;
  analysis: AIDocumentAnalysis | null;
  error?: string;
  isValid: boolean;
  rejectionReasons: string[];
}

interface DocumentVerificationOptions {
  documentType: string;
  requireMinimumCoverage?: boolean;
  checkForFraud?: boolean;
}

// ============ PROMPT TEMPLATES ============

const EXTRACTION_PROMPT = `You are an expert insurance document analyzer. Analyze this insurance certificate or compliance document image and extract the following information in JSON format:

{
  "policyNumber": "The policy or certificate number",
  "providerName": "The insurance company or issuing organization name",
  "insuredName": "The name of the insured party/company",
  "insuredAddress": "The address of the insured party",
  "coverageAmount": "The coverage limit in GBP (just the number, e.g., 5000000 for £5M)",
  "excessAmount": "The excess/deductible amount in GBP if mentioned",
  "startDate": "Policy start date in YYYY-MM-DD format",
  "expiryDate": "Policy expiry date in YYYY-MM-DD format",
  "coverageTypes": ["Array of coverage types mentioned, e.g., 'Public Liability', 'Products Liability'"],
  "additionalInsured": ["Any additional insured parties listed"],
  "endorsements": ["Any special endorsements or conditions"],
  "documentType": "The type of document (e.g., 'Insurance Certificate', 'Gas Safe Card', 'NICEIC Certificate')"
}

Important:
- Extract EXACT values as they appear on the document
- For dates, convert to YYYY-MM-DD format
- For amounts, convert to numeric values in GBP (pounds not pence)
- If a field is not present or not readable, set it to null
- Be precise with policy numbers - they are critical for verification

Return ONLY the JSON object, no additional text.`;

const FRAUD_DETECTION_PROMPT = `You are an expert forensic document analyst specializing in detecting fraudulent insurance certificates and compliance documents. Analyze this document image for signs of tampering, forgery, or fraud.

Check for these specific indicators:

1. FONT INCONSISTENCIES:
   - Different fonts within the same document section
   - Misaligned text or varying text sizes where uniformity is expected
   - Text that appears to be overlaid or inserted

2. DATE MANIPULATION:
   - Dates that appear altered or overwritten
   - Inconsistent date formatting within the document
   - Dates that don't align with document creation metadata

3. LOGO/BRANDING ISSUES:
   - Low resolution logos compared to rest of document
   - Logos that appear cropped or poorly positioned
   - Incorrect colors or proportions for known insurance providers

4. DOCUMENT QUALITY:
   - Sections with different resolution or quality
   - Visible editing artifacts or clone stamp marks
   - Inconsistent background colors or patterns

5. CONTENT RED FLAGS:
   - Policy numbers in incorrect formats for the stated provider
   - Unusual or non-standard document layouts
   - Missing standard elements (signatures, stamps, reference numbers)
   - Grammatical errors or typos in official sections

6. METADATA ANOMALIES:
   - Signs the document has been digitally edited
   - Compression artifacts inconsistent with original scans

Return a JSON array of detected issues:
[
  {
    "type": "font_mismatch|date_manipulation|logo_inconsistency|metadata_anomaly|text_overlay|resolution_mismatch|known_fake_template|invalid_policy_format|provider_mismatch",
    "severity": "low|medium|high|critical",
    "description": "Detailed description of the issue",
    "confidence": 0.0-1.0
  }
]

If no issues are detected, return an empty array: []

Be conservative - only flag issues you are confident about. False positives damage trust.
Return ONLY the JSON array, no additional text.`;

const QUALITY_ASSESSMENT_PROMPT = `Assess the quality of this document image for processing:

Evaluate:
1. Image resolution and clarity
2. Completeness (is the full document visible?)
3. Orientation (is it properly oriented?)
4. Lighting and contrast
5. Presence of obstructions or damage

Return a JSON object:
{
  "qualityScore": 0-100,
  "isReadable": true/false,
  "issues": ["List of quality issues if any"],
  "recommendation": "proceed|rescan|reject"
}

Return ONLY the JSON object.`;

// ============ MAIN VERIFICATION FUNCTION ============

export async function verifyDocument(
  imageBase64: string,
  mimeType: string,
  options: DocumentVerificationOptions
): Promise<VerificationResult> {
  const startTime = Date.now();
  const rejectionReasons: string[] = [];

  try {
    // Run quality assessment, extraction, and fraud detection in parallel
    const [qualityResult, extractionResult, fraudResult] = await Promise.all([
      assessDocumentQuality(imageBase64, mimeType),
      extractDocumentData(imageBase64, mimeType),
      options.checkForFraud !== false
        ? detectFraud(imageBase64, mimeType)
        : Promise.resolve([])
    ]);

    // Check quality
    if (!qualityResult.isReadable) {
      return {
        success: false,
        analysis: null,
        error: 'Document quality too poor for reliable analysis',
        isValid: false,
        rejectionReasons: ['Poor document quality - please upload a clearer image']
      };
    }

    // Parse extracted data
    const extractedData = extractionResult;

    // Validate expiry date
    if (extractedData.expiryDate) {
      const expiryDate = new Date(extractedData.expiryDate);
      if (expiryDate < new Date()) {
        rejectionReasons.push(
          `Document has expired (${extractedData.expiryDate})`
        );
      }
    } else {
      rejectionReasons.push('Could not determine expiry date from document');
    }

    // Validate coverage amount for insurance documents
    if (options.requireMinimumCoverage && extractedData.coverageAmount) {
      const coverageInPence = extractedData.coverageAmount * 100;
      const minimumRequired =
        MINIMUM_COVERAGE_REQUIREMENTS[
          options.documentType as keyof typeof MINIMUM_COVERAGE_REQUIREMENTS
        ];

      if (minimumRequired && coverageInPence < minimumRequired) {
        const requiredFormatted = (minimumRequired / 100).toLocaleString(
          'en-GB',
          {
            style: 'currency',
            currency: 'GBP',
            minimumFractionDigits: 0
          }
        );
        const actualFormatted = extractedData.coverageAmount.toLocaleString(
          'en-GB',
          {
            style: 'currency',
            currency: 'GBP',
            minimumFractionDigits: 0
          }
        );
        rejectionReasons.push(
          `Coverage amount (${actualFormatted}) is below minimum requirement (${requiredFormatted})`
        );
      }
    }

    // Check fraud indicators
    const highSeverityFraud = fraudResult.filter(
      (f) => f.severity === 'high' || f.severity === 'critical'
    );
    if (highSeverityFraud.length > 0) {
      rejectionReasons.push(
        'Document flagged for potential fraud - manual review required'
      );
    }

    // Calculate verification score
    const verificationScore = calculateVerificationScore(
      qualityResult.qualityScore,
      extractedData,
      fraudResult,
      rejectionReasons
    );

    const analysis: AIDocumentAnalysis = {
      confidence: verificationScore / 100,
      extractedData,
      fraudIndicators: fraudResult,
      qualityScore: qualityResult.qualityScore,
      processingTimeMs: Date.now() - startTime,
      modelVersion: 'gpt-4o-2024-08-06'
    };

    return {
      success: true,
      analysis,
      isValid: rejectionReasons.length === 0,
      rejectionReasons
    };
  } catch (error) {
    console.error('Document verification error:', error);
    return {
      success: false,
      analysis: null,
      error: error instanceof Error ? error.message : 'Verification failed',
      isValid: false,
      rejectionReasons: ['System error during verification']
    };
  }
}

// ============ HELPER FUNCTIONS ============

async function assessDocumentQuality(
  imageBase64: string,
  mimeType: string
): Promise<{
  qualityScore: number;
  isReadable: boolean;
  issues: string[];
  recommendation: string;
}> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: QUALITY_ASSESSMENT_PROMPT },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
                detail: 'low'
              }
            }
          ]
        }
      ],
      max_tokens: 500,
      temperature: 0.1
    });

    const content = response.choices[0]?.message?.content || '{}';
    return JSON.parse(cleanJsonResponse(content));
  } catch (error) {
    console.error('Quality assessment error:', error);
    return {
      qualityScore: 50,
      isReadable: true,
      issues: ['Could not assess quality'],
      recommendation: 'proceed'
    };
  }
}

async function extractDocumentData(
  imageBase64: string,
  mimeType: string
): Promise<ExtractedDocumentData> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: EXTRACTION_PROMPT },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${imageBase64}`,
              detail: 'high'
            }
          }
        ]
      }
    ],
    max_tokens: 2000,
    temperature: 0.1
  });

  const content = response.choices[0]?.message?.content || '{}';
  return JSON.parse(cleanJsonResponse(content));
}

async function detectFraud(
  imageBase64: string,
  mimeType: string
): Promise<FraudIndicator[]> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: FRAUD_DETECTION_PROMPT },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
                detail: 'high'
              }
            }
          ]
        }
      ],
      max_tokens: 2000,
      temperature: 0.2
    });

    const content = response.choices[0]?.message?.content || '[]';
    const indicators = JSON.parse(cleanJsonResponse(content));

    // Validate and type-cast the response
    return indicators.map(
      (ind: {
        type: string;
        severity: string;
        description: string;
        confidence: number;
      }) => ({
        type: ind.type as FraudIndicatorType,
        severity: ind.severity as 'low' | 'medium' | 'high' | 'critical',
        description: ind.description,
        confidence: ind.confidence
      })
    );
  } catch (error) {
    console.error('Fraud detection error:', error);
    return [];
  }
}

function calculateVerificationScore(
  qualityScore: number,
  extractedData: ExtractedDocumentData,
  fraudIndicators: FraudIndicator[],
  rejectionReasons: string[]
): number {
  let score = 100;

  // Quality impact (max -20 points)
  score -= Math.max(0, (100 - qualityScore) * 0.2);

  // Missing critical fields (max -30 points)
  const criticalFields = ['policyNumber', 'expiryDate', 'providerName'];
  const missingFields = criticalFields.filter(
    (field) => !extractedData[field as keyof ExtractedDocumentData]
  );
  score -= missingFields.length * 10;

  // Fraud indicators (max -50 points)
  for (const indicator of fraudIndicators) {
    switch (indicator.severity) {
      case 'critical':
        score -= 25 * indicator.confidence;
        break;
      case 'high':
        score -= 15 * indicator.confidence;
        break;
      case 'medium':
        score -= 8 * indicator.confidence;
        break;
      case 'low':
        score -= 3 * indicator.confidence;
        break;
    }
  }

  // Rejection reasons impact
  score -= rejectionReasons.length * 10;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function cleanJsonResponse(content: string): string {
  // Remove markdown code blocks if present
  let cleaned = content.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

// ============ BATCH VERIFICATION ============

export async function verifyDocumentBatch(
  documents: Array<{
    id: string;
    imageBase64: string;
    mimeType: string;
    documentType: string;
  }>
): Promise<Map<string, VerificationResult>> {
  const results = new Map<string, VerificationResult>();

  // Process in parallel with concurrency limit
  const CONCURRENCY = 3;
  for (let i = 0; i < documents.length; i += CONCURRENCY) {
    const batch = documents.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((doc) =>
        verifyDocument(doc.imageBase64, doc.mimeType, {
          documentType: doc.documentType,
          requireMinimumCoverage: true,
          checkForFraud: true
        })
      )
    );

    batch.forEach((doc, index) => {
      results.set(doc.id, batchResults[index]!);
    });
  }

  return results;
}

// ============ GAS SAFE SPECIFIC VERIFICATION ============

export async function verifyGasSafeCard(
  imageBase64: string,
  mimeType: string
): Promise<{
  registrationNumber: string | null;
  engineerName: string | null;
  expiryDate: string | null;
  qualifications: string[];
  isValid: boolean;
}> {
  const prompt = `Analyze this Gas Safe registration card and extract:
{
  "registrationNumber": "The 7-digit Gas Safe registration number",
  "engineerName": "The name of the registered engineer",
  "expiryDate": "Card expiry date in YYYY-MM-DD format",
  "qualifications": ["List of gas work qualifications shown on the card"],
  "cardType": "ID Card or License Card"
}

Return ONLY the JSON object.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
                detail: 'high'
              }
            }
          ]
        }
      ],
      max_tokens: 1000,
      temperature: 0.1
    });

    const content = response.choices[0]?.message?.content || '{}';
    const data = JSON.parse(cleanJsonResponse(content));

    const expiryDate = data.expiryDate ? new Date(data.expiryDate) : null;
    const isValid =
      expiryDate !== null &&
      expiryDate > new Date() &&
      data.registrationNumber?.length === 7;

    return {
      registrationNumber: data.registrationNumber || null,
      engineerName: data.engineerName || null,
      expiryDate: data.expiryDate || null,
      qualifications: data.qualifications || [],
      isValid
    };
  } catch (error) {
    console.error('Gas Safe verification error:', error);
    return {
      registrationNumber: null,
      engineerName: null,
      expiryDate: null,
      qualifications: [],
      isValid: false
    };
  }
}
