// Helpers to keep jsPDF (helvetica = WinAnsi/latin1) from rendering
// unsupported characters (arabic, emojis, CJK…) as garbled "þ" sequences.

import type jsPDF from "jspdf";

const REPLACEMENTS: Record<string, string> = {
  "€": "EUR",
  "£": "GBP",
  "—": "-",
  "–": "-",
  "•": "-",
  "·": "-",
  "…": "...",
  "‘": "'",
  "’": "'",
  "‚": ",",
  "“": '"',
  "”": '"',
  "„": '"',
  "«": '"',
  "»": '"',
  "→": "->",
  "←": "<-",
  "©": "(c)",
  "®": "(R)",
  "™": "(TM)",
  "\u00A0": " ",
  "\u202F": " ",
  "\u2009": " ",
};

// Translittération arabe (lettres + chiffres arabes/persans) vers latin
// pour que les adresses saisies en arabe restent lisibles dans le PDF.
const ARABIC_MAP: Record<string, string> = {
  ا: "a", أ: "a", إ: "i", آ: "aa", ء: "'", ى: "a", ﻻ: "la",
  ب: "b", ت: "t", ث: "th", ج: "j", ح: "h", خ: "kh",
  د: "d", ذ: "dh", ر: "r", ز: "z", س: "s", ش: "sh",
  ص: "s", ض: "d", ط: "t", ظ: "z", ع: "'", غ: "gh",
  ف: "f", ق: "q", ك: "k", ل: "l", م: "m", ن: "n",
  ه: "h", ة: "a", و: "w", ؤ: "w", ي: "y", ئ: "y", ﻱ: "y",
  // chiffres arabes-indiens
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  // chiffres persans
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
  "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
  // ponctuation arabe
  "،": ",", "؛": ";", "؟": "?", "ـ": "-",
};

function transliterateArabic(s: string): string {
  let out = "";
  for (const ch of s) {
    out += ARABIC_MAP[ch] ?? ch;
  }
  return out;
}

export function pdfSafe(input: unknown): string {
  if (input === null || input === undefined) return "";
  let s = String(input).normalize("NFC");
  s = s.replace(
    /[€£—–•·…‘’‚“”„«»→←©®™\u00A0\u202F\u2009]/g,
    (c) => REPLACEMENTS[c] ?? c,
  );
  // Translittération de l'arabe avant filtrage Latin1
  s = transliterateArabic(s);
  // Décompose les accents puis garde la base si nécessaire
  let out = "";
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    if (code === 9 || code === 10 || code === 13 || (code >= 0x20 && code <= 0xff)) {
      out += ch;
    } else {
      // Tenter une décomposition NFD pour récupérer la lettre de base latine
      const decomposed = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      for (const dch of decomposed) {
        const dcode = dch.codePointAt(0)!;
        if (dcode >= 0x20 && dcode <= 0xff) out += dch;
      }
    }
  }
  return out;
}

function sanitizeArg(arg: unknown): unknown {
  if (typeof arg === "string") return pdfSafe(arg);
  if (Array.isArray(arg)) return arg.map((a) => (typeof a === "string" ? pdfSafe(a) : a));
  return arg;
}

/**
 * Wraps a jsPDF instance so every call to `text()` sanitizes its string args.
 * Call once right after `new jsPDF(...)`.
 */
export function installPdfSafeText(doc: jsPDF): void {
  const original = doc.text.bind(doc);
  (doc as unknown as { text: (...a: unknown[]) => unknown }).text = (
    ...args: unknown[]
  ) => {
    args[0] = sanitizeArg(args[0]);
    return (original as unknown as (...a: unknown[]) => unknown)(...args);
  };
}

/** Sanitize a 2D body array passed to autoTable. */
export function sanitizeRows(rows: (string | number)[][]): string[][] {
  return rows.map((row) => row.map((cell) => pdfSafe(cell)));
}
