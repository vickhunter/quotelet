// D-004c "no English" check: collects every string a user can see or hear on a page
// (visible text nodes, aria-label, title, placeholder, alt, document.title), walking into
// open shadow roots (the widget), and flags words from an English word list.
import type { Page } from 'playwright'
import { ENGLISH_WORDS } from '../apps/web/src/lib/englishWords.ts'

export type UiText = { source: string; text: string }

export async function collectUiText(page: Page): Promise<UiText[]> {
  return page.evaluate(() => {
    const out: { source: string; text: string }[] = [{ source: 'document.title', text: document.title }]
    const ATTRS = ['aria-label', 'title', 'placeholder', 'alt']
    const visible = (el: Element) => {
      const h = el as HTMLElement
      if (h.closest('[hidden]')) return false
      const cs = getComputedStyle(h)
      if (cs.display === 'none' || cs.visibility === 'hidden') return false
      // sr-only text counts: screen readers say it. Only display:none / hidden are skipped.
      return true
    }
    const walk = (root: Document | ShadowRoot, where: string) => {
      const els = root.querySelectorAll('*')
      for (const el of els) {
        if (el.shadowRoot) walk(el.shadowRoot, `${where} > ${el.tagName.toLowerCase()}::shadow`)
        if (['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT'].includes(el.tagName)) continue
        if (!visible(el)) continue
        for (const a of ATTRS) {
          const v = el.getAttribute(a)
          if (v) out.push({ source: `${where} ${el.tagName.toLowerCase()}[${a}]`, text: v })
        }
        for (const n of el.childNodes) {
          if (n.nodeType === Node.TEXT_NODE && n.textContent?.trim()) {
            out.push({ source: `${where} ${el.tagName.toLowerCase()}`, text: n.textContent.trim() })
          }
        }
      }
    }
    walk(document, 'page')
    return out
  })
}

export function englishIn(items: UiText[]) {
  const hits: { word: string; source: string; text: string }[] = []
  for (const it of items) {
    for (const w of it.text.toLowerCase().match(/\p{L}+/gu) ?? []) {
      if (ENGLISH_WORDS.has(w)) hits.push({ word: w, ...it })
    }
  }
  return hits
}
