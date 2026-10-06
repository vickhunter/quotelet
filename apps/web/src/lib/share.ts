const trim = (origin: string) => origin.replace(/\/+$/, '')
export const shareLink = (origin: string, encoded: string) => `${trim(origin)}/q#c=${encoded}`
export const embedSnippet = (origin: string, encoded: string) =>
  `<div data-quotelet data-config="${encoded}"></div>\n<script src="${trim(origin)}/quotelet.js" defer></script>`

/** Landing developer snippet: config file + script, both on this origin (scripts/assemble.ts ships /painting.json). */
export const devSnippet = (origin: string) =>
  `<div data-quotelet data-config-url="${trim(origin)}/painting.json"></div>\n<script src="${trim(origin)}/quotelet.js" defer></script>`
