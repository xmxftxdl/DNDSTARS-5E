import { describe, expect, it } from 'vitest'
import type { BattleMap, Dnd5ePluginArea, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { createDnd5eMechanicalEffect } from '../../rulesets/dnd5e/activeEffects'
import { ensureDnd5eCoreSpellActivitiesRegisteredV1 } from '../../rulesets/dnd5e/activities/dnd5eCoreSpellActivities'
import {
  mapTokenGrantedActivityControls,
  playerMapGrantedActivityControls,
  playerMovementFirstGreaseCheckpoint,
  playerMovementEntersGrease,
} from './playerMapPersistentAreas'

const emptyMap: BattleMap = { id: 'empty', name: 'Empty', width: 500, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [], dnd5ePluginAreas: [] }

const greaseArea = (): Dnd5ePluginArea => ({
  id: 'grease-area',
  pluginId: 'srd-5.1',
  featureId: 'srd-5.1:spell.grease',
  label: '油腻术',
  color: '#eab308',
  sourceKind: 'core-spell',
  coreSpellId: 'grease',
  sourceCharacterId: 'wizard',
  sourceTokenId: 'wizard-token',
  cells: [{ col: 1, row: 0 }],
  createdRound: 1,
  expiresAfterRound: 11,
  triggers: [{
    id: 'grease-enter',
    label: '进入油腻区域',
    timing: 'on-enter',
    oncePerRound: false,
    savingThrow: { ability: 'dex', dc: 14, onSuccess: 'none', magical: true },
    condition: { condition: 'prone', duration: { expiresAt: 'permanent' } },
  }],
})

describe('playerMapGrantedActivityControls', () => {
  it('projects a source-targeted control granted to an unlinked monster token', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const monster = {
      id: 'bandit-token', label: 'Bandit', x: 25, y: 25, color: '#fff', emoji: 'B',
      size: 1, type: 'enemy',
      dnd5eCombatState: {
        activeEffects: [createDnd5eMechanicalEffect({
          id: 'detect-thoughts-probed-instance',
          definitionId: 'activity:srd-5.1:spell:detect-thoughts:probe:detect-thoughts-probed:modifiers:0',
          label: '侦测思想·察觉深入探查',
          source: {
            kind: 'plugin', actorId: 'wizard-token', rulesId: 'spell:detect-thoughts:probe',
            pluginId: 'srd-5.1', magical: false,
          },
          targetId: 'bandit-token',
          duration: { type: 'rounds', remainingRounds: 10, tickOn: 'source-turn-end' },
          grantedActivities: ['spell:detect-thoughts:contest'],
        })],
      },
    } as Token

    expect(mapTokenGrantedActivityControls(monster)).toEqual([expect.objectContaining({
      effectId: 'detect-thoughts-probed-instance',
      sourceActorTokenId: 'wizard-token',
      featureId: 'srd-5.1:effect-control.spell:detect-thoughts:contest',
      activityId: 'spell:detect-thoughts:contest',
      label: '侦测思想·反制探查',
      economy: 'action',
      targeting: 'creature',
    })])
  })

  it('projects Disguise Self dismissal to the caster and inspection to another creature', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const disguise = createDnd5eMechanicalEffect({
      id: 'disguise-self-instance',
      definitionId: 'activity:spell:disguise-self:disguise-self-appearance:modifiers:0',
      label: '易容术',
      source: {
        kind: 'spell', actorId: 'wizard-token', characterId: 'wizard',
        rulesId: 'disguise-self', pluginId: 'srd-5.1', spellLevel: 1,
        spellSaveDc: 19, magical: true,
      },
      targetId: 'wizard-token',
      duration: { type: 'rounds', remainingRounds: 600, tickOn: 'target-turn-end' },
      tags: ['illusion', 'disguise', 'appearance', 'externally-usable-activity'],
      grantedActivities: ['spell:disguise-self:dismiss', 'spell:disguise-self:inspect'],
    })
    const wizard = { id: 'wizard', dnd5eCombatState: { activeEffects: [disguise] } } as Character
    const wizardToken = {
      id: 'wizard-token', label: 'Wizard', x: 75, y: 25, color: '#fff', emoji: 'W',
      size: 1, type: 'player', characterId: 'wizard',
    } as Token
    const bandit = {
      id: 'bandit-token', label: 'Bandit', x: 25, y: 25, color: '#fff', emoji: 'B',
      size: 1, type: 'enemy',
    } as Token
    const map = { tokens: [wizardToken, bandit], dnd5ePluginAreas: [] } as unknown as BattleMap

    expect(playerMapGrantedActivityControls(map, wizard).map((control) => control.activityId))
      .toEqual(['spell:disguise-self:dismiss'])
    expect(mapTokenGrantedActivityControls(bandit, map, [wizard])).toEqual([
      expect.objectContaining({
        effectId: 'disguise-self-instance',
        sourceActorTokenId: 'wizard-token',
        activityId: 'spell:disguise-self:inspect',
        label: '易容术·调查识破 · Wizard',
        targeting: 'creature',
      }),
    ])
  })

  it('projects a core-spell effect control even when legacy combat state omitted pluginId', () => {
    const character = {
      id: 'wizard',
      dnd5eCombatState: {
        activeEffects: [createDnd5eMechanicalEffect({
          id: 'blink-return-pending-instance',
          definitionId: 'blink-return-pending',
          label: '闪现术·返回落点',
          kind: 'buff',
          source: { kind: 'spell', actorId: 'wizard', rulesId: 'blink' },
          targetId: 'wizard',
          duration: { type: 'until-turn-boundary', boundary: 'target-turn-end' },
          grantedActivities: ['spell:blink:return'],
        })],
      },
    } as Character

    expect(playerMapGrantedActivityControls(emptyMap, character))
      .toEqual([expect.objectContaining({
        effectId: 'blink-return-pending-instance',
        featureId: 'srd-5.1:effect-control.spell:blink:return',
        activityId: 'spell:blink:return',
        label: '闪现术·返回原位面',
        economy: 'none',
        targeting: 'area',
      })])
  })

  it('projects the Host-granted Shapechange form control from its concentration Effect', () => {
    const character = {
      id: 'wizard',
      dnd5eCombatState: {
        activeEffects: [createDnd5eMechanicalEffect({
          id: 'shapechange-controller-instance',
          definitionId: 'srd-5.1:shapechange-controller',
          label: '形体变化·形态控制',
          kind: 'buff',
          source: {
            kind: 'spell',
            actorId: 'wizard',
            rulesId: 'shapechange',
            pluginId: 'srd-5.1',
          },
          targetId: 'wizard',
          duration: {
            type: 'concentration',
            sourceActorId: 'wizard',
            concentrationId: 'shapechange',
          },
          grantedActivities: ['spell:shapechange:change-form'],
        })],
      },
    } as Character

    expect(playerMapGrantedActivityControls(emptyMap, character))
      .toEqual([expect.objectContaining({
        effectId: 'shapechange-controller-instance',
        featureId: 'srd-5.1:effect-control.spell:shapechange:change-form',
        activityId: 'spell:shapechange:change-form',
        label: '形体变化·改变形态',
        economy: 'action',
        targeting: 'self',
      })])
  })

  it('does not project controls granted by a suspended Effect', () => {
    const character = {
      id: 'wizard',
      dnd5eCombatState: {
        activeEffects: [createDnd5eMechanicalEffect({
          id: 'suspended-shapechange-controller',
          definitionId: 'srd-5.1:shapechange-controller',
          label: '形体变化·暂停控制',
          kind: 'buff',
          source: {
            kind: 'spell', actorId: 'wizard', rulesId: 'shapechange', pluginId: 'srd-5.1',
          },
          targetId: 'wizard',
          duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
          grantedActivities: ['spell:shapechange:change-form'],
          suspendedBy: ['transition-instance'],
        })],
      },
    } as Character

    expect(playerMapGrantedActivityControls(emptyMap, character)).toEqual([])
  })
})

