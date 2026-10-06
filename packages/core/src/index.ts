// D-003 red phase: public API surface of @quotelet/core (design 10.2). Not implemented yet.
const todo = (name: string) => () => { throw new Error(`${name}: not implemented`); };
export const validateConfig: (input: unknown) => any = todo("validateConfig");
export const compileFormula: (src: string, fieldIds: string[]) => any = todo("compileFormula");
export const defaultAnswers: (config: any) => any = todo("defaultAnswers");
export const computeQuote: (config: any, answers: any) => any = todo("computeQuote");
export const buildWhatsAppUrl: (config: any, quote: any, lead: { name: string }) => string = todo("buildWhatsAppUrl");
export const buildMailtoUrl: (config: any, quote: any, lead: { name: string }) => string | null = todo("buildMailtoUrl");
export const encodeConfig: (config: any) => string = todo("encodeConfig");
export const decodeConfig: (s: string) => any = todo("decodeConfig");
export const listTemplates: () => { id: string; locale: string; title: string }[] = todo("listTemplates");
export const getTemplate: (id: string) => any = todo("getTemplate");
