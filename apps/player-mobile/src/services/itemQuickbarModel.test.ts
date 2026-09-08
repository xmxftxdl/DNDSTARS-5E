import { describe, expect, it } from 'vitest'
import { assignMobileItemQuickbar, parseMobileItemQuickbar, reconcileMobileItemQuickbar } from './itemQuickbarModel'

describe('mobile item quickbar model', () => {
  it('keeps seven item shortcuts and reserves the eighth UI slot for the backpack', () => {
    expect(parseMobileItemQuickbar(JSON.stringify(['1', '2', '3', '4', '5', '6', '7', '8']))).toEqual(['1', '2', '3', '4', '5', '6', '7'])
  })

  it('removes consumed instances and moves an instance instead of duplicating it', () => {
    expect(reconcileMobileItemQuickbar(['potion', 'missing'], new Set(['potion']))).toEqual(['potion', '', '', '', '', '', ''])
    expect(assignMobileItemQuickbar(['potion', '', 'wand'], 2, 'potion')).toEqual(['', '', 'potion', '', '', '', ''])
  })
})
