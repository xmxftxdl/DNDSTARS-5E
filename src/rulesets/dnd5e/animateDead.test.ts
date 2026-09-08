import { describe, expect, it } from 'vitest'
import {
  dnd5eAnimateDeadAnimationCapacity,
  dnd5eAnimateDeadReassertionCapacity,
  dnd5eCreateUndeadCapacity,
  dnd5eCreateUndeadIsNight,
  normalizeDnd5eAnimateDeadDeclarationV1,
} from './animateDead'

describe('Animate Dead declarations', () => {
  it('scales animation and control capacities independently', () => {
    expect(dnd5eAnimateDeadAnimationCapacity(3)).toBe(1)
    expect(dnd5eAnimateDeadAnimationCapacity(4)).toBe(3)
    expect(dnd5eAnimateDeadAnimationCapacity(9)).toBe(13)
    expect(dnd5eAnimateDeadReassertionCapacity(3)).toBe(4)
    expect(dnd5eAnimateDeadReassertionCapacity(4)).toBe(6)
    expect(dnd5eAnimateDeadReassertionCapacity(9)).toBe(16)
  })

  it('rejects duplicate targets and mismatched remains metadata', () => {
    expect(normalizeDnd5eAnimateDeadDeclarationV1({
      schemaVersion: 1,
      mode: 'animate',
      targets: [
        { tokenId: 'bones', targetName: '骨骸堆', remainsKind: 'bone-pile' },
        { tokenId: 'bones', targetName: '骨骸堆', remainsKind: 'bone-pile' },
      ],
    })).toBeUndefined()
    expect(normalizeDnd5eAnimateDeadDeclarationV1({
      schemaVersion: 1,
      mode: 'reassert-control',
      targets: [{ tokenId: 'skeleton', targetName: '骷髅', remainsKind: 'bone-pile' }],
    })).toBeUndefined()
  })

  it('uses Create Undead type-specific upcast capacities and a strict night boundary', () => {
    expect(dnd5eCreateUndeadCapacity(6, 'ghoul')).toBe(3)
    expect(dnd5eCreateUndeadCapacity(7, 'ghoul')).toBe(4)
    expect(dnd5eCreateUndeadCapacity(8, 'ghoul')).toBe(5)
    expect(dnd5eCreateUndeadCapacity(8, 'ghast')).toBe(2)
    expect(dnd5eCreateUndeadCapacity(8, 'wight')).toBe(2)
    expect(dnd5eCreateUndeadCapacity(8, 'mummy')).toBe(0)
    expect(dnd5eCreateUndeadCapacity(9, 'ghoul')).toBe(6)
    expect(dnd5eCreateUndeadCapacity(9, 'ghast')).toBe(3)
    expect(dnd5eCreateUndeadCapacity(9, 'wight')).toBe(3)
    expect(dnd5eCreateUndeadCapacity(9, 'mummy')).toBe(2)
    expect(dnd5eCreateUndeadIsNight(5 * 60 + 59)).toBe(true)
    expect(dnd5eCreateUndeadIsNight(6 * 60)).toBe(false)
    expect(dnd5eCreateUndeadIsNight(17 * 60 + 59)).toBe(false)
    expect(dnd5eCreateUndeadIsNight(18 * 60)).toBe(true)
  })
})
