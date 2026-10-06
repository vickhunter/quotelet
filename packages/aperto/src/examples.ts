// Canonical example price lists (the /aperto chips + demo). APERTUS_MOCK=1 has recorded answers for
// exactly these texts (whitespace/case-insensitive), so UI/UX and BDD can run without a key.
import type { Lang } from "./types.ts";

export type Example = { id: string; lang: Lang; label: string; text: string };

export const EXAMPLES: readonly Example[] = [
  { id: "mover-lugano", lang: "de", label: "Umzug Lugano (CHF)", text: "Umzug: 45 CHF pro m³, +20 CHF pro Stockwerk ohne Lift, mindestens 300 CHF, MwSt 8.1% inklusive" },
  { id: "painter-padova", lang: "it", label: "Imbianchino Padova (EUR)", text: "Imbiancatura a Padova: 8 € al m² di pareti, soffitti oltre 3 m +20%, trattamento antimuffa 4 € al m², minimo 200 €, IVA 22% esclusa" },
  { id: "cleaner-lausanne", lang: "fr", label: "Nettoyage Lausanne (CHF)", text: "Nettoyage de fin de bail à Lausanne : 6 CHF par m², 35 CHF par fenêtre, four et frigo 80 CHF forfait, minimum 250 CHF, TVA 8.1% comprise" },
  { id: "broken-sundays", lang: "en", label: "Broken: \"a bit more on Sundays\"", text: "Gardening: 50 per hour, a bit more on Sundays" },
] as const;
