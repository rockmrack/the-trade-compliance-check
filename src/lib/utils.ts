import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow, format, differenceInDays, isPast } from 'date-fns';

// ============ CLASSNAME UTILITIES ============

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============ CURRENCY FORMATTING ============

export function formatCurrency(
  amountInPence: number,
  currency: string = 'GBP'
): string {
  const amount = amountInPence / 100;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
}

export function formatCurrencyCompact(
  amountInPence: number,
  currency: string = 'GBP'
): string {
  const amount = amountInPence / 100;
  if (amount >= 1000000) {
    return `${currency === 'GBP' ? '£' : '$'}${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `${currency === 'GBP' ? '£' : '$'}${(amount / 1000).toFixed(0)}K`;
  }
  return formatCurrency(amountInPence, currency);
}

export function parseCurrencyToPence(value: string): number {
  const cleaned = value.replace(/[£$,\s]/g, '');
  const amount = parseFloat(cleaned);
  if (isNaN(amount)) return 0;
  return Math.round(amount * 100);
}

// ============ DATE FORMATTING ============

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'dd MMM yyyy');
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'dd MMM yyyy, HH:mm');
}

export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

export function getDaysUntilExpiry(expiryDate: string | Date): number {
  const d = typeof expiryDate === 'string' ? new Date(expiryDate) : expiryDate;
  return differenceInDays(d, new Date());
}

export function isExpired(expiryDate: string | Date): boolean {
  const d = typeof expiryDate === 'string' ? new Date(expiryDate) : expiryDate;
  return isPast(d);
}

export function getExpiryStatus(expiryDate: string | Date): {
  status: 'valid' | 'expiring_soon' | 'expired';
  daysRemaining: number;
  label: string;
  color: string;
} {
  const days = getDaysUntilExpiry(expiryDate);

  if (days < 0) {
    return {
      status: 'expired',
      daysRemaining: days,
      label: `Expired ${Math.abs(days)} days ago`,
      color: 'destructive'
    };
  }

  if (days <= 30) {
    return {
      status: 'expiring_soon',
      daysRemaining: days,
      label: days === 0 ? 'Expires today' : `Expires in ${days} days`,
      color: 'warning'
    };
  }

  return {
    status: 'valid',
    daysRemaining: days,
    label: `Valid for ${days} days`,
    color: 'success'
  };
}

// ============ STRING UTILITIES ============

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

export function titleCase(text: string): string {
  return text
    .split(/[\s_-]+/)
    .map(capitalize)
    .join(' ');
}

export function formatTradeType(type: string): string {
  const mapping: Record<string, string> = {
    electrician: 'Electrician',
    plumber: 'Plumber',
    gas_engineer: 'Gas Engineer',
    roofer: 'Roofer',
    carpenter: 'Carpenter',
    builder: 'Builder',
    plasterer: 'Plasterer',
    painter_decorator: 'Painter & Decorator',
    tiler: 'Tiler',
    landscaper: 'Landscaper',
    hvac: 'HVAC Engineer',
    general_contractor: 'General Contractor',
    other: 'Other'
  };
  return mapping[type] || titleCase(type);
}

export function formatDocumentType(type: string): string {
  const mapping: Record<string, string> = {
    public_liability: 'Public Liability Insurance',
    employers_liability: "Employer's Liability Insurance",
    professional_indemnity: 'Professional Indemnity',
    gas_safe: 'Gas Safe Registration',
    niceic: 'NICEIC Certification',
    napit: 'NAPIT Certification',
    oftec: 'OFTEC Registration',
    cscs: 'CSCS Card',
    building_regulations: 'Building Regulations Approval',
    other_certification: 'Other Certification'
  };
  return mapping[type] || titleCase(type);
}

export function formatStatus(status: string): string {
  const mapping: Record<string, string> = {
    valid: 'Valid',
    expiring_soon: 'Expiring Soon',
    expired: 'Expired',
    pending_review: 'Pending Review',
    rejected: 'Rejected',
    fraud_suspected: 'Fraud Suspected',
    verified: 'Verified',
    partially_verified: 'Partially Verified',
    unverified: 'Unverified',
    suspended: 'Suspended',
    blocked: 'Blocked',
    allowed: 'Allowed',
    on_hold: 'On Hold'
  };
  return mapping[status] || titleCase(status);
}

// ============ PHONE FORMATTING ============

export function formatPhoneNumber(phone: string): string {
  // UK phone number formatting
  const cleaned = phone.replace(/\D/g, '');

  if (cleaned.startsWith('44')) {
    const number = cleaned.slice(2);
    if (number.startsWith('7')) {
      return `+44 ${number.slice(0, 4)} ${number.slice(4)}`;
    }
    return `+44 ${number.slice(0, 4)} ${number.slice(4)}`;
  }

  if (cleaned.startsWith('0')) {
    if (cleaned.startsWith('07')) {
      return `${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
    }
    return `${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
  }

  return phone;
}

export function formatWhatsAppNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    return `whatsapp:+44${cleaned.slice(1)}`;
  }
  if (cleaned.startsWith('44')) {
    return `whatsapp:+${cleaned}`;
  }
  return `whatsapp:+${cleaned}`;
}

// ============ RISK SCORE UTILITIES ============

export function getRiskScoreInfo(score: number): {
  label: string;
  color: string;
  description: string;
} {
  if (score <= 25) {
    return {
      label: 'Low Risk',
      color: 'success',
      description: 'Contractor meets all compliance requirements'
    };
  }
  if (score <= 50) {
    return {
      label: 'Medium Risk',
      color: 'warning',
      description: 'Some compliance items need attention'
    };
  }
  if (score <= 75) {
    return {
      label: 'High Risk',
      color: 'destructive',
      description: 'Multiple compliance issues detected'
    };
  }
  return {
    label: 'Critical Risk',
    color: 'destructive',
    description: 'Immediate action required'
  };
}

// ============ COVERAGE REQUIREMENTS ============

export const MINIMUM_COVERAGE_REQUIREMENTS = {
  public_liability: 200000000, // £2,000,000 in pence
  employers_liability: 1000000000, // £10,000,000 in pence
  professional_indemnity: 100000000 // £1,000,000 in pence
};

export function meetsMinimumCoverage(
  type: string,
  coverageInPence: number
): boolean {
  const minimum =
    MINIMUM_COVERAGE_REQUIREMENTS[
      type as keyof typeof MINIMUM_COVERAGE_REQUIREMENTS
    ];
  if (!minimum) return true;
  return coverageInPence >= minimum;
}

// ============ FILE UTILITIES ============

export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

export function isValidDocumentType(filename: string): boolean {
  const validExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];
  return validExtensions.includes(getFileExtension(filename));
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ============ ARRAY UTILITIES ============

export function groupBy<T, K extends string | number>(
  array: T[],
  keyFn: (item: T) => K
): Record<K, T[]> {
  return array.reduce(
    (result, item) => {
      const key = keyFn(item);
      (result[key] = result[key] || []).push(item);
      return result;
    },
    {} as Record<K, T[]>
  );
}

export function sortBy<T>(
  array: T[],
  keyFn: (item: T) => string | number | Date,
  order: 'asc' | 'desc' = 'asc'
): T[] {
  return [...array].sort((a, b) => {
    const aVal = keyFn(a);
    const bVal = keyFn(b);
    const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return order === 'asc' ? comparison : -comparison;
  });
}

// ============ DEBOUNCE/THROTTLE ============

export function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, wait);
  };
}

export function throttle<T extends (...args: Parameters<T>) => ReturnType<T>>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

// ============ ERROR HANDLING ============

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred';
}

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}
