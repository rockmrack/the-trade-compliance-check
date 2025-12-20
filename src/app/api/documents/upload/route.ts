import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { verifyDocument } from '@/lib/services/ai-verifier';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const contractorId = formData.get('contractorId') as string | null;
    const documentType = formData.get('documentType') as string | null;
    const providerName = formData.get('providerName') as string | null;
    const expiryDate = formData.get('expiryDate') as string | null;

    // Validate required fields
    if (!file || !contractorId || !documentType || !expiryDate) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required fields: file, contractorId, documentType, expiryDate'
          }
        },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_FILE_TYPE',
            message: 'File must be PDF, JPEG, PNG, or WebP'
          }
        },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FILE_TOO_LARGE',
            message: 'File must be less than 10MB'
          }
        },
        { status: 400 }
      );
    }

    const serviceClient = await createServiceClient();

    // Verify contractor exists
    const { data: contractor, error: contractorError } = await serviceClient
      .from('contractors')
      .select('id, company_name')
      .eq('id', contractorId)
      .single();

    if (contractorError || !contractor) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CONTRACTOR_NOT_FOUND',
            message: 'Contractor not found'
          }
        },
        { status: 404 }
      );
    }

    // Generate file hash and check for duplicates
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileHash = createHash('sha256').update(buffer).digest('hex');

    const { data: existingDoc } = await serviceClient
      .from('compliance_documents')
      .select('id')
      .eq('file_hash', fileHash)
      .eq('contractor_id', contractorId)
      .is('replaced_by_id', null)
      .single();

    if (existingDoc) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DUPLICATE_DOCUMENT',
            message: 'This document has already been uploaded'
          }
        },
        { status: 409 }
      );
    }

    // Upload to Supabase Storage
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'pdf';
    const fileName = `${contractorId}/${documentType}/${uuidv4()}.${fileExt}`;

    const { error: uploadError } = await serviceClient.storage
      .from('compliance-documents')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UPLOAD_ERROR',
            message: 'Failed to upload file'
          }
        },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = serviceClient.storage
      .from('compliance-documents')
      .getPublicUrl(fileName);

    // Run AI verification (for images and PDFs)
    let aiAnalysis = null;
    let verificationScore = 50;
    let status: 'pending_review' | 'valid' | 'rejected' | 'fraud_suspected' = 'pending_review';
    let rejectionReason: string | null = null;

    if (process.env.OPENAI_API_KEY && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
      try {
        // For PDFs, we'd need to convert to image first
        // For now, only process images directly
        if (file.type.startsWith('image/')) {
          const base64 = buffer.toString('base64');
          const verificationResult = await verifyDocument(base64, file.type, {
            documentType,
            requireMinimumCoverage: ['public_liability', 'employers_liability'].includes(documentType),
            checkForFraud: true
          });

          if (verificationResult.success && verificationResult.analysis) {
            aiAnalysis = verificationResult.analysis;
            verificationScore = Math.round(verificationResult.analysis.confidence * 100);

            if (verificationResult.isValid) {
              status = 'valid';
            } else if (verificationResult.analysis.fraudIndicators?.some(
              (f) => f.severity === 'high' || f.severity === 'critical'
            )) {
              status = 'fraud_suspected';
              rejectionReason = 'Document flagged for potential fraud - manual review required';
            } else if (verificationResult.rejectionReasons.length > 0) {
              status = 'rejected';
              rejectionReason = verificationResult.rejectionReasons.join('; ');
            }
          }
        }
      } catch (aiError) {
        console.error('AI verification error:', aiError);
        // Continue with manual review required
      }
    }

    // Check if there's an existing document to replace
    const { data: existingCurrentDoc } = await serviceClient
      .from('compliance_documents')
      .select('id')
      .eq('contractor_id', contractorId)
      .eq('document_type', documentType)
      .is('replaced_by_id', null)
      .single();

    // Create document record
    const { data: document, error: dbError } = await serviceClient
      .from('compliance_documents')
      // @ts-ignore - Supabase type inference limitation
      .insert({
        contractor_id: contractorId,
        document_type: documentType,
        provider_name: providerName || 'Unknown',
        expiry_date: expiryDate,
        document_url: urlData.publicUrl,
        document_path: fileName,
        file_size_bytes: file.size,
        mime_type: file.type,
        file_hash: fileHash,
        status,
        verification_score: verificationScore,
        ai_analysis: aiAnalysis,
        rejection_reason: rejectionReason,
        metadata: {
          originalFileName: file.name,
          uploadedBy: user.id,
          uploadedAt: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (dbError || !document) {
      console.error('Database error:', dbError);
      // Clean up uploaded file
      await serviceClient.storage.from('compliance-documents').remove([fileName]);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'Failed to create document record'
          }
        },
        { status: 500 }
      );
    }

    // Update old document as replaced
    if (existingCurrentDoc) {
      await serviceClient
        .from('compliance_documents')
        // @ts-ignore - Supabase type inference limitation
        .update({ replaced_by_id: (document as any).id })
        .eq('id', (existingCurrentDoc as any).id);
    }

    // Create verification log
    // @ts-ignore - Supabase type inference limitation
    await serviceClient.from('verification_logs').insert({
      contractor_id: contractorId,
      document_id: (document as any).id,
      check_type: 'ai_document_scan',
      status: aiAnalysis ? 'success' : 'pending',
      result: {
        passed: status === 'valid',
        message: status === 'valid' ? 'Document verified successfully' : rejectionReason || 'Pending manual review',
        aiAnalysis: aiAnalysis ? {
          confidence: aiAnalysis.confidence,
          qualityScore: aiAnalysis.qualityScore,
          fraudIndicators: aiAnalysis.fraudIndicators?.length || 0
        } : null
      },
      performed_by: user.id,
      duration_ms: aiAnalysis?.processingTimeMs || 0
    });

    // Update contractor verification status if needed
    if (status === 'valid') {
      // Check if all required documents are now valid
      const { data: allDocs } = await serviceClient
        .from('compliance_documents')
        .select('document_type, status')
        .eq('contractor_id', contractorId)
        .is('replaced_by_id', null);

      const requiredTypes = ['public_liability'];
      const hasAllRequired = requiredTypes.every((type) =>
        allDocs?.some((d: any) => d.document_type === type && d.status === 'valid')
      );

      if (hasAllRequired) {
        await serviceClient
          .from('contractors')
          // @ts-ignore - Supabase type inference limitation
          .update({
            verification_status: 'verified',
            payment_status: 'allowed',
            last_verified_at: new Date().toISOString()
          })
          .eq('id', contractorId);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: (document as any).id,
        status,
        verificationScore,
        message:
          status === 'valid'
            ? 'Document verified successfully'
            : status === 'fraud_suspected'
            ? 'Document flagged for review'
            : status === 'rejected'
            ? `Document rejected: ${rejectionReason}`
            : 'Document uploaded - pending verification'
      }
    });
  } catch (error) {
    console.error('Document upload error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Document upload failed'
        }
      },
      { status: 500 }
    );
  }
}
