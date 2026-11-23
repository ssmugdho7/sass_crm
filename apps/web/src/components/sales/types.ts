export type LineItem = { description: string; quantity: number; unit_price: number; amount?: number };

export type DocKind = "estimate" | "invoice";

export type SalesDoc = {
  id: number;
  number: string;
  status: string;
  customer_id: number;
  project_id: number | null;
  customer?: { id: number; name: string; email?: string | null; phone?: string | null; address?: string | null; city?: string | null } | null;
  project?: { id: number; name: string } | null;
  issue_date: string | null;
  expiry_date?: string | null;
  due_date?: string | null;
  items: LineItem[];
  tax_rate: number;
  subtotal: number;
  tax: number;
  total: number;
  amount_paid?: number;
  balance?: number;
  is_overdue?: boolean;
  estimate_id?: number | null;
  invoice_id?: number | null;
  notes: string | null;
  public_token: string;
};

export type Payment = { id: number; amount: number; method: string; reference: string | null; paid_at: string };

export type Paginated<T> = { data: T[]; current_page: number; last_page: number; total: number };

export const ESTIMATE_STATUSES = ["draft", "sent", "accepted", "declined"] as const;
export const INVOICE_STATUSES = ["draft", "sent", "partial", "paid", "overdue", "void"] as const;
export const PAYMENT_METHODS: Record<string, string> = { cash: "Cash", bank_transfer: "Bank transfer", check: "Check", card: "Card", stripe: "Online (Stripe)" };

/** Mirrors the server's CalculateTotals (integer cents, round half up) for live preview. */
export function calcTotals(items: LineItem[], taxRate: number) {
  const lines = items.map((i) => Math.round((Number(i.quantity) || 0) * (Number(i.unit_price) || 0)));
  const subtotal = lines.reduce((a, b) => a + b, 0);
  const tax = Math.round((subtotal * (Number(taxRate) || 0)) / 100);
  return { lines, subtotal, tax, total: subtotal + tax };
}

export const toCents = (dollars: string) => {
  const n = Number(String(dollars).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};
export const toDollars = (cents: number) => (cents / 100).toFixed(2);
