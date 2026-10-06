export const WAITLIST_ENDPOINT =
  (import.meta as any).env?.VITE_WAITLIST_ENDPOINT ?? 'https://formsubmit.co/ajax/8f91396bf59826015938c63f6a84e8b4'

export const isValidEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim())

type Opts = { endpoint?: string; fetchImpl?: (url: string, init: RequestInit) => Promise<Response>; ref?: string }

// D-004b launch tracking: the page's ?ref= goes with the signup as "ref". Kept for the session so a
// visitor who moves around the site still carries it. Only [A-Za-z0-9._~-], at most 64 characters.
export const REF_KEY = 'quotelet:ref'
const cleanRef = (v: string | null | undefined) => (v ?? '').replace(/[^A-Za-z0-9._~-]/g, '').slice(0, 64)
export function readRef(search: string, store?: Pick<Storage, 'getItem' | 'setItem'>): string {
  const fromUrl = cleanRef(new URLSearchParams(search).get('ref'))
  try {
    if (fromUrl) store?.setItem(REF_KEY, fromUrl)
    return fromUrl || cleanRef(store?.getItem(REF_KEY))
  } catch {
    return fromUrl
  }
}

export async function submitWaitlist(email: string, source: string, opts: Opts = {}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isValidEmail(email)) return { ok: false, error: 'Check the email address.' }
  const doFetch = opts.fetchImpl ?? ((u, i) => fetch(u, i))
  try {
    const res = await doFetch(opts.endpoint ?? WAITLIST_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email: email.trim(), source, ...(opts.ref ? { ref: opts.ref } : {}), _subject: 'quotelet waitlist', _template: 'table', _captcha: 'false' }),
    })
    const data = await res.json().catch(() => ({}))
    return res.ok && String(data.success) === 'true' ? { ok: true } : { ok: false, error: 'Could not save that. Try again in a minute.' }
  } catch {
    return { ok: false, error: 'You look offline. Try again in a minute.' }
  }
}
