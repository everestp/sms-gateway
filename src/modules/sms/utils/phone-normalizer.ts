export interface PhoneNormalizationResult {
  raw: string;
  normalized: string;
  isValid: boolean;
}

export class PhoneNormalizer {
  static normalize(phone: string): PhoneNormalizationResult {
    const raw = (phone || "").trim();
    let cleaned = raw.replace(/\s+/g, "");

    // Strip country code prefixes
    if (cleaned.startsWith("+977")) {
      cleaned = cleaned.substring(4);
    } else if (cleaned.startsWith("977")) {
      cleaned = cleaned.substring(3);
    }

    // Must be 10 digits starting with 97 or 98
    const regex = /^(97|98)\d{8}$/;
    const isValid = regex.test(cleaned);

    return {
      raw,
      normalized: isValid ? cleaned : raw,
      isValid,
    };
  }
}
