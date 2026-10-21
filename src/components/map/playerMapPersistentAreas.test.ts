import { describe, expect, it } from 'vitest'
import type { BattleMap, Dnd5ePluginArea, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { createDnd5eMechanicalEffect } from '../../rulesets/dnd5e/activeEffects'
import { registerDnd5eRulesPlugin } from '../../rulesets/dnd5e/pluginApi'
import { ensureDnd5eCoreSpellActivitiesRegisteredV1 } from '../../rulesets/dnd5e/activities/dnd5eCoreSpellActivities'
import {
  mapTokenGrantedActivityControls,
  playerMapGrantedActivityControls,
  playerMovementFirstAreaCheckpoint,
  playerMovementEntersStoppingArea,
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
  it('identifies each captive and remaining charges while retaining its exact control identity', () => {
    const dispose = registerDnd5eRulesPlugin({ manifest: { id: 'local.cage-ui', name: 'Cage', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
      api.registerHeadlessAction({ id: 'eyes', resolve: ({ succeed }) => succeed() })
      api.registerFeature({ id: 'effect-control.eyes', name: 'Eyes', summary: 'Test', description: 'Test', automation: 'full', action: { id: 'eyes', label: '亡者之眼', economy: 'action', targeting: { kind: 'self' } } })
    } })
    try {
      const effects = ['甲', '乙'].map((name, index) => ({ ...createDnd5eMechanicalEffect({
        id: `cage-${index}`, definitionId: 'cage', label: 'Cage', targetId: 'wizard-token',
        source: { kind: 'spell', actorId: 'wizard-token', pluginId: 'local.cage-ui' }, grantedActivities: ['eyes'],
      }), linkedTargetSnapshots: [{ actorId: `dead-${index}`, effectId: `bound-${index}`, name }],
        grantedActivityCharges: { current: 6 - index, maximum: 6, endWhenEmpty: true as const } }))
      const character = { id: 'wizard', dnd5eCombatState: { activeEffects: effects } } as unknown as Character
      expect(playerMapGrantedActivityControls(emptyMap, character)).toEqual([
        expect.objectContaining({ effectId: 'cage-0', label: '亡者之眼 · 甲 · 剩余 6/6 次' }),
        expect.objectContaining({ effectId: 'cage-1', label: '亡者之眼 · 乙 · 剩余 5/6 次' }),
      ])
      character.dnd5eCombatState!.activeEffects = effects.slice(1)
      expect(playerMapGrantedActivityControls(emptyMap, character).map(control => control.effectId)).toEqual(['cage-1'])
    } finally { dispose() }
  })
  it('shows monster-owned area controls with live grants and removes them when the area ends', () => {
    const dispose = registerDnd5eRulesPlugin({ manifest: { id: 'local.area-ui', name: 'Area', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
      api.registerHeadlessAction({ id: 'dismiss', resolve: ({ succeed }) => succeed() })
      api.registerFeature({ id: 'area-control.dismiss', name: 'Dismiss', summary: 'Test', description: 'Test', automation: 'full', action: { id: 'dismiss', label: 'Dismiss', economy: 'bonusAction', targeting: { kind: 'self' } } })
    } })
    try {
      const monster: Token = { id: 'monster', label: 'Monster', type: 'enemy', x: 25, y: 25, size: 1, color: '', emoji: '' }
      const area: Dnd5ePluginArea = { ...greaseArea(), id: 'aura', pluginId: 'local.area-ui', sourceCharacterId: monster.id, sourceTokenId: monster.id, grantedActivities: [{ activityId: 'dismiss' }] }
      const map = { ...emptyMap, tokens: [monster], dnd5ePluginAreas: [area] }
      expect(mapTokenGrantedActivityControls(monster, map)).toEqual([expect.objectContaining({ areaId: 'aura', featureId: 'local.area-ui:area-control.dismiss', targeting: 'self', economy: 'bonus-action' })])
      expect(mapTokenGrantedActivityControls(monster, { ...map, dnd5ePluginAreas: [] })).toEqual([])
      expect(mapTokenGrantedActivityControls(monster, { ...map, dnd5ePluginAreas: [{ ...area, sourceTokenId: 'other' }] })).toEqual([])
      expect(mapTokenGrantedActivityControls(monster, { ...map, dnd5ePluginAreas: [{ ...area, sourceCharacterId: 'dm-token:monster' }] })).toEqual([])
      expect(mapTokenGrantedActivityControls(monster, { ...map, dnd5ePluginAreas: [{ ...area, grantedActivities: [] }] })).toEqual([])
    } finally { dispose() }
  })
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
    // A caster-owned grant (for example a maintained drain) needs a creature
    // selection; its caster is not automatically the ability's counterparty.
    monster.dnd5eCombatState!.activeEffects![0].source.actorId = monster.id
    expect(mapTokenGrantedActivityControls(monster)[0]).toMatchObject({
      targeting: 'creature', sourceActorTokenId: undefined,
    })
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

describe('playerMovementEntersStoppingArea', () => {
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
    expect(playerMovementEntersStoppingArea({
      map,
      token,
      to: { x: 75, y: 25 },
      path: [{ x: 25, y: 25 }, { x: 75, y: 25 }],
      round: 1,
    })).toBe(true)
  })

  it('returns the first Grease entry cell instead of the requested destination', () => {
    expect(playerMovementFirstAreaCheckpoint({
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
    expect(playerMovementEntersStoppingArea({
      map,
      token,
      to: { x: 25, y: 25 },
      path: [{ x: 25, y: 25 }],
      round: 1,
    })).toBe(false)
    expect(playerMovementEntersStoppingArea({
      map,
      token: { ...token, x: 75, y: 25 },
      to: { x: 75, y: 25 },
      path: [{ x: 75, y: 25 }],
      round: 1,
    })).toBe(false)
  })
})
