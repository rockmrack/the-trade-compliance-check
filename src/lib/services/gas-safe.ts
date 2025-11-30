/**
 * Gas Safe Registry Verification Service
 * UK Gas Safe Register lookup and verification
 *
 * Note: The Gas Safe Register does not provide a public API.
 * This service uses web scraping of the public lookup tool.
 * For production use, consider contacting Gas Safe Register for official API access.
 */

export interface GasSafeEngineer {
  licenceNumber: string;
  engineerName: string | null;
  tradingName: string | null;
  businessAddress: string | null;
  status: 'valid' | 'expired' | 'not_found' | 'unknown';
  isValid: boolean;
  appliances: string[];
  expiryDate: string | null;
  rawData?: Record<string, unknown>;
  fetchedAt: string;
}

export interface GasSafeLookupResult {
  success: boolean;
  engineer?: GasSafeEngineer;
  error?: string;
  cached?: boolean;
}

const GAS_SAFE_LOOKUP_URL = 'https://www.gassaferegister.co.uk/find-an-engineer/';

/**
 * Lookup a Gas Safe engineer by licence number
 */
export async function lookupGasSafeEngineer(
  licenceNumber: string
): Promise<GasSafeLookupResult> {
  // Validate licence number format (7 digits)
  const cleanLicence = licenceNumber.replace(/\D/g, '');
  if (cleanLicence.length !== 7) {
    return {
      success: false,
      error: 'Invalid Gas Safe licence number. Must be 7 digits.'
    };
  }

  try {
    // Check cache first (using database or Redis in production)
    const cacheKey = `gas_safe:${cleanLicence}`;
    const cached = await getCachedResult(cacheKey);

    if (cached) {
      return {
        success: true,
        engineer: cached,
        cached: true
      };
    }

    // Note: In production, this would either:
    // 1. Use an official Gas Safe API (if available through partnership)
    // 2. Use a third-party verification service
    // 3. Implement web scraping with proper rate limiting and error handling

    // For now, we'll simulate the lookup with placeholder logic
    // Real implementation would make HTTP requests to Gas Safe Register

    // Simulated lookup (replace with actual implementation)
    const result = await performGasSafeLookup(cleanLicence);

    if (result.success && result.engineer) {
      // Cache the result
      await cacheResult(cacheKey, result.engineer);
    }

    return result;
  } catch (error) {
    console.error('Gas Safe lookup error:', error);
    return {
      success: false,
      error: 'Failed to verify Gas Safe registration'
    };
  }
}

/**
 * Perform the actual Gas Safe lookup
 * Note: This is a placeholder - implement actual lookup logic
 */
async function performGasSafeLookup(licenceNumber: string): Promise<GasSafeLookupResult> {
  // In production, this would:
  // 1. Make a POST request to the Gas Safe Register search
  // 2. Parse the HTML response
  // 3. Extract engineer details

  // Placeholder implementation
  // Returns a "not implemented" response that prompts manual verification

  return {
    success: true,
    engineer: {
      licenceNumber,
      engineerName: null,
      tradingName: null,
      businessAddress: null,
      status: 'unknown',
      isValid: false,
      appliances: [],
      expiryDate: null,
      rawData: {
        note: 'Automated lookup not available. Please verify manually at gassaferegister.co.uk'
      },
      fetchedAt: new Date().toISOString()
    }
  };
}

/**
 * Verify if a Gas Safe registration is valid for specific appliances
 */
export async function verifyGasSafeForAppliances(
  licenceNumber: string,
  requiredAppliances: string[]
): Promise<{
  success: boolean;
  isValid: boolean;
  missingAppliances: string[];
  error?: string;
}> {
  const lookup = await lookupGasSafeEngineer(licenceNumber);

  if (!lookup.success || !lookup.engineer) {
    return {
      success: false,
      isValid: false,
      missingAppliances: requiredAppliances,
      error: lookup.error
    };
  }

  const engineer = lookup.engineer;

  if (!engineer.isValid || engineer.status !== 'valid') {
    return {
      success: true,
      isValid: false,
      missingAppliances: requiredAppliances,
      error: 'Gas Safe registration is not valid or has expired'
    };
  }

  // Check if engineer is qualified for required appliances
  const engineerAppliances = engineer.appliances.map(a => a.toLowerCase());
  const missingAppliances = requiredAppliances.filter(
    req => !engineerAppliances.some(eng => eng.includes(req.toLowerCase()))
  );

  return {
    success: true,
    isValid: missingAppliances.length === 0,
    missingAppliances
  };
}

/**
 * Get the Gas Safe Register public lookup URL for manual verification
 */
export function getGasSafeLookupUrl(licenceNumber?: string): string {
  if (licenceNumber) {
    return `https://www.gassaferegister.co.uk/find-an-engineer/?registration=${licenceNumber}`;
  }
  return GAS_SAFE_LOOKUP_URL;
}

/**
 * Common Gas Safe appliance categories
 */
export const GAS_SAFE_APPLIANCE_CATEGORIES = [
  'Natural Gas',
  'LPG',
  'Domestic',
  'Commercial',
  'Boilers',
  'Fires',
  'Cookers',
  'Water Heaters',
  'Warm Air',
  'Meters',
  '?"LAV\'s',
  'Catering',
  'Industrial Catering',
  'Space Heating',
  'Refrigeration',
];

// Cache functions (implement with Redis or database in production)
async function getCachedResult(key: string): Promise<GasSafeEngineer | null> {
  // In production, implement Redis or database cache lookup
  // Cache should expire after 24 hours
  return null;
}

async function cacheResult(key: string, engineer: GasSafeEngineer): Promise<void> {
  // In production, implement Redis or database cache storage
  // Set TTL to 24 hours
}

/**
 * Validate Gas Safe ID card number format
 */
export function validateGasSafeIdCard(cardNumber: string): boolean {
  // Gas Safe ID cards have a 7-digit registration number
  const cleaned = cardNumber.replace(/\D/g, '');
  return cleaned.length === 7;
}

/**
 * Format Gas Safe licence number for display
 */
export function formatGasSafeLicence(licenceNumber: string): string {
  const cleaned = licenceNumber.replace(/\D/g, '');
  return cleaned.padStart(7, '0');
}
