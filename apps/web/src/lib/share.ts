const trim = (origin: string) => origin.replace(/\/+$/, '')
export const shareLink = (origin: string, encoded: string) => `${trim(origin)}/q#c=${encoded}`
export const embedSnippet = (origin: string, encoded: string) =>
  `<div data-quotelet data-config="${encoded}"></div>\n<script src="${trim(origin)}/quotelet.js" defer></script>`
