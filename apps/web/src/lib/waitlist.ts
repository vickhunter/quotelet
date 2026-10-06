export const WAITLIST_ENDPOINT =
  (import.meta as any).env?.VITE_WAITLIST_ENDPOINT ?? 'https://formsubmit.co/ajax/8f91396bf59826015938c63f6a84e8b4'

export const isValidEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim())

type Opts = { endpoint?: string; fetchImpl?: (url: string, init: RequestInit) => Promise<Response> }

export async function submitWaitlist(email: string, source: string, opts: Opts = {}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isValidEmail(email)) return { ok: false, error: 'Check the email address.' }
  const doFetch = opts.fetchImpl ?? ((u, i) => fetch(u, i))
  try {
    const res = await doFetch(opts.endpoint ?? WAITLIST_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email: email.trim(), source, _subject: 'quotelet waitlist', _template: 'table', _captcha: 'false' }),
    })
    const data = await res.json().catch(() => ({}))
    return res.ok && String(data.success) === 'true' ? { ok: true } : { ok: false, error: 'Could not save that. Try again in a minute.' }
  } catch {
    return { ok: false, error: 'You look offline. Try again in a minute.' }
  }
}
