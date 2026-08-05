import { describe, expect, it } from 'vitest'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import {
  PLAYER_ACTION_COMBAT_BANNER_ROUTES,
  playerActionCombatBannerName,
} from './combatBannerCoverage'

const actionTypes: SharedPlayerActionState['type'][] = [
  'end-turn', 'dnd5e-death-save', 'dnd5e-weapon-attack', 'dnd5e-fighter-feature',
  'dnd5e-class-feature', 'dnd5e-racial-action', 'dnd5e-plugin-action', 'dnd5e-item-use',
  'dnd5e-ability-check', 'dnd5e-spell-cast', 'dnd5e-persistent-area-move',
  'dnd5e-adjudicated-spell', 'dnd5e-map-interaction', 'move-token', 'disengage', 'dodge',
  'dnd5e-basic-action',
]

describe('combat banner coverage', () => {
  it('classifies every shared player action explicitly', () => {
    expect(Object.keys(PLAYER_ACTION_COMBAT_BANNER_ROUTES).sort()).toEqual([...actionTypes].sort())
    expect(Object.values(PLAYER_ACTION_COMBAT_BANNER_ROUTES)).not.toContain(undefined)
  })

  it('gives imported plugin actions a banner without an id allowlist', () => {
    const action = {
      type: 'dnd5e-plugin-action',
      dnd5ePluginAction: { featureId: 'player.custom:starfall-stance' },
    } as SharedPlayerActionState
    expect(playerActionCombatBannerName(action)).toBe('starfall stance')
  })
})
