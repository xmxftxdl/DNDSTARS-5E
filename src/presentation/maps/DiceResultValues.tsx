import { useEffect, useRef } from 'react'

export default function DiceResultValues({ values, sides, dieSides, adoptedIndex }: {
  values: readonly number[]
  sides: number
  dieSides?: readonly number[]
  adoptedIndex?: number
}) {
  const list = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = list.current
    if (!element) return
    const scroll = (event: WheelEvent) => {
      event.stopPropagation()
      const vertical = element.scrollHeight > element.clientHeight
      const horizontal = element.scrollWidth > element.clientWidth
      if (!vertical && !horizontal) return
      event.preventDefault()
      const delta = (event.deltaY || event.deltaX) * (event.deltaMode === 1 ? 20 : event.deltaMode === 2 ? element.clientHeight : 1)
      if (vertical) element.scrollTop += delta
      else element.scrollLeft += delta
    }
    element.addEventListener('wheel', scroll, { passive: false })
    return () => element.removeEventListener('wheel', scroll)
  }, [])
  return <div ref={list} className="dice-tray-drawer__dice" aria-label="各骰点数" tabIndex={0}>
    {values.map((value, index) => {
      const die = dieSides?.[index] ?? sides
      const adopted = index === adoptedIndex
      return <span key={index} data-die-sides={die} data-adopted={adopted || undefined}
        style={{ position: 'relative' }}
        className={`dice-tray-drawer__die dice-result-value${adopted ? ' dice-tray-drawer__die--adopted' : ''}`}
        title={`D${die} · ${value}`} aria-label={`D${die}：${value}${adopted ? '，采用' : ''}`}>
        <small className="dice-result-value__type">D{die}</small><strong>{value}</strong>
        {adopted && <small className="dice-adopted-corner" aria-label="采用">✓</small>}
      </span>
    })}
  </div>
}
