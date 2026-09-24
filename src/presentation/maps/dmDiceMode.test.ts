import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createDmDiceModeSelection, dmAdoptedDie, dmConfirmedFaces, type DmDiceMode } from './dmDiceMode'
import { createDmDiceConfirmationQueue } from './dmDiceConfirmationQueue'
import { SecretDiceTrayControls } from './DicePresentationOverlays'

describe('DM roll mode adjudication', () => {
  it('supplements once and keeps both dice across repeated mode switches', async () => {
    let rolls = 0
    const selection = createDmDiceModeSelection([6], 'normal', async () => { rolls++; return 18 })
    expect(await selection.change('advantage', [6])).toEqual({ mode: 'advantage', values: [6, 18] })
    expect(await selection.change('disadvantage', [6, 18])).toEqual({ mode: 'disadvantage', values: [6, 18] })
    expect(await selection.change('normal', [6, 18])).toEqual({ mode: 'normal', values: [6] })
    expect(await selection.change('advantage', [7])).toEqual({ mode: 'advantage', values: [7, 18] })
    expect(rolls).toBe(1)
  })
  it.each(['normal', 'advantage', 'disadvantage'] as DmDiceMode[])('overrides prepared %s without allowing it to select a different face', async original => {
    for (const mode of ['normal', 'advantage', 'disadvantage'] as const) {
      const count = original === 'normal' ? 1 : 2
      const faces = mode === 'normal' ? [6] : [6, 18]
      const queue = createDmDiceConfirmationQueue(async () => faces)
      const confirmed = await queue({ id: 'attack', label: '命中', targetName: '目标', sides: 20,
        visibility: 'public', values: Array(count).fill(6), check: { mode: original, kind: 'attack' },
        settleValues: values => dmConfirmedFaces(values, mode, original, count) })
      expect(dmAdoptedDie(confirmed, original)).toBe(dmAdoptedDie(faces, mode))
      expect(dmAdoptedDie(confirmed, original) + 4 >= 15).toBe(mode === 'advantage')
    }
  })
  it('retains real faces when mode is unchanged', () => {
    expect(dmConfirmedFaces([6, 18], 'advantage', 'advantage', 2)).toEqual([6, 18])
  })
  it('renders the three controls above confirmation only for supported rolls', () => {
    const confirmation = { id: 'roll', label: '豁免', targetName: '目标', sides: 20, values: [6],
      check: { mode: 'normal' as const, kind: 'save' as const }, onModeChange: async () => {} }
    const html = renderToStaticMarkup(createElement(SecretDiceTrayControls, { confirmation, onConfirm: () => {} }))
    expect(html.indexOf('优势')).toBeLessThan(html.indexOf('正常'))
    expect(html.indexOf('正常')).toBeLessThan(html.indexOf('劣势'))
    expect(html.indexOf('劣势')).toBeLessThan(html.indexOf('确认并继续'))
    const damage = renderToStaticMarkup(createElement(SecretDiceTrayControls, {
      confirmation: { id: 'damage', label: '伤害', targetName: '', sides: 6, values: [3] }, onConfirm: () => {} }))
    expect(damage).not.toContain('DM 投掷模式')
  })
})
