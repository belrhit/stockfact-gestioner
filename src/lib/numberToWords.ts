// Conversion d'un nombre en lettres françaises (pour montant facture en MAD).
const UNITS = [
  "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
  "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize",
  "dix-sept", "dix-huit", "dix-neuf",
];
const TENS = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante", "quatre-vingt", "quatre-vingt"];

function below1000(n: number): string {
  if (n === 0) return "";
  let out = "";
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (h > 0) {
    out += h === 1 ? "cent" : `${UNITS[h]} cent${r === 0 && h > 1 ? "s" : ""}`;
    if (r > 0) out += " ";
  }
  if (r > 0) out += below100(r);
  return out;
}

function below100(n: number): string {
  if (n < 20) return UNITS[n];
  const t = Math.floor(n / 10);
  const u = n % 10;
  if (t === 7 || t === 9) {
    const base = TENS[t];
    return `${base}${u === 1 && t !== 7 && t !== 9 ? " et " : "-"}${UNITS[10 + u]}`;
  }
  let s = TENS[t];
  if (u === 1 && t !== 8) s += " et un";
  else if (u > 0) s += `-${UNITS[u]}`;
  else if (t === 8) s += "s";
  return s;
}

export function numberToFrenchWords(num: number): string {
  const n = Math.floor(Math.abs(num));
  if (n === 0) return "zéro";
  let out = "";
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  if (millions > 0) {
    out += millions === 1 ? "un million" : `${below1000(millions)} millions`;
    if (thousands > 0 || rest > 0) out += " ";
  }
  if (thousands > 0) {
    out += thousands === 1 ? "mille" : `${below1000(thousands)} mille`;
    if (rest > 0) out += " ";
  }
  if (rest > 0) out += below1000(rest);
  return out.trim();
}

/** Ex: 3600 -> "TROIS MILLE SIX CENTS DHS" */
export function montantEnLettresMAD(amount: number): string {
  const entier = Math.floor(amount);
  const cents = Math.round((amount - entier) * 100);
  let s = numberToFrenchWords(entier).toUpperCase() + " DHS";
  if (cents > 0) s += ` ET ${numberToFrenchWords(cents).toUpperCase()} CENTIMES`;
  return s;
}
