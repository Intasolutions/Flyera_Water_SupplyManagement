/**
 * Validation and sanitization helpers for Indian mobile numbers and driving licenses.
 */

/**
 * Sanitizes phone input to keep ONLY numeric digits, max 10 digits.
 * Automatically cleans leading '0' (e.g. 08113900760 -> 8113900760)
 * or '+91' / '91' country code prefix if pasted.
 */
export function sanitizePhone(input: string): string {
  if (!input) return "";
  let digits = input.replace(/\D/g, "");
  
  // If user pasted 12 digits starting with '91' (country code)
  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  }
  
  // If user entered 11 digits starting with '0' (STD code prefix)
  if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  
  return digits.slice(0, 10);
}

/**
 * Checks if a string is a valid 10-digit mobile number.
 */
export function isValidPhone(phone: string): boolean {
  if (!phone) return false;
  const digits = sanitizePhone(phone);
  return digits.length === 10;
}

/**
 * Formats a 10-digit mobile number for clean display (e.g. "+91 98765 43210")
 */
export function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return "No phone";
  const clean = sanitizePhone(phone);
  if (clean.length === 10) {
    return `+91 ${clean.slice(0, 5)} ${clean.slice(5)}`;
  }
  return phone;
}

/**
 * Validates Indian Driving License number format (Optional field).
 * Returns true if empty.
 * If provided, standard DL format is 15-16 characters:
 * State Code (2 letters) + RTO Code (2 digits) + Year (4 digits) + Unique Number (7 digits)
 * Or flexible standard alphanumeric between 10 and 16 characters.
 */
export function isValidDrivingLicense(dl: string | null | undefined): boolean {
  if (!dl || !dl.trim()) return true; // Optional field!
  const cleaned = dl.trim().toUpperCase().replace(/[-\s]/g, "");
  // Minimum 10 chars, max 16 chars, starts with 2 letters
  return /^[A-Z]{2}[0-9A-Z]{8,14}$/.test(cleaned);
}
