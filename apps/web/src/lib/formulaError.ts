/** Turns a compileFormula error into one readable line that names the offending token. */
export function formulaErrorMessage(src: string, err: { pos: number; message: string }) {
  const token = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(err.pos))?.[0]
  const named = token && !err.message.includes(token) ? `${err.message}: ${token}` : err.message
  return `${named} (position ${err.pos + 1})`
}
