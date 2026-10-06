import { UI_LANGS, translator, type BuilderLang } from '../lib/i18n'

/** IT / EN switch for the builder UI. Native radios: arrow keys move, screen readers hear the full name. */
export function UiLangSwitch({ value, onChange }: { value: BuilderLang; onChange: (l: BuilderLang) => void }) {
  const tr = translator(value)
  return (
    <fieldset className="seg-group ui-lang">
      <legend className="sr-only">{tr('ui.legend')}</legend>
      <div className="seg">
        {UI_LANGS.map((l) => (
          <label key={l} className="seg-opt">
            <input type="radio" name="ui-lang" value={l} checked={value === l} aria-label={tr(l === 'it' ? 'ui.it' : 'ui.en')}
              data-testid={`ui-lang-${l}`} onChange={() => onChange(l)} />
            <span aria-hidden>{l.toUpperCase()}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
