import { useEffect } from 'react'

export function useMeta(title: string, lang: 'en' | 'it' = 'en', description?: string) {
  useEffect(() => {
    document.title = title
    document.documentElement.lang = lang
    if (description) document.querySelector('meta[name=description]')?.setAttribute('content', description)
  }, [title, lang, description])
}
