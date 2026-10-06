// D-004c "no English" check: collects every string a user can see or hear on a page
// (visible text nodes, aria-label, title, placeholder, alt, document.title), walking into
// open shadow roots (the widget), and flags words from an English word list.
import type { Page } from 'playwright'
import { ENGLISH_WORDS } from '../apps/web/src/lib/englishWords.ts'

export type UiText = { source: string; text: string }

// Plain string, not a function: tsx/esbuild adds __name() helpers to functions, which do not
// exist inside the page.
const COLLECT = `(() => {
  const out = [{ source: 'document.title', text: document.title }]
  const ATTRS = ['aria-label', 'title', 'placeholder', 'alt']
  const SKIP = ['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT']
  // sr-only text counts (screen readers say it); only hidden / display:none / visibility:hidden is skipped.
  function visible(el) {
    if (el.closest('[hidden]')) return false
    const cs = getComputedStyle(el)
    return cs.display !== 'none' && cs.visibility !== 'hidden'
  }
  function walk(root, where) {
    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) walk(el.shadowRoot, where + ' > ' + el.tagName.toLowerCase() + '::shadow')
      if (SKIP.includes(el.tagName) || !visible(el)) continue
      for (const a of ATTRS) {
        const v = el.getAttribute(a)
        if (v) out.push({ source: where + ' ' + el.tagName.toLowerCase() + '[' + a + ']', text: v })
      }
      for (const n of el.childNodes) {
        if (n.nodeType === 3 && n.textContent.trim()) out.push({ source: where + ' ' + el.tagName.toLowerCase(), text: n.textContent.trim() })
      }
    }
  }
  walk(document, 'page')
  return out
})()`

export async function collectUiText(page: Page): Promise<UiText[]> {
  return page.evaluate(COLLECT) as Promise<UiText[]>
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
