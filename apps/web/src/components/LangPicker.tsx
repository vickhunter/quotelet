import { LANGS, LANG_NAMES, type Lang } from '../lib/aperto'

type Props = { name: string; legend: string; value: Lang | null; onChange: (l: Lang) => void; testIdPrefix?: string; className?: string; names?: Record<Lang, string> }

/** IT / DE / FR / EN as a native radio group: arrow keys move, screen readers hear the full name. */
export function LangPicker({ name, legend, value, onChange, testIdPrefix, className, names = LANG_NAMES }: Props) {
  return (
    <fieldset className={`seg-group${className ? ` ${className}` : ''}`}>
      <legend className="label">{legend}</legend>
      <div className="seg">
        {LANGS.map((l) => (
          <label key={l} className="seg-opt">
            <input type="radio" name={name} value={l} checked={value === l} aria-label={names[l]}
              data-testid={testIdPrefix ? `${testIdPrefix}-${l}` : undefined} onChange={() => onChange(l)} />
            <span aria-hidden>{l.toUpperCase()}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