describe('playerMovementEntersGrease', () => {
  const token: Token = {
    id: 'hero-token', label: 'Hero', x: 25, y: 25, color: '#fff', emoji: 'H',
    size: 1, type: 'player', characterId: 'hero',
  }
  const map = {
    id: 'map-1', name: 'Map', width: 200, height: 100, gridSize: 50,
    gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
    tokens: [token], dnd5ePluginAreas: [greaseArea()],
  } as BattleMap

  it('detects a path entering Grease before the Host asks for the Dexterity save', () => {
    expect(playerMovementEntersGrease({
      map,
      token,
      to: { x: 75, y: 25 },
      path: [{ x: 25, y: 25 }, { x: 75, y: 25 }],
      round: 1,
    })).toBe(true)
  })

  it('returns the first Grease entry cell instead of the requested destination', () => {
    expect(playerMovementFirstGreaseCheckpoint({
      map,
      token,
      to: { x: 175, y: 25 },
      path: [
        { x: 25, y: 25 },
        { x: 75, y: 25 },
        { x: 125, y: 25 },
        { x: 175, y: 25 },
      ],
      round: 1,
    })).toMatchObject({
      position: { x: 75, y: 25 },
      pathIndex: 1,
      candidate: { area: { id: 'grease-area' }, trigger: { id: 'grease-enter' } },
    })
  })

  it('does not pre-present movement that stays outside or starts inside Grease', () => {
    expect(playerMovementEntersGrease({
      map,
      token,
      to: { x: 25, y: 25 },
      path: [{ x: 25, y: 25 }],
      round: 1,
    })).toBe(false)
    expect(playerMovementEntersGrease({
      map,
      token: { ...token, x: 75, y: 25 },
      to: { x: 75, y: 25 },
      path: [{ x: 75, y: 25 }],
      round: 1,
    })).toBe(false)
  })
})
