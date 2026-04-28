// src/hooks/useStore.ts - PARTIE 1
// src/hooks/useStore.ts
import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Product,
  Invoice,
  InvoiceItem,
  InvoiceClient,
  Company,
  CompanyInfo,
  Client,
  Payment,
  PaymentMode,
  DeliveryNote,
  CreditNote,
  loadProducts,
  saveProducts,
  loadInvoices,
  saveInvoices,
  loadCompanies,
  saveCompanies,
  loadActiveCompanyId,
  saveActiveCompanyId,
  loadClients,
  saveClients,
  loadPayments,
  savePayments,
  loadDeliveryNotes,
  saveDeliveryNotes,
  loadCreditNotes,
  saveCreditNotes,
  uid,
  nextInvoiceNumber,
  nextClientCode,
  nextDocNumber,
} from "@/lib/storage";

// --- 1. Système de synchronisation ---
const listeners = new Set<() => void>();
export const notify = () => listeners.forEach((l) => l());
export function notifyAll() { notify(); }

// --- 2. Hook Pivot : Gestion Multi-Société ---
export function useActiveCompany() {
  const [companies, setCompanies] = useState<Company[]>(() => loadCompanies());
  const [activeId, setActiveId] = useState<string>(() => loadActiveCompanyId());

  useEffect(() => {
    const l = () => {
      setCompanies(loadCompanies());
      setActiveId(loadActiveCompanyId());
    };
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  const activeCompany = useMemo(() => {
    const found = companies.find((c) => c.id === activeId);
    return found || companies[0];
  }, [companies, activeId]);

  const switchCompany = useCallback((id: string) => {
    saveActiveCompanyId(id);
    notify();
  }, []);

  const addCompany = useCallback((name: string) => {
    const all = loadCompanies();
    const newCo: Company = {
      id: uid(),
      name: name,
      settings: {
        ...all[0].settings,
        name: name,
        ice: "",
        logoDataUrl: ""
      }
    };
    saveCompanies([...all, newCo]);
    notify();
    return newCo;
  }, []);

  const updateActiveCompany = useCallback((updatedSettings: CompanyInfo) => {
    const all = loadCompanies();
    const next = all.map((c) => 
      c.id === activeId ? { ...c, name: updatedSettings.name, settings: updatedSettings } : c
    );
    saveCompanies(next);
    notify();
  }, [activeId]);

  return { companies, activeId, activeCompany, switchCompany, addCompany, updateActiveCompany };
}

// --- 3. Hook : Produits (Filtrés par société) ---
// GARDER UNIQUEMENT CETTE VERSION DE useProducts
export function useProducts() {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const { activeId } = useActiveCompany();

  useEffect(() => {
    setAllProducts(loadProducts());
    const l = () => setAllProducts(loadProducts());
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  const products = useMemo(() => 
    allProducts.filter((p) => p.companyId === activeId), 
    [allProducts, activeId]
  );

  const addProduct = useCallback((p: Omit<Product, "id" | "companyId">) => {
    const next = [...loadProducts(), { ...p, id: uid(), companyId: activeId }];
    saveProducts(next);
    notify();
  }, [activeId]);

  const updateProduct = useCallback((id: string, patch: Partial<Product>) => {
    const next = loadProducts().map((p) => (p.id === id ? { ...p, ...patch } : p));
    saveProducts(next);
    notify();
  }, []);

  const deleteProduct = useCallback((id: string) => {
    const next = loadProducts().filter((p) => p.id !== id);
    saveProducts(next);
    notify();
  }, []);

  const deleteProducts = useCallback((ids: string[]) => {
    const set = new Set(ids);
    saveProducts(loadProducts().filter((p) => !set.has(p.id)));
    notify();
  }, []);

  return { products, addProduct, updateProduct, deleteProduct, deleteProducts };
}

// --- ENSUITE VIENNENT useInvoices, useClients, etc. (Parties 2, 3, 4) ---
// src/hooks/useStore.ts - PARTIE 2

export type CreateInvoiceInput = {
  client: InvoiceClient;
  clientId?: string;
  items: { productId: string; quantity: number }[];
  number?: string;
  date?: string;
  dueDate?: string;
  paymentMethod?: string;
  tvaRate?: number;
};

export function useInvoices() {
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const { activeId } = useActiveCompany();

  useEffect(() => {
    setAllInvoices(loadInvoices());
    const l = () => setAllInvoices(loadInvoices());
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  // Filtrage des factures pour la société active
  const invoices = useMemo(() => 
    allInvoices.filter((i) => i.companyId === activeId), 
    [allInvoices, activeId]
  );

  const createInvoice = useCallback((input: CreateInvoiceInput) => {
    const products = loadProducts();

    // 1. Validation des stocks (sur l'ensemble des produits)
    for (const it of input.items) {
      const p = products.find((p) => p.id === it.productId);
      if (!p) throw new Error("Produit introuvable.");
      if (it.quantity <= 0) throw new Error(`Quantité invalide pour ${p.name}.`);
      if (it.quantity > p.quantity) {
        throw new Error(`Stock insuffisant pour "${p.name}" (disponible: ${p.quantity}L).`);
      }
    }

    // 2. Préparation des items et décrémentation stock
    const invoiceItems: InvoiceItem[] = input.items.map((it) => {
      const p = products.find((p) => p.id === it.productId)!;
      p.quantity -= it.quantity;
      return {
        productId: p.id,
        name: p.name,
        reference: p.reference,
        quantity: it.quantity,
        price: p.price,
      };
    });

    // 3. Calculs financiers
    const totalHT = invoiceItems.reduce((s, i) => s + i.price * i.quantity, 0);
    const tvaRate = input.tvaRate ?? 20;
    const tvaAmount = totalHT * (tvaRate / 100);
    const totalTTC = totalHT + tvaAmount;

    // 4. Numérotation (Filtrée par société active)
    const allExisting = loadInvoices();
    const companyExisting = allExisting.filter(i => i.companyId === activeId);
    const customNumber = input.number?.trim();
    
    if (customNumber && allExisting.some((i) => i.number === customNumber)) {
      throw new Error(`Le numéro "${customNumber}" est déjà utilisé.`);
    }

    const invoice: Invoice = {
      id: uid(),
      companyId: activeId, // Liaison à la société
      number: customNumber || nextInvoiceNumber(companyExisting),
      client: input.client.name.trim() || "Client",
      clientId: input.clientId,
      clientInfo: input.client,
      date: input.date ? new Date(input.date).toISOString() : new Date().toISOString(),
      dueDate: input.dueDate,
      paymentMethod: input.paymentMethod,
      items: invoiceItems,
      total: totalHT,
      totalHT,
      tvaRate,
      tvaAmount,
      totalTTC,
    };

    saveProducts(products);
    saveInvoices([invoice, ...allExisting]);
    notify();
    return invoice;
  }, [activeId]);

  const deleteInvoice = useCallback((id: string) => {
    saveInvoices(loadInvoices().filter((i) => i.id !== id));
    savePayments(loadPayments().filter((p) => p.invoiceId !== id));
    notify();
  }, []);

  return { invoices, createInvoice, deleteInvoice };
}

// --- Hook : Clients (Filtrés par société) ---
export function useClients() {
  const [allClients, setAllClients] = useState<Client[]>([]);
  const { activeId } = useActiveCompany();

  useEffect(() => {
    setAllClients(loadClients());
    const l = () => setAllClients(loadClients());
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  const clients = useMemo(() => 
    allClients.filter((c) => c.companyId === activeId), 
    [allClients, activeId]
  );

  const addClient = useCallback((c: Omit<Client, "id" | "code" | "companyId">) => {
    const allExisting = loadClients();
    const companyExisting = allExisting.filter(cl => cl.companyId === activeId);
    
    const newClient: Client = {
      ...c,
      id: uid(),
      companyId: activeId,
      code: nextClientCode(companyExisting),
    };
    saveClients([...allExisting, newClient]);
    notify();
    return newClient;
  }, [activeId]);

  const updateClient = useCallback((id: string, patch: Partial<Client>) => {
    const next = loadClients().map((c) => (c.id === id ? { ...c, ...patch } : c));
    saveClients(next);
    notify();
  }, []);

  const deleteClient = useCallback((id: string) => {
    const next = loadClients().filter((c) => c.id !== id);
    saveClients(next);
    notify();
  }, []);

  return { clients, addClient, updateClient, deleteClient };
}
// src/hooks/useStore.ts - PARTIE 3

export type CreatePaymentInput = {
  clientId: string;
  invoiceId: string;
  amount: number;
  date: string;
  mode: PaymentMode;
  reference?: string;
};

export function usePayments() {
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const { activeId } = useActiveCompany();

  useEffect(() => {
    setAllPayments(loadPayments());
    const l = () => setAllPayments(loadPayments());
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  const payments = useMemo(() => 
    allPayments.filter((p) => p.companyId === activeId), 
    [allPayments, activeId]
  );

  const addPayment = useCallback((p: CreatePaymentInput) => {
    if (p.amount <= 0) throw new Error("Montant invalide.");
    const newPayment: Payment = { ...p, id: uid(), companyId: activeId };
    const next = [newPayment, ...loadPayments()];
    savePayments(next);
    notify();
    return newPayment;
  }, [activeId]);

  const deletePayment = useCallback((id: string) => {
    const next = loadPayments().filter((p) => p.id !== id);
    savePayments(next);
    notify();
  }, []);

  const addPaymentBulk = useCallback((entries: CreatePaymentInput[]) => {
    const valid = entries.filter((p) => p.amount > 0);
    const created = valid.map((p) => ({ ...p, id: uid(), companyId: activeId }));
    savePayments([...created, ...loadPayments()]);
    notify();
    return created;
  }, [activeId]);

  return { payments, addPayment, addPaymentBulk, deletePayment };
}

// ============== Bons de Livraison ==============
export type CreateDeliveryNoteInput = {
  client: InvoiceClient;
  clientId?: string;
  number?: string;
  date?: string;
  items: { productId: string; quantity: number }[];
  notes?: string;
};

export function useDeliveryNotes() {
  const [allDeliveryNotes, setAllDeliveryNotes] = useState<DeliveryNote[]>([]);
  const { activeId } = useActiveCompany();

  useEffect(() => {
    setAllDeliveryNotes(loadDeliveryNotes());
    const l = () => setAllDeliveryNotes(loadDeliveryNotes());
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  const deliveryNotes = useMemo(() => 
    allDeliveryNotes.filter((b) => b.companyId === activeId), 
    [allDeliveryNotes, activeId]
  );

  const createDeliveryNote = useCallback((input: CreateDeliveryNoteInput) => {
    const products = loadProducts();
    
    // Validation stock
    for (const it of input.items) {
      const p = products.find((p) => p.id === it.productId);
      if (!p) throw new Error("Produit introuvable.");
      if (it.quantity > p.quantity) {
        throw new Error(`Stock insuffisant pour "${p.name}".`);
      }
    }

    const items: InvoiceItem[] = input.items.map((it) => {
      const p = products.find((p) => p.id === it.productId)!;
      p.quantity -= it.quantity;
      return {
        productId: p.id,
        name: p.name,
        reference: p.reference,
        quantity: it.quantity,
        price: p.price,
      };
    });

    const allExisting = loadDeliveryNotes();
    const companyExisting = allExisting.filter(b => b.companyId === activeId);
    
    const bl: DeliveryNote = {
      id: uid(),
      companyId: activeId,
      number: input.number?.trim() || nextDocNumber("BL", companyExisting),
      date: input.date ? new Date(input.date).toISOString() : new Date().toISOString(),
      clientId: input.clientId,
      clientInfo: input.client,
      client: input.client.name.trim() || "Client",
      items,
      status: "En attente",
      notes: input.notes,
    };

    saveProducts(products);
    saveDeliveryNotes([bl, ...allExisting]);
    notify();
    return bl;
  }, [activeId]);

  const transformToInvoice = useCallback((blId: string, opts?: { tvaRate?: number; paymentMethod?: string; dueDate?: string }) => {
    const blList = loadDeliveryNotes();
    const bl = blList.find((b) => b.id === blId);
    if (!bl || bl.status === "Facturé") throw new Error("BL invalide ou déjà facturé.");

    const tvaRate = opts?.tvaRate ?? 20;
    const totalHT = bl.items.reduce((s, i) => s + i.price * i.quantity, 0);
    const tvaAmount = totalHT * (tvaRate / 100);
    
    const allInvoices = loadInvoices();
    const companyInvoices = allInvoices.filter(i => i.companyId === activeId);

    const invoice: Invoice = {
      id: uid(),
      companyId: activeId,
      number: nextInvoiceNumber(companyInvoices),
      client: bl.client,
      clientId: bl.clientId,
      clientInfo: bl.clientInfo,
      date: new Date().toISOString(),
      dueDate: opts?.dueDate,
      paymentMethod: opts?.paymentMethod || "Virement",
      items: bl.items,
      total: totalHT,
      totalHT,
      tvaRate,
      tvaAmount,
      totalTTC: totalHT + tvaAmount,
    };

    saveInvoices([invoice, ...allInvoices]);
    const updatedBl = blList.map((b) =>
      b.id === blId ? { ...b, status: "Facturé" as const, invoiceId: invoice.id } : b,
    );
    saveDeliveryNotes(updatedBl);
    notify();
    return invoice;
  }, [activeId]);

  return { deliveryNotes, createDeliveryNote, transformToInvoice };
}
// src/hooks/useStore.ts - PARTIE 4

export type CreateCreditNoteInput = {
  client: InvoiceClient;
  clientId?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  number?: string;
  date?: string;
  items: { productId: string; quantity: number; price?: number; name?: string; reference?: string }[];
  tvaRate?: number;
  reason?: string;
};

export function useCreditNotes() {
  const [allCreditNotes, setAllCreditNotes] = useState<CreditNote[]>([]);
  const { activeId } = useActiveCompany();

  useEffect(() => {
    setAllCreditNotes(loadCreditNotes());
    const l = () => setAllCreditNotes(loadCreditNotes());
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  // Filtrage des avoirs pour la société active
  const creditNotes = useMemo(() => 
    allCreditNotes.filter((c) => c.companyId === activeId), 
    [allCreditNotes, activeId]
  );

  const createCreditNote = useCallback((input: CreateCreditNoteInput) => {
    if (!input.items.length) throw new Error("Ajoutez au moins un article.");
    const products = loadProducts();

    const items: InvoiceItem[] = input.items.map((it) => {
      const p = products.find((p) => p.id === it.productId);
      if (!p && !it.name) throw new Error("Produit introuvable.");
      if (it.quantity <= 0) throw new Error("Quantité invalide.");
      
      // Réintégration en stock (spécifique à l'avoir)
      if (p) p.quantity += it.quantity;
      
      return {
        productId: it.productId,
        name: it.name || p!.name,
        reference: it.reference || p?.reference || "",
        quantity: it.quantity,
        price: it.price ?? p?.price ?? 0,
      };
    });

    const totalHT = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const tvaRate = input.tvaRate ?? 20;
    const tvaAmount = totalHT * (tvaRate / 100);

    const allExisting = loadCreditNotes();
    const companyExisting = allExisting.filter(c => c.companyId === activeId);
    const customNumber = input.number?.trim();

    if (customNumber && allExisting.some((c) => c.number === customNumber)) {
      throw new Error(`Le numéro "${customNumber}" est déjà utilisé.`);
    }

    const cn: CreditNote = {
      id: uid(),
      companyId: activeId, // Liaison auto
      number: customNumber || nextDocNumber("AV", companyExisting),
      date: input.date ? new Date(input.date).toISOString() : new Date().toISOString(),
      clientId: input.clientId,
      clientInfo: input.client,
      client: input.client.name.trim() || "Client",
      invoiceId: input.invoiceId,
      invoiceNumber: input.invoiceNumber,
      items,
      totalHT,
      tvaRate,
      tvaAmount,
      totalTTC: totalHT + tvaAmount,
      reason: input.reason,
    };

    saveProducts(products);
    saveCreditNotes([cn, ...allExisting]);
    notify();
    return cn;
  }, [activeId]);

  const deleteCreditNote = useCallback((id: string) => {
    const list = loadCreditNotes();
    const cn = list.find((c) => c.id === id);
    if (cn) {
      // Annulation de la réintégration (on retire du stock)
      const products = loadProducts();
      cn.items.forEach((it) => {
        const p = products.find((p) => p.id === it.productId);
        if (p) p.quantity = Math.max(0, p.quantity - it.quantity);
      });
      saveProducts(products);
    }
    saveCreditNotes(list.filter((c) => c.id !== id));
    notify();
  }, []);

  return { creditNotes, createCreditNote, deleteCreditNote };
}