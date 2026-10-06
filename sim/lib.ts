// Shared Playwright helpers for UI/UX steps and D-004 sims. Owner: UI/UX.
import type { Locator } from 'playwright'

// Widget field helper: ql-field-<id> may be the control itself or wrap it.
export async function setField(root: Locator, id: string, value: number | boolean | { index: number }) {
  const field = root.locator(`[data-testid="ql-field-${id}"]`).first()
  const tag = await field.evaluate((el) => el.tagName.toLowerCase())
  const control = ['input', 'select'].includes(tag) ? field : field.locator('input, select').first()
  const ctag = await control.evaluate((el) => el.tagName.toLowerCase())
  const type = await control.getAttribute('type')
  if (ctag === 'select') return control.selectOption({ index: (value as { index: number }).index })
  if (type === 'checkbox') return control.setChecked(Boolean(value))
  if (type === 'radio') return field.locator('input[type=radio]').nth((value as { index: number }).index).check()
  await control.fill(String(value))
}

export const base64url = (json: unknown) => Buffer.from(JSON.stringify(json)).toString('base64url')

// Bundled Playwright chromium first; system Chrome only as a fallback (QL_CHANNEL=chrome forces it).
export async function launchBrowser() {
  const { chromium } = await import('playwright')
  if (process.env.QL_CHANNEL) return chromium.launch({ channel: process.env.QL_CHANNEL })
  try { return await chromium.launch() } catch { return chromium.launch({ channel: 'chrome' }) }
}
