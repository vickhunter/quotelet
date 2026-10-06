// @quotelet/core — public API (design 10.2). Pure TS, no DOM, zero runtime dependencies.
export { validateConfig } from "./schema.ts";
export type { ValidateResult } from "./schema.ts";
export { compileFormula } from "./formula.ts";
export type { CompileResult, CompiledFormula, FormulaError, EvalResult } from "./formula.ts";
export { defaultAnswers, computeQuote, normalizeAnswers, formatMoney, formatNumber, SWISS_GROUP } from "./quote.ts";
export { buildWhatsAppUrl, buildMailtoUrl, buildLeadMessage } from "./handoff.ts";
export { encodeConfig, decodeConfig } from "./encode.ts";
export type { DecodeResult } from "./encode.ts";
export { listTemplates, getTemplate } from "./templates.ts";
export { strings, lang } from "./i18n.ts";
export { ERRORS, errorCode, localizeError, localizeMessage, localizePath } from "./errors.ts";
export type { Answers, Config, Field, NumberField, ChoiceField, ToggleField, Quote, ValidationError } from "./types.ts";
export { LIMITS } from "./types.ts";
