export type NumberField = {
  id: string; type: "number"; label: string; unit?: string;
  min: number; max: number; step?: number; default?: number;
};
export type ChoiceOption = { label: string; value: number };
export type ChoiceField = { id: string; type: "choice"; label: string; options: ChoiceOption[]; default?: number };
export type ToggleField = { id: string; type: "toggle"; label: string; on: number; off: number; default?: boolean };
export type Field = NumberField | ChoiceField | ToggleField;

export type Config = {
  v: 1;
  id: string;
  locale: string;
  currency: string;
  title: string;
  business: { name: string; whatsapp?: string; email?: string };
  fields: Field[];
  formula: string;
  range?: { low: number; high: number };
  rounding?: number;
  vat?: { rate: number; pricesInclude: boolean; show: boolean };
  disclaimer?: string;
  branding?: boolean;
};

/** Answers = Record<fieldId, number | boolean> (choice = option index). */
export type Answers = Record<string, number | boolean>;

export type ValidationError = { path: string; message: string };

export type Quote = {
  pointCents: number;
  lowCents: number;
  highCents: number;
  currency: string;
  vat: { rate: number; pricesInclude: boolean; lowGrossCents: number; highGrossCents: number };
  display: { low: string; high: string; vatNote: string; lowGross: string; highGross: string };
  answers: { id: string; label: string; display: string }[];
  error: string | null;
};

export const LIMITS = {
  idPattern: /^[a-z][a-z0-9_]{0,31}$/,
  /** Config id: the 10.1 regex plus "-", because the contract's own ids ("imbianchino-it") contain a hyphen. */
  configIdPattern: /^[a-z][a-z0-9_-]{0,31}$/,
  maxFields: 12,
  maxLabel: 80,
  maxTitle: 120,
  maxFormula: 500,
  maxDisclaimer: 500,
  maxOptions: 20,
  maxEncoded: 8 * 1024,
} as const;
