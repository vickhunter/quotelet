import { useState } from 'react'

/** Copy to clipboard with a textarea fallback; `copied` names the last thing copied for 1.6 s. */
export function useCopy() {
  const [copied, setCopied] = useState<string | null>(null)
  const copy = async (what: string, text: string) => {
    try { await navigator.clipboard.writeText(text) } catch {
      const ta = Object.assign(document.createElement('textarea'), { value: text })
      document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove()
    }
    setCopied(what)
    window.setTimeout(() => setCopied((c) => (c === what ? null : c)), 1600)
  }
  return { copied, copy }
}
