// --- TYPES MÉTIER ---

export type Product = {
  id: string;
  companyId: string;
  name: string;
  reference: string;
  price: number;
  quantity: number;
  category?: string;
};

export const STOCK_THRESHOLD = 5;

export type InvoiceItem = {
  productId: string;
  name: string;
  reference: string;
  quantity: number;
  price: number;
};

export type InvoiceClient = {
  name: string;
  address?: string;
  ice?: string;
  phone?: string;
  email?: string;
};

export type Invoice = {
  id: string;
  companyId: string;
  number: string;
  client: string;
  clientId?: string;
  clientInfo?: InvoiceClient;
  date: string;
  dueDate?: string;
  paymentMethod?: string;
  items: InvoiceItem[];
  total: number;
  totalHT?: number;
  tvaRate?: number;
  tvaAmount?: number;
  totalTTC?: number;
};

export type Client = {
  id: string;
  companyId: string;
  code: string;
  name: string;
  ice: string;
  address?: string;
  phone?: string;
  email?: string;
};

export type PaymentMode = "Espèces" | "Chèque" | "Virement" | "Effet";

export type Payment = {
  id: string;
  companyId: string;
  clientId: string;
  invoiceId: string;
  amount: number;
  date: string;
  mode: PaymentMode;
  reference?: string;
};

export type CompanyInfo = {
  name: string;
  address: string;
  ice: string;
  if: string;
  rc: string;
  phone: string;
  email: string;
  logo: string;
  logoDataUrl?: string;
  cnss?: string;
  patente?: string;
  lf?: string;
  legalFooter?: string;
};

export type Company = {
  id: string;
  name: string;
  settings: CompanyInfo;
};

export type DeliveryNoteStatus = "En attente" | "Facturé";

export type DeliveryNote = {
  id: string;
  companyId: string;
  number: string;
  date: string;
  clientId?: string;
  clientInfo?: InvoiceClient;
  client: string;
  items: InvoiceItem[];
  status: DeliveryNoteStatus;
  invoiceId?: string;
  notes?: string;
};

export type CreditNote = {
  id: string;
  companyId: string;
  number: string;
  date: string;
  clientId?: string;
  clientInfo?: InvoiceClient;
  client: string;
  invoiceId?: string;
  invoiceNumber?: string;
  items: InvoiceItem[];
  totalHT: number;
  tvaRate: number;
  tvaAmount: number;
  totalTTC: number;
  reason?: string;
};

// --- CLÉS DE STOCKAGE ---
const PRODUCTS_KEY = "stockfact:products";
const INVOICES_KEY = "stockfact:invoices";
const COMPANIES_KEY = "stockfact:companies"; 
const CLIENTS_KEY = "stockfact:clients";
const PAYMENTS_KEY = "stockfact:payments";
const DELIVERY_NOTES_KEY = "stockfact:deliveryNotes";
const CREDIT_NOTES_KEY = "stockfact:creditNotes";
const ACTIVE_COMPANY_ID_KEY = "stockfact:activeCompanyId";

const isBrowser = () => typeof window !== "undefined";

// --- FONCTIONS DE CHARGEMENT / SAUVEGARDE ---

export function loadProducts(): Product[] {
  if (!isBrowser()) return [];
  try {
    return JSON.parse(localStorage.getItem(PRODUCTS_KEY) || "[]");
  } catch { return []; }
}
export function saveProducts(products: Product[]) {
  if (!isBrowser()) return;
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
}

export function loadInvoices(): Invoice[] {
  if (!isBrowser()) return [];
  try {
    return JSON.parse(localStorage.getItem(INVOICES_KEY) || "[]");
  } catch { return []; }
}
export function saveInvoices(invoices: Invoice[]) {
  if (!isBrowser()) return;
  localStorage.setItem(INVOICES_KEY, JSON.stringify(invoices));
}

export function loadClients(): Client[] {
  if (!isBrowser()) return [];
  try {
    return JSON.parse(localStorage.getItem(CLIENTS_KEY) || "[]");
  } catch { return []; }
}
export function saveClients(clients: Client[]) {
  if (!isBrowser()) return;
  localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients));
}

export function loadPayments(): Payment[] {
  if (!isBrowser()) return [];
  try {
    return JSON.parse(localStorage.getItem(PAYMENTS_KEY) || "[]");
  } catch { return []; }
}
export function savePayments(payments: Payment[]) {
  if (!isBrowser()) return;
  localStorage.setItem(PAYMENTS_KEY, JSON.stringify(payments));
}

export function loadDeliveryNotes(): DeliveryNote[] {
  if (!isBrowser()) return [];
  try {
    return JSON.parse(localStorage.getItem(DELIVERY_NOTES_KEY) || "[]");
  } catch { return []; }
}
export function saveDeliveryNotes(items: DeliveryNote[]) {
  if (!isBrowser()) return;
  localStorage.setItem(DELIVERY_NOTES_KEY, JSON.stringify(items));
}

export function loadCreditNotes(): CreditNote[] {
  if (!isBrowser()) return [];
  try {
    return JSON.parse(localStorage.getItem(CREDIT_NOTES_KEY) || "[]");
  } catch { return []; }
}
export function saveCreditNotes(items: CreditNote[]) {
  if (!isBrowser()) return;
  localStorage.setItem(CREDIT_NOTES_KEY, JSON.stringify(items));
}

