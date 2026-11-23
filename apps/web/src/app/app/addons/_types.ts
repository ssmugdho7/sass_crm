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
