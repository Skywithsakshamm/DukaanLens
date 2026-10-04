// Formatting utilities for Indian context (₹ Rupee, Indian Date, Quantities)

/**
 * Formats minor units (paise) into INR string: ₹120.50
 */
export function formatINR(paise: number | undefined | null, includeDecimals = true): string {
  if (paise === null || paise === undefined || isNaN(paise)) {
    return '₹0.00';
  }
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: includeDecimals ? 2 : 0,
    maximumFractionDigits: includeDecimals ? 2 : 0
  }).format(rupees);
}

/**
 * Convert rupee float/number to integer paise (minor units) safely
 */
export function toPaise(rupees: number | undefined | null): number {
  if (rupees === null || rupees === undefined || isNaN(rupees)) {
    return 0;
  }
  return Math.round(Number(rupees) * 100);
}

/**
 * Convert integer paise to rupee float
 */
export function fromPaise(paise: number | undefined | null): number {
  if (paise === null || paise === undefined || isNaN(paise)) {
    return 0;
  }
  return Number(paise) / 100;
}

/**
 * Format ISO date string into Indian standard display: "04 Oct 2026" or "04 Oct 2026, 03:30 PM"
 */
export function formatDate(dateStr: string | undefined | null, includeTime = false): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);

    const dateOptions: Intl.DateTimeFormatOptions = {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    };

    if (includeTime) {
      dateOptions.hour = '2-digit';
      dateOptions.minute = '2-digit';
      dateOptions.hour12 = true;
    }

    return new Intl.DateTimeFormat('en-IN', dateOptions).format(d);
  } catch {
    return String(dateStr);
  }
}

/**
 * Format quantity with optional unit: "50 pcs" or "10 kg"
 */
export function formatQuantity(qty: number | undefined | null, unit?: string): string {
  if (qty === null || qty === undefined || isNaN(qty)) return '0';
  const formatted = new Intl.NumberFormat('en-IN').format(qty);
  return unit ? `${formatted} ${unit}` : formatted;
}

/**
 * Clean & normalize product names for indexing and fuzzy comparison
 */
export function normalizeProductName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // remove special chars
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate Jaccard token similarity (0.0 to 1.0) between two strings
 */
export function calculateTokenSimilarity(str1: string, str2: string): number {
  const norm1 = normalizeProductName(str1);
  const norm2 = normalizeProductName(str2);

  if (!norm1 || !norm2) return 0;
  if (norm1 === norm2) return 1.0;

  const tokens1 = new Set(norm1.split(' ').filter(Boolean));
  const tokens2 = new Set(norm2.split(' ').filter(Boolean));

  const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);

  if (union.size === 0) return 0;
  return intersection.size / union.size;
}
