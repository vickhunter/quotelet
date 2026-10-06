import type { BuilderState } from './builder'

export const DRAFT_KEY = 'quotelet:builder-draft'
const VERSION = 1
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function saveDraft(store: Store, state: BuilderState) {
  try { store.setItem(DRAFT_KEY, JSON.stringify({ version: VERSION, state })) } catch { /* private mode or quota: drafting still works */ }
}

export function loadDraft(store: Store): BuilderState | null {
  try {
    const raw = store.getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.version !== VERSION || !parsed.state?.config) return null
    return parsed.state as BuilderState
  } catch {
    return null
  }
}

export function clearDraft(store: Store) {
  try { store.removeItem(DRAFT_KEY) } catch { /* ignore */ }
}