// --- GESTION DES SOCIÉTÉS ---

const DEFAULT_COMPANY: Company = {
  id: "default",
  name: "Ma Première Société",
  settings: {
    name: "StockFact SARL",
    address: "Casablanca, Maroc",
    ice: "",
    if: "",
    rc: "",
    phone: "",
    email: "",
    logo: "SF",
    logoDataUrl: "",
    cnss: "",
    patente: "",
    lf: "",
    legalFooter: "",
  }
};

export function loadCompanies(): Company[] {
  if (!isBrowser()) return [DEFAULT_COMPANY];
  try {
    const raw = localStorage.getItem(COMPANIES_KEY);
    if (!raw) return [DEFAULT_COMPANY];
    const companies = JSON.parse(raw);
    return companies.length > 0 ? companies : [DEFAULT_COMPANY];
  } catch { return [DEFAULT_COMPANY]; }
}

export function saveCompanies(companies: Company[]) {
  if (!isBrowser()) return;
  localStorage.setItem(COMPANIES_KEY, JSON.stringify(companies));
}

export function loadActiveCompanyId(): string {
  if (!isBrowser()) return "default";
  return localStorage.getItem(ACTIVE_COMPANY_ID_KEY) || "default";
}

export function saveActiveCompanyId(id: string) {
  if (!isBrowser()) return;
  localStorage.setItem(ACTIVE_COMPANY_ID_KEY, id);
}

// --- UTILS & GÉNÉRATEURS ---

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function nextDocNumber(prefix: string, existing: { number: string }[]): string {
  const year = new Date().getFullYear();
  const fullPrefix = `${prefix}-${year}-`;
  const nums = existing
    .map((i) => i.number)
    .filter((n) => typeof n === "string" && n.startsWith(fullPrefix))
    .map((n) => parseInt(n.slice(fullPrefix.length), 10))
    .filter((n) => !isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${fullPrefix}${String(next).padStart(4, "0")}`;
}

export function nextInvoiceNumber(existing: Invoice[]): string {
  return nextDocNumber("FAC", existing);
}

export function nextClientCode(existing: Client[]): string {
  const prefix = "CLI-";
  const nums = existing
    .map((c) => c.code)
    .filter((c) => typeof c === "string" && c.startsWith(prefix))
    .map((c) => parseInt(c.slice(prefix.length), 10))
    .filter((n) => !isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

// --- CALCULS ---

export type InvoiceStatus = "Impayée" | "Partielle" | "Soldée";

export function invoiceTotalTTC(inv: Invoice): number {
  return inv.totalTTC ?? inv.total * 1.2;
}

export function invoicePaidAmount(inv: Invoice, payments: Payment[]): number {
  return payments
    .filter((p) => p.invoiceId === inv.id)
    .reduce((s, p) => s + p.amount, 0);
}

export function invoiceStatus(inv: Invoice, payments: Payment[]): InvoiceStatus {
  const paid = invoicePaidAmount(inv, payments);
  const ttc = invoiceTotalTTC(inv);
  if (paid <= 0.0001) return "Impayée";
  if (paid + 0.0001 < ttc) return "Partielle";
  return "Soldée";
}

// --- EXPORT ---

// Modification du type pour accepter les anciennes et nouvelles versions
export type BackupData = {
  version: number; // On passe de '3' à 'number' pour autoriser la comparaison
  exportedAt: string;
  products: Product[];
  invoices: Invoice[];
  clients: Client[];
  payments: Payment[];
  companies: Company[];
  deliveryNotes?: DeliveryNote[];
  creditNotes?: CreditNote[];
  activeCompanyId: string;
};

export function exportAll(): BackupData {
  return {
    version: 3,
    exportedAt: new Date().toISOString(),
    products: loadProducts(),
    invoices: loadInvoices(),
    clients: loadClients(),
    payments: loadPayments(),
    companies: loadCompanies(),
    deliveryNotes: loadDeliveryNotes(),
    creditNotes: loadCreditNotes(),
    activeCompanyId: loadActiveCompanyId(),
  };
}

export function importAll(data: BackupData) {
  if (!isBrowser()) return;

  // Maintenant TypeScript accepte la comparaison car version est un 'number'
  if (!data || (data.version !== 2 && data.version !== 3)) {
    throw new Error("Format de sauvegarde invalide ou version incompatible.");
  }

  saveProducts(data.products || []);
  saveInvoices(data.invoices || []);
  saveClients(data.clients || []);
  savePayments(data.payments || []);
  saveDeliveryNotes(data.deliveryNotes || []);
  saveCreditNotes(data.creditNotes || []);
  
  // Si c'est une ancienne version (v2), on crée une société par défaut
  if (data.version === 2) {
    const defaultCo = loadCompanies()[0];
    saveCompanies([defaultCo]);
    saveActiveCompanyId(defaultCo.id);
  } else {
    // Si c'est la v3, on restaure les sociétés et l'ID actif
    saveCompanies(data.companies || []);
    if (data.activeCompanyId) saveActiveCompanyId(data.activeCompanyId);
  }
}