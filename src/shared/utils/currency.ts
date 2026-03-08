/**
 * Convert dollars to cents (integer).
 * Always use integer cents — never store or compute floats.
 */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/**
 * Convert cents to dollars string for display.
 */
export function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Format cents as a currency string.
 */
export function formatCurrency(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}

/**
 * Validate that a value is a non-negative integer (cents).
 */
export function isValidCents(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}
