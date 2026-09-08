import { describe, expect, it } from 'vitest'
import { mobileCombatMoveCommand, mobileItemUseCommand, mobileWeaponAttackCommand } from './mobileActionCommands'

describe('mobile Host command builders', () => {
  it('preserves the selected action for multi-action items', () => {
    expect(mobileItemUseCommand({ instanceId: 'wand-1', useActionId: 'cast-web', targetCell: { col: 4, row: 7 } })).toEqual({
      type: 'dnd5e-item-use',
      dnd5eItemUse: { instanceId: 'wand-1', useActionId: 'cast-web', targetCell: { col: 4, row: 7 } },
    })
  })

  it('keeps a descriptor option while adding player-selected attack intents', () => {
    expect(mobileWeaponAttackCommand({
      type: 'dnd5e-weapon-attack',
      dnd5eWeaponAttackOptions: { offHandAttack: true },
    }, { stunningStrike: true })).toMatchObject({
      dnd5eWeaponAttackOptions: { offHandAttack: true, stunningStrike: true },
    })
  })

  it('submits traversal, elevation and careful movement for Host validation', () => {
    expect(mobileCombatMoveCommand({ x: 100, y: 200 }, 10, {
      traversalMode: 'fly', targetElevationFeet: 35, carefulMovement: true,
    })).toEqual({
      type: 'move-token', targetPosition: { x: 100, y: 200 }, dnd5eTraversalMode: 'fly',
      targetElevationFeet: 35, dnd5eCarefulMovement: true,
    })
  })
})
