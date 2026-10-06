import imbianchino from "../../../templates/imbianchino-it.json" with { type: "json" };
import pulizie from "../../../templates/pulizie-it.json" with { type: "json" };
import traslochi from "../../../templates/traslochi-it.json" with { type: "json" };
import painting from "../../../templates/painting-en.json" with { type: "json" };
import type { Config } from "./types.ts";

const TEMPLATES = [imbianchino, pulizie, traslochi, painting] as unknown as Config[];

export function listTemplates(): { id: string; locale: string; title: string }[] {
  return TEMPLATES.map((t) => ({ id: t.id, locale: t.locale, title: t.title }));
}

/** Returns a fresh copy of a bundled template. Throws on an unknown id. */
export function getTemplate(id: string): Config {
  const t = TEMPLATES.find((x) => x.id === id);
  if (!t) throw new Error(`Unknown template "${id}". Available: ${TEMPLATES.map((x) => x.id).join(", ")}`);
  return JSON.parse(JSON.stringify(t));
}
