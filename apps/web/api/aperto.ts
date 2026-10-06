// H-01 (AI Engineer): Vercel Function entry for POST /api/aperto. The only AI Engineer file under
// apps/web (approved, hack-apertus-quotelet.md section 9). All logic lives in packages/aperto.
// Env (server-side only): APERTUS_BASE_URL, APERTUS_MODEL, APERTUS_API_KEY. Preview deploys only.
import { handler } from "../../../packages/aperto/src/proxy.ts";

export default { fetch: handler };
