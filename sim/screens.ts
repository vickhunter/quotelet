// D-004 proof screenshots: 4 pages × mobile 375×812 and desktop 1440. Run with the local server up.
import { launchBrowser } from './lib.ts'
import { readFileSync } from 'node:fs'
import { base64url } from './lib.ts'

const BASE = process.env.QL_BASE ?? 'http://127.0.0.1:4173'
const enc = base64url(JSON.parse(readFileSync('fixtures/config-imbianchino.json', 'utf8')))
const pages = [
  ['landing', '/'],
  ['build', '/build?template=imbianchino-it'],
  ['q', `/q#c=${enc}`],
  ['it-imbiancare', '/it/quanto-costa-imbiancare'],
] as const
const sizes = [['375', { width: 375, height: 812 }, true], ['1440', { width: 1440, height: 900 }, false]] as const

const browser = await launchBrowser()
for (const [w, viewport, mobile] of sizes) {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 })
  for (const [name, path] of pages) {
    const page = await ctx.newPage()
    await page.goto(BASE + path, { waitUntil: 'networkidle' })
    await page.waitForTimeout(400)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    await page.screenshot({ path: `proof/d004-${name}-${w}.png`, fullPage: true })
    await page.screenshot({ path: `proof/d004-${name}-${w}-fold.png` })
    console.log(`${name} @${w}: overflow=${overflow}px`)
    await page.close()
  }
  await ctx.close()
}
await browser.close()
