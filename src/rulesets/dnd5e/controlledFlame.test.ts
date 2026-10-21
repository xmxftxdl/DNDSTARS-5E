import { expect, it } from 'vitest'
import { changeDnd5eNonmagicalFlame, dismissDnd5eFlameAlteration, expireDnd5eFlameAlterations, projectDnd5eControlledFlame, type Dnd5ePhysicalFlame } from './controlledFlame'

function flame(id = 'fire'): Dnd5ePhysicalFlame {
  return { id, magical: false, burning: true, extentFeet: 5, brightRadiusFeet: 20, dimRadiusFeet: 40, color: '#ffaa00', alterations: [] }
}
function cast(flames: Dnd5ePhysicalFlame[], actionId = 'a', worldMinute = 10) {
  return { flames, actionId, worldMinute, flameId: flames[0].id, casterId: 'caster', distanceFeet: 60, visible: true,
    change: { kind: 'illumination' as const, multiplier: 2 as const } }
}

it('expands into explicit fuel five feet away as permanent physical fire without copying temporary effects', () => {
  const source = { ...flame('source'), positionFeet: { x: 0, y: 0, z: 0 } }
  const destination = { ...flame('fuel'), burning: false, fuelAvailable: true, positionFeet: { x: 3, y: 4, z: 0 } }
  const changed = changeDnd5eNonmagicalFlame(cast([source, destination]))
  if (!changed.ok) throw Error(changed.reason)
  const input = { ...cast(changed.flames, 'expand'), spreadPathClear: true,
    change: { kind: 'spread' as const, destinationId: 'fuel' } }
  const spread = changeDnd5eNonmagicalFlame(input)
  expect(spread.ok).toBe(true)
  if (!spread.ok) throw Error(spread.reason)
  expect(spread.flames[1]).toMatchObject({ burning: true, alterations: [] })
  expect(projectDnd5eControlledFlame(spread.flames[1], 10000)).toMatchObject({ enabled: true, brightRadiusFeet: 20 })
  expect(changeDnd5eNonmagicalFlame({ ...input, flames: spread.flames })).toMatchObject({ ok: false, reason: 'invalid-flame-expansion' })
  expect(destination.burning).toBe(false)
})

it.each(['no-fuel', 'unknown-fuel', 'wall', 'far', 'same-place', 'no-position', 'magical'] as const)('rejects expansion with %s', reason => {
  const source: Dnd5ePhysicalFlame = { ...flame('source'), positionFeet: { x: 0, y: 0, z: 0 } }
  const destination: Dnd5ePhysicalFlame = { ...flame('fuel'), burning: false, fuelAvailable: true, positionFeet: { x: 5, y: 0, z: 0 } }
  if (reason === 'no-fuel') destination.fuelAvailable = false
  if (reason === 'unknown-fuel') delete destination.fuelAvailable
  if (reason === 'far') destination.positionFeet!.x = 10
  if (reason === 'same-place') destination.positionFeet!.x = 0
  if (reason === 'no-position') delete source.positionFeet
  if (reason === 'magical') destination.magical = true
  const input = { ...cast([source, destination]), spreadPathClear: reason !== 'wall', change: { kind: 'spread' as const, destinationId: 'fuel' } }
  const before = structuredClone(input)
  expect(changeDnd5eNonmagicalFlame(input)).toMatchObject({ ok: false, reason: 'invalid-flame-expansion' })
  expect(input).toEqual(before)
})
it('keeps base illumination intact and restores it at the exact hour boundary after serialization', () => {
  const original = [flame()], result = changeDnd5eNonmagicalFlame(cast(original))
  expect(result.ok).toBe(true)
  if (!result.ok) throw Error(result.reason)
  expect(original[0].alterations).toEqual([])
  const saved: Dnd5ePhysicalFlame[] = JSON.parse(JSON.stringify(result.flames))
  expect(projectDnd5eControlledFlame(saved[0], 69.99)).toMatchObject({ brightRadiusFeet: 40, dimRadiusFeet: 80 })
  expect(projectDnd5eControlledFlame(saved[0], 70)).toMatchObject({ brightRadiusFeet: 20, dimRadiusFeet: 40 })
  expect(expireDnd5eFlameAlterations(saved, 70)[0].alterations).toEqual([])
  expect(changeDnd5eNonmagicalFlame(cast(saved))).toMatchObject({ ok: false, reason: 'flame-action-already-applied' })
})
it('limits one caster across multiple flames to three effects and frees one slot on owned dismissal', () => {
  let flames = [flame('one'), flame('two')]
  for (let n = 0; n < 3; n++) {
    const result = changeDnd5eNonmagicalFlame({ ...cast(flames, `effect-${n}`), flameId: n % 2 ? 'two' : 'one' })
    if (!result.ok) throw Error(result.reason)
    flames = result.flames
  }
  expect(changeDnd5eNonmagicalFlame(cast(flames, 'fourth'))).toMatchObject({ ok: false, reason: 'flame-effect-limit' })
  expect(dismissDnd5eFlameAlteration(flames, 'other', 'effect-1', 10)).toMatchObject({ ok: false })
  const dismissed = dismissDnd5eFlameAlteration(flames, 'caster', 'effect-1', 10)
  if (!dismissed.ok) throw Error(dismissed.reason)
  expect(dismissed.flames.flatMap(f => f.alterations).map(e => e.id)).toEqual(['effect-0', 'effect-2'])
  expect(changeDnd5eNonmagicalFlame(cast(dismissed.flames, 'fourth')).ok).toBe(true)
})
it('does not compound light multipliers; shape and color remain independent and extinguish clears both', () => {
  let flames = [flame()]
  for (const [actionId, change] of [
    ['z', { kind: 'illumination', multiplier: 2, color: '#ff0000' }],
    ['a', { kind: 'illumination', multiplier: 0.5 }],
    ['shape', { kind: 'shape', description: 'bird' }],
  ] as const) {
    const result = changeDnd5eNonmagicalFlame({ ...cast(flames, actionId), change })
    if (!result.ok) throw Error(result.reason)
    flames = result.flames
  }
  expect(projectDnd5eControlledFlame(flames[0], 10)).toMatchObject({ brightRadiusFeet: 10, dimRadiusFeet: 20, shape: 'bird' })
  const result = changeDnd5eNonmagicalFlame({ ...cast(flames, 'out'), change: { kind: 'extinguish' } })
  if (!result.ok) throw Error(result.reason)
  expect(result.flames[0]).toMatchObject({ burning: false, alterations: [] })
  expect(projectDnd5eControlledFlame(result.flames[0], 100)).toMatchObject({ enabled: false, brightRadiusFeet: 0 })
})
it.each(['magical', 'oversized', 'unseen', 'distant', 'duplicate'] as const)('rejects %s target before making changes', reason => {
  const input = cast([flame()]), before = structuredClone(input.flames)
  if (reason === 'magical') input.flames[0].magical = true
  if (reason === 'oversized') input.flames[0].extentFeet = 5.1
  if (reason === 'unseen') input.visible = false
  if (reason === 'distant') input.distanceFeet = 60.1
  if (reason === 'duplicate') input.flames.push(flame())
  const snapshot = structuredClone(input)
  expect(changeDnd5eNonmagicalFlame(input).ok).toBe(false)
  expect(input).toEqual(snapshot)
  expect(before[0].alterations).toEqual([])
})
