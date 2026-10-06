import { forwardRef } from 'react'
import type { ApiError } from '../lib/aperto'

export type ValidatorState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; summary: string; attempts: number; warnings: ApiError[] }
  | { kind: 'error'; attempts: number; errors: ApiError[] }

/** Validator status: one live region that says loading, green summary, or the error list. */
export const ValidatorPanel = forwardRef<HTMLDivElement, { state: ValidatorState }>(function ValidatorPanel({ state }, ref) {
  return (
    <div ref={ref} tabIndex={-1} className={`vpanel vpanel-${state.kind}`} data-testid="validator" data-state={state.kind} aria-live="polite">
      {state.kind === 'loading' && (
        <p className="vrow"><span className="spinner" aria-hidden /> Reading your prices…</p>
      )}
      {state.kind === 'ok' && (
        <>
          <p className="vrow">
            <svg className="vicon" viewBox="0 0 20 20" aria-hidden><circle cx="10" cy="10" r="10" fill="currentColor" /><path d="m5.5 10.5 3 3 6-7" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <strong data-testid="validator-summary">{state.summary}</strong>
            {state.attempts > 1 && <span className="vnote">fixed on retry</span>}
          </p>
          {state.warnings.length > 0 && (
            <ul className="vlist vwarn" aria-label="Check these">
              {state.warnings.map((w, i) => <li key={i}>{w.path && <code>{w.path}</code>} {w.message}</li>)}
            </ul>
          )}
        </>
      )}
      {state.kind === 'error' && (
        <>
          <p className="vrow">
            <svg className="vicon" viewBox="0 0 20 20" aria-hidden><circle cx="10" cy="10" r="10" fill="currentColor" /><path d="M10 5.5v5.5M10 14.2v.3" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" /></svg>
            <strong>Not a valid calculator yet</strong>
            {state.attempts > 1 && <span className="vnote">{state.attempts} attempts</span>}
          </p>
          <ul className="vlist" data-testid="validator-errors">
            {state.errors.map((e, i) => <li key={i}>{e.path && <code>{e.path}</code>} {e.message}</li>)}
          </ul>
        </>
      )}
    </div>
  )
})
