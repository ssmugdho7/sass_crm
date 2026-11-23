export type AddonField =
  | { key: string; type: "secret"; set: boolean; hint: string | null }
  | { key: string; type: string; value: string | null };

export type Addon = {
  key: string;
  name: string;
  category: string;
  description: string;
  price_monthly: number;
  permissions: string[];
  installed: boolean;
  included_in_plan: boolean;
  configurable: boolean;
  fields: AddonField[];
};

export const fieldLabel = (key: string) => key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** Help text and placeholders per add-on setting. Keyed by `${addonKey}.${fieldKey}`, falling back to the field key alone. */
export type FieldHelp = { help?: string; placeholder?: string; options?: string[] };
export const FIELD_HELP: Record<string, FieldHelp> = {
  "payment_gateway.publishable_key": { help: "Stripe Dashboard → Developers → API keys. Safe to share with browsers.", placeholder: "pk_live_… or pk_test_…" },
  "payment_gateway.secret_key": { help: "Stripe Dashboard → Developers → API keys → Secret key. Never share it.", placeholder: "sk_live_… or sk_test_…" },
  "payment_gateway.webhook_secret": { help: "Shown after you add the webhook endpoint above (Signing secret).", placeholder: "whsec_…" },
  "payment_gateway.currency": { help: "Currency your customers pay invoices in.", options: ["USD", "CAD", "GBP", "EUR", "AUD"] },
  "google_calendar.client_id": { help: "Google Cloud Console → APIs & Services → Credentials → OAuth client ID.", placeholder: "1234567890-abc.apps.googleusercontent.com" },
  "google_calendar.client_secret": { help: "Shown next to the OAuth client ID in Google Cloud Console.", placeholder: "GOCSPX-…" },
  "google_calendar.calendar_id": { help: "Leave as “primary” to use the connected account's main calendar.", placeholder: "primary" },
};
export const fieldHelp = (addon: string, field: string): FieldHelp => FIELD_HELP[`${addon}.${field}`] ?? FIELD_HELP[field] ?? {};
