import { useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { clearCharacterCreationDraft, readCharacterCreationDraft, writeCharacterCreationDraft } from '../../lib/characterCreationDraft'

/** Persist on input, so closing a dialog or refreshing cannot race a debounce. */
export function useCharacterCreationDraft<T extends object>(key: string | undefined, defaults: () => T) {
  const [draft, setDraft] = useState(() => {
    const initial = defaults()
    return key ? readCharacterCreationDraft(key, initial) : initial
  })
  const current = useRef(draft)
  const [saveError, setSaveError] = useState(false)
  const field = <K extends keyof T>(name: K): [T[K], Dispatch<SetStateAction<T[K]>>] => [
    draft[name],
    (value) => {
      const previous = current.current
      const next = { ...previous, [name]: typeof value === 'function'
        ? (value as (previous: T[K]) => T[K])(previous[name]) : value }
      current.current = next
      if (key) setSaveError(!writeCharacterCreationDraft(key, next))
      setDraft(next)
    },
  ]
  const clear = () => { if (key) clearCharacterCreationDraft(key) }
  return { field, saveError, clear }
}
