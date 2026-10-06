import { useEffect } from 'react'
import type { UiLang } from './i18n'

export function useMeta(title: string, lang: UiLang = 'en', description?: string) {
  useEffect(() => {
    document.title = title
    document.documentElement.lang = lang
    if (description) document.querySelector('meta[name=description]')?.setAttribute('content', description)
  }, [title, lang, description])
}
