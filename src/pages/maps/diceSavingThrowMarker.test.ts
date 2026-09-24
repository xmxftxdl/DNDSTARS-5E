import { describe, expect, it } from 'vitest'
import { withDiceSavingThrowMarker, type DiceSavingThrowMarker } from './diceSavingThrowMarker'

describe('dice saving throw map marker', () => {
  it('marks a monster repeat save until confirmation completes', async () => {
    let markers: DiceSavingThrowMarker[] = []
    let confirm!: (value: number) => void
    const result = withDiceSavingThrowMarker({ label: '怪影杀手·牛头人·WIS 豁免', rollKind: 'saving-throw',
      rollerTokenId: 'minotaur', update: change => { markers = change(markers) },
      roll: () => new Promise<number>(resolve => { confirm = resolve }) })
    expect(markers).toMatchObject([{ targetTokenId: 'minotaur', ability: 'wis' }])
    confirm(12)
    await expect(result).resolves.toBe(12)
    expect(markers).toEqual([])
  })
  it('cleans up cancelled saves without clearing another pending save', async () => {
    let markers: DiceSavingThrowMarker[] = []
    const update = (change: (current: DiceSavingThrowMarker[]) => DiceSavingThrowMarker[]) => { markers = change(markers) }
    let finish!: () => void
    const first = withDiceSavingThrowMarker({ label: '感知豁免', rollKind: 'saving-throw', rollerTokenId: 'first', update,
      roll: () => new Promise<void>(resolve => { finish = resolve }) })
    await expect(withDiceSavingThrowMarker({ label: 'DEX 豁免', rollKind: 'saving-throw', rollerTokenId: 'second', update,
      roll: async () => { throw new Error('cancelled') } })).rejects.toThrow('cancelled')
    expect(markers.map(m => m.targetTokenId)).toEqual(['first'])
    finish(); await first
    expect(markers).toEqual([])
  })
  it('does not mark attacks or free rolls as saving throws', async () => {
    for (const options of [{ rollKind: 'attack' }, { rollKind: 'saving-throw', freeRoll: true }]) {
      await withDiceSavingThrowMarker({ ...options, label: 'WIS', rollerTokenId: 'monster',
        update: () => { throw new Error('unexpected marker') }, roll: async () => 20 })
    }
  })
})
