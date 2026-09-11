import { expect, it } from 'vitest'
import { diceCheckOutcome, diceCheckOutcomeLabel, createDiceCheckPreview, createAttackDiceCheckPreview, previewDiceCheck } from './diceCheckOutcome'

it('previews special attacks with natural dice, critical thresholds and the selected roll mode', () => {
  const preview = createAttackDiceCheckPreview('武僧', '目标', 5, 15)
  expect(preview.evaluate(10)).toBe(true)
  expect(preview.evaluate(9)).toBe(false)
  expect(createAttackDiceCheckPreview('武僧', '目标', 30, 15).evaluate(1)).toBe(false)
  expect(createAttackDiceCheckPreview('武僧', '目标', 0, 40).evaluate(20)).toBe(true)
  expect(createAttackDiceCheckPreview('战士', '目标', 0, 40, 'normal', 19).evaluate(19)).toBe(true)
  expect(createAttackDiceCheckPreview('武僧', '目标', 5, 15, 'disadvantage').evaluate(20, 9)).toBe(false)
  expect(createAttackDiceCheckPreview('武僧', '目标', 5, 15, 'advantage').evaluate(1, 10)).toBe(true)
})

it('announces the current roll immediately and revises the same die after DM edits', () => {
  const preview = createDiceCheckPreview('attack', 'caster', 'target', value => value + 4 >= 17)
  expect(previewDiceCheck(preview, 15, 'initial').success).toBe(true)
  expect(previewDiceCheck(preview, 12, 'edited', 0).success).toBe(false)
  expect(preview.values).toEqual([12])
})

it('updates disadvantage after the second die without waiting for settlement', () => {
  const preview = createDiceCheckPreview('attack', 'caster', 'target', (a,b) => Math.min(a,b ?? a) + 4 >= 17, 'disadvantage')
  expect(previewDiceCheck(preview, 15, 'first').success).toBe(true)
  expect(previewDiceCheck(preview, 7, 'second').success).toBe(false)
})

it('uses the authoritative attack result instead of guessing from the die or AC', () => {
  const result = diceCheckOutcome({type:'attack-resolved',actorId:'caster',targetId:'target',d20:1,total:30,armorClass:10,hit:false,critical:false}, 'a', id=>id)!
  expect(diceCheckOutcomeLabel(result)).toBe('未命中')
  expect(result).not.toHaveProperty('armorClass')
  expect(diceCheckOutcomeLabel({...result,success:true})).toBe('命中')
})

it('attributes saving throws to the saving character without exposing DC', () => {
  const result = diceCheckOutcome({type:'saving-throw-resolved',targetId:'player',ability:'dex',d20:12,modifier:3,total:15,dc:16,success:false}, 's', id=>id)!
  expect(result.actorName).toBe('player')
  expect(diceCheckOutcomeLabel(result)).toBe('豁免失败')
  expect(diceCheckOutcomeLabel({...result,success:true})).toBe('豁免成功')
  expect(result).not.toHaveProperty('dc')
})
it('replaces the natural one in its original slot for a paired disadvantage reroll', () => {
  const preview = createDiceCheckPreview('attack', 'caster', 'target', (a,b) => Math.min(a,b ?? a) + 4 >= 15, 'disadvantage')
  preview.values = [15,1]
  expect(previewDiceCheck(preview, 18, 'lucky', preview.values.indexOf(1)).success).toBe(true)
  expect(preview.values).toEqual([15,18])
})
