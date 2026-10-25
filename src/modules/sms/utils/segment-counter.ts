export interface SmsMetrics {
  encoding: "GSM-7" | "UNICODE";
  characterCount: number;
  segments: number;
}

export class SegmentCounter {
  // GSM 03.38 Basic Character Set
  private static readonly GSM_REGEX =
    /^[A-Za-z0-9@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ^{}\\[~\]|€ÆæßÉ !"#%&'()*+,\-./:;<=>?]*$/;

  static calculate(message: string): SmsMetrics {
    const isGsm7 = this.GSM_REGEX.test(message);
    const count = [...message].length; // Handles Unicode multi-byte characters accurately

    if (isGsm7) {
      if (count <= 160) {
        return { encoding: "GSM-7", characterCount: count, segments: 1 };
      }
      return {
        encoding: "GSM-7",
        characterCount: count,
        segments: Math.ceil(count / 153),
      };
    }

    // Any non-GSM character switches encoding to Unicode
    if (count <= 70) {
      return { encoding: "UNICODE", characterCount: count, segments: 1 };
    }
    return {
      encoding: "UNICODE",
      characterCount: count,
      segments: Math.ceil(count / 67),
    };
  }
}
