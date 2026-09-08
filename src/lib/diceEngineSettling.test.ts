import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('dice engine settled presentation', () => {
  const source = readFileSync(new URL('./diceEngine.ts', import.meta.url), 'utf8')
  const frameSource = readFileSync(new URL('../../dice-box-frame.html', import.meta.url), 'utf8')

  it('does not skip the gather pass for a single die', () => {
    expect(source).toContain('if (dice.length < 1) return Promise.resolve()')
    expect(source).not.toContain('if (dice.length < 2) return Promise.resolve()')
  })

  it('levels the currently upper face for every non-d4 polyhedron', () => {
    expect(source).toContain('function uprightTopFaceQuaternion')
    expect(source).toContain('return uprightTopFaceQuaternion(die)')
    expect(source).not.toContain("if (die.shape !== 'd6') return current")
  })

  it('reads actual geometry group spans instead of assuming one triangle per face', () => {
    expect(source).toContain('group.start')
    expect(source).toContain('group.count')
    expect(source).toContain('groupLocalNormal(normals, groups[index], index)')
  })

  it('reports the result only after the central arrangement completes', () => {
    const arrangeIndex = frameSource.indexOf('await box.arrangeSettledDice(presentedValues)')
    const deliverIndex = frameSource.indexOf('deliver(presentedValues, false)')
    expect(arrangeIndex).toBeGreaterThan(-1)
    expect(deliverIndex).toBeGreaterThan(arrangeIndex)
  })
})
