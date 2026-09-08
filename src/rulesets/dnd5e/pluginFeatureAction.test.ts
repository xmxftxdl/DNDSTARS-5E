import { describe, expect, it } from 'vitest'
import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import { createEmptyMapGeometry, setMapGeometryRuntime } from '../../lib/mapGeometry'
import { createDnd5eMechanicalEffect } from './activeEffects'
import { ensureDnd5eCoreSpellActivitiesRegisteredV1 } from './activities/dnd5eCoreSpellActivities'
import { createDnd5eTurnEconomyCounts } from './turnEconomy'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { dnd5eHeadlessActionFromDeclarativeDraft } from './declarativePluginPackage'
import { registerDnd5eRulesPlugin } from './pluginApi'
import {
  activateDnd5ePluginSandbox,
  type Dnd5ePluginSandboxSession,
} from './pluginSandbox'
import {
  prepareDnd5ePluginFeatureAction,
  rebaseDnd5ePluginFeatureApplication,
  resolvePreparedDnd5ePluginFeatureAction,
} from './pluginFeatureAction'

const ABILITIES = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }

function character(id: string, patch: Partial<Character> = {}): Character {
  return {
    rulesetId: 'dnd5e-2014-srd-5.1',
    id,
    name: id,
    player: id,
    avatar: '🛡️',
    accent: 'from-slate-500 to-slate-700',
    race: '人类',
    charClass: '战士',
    level: 3,
    background: '士兵',
    experience: 0,
    reputation: 0,
    abilities: ABILITIES,
    savingThrows: ['str', 'con'],
    skills: [],
    maxHp: 20,
    currentHp: 20,
    tempHp: 0,
    hitDice: '1d10',
    ac: 16,
    speed: 30,
    initiativeBonus: 0,
    saveDC: 10,
    
    
    passivePerception: 10,
    inspiration: 0,
    
    
    
    
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    ...patch,
  }
}

function token(id: string, characterId: string, x: number, type: Token['type'] = 'player'): Token {
  return {
    id,
    label: id,
    x,
    y: 25,
    color: '#34d399',
    emoji: '●',
    type,
    size: 1,
    characterId,
  }
}

function action(featureId: string): SharedPlayerActionState {
  return {
    id: 'plugin-action-1',
    mapId: 'map-1',
    combatId: 'combat-1',
    sourceMode: 'player',
    status: 'pending',
    type: 'dnd5e-plugin-action',
    actorTokenId: 'hero-token',
    characterId: 'hero',
    targetTokenId: 'ally-token',
    dnd5ePluginAction: { featureId },
    round: 1,
    initiativeIndex: 0,
    seq: 1,
    updatedAt: 1,
  }
}

describe('D&D 5e plugin feature authority action', () => {
  it('authorizes a DM-controlled monster action granted by its live Detect Thoughts effect', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const featureId = 'srd-5.1:effect-control.spell:detect-thoughts:contest'
    const wizardToken = token('wizard-token', 'wizard', 75)
    const wizard = character('wizard', {
      dnd5eCombatState: {
        activeEffects: [createDnd5eMechanicalEffect({
          id: 'detect-thoughts-controller-instance',
          definitionId: 'activity:detect-thoughts:detect-thoughts-controller:modifiers:0',
          label: '侦测思想·持续读心',
          source: {
            kind: 'spell', actorId: wizardToken.id, characterId: 'wizard',
            rulesId: 'detect-thoughts', pluginId: 'srd-5.1', spellLevel: 2, magical: true,
          },
          targetId: wizardToken.id,
          duration: { type: 'concentration', sourceActorId: wizardToken.id, remainingRounds: 10 },
          grantedActivities: [
            'spell:detect-thoughts:surface',
            'spell:detect-thoughts:probe',
            'spell:detect-thoughts:search',
          ],
        })],
      },
    })
    const probed = createDnd5eMechanicalEffect({
      id: 'detect-thoughts-probed-instance',
      definitionId: 'activity:srd-5.1:spell:detect-thoughts:probe:detect-thoughts-probed:modifiers:0',
      label: '侦测思想·察觉深入探查',
      source: {
        kind: 'plugin', actorId: wizardToken.id, characterId: wizard.id,
        rulesId: 'srd-5.1:spell:detect-thoughts:probe', pluginId: 'srd-5.1', magical: false,
      },
      targetId: 'bandit-token',
      duration: { type: 'rounds', remainingRounds: 10, tickOn: 'source-turn-end' },
      grantedActivities: ['spell:detect-thoughts:contest'],
    })
    const bandit = {
      ...token('bandit-token', '', 25, 'enemy'),
      characterId: undefined,
      hp: 11,
      maxHp: 11,
      poolId: 'srd-5.1:bandit',
      dnd5eCombatState: { activeEffects: [probed] },
    } as Token
    const map: BattleMap = {
      id: 'map-1', name: 'Detect Thoughts contest', width: 500, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
      tokens: [bandit, wizardToken],
    }
    const requested: SharedPlayerActionState = {
      ...action(featureId),
      sourceMode: 'dm',
      actorTokenId: bandit.id,
      characterId: `dm-token:${bandit.id}`,
      targetTokenId: wizardToken.id,
      dnd5ePluginAction: { featureId, payload: { activeEffectId: probed.id } },
    }

    const prepared = prepareDnd5ePluginFeatureAction({
      action: requested,
      map,
      characters: [wizard],
      initiativeOrder: [
        { slotId: 'bandit-token:normal', tokenId: bandit.id, label: bandit.label, emoji: 'B', color: '#fff', roll: 20 },
        { slotId: 'wizard-token:normal', tokenId: wizardToken.id, label: wizard.name, emoji: 'W', color: '#fff', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('combat-1:1:bandit-token:normal'),
      roomRequiredPlugins: [],
    })

    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.actor.name).toBe('bandit-token')
    expect(prepared.prepared.actorToken.id).toBe(bandit.id)
    expect(prepared.prepared.targetToken.id).toBe(wizardToken.id)
    expect(prepared.prepared.headlessAction.hostEntitlement).toEqual({
      kind: 'active-effect', effectId: probed.id,
    })
  })

  it('preflights root Active Effect requirements before a monster grant opens its DM interrupt', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const featureId = 'srd-5.1:effect-control.spell:geas:violate-command'
    const wizardToken = token('wizard-token', 'wizard', 75)
    const wizard = character('wizard')
    const geas = createDnd5eMechanicalEffect({
      id: 'geas-instance',
      definitionId: 'activity:srd-5.1:spell:geas:geas-charmed:modifiers:0',
      label: '指使术',
      source: {
        kind: 'spell', actorId: wizardToken.id, characterId: wizard.id,
        rulesId: 'geas', pluginId: 'srd-5.1', spellLevel: 5, magical: true,
      },
      targetId: 'bandit-token',
      duration: { type: 'rounds', remainingRounds: 432_000, tickOn: 'target-turn-end' },
      grantedActivities: ['spell:geas:violate-command'],
    })
    const cooldown = createDnd5eMechanicalEffect({
      id: 'geas-daily-lock-instance',
      definitionId: 'activity:srd-5.1:spell:geas:violate-command:geas-daily-damage-lock:modifiers:1',
      label: '指使术·每日伤害已触发',
      source: {
        kind: 'spell', actorId: 'bandit-token', rulesId: 'geas',
        pluginId: 'srd-5.1', spellLevel: 5, magical: true,
      },
      targetId: 'bandit-token',
      duration: { type: 'rounds', remainingRounds: 14_400, tickOn: 'target-turn-end' },
    })
    const makeBandit = (activeEffects: NonNullable<Token['dnd5eCombatState']>['activeEffects']) => ({
      ...token('bandit-token', '', 25, 'enemy'),
      characterId: undefined,
      hp: 65,
      maxHp: 65,
      poolId: 'srd-5.1:bandit-captain',
      dnd5eCombatState: { activeEffects },
    } as Token)
    const request: SharedPlayerActionState = {
      ...action(featureId),
      sourceMode: 'dm',
      actorTokenId: 'bandit-token',
      characterId: 'dm-token:bandit-token',
      targetTokenId: 'bandit-token',
      dnd5ePluginAction: { featureId, payload: { activeEffectId: geas.id } },
    }
    const prepare = (bandit: Token) => prepareDnd5ePluginFeatureAction({
      action: request,
      map: {
        id: 'map-1', name: 'Geas cooldown', width: 500, height: 500,
        gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
        tokens: [bandit, wizardToken],
      },
      characters: [wizard],
      initiativeOrder: [
        { slotId: 'bandit-token:normal', tokenId: 'bandit-token', label: 'Bandit Captain', emoji: 'B', color: '#fff', roll: 20 },
        { slotId: 'wizard-token:normal', tokenId: wizardToken.id, label: wizard.name, emoji: 'W', color: '#fff', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('combat-1:1:bandit-token:normal'),
      roomRequiredPlugins: [],
    })

    const firstUse = prepare(makeBandit([geas]))
    expect(firstUse.ok, firstUse.ok ? undefined : firstUse.reason).toBe(true)
    const repeatedUse = prepare(makeBandit([geas, cooldown]))
    expect(repeatedUse).toEqual({ ok: false, reason: 'feature-unavailable' })
  })

  it('removes the caster Geas controller after dismissing the last affected target', async () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const featureId = 'srd-5.1:effect-control.spell:geas:dismiss'
    const heroToken = token('hero-token', 'hero', 25)
    const allyToken = token('ally-token', 'ally', 75)
    const controller = createDnd5eMechanicalEffect({
      id: 'geas-controller-instance',
      definitionId: 'activity:srd-5.1:spell:geas:geas-caster-controller:marker',
      label: '指使术·施法者控制',
      source: {
        kind: 'spell', actorId: heroToken.id, characterId: 'hero',
        rulesId: 'geas', pluginId: 'srd-5.1', spellLevel: 5, magical: true,
      },
      targetId: heroToken.id,
      duration: { type: 'rounds', remainingRounds: 432_000, tickOn: 'target-turn-end' },
      grantedActivities: ['spell:geas:dismiss'],
      stackingPolicy: 'stack',
    })
    const geas = createDnd5eMechanicalEffect({
      id: 'geas-target-instance',
      definitionId: 'activity:srd-5.1:spell:geas:geas-charmed',
      label: '指使术',
      source: {
        kind: 'spell', actorId: heroToken.id, characterId: 'hero',
        rulesId: 'geas', pluginId: 'srd-5.1', spellLevel: 5, magical: true,
      },
      targetId: allyToken.id,
      duration: { type: 'rounds', remainingRounds: 432_000, tickOn: 'target-turn-end' },
      grantedActivities: ['spell:geas:violate-command'],
    })
    const hero = character('hero', { dnd5eCombatState: { activeEffects: [controller] } })
    const ally = character('ally', { dnd5eCombatState: { activeEffects: [geas] } })
    const map: BattleMap = {
      id: 'map-1', name: 'Geas dismissal', width: 500, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
      tokens: [heroToken, allyToken],
    }
    const prepared = prepareDnd5ePluginFeatureAction({
      action: {
        ...action(featureId), targetTokenId: allyToken.id,
        dnd5ePluginAction: { featureId, payload: { activeEffectId: controller.id } },
      },
      map,
      characters: [hero, ally],
      initiativeOrder: [
        { slotId: 'hero-token:normal', tokenId: heroToken.id, label: hero.name, emoji: 'H', color: '#fff', roll: 20 },
        { slotId: 'ally-token:normal', tokenId: allyToken.id, label: ally.name, emoji: 'A', color: '#fff', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('combat-1:1:hero-token:normal'),
      roomRequiredPlugins: [],
    })

    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    const resolved = await resolvePreparedDnd5ePluginFeatureAction({ prepared: prepared.prepared })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.application?.characters.find((candidate) => candidate.id === ally.id)
      ?.dnd5eCombatState?.activeEffects ?? []).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: geas.id }),
    ]))
    expect(resolved.application?.characters.find((candidate) => candidate.id === hero.id)
      ?.dnd5eCombatState?.activeEffects ?? []).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: controller.id }),
    ]))
  })

  it('authorizes a monster to investigate an externally usable Disguise Self effect', async () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const featureId = 'srd-5.1:effect-control.spell:disguise-self:inspect'
    const wizardToken = token('wizard-token', 'wizard', 75)
    const disguise = createDnd5eMechanicalEffect({
      id: 'disguise-self-instance',
      definitionId: 'activity:spell:disguise-self:disguise-self-appearance:modifiers:0',
      label: '易容术',
      source: {
        kind: 'spell', actorId: wizardToken.id, characterId: 'wizard',
        rulesId: 'disguise-self', pluginId: 'srd-5.1', spellLevel: 1,
        spellSaveDc: 19, magical: true,
      },
      targetId: wizardToken.id,
      duration: { type: 'rounds', remainingRounds: 600, tickOn: 'target-turn-end' },
      tags: ['illusion', 'disguise', 'appearance', 'externally-usable-activity'],
      grantedActivities: ['spell:disguise-self:dismiss', 'spell:disguise-self:inspect'],
    })
    const wizard = character('wizard', { saveDC: 19, dnd5eCombatState: { activeEffects: [disguise] } })
    const bandit = {
      ...token('bandit-token', '', 25, 'enemy'), characterId: undefined,
      hp: 11, maxHp: 11, poolId: 'srd-5.1:bandit',
    } as Token
    const map: BattleMap = {
      id: 'map-1', name: 'Disguise inspection', width: 500, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
      tokens: [bandit, wizardToken],
    }
    const prepared = prepareDnd5ePluginFeatureAction({
      action: {
        ...action(featureId), sourceMode: 'dm', actorTokenId: bandit.id,
        characterId: `dm-token:${bandit.id}`, targetTokenId: wizardToken.id,
        dnd5ePluginAction: { featureId, payload: { activeEffectId: disguise.id } },
      },
      map, characters: [wizard],
      initiativeOrder: [
        { slotId: 'bandit-token:normal', tokenId: bandit.id, label: bandit.label, emoji: 'B', color: '#fff', roll: 20 },
        { slotId: 'wizard-token:normal', tokenId: wizardToken.id, label: wizard.name, emoji: 'W', color: '#fff', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('combat-1:1:bandit-token:normal'),
      roomRequiredPlugins: [],
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.headlessAction.hostEntitlement).toEqual({
      kind: 'active-effect', effectId: disguise.id,
    })
    const resolved = await resolvePreparedDnd5ePluginFeatureAction({
      prepared: prepared.prepared,
      rolls: {
        [`disguise-self-investigation-d20:${wizardToken.id}`]: {
          values: [20, 1], modifier: 0, total: 21,
        },
      },
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    if (!resolved.result.ok) return
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'ability-check-resolved', actorId: bandit.id, perceivedTargetId: wizardToken.id,
      total: 20, dc: 19, success: true,
    }))
  })

  it('accepts and resolves a legacy core-spell Effect grant and its empty Blink return cell', async () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const featureId = 'srd-5.1:effect-control.spell:blink:return'
    const heroToken = token('hero-token', 'hero', 25)
    const controller = createDnd5eMechanicalEffect({
      id: 'blink-return-pending-instance',
      definitionId: 'blink-return-pending',
      label: '闪现术·返回落点',
      source: { kind: 'spell', actorId: heroToken.id, rulesId: 'blink', magical: true },
      targetId: heroToken.id,
      grantedActivities: ['spell:blink:return'],
      modifiers: { speedOverrideFeet: 0 },
      duration: { type: 'until-turn-boundary', boundary: 'target-turn-end' },
    })
    const hero = character('hero', { dnd5eCombatState: { activeEffects: [controller] } })
    const map: BattleMap = {
      id: 'map-1', name: 'Blink return', width: 500, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
      tokens: [heroToken],
    }

    const prepared = prepareDnd5ePluginFeatureAction({
      action: {
        ...action(featureId),
        targetTokenId: undefined,
        targetCell: { col: 1, row: 0 },
        dnd5ePluginAction: { featureId, payload: { activeEffectId: controller.id } },
      },
      map,
      characters: [hero],
      initiativeOrder: [
        { slotId: 'hero-token:normal', tokenId: heroToken.id, label: hero.name, emoji: 'H', color: '#fff', roll: 20 },
      ],
      turnEconomy: {
        ...createDnd5eTurnEconomyCounts('combat-1:1:hero-token:normal'),
        movement: { current: 0, max: 0 },
      },
      roomRequiredPlugins: [],
    })

    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.targetCell).toEqual({ col: 1, row: 0 })
    expect(prepared.prepared.headlessAction.hostEntitlement).toEqual({
      kind: 'active-effect', effectId: controller.id,
    })
    const resolved = await resolvePreparedDnd5ePluginFeatureAction({
      prepared: prepared.prepared,
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    if (!resolved.result.ok) return
    expect(resolved.result.activityHandoffs?.movements).toContainEqual(expect.objectContaining({
      operationId: 'blink-return-teleport', targetId: heroToken.id,
      mode: 'teleport', distanceFeet: 10,
    }))
    expect(resolved.result.state.combatants[heroToken.id]?.turn.movementRemaining).toBe(30)
  })

  it('rejects an Activity control whose granting Effect is suspended', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const featureId = 'srd-5.1:effect-control.spell:tree-stride:teleport'
    const heroToken = token('hero-token', 'hero', 25)
    const controller = createDnd5eMechanicalEffect({
      id: 'suspended-tree-stride-controller',
      definitionId: 'activity:tree-stride:tree-stride-teleport:modifiers:0',
      label: '树跃术·暂停控制',
      source: {
        kind: 'spell', actorId: heroToken.id, pluginId: 'srd-5.1',
        rulesId: 'tree-stride', spellLevel: 5, magical: true,
      },
      targetId: heroToken.id,
      grantedActivities: ['spell:tree-stride:teleport'],
      suspendedBy: ['transition-instance'],
      duration: { type: 'concentration', sourceActorId: heroToken.id, remainingRounds: 10 },
    })
    const hero = character('hero', { dnd5eCombatState: { activeEffects: [controller] } })
    const map: BattleMap = {
      id: 'map-1', name: 'Suspended grant', width: 500, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
      tokens: [heroToken],
    }

    expect(prepareDnd5ePluginFeatureAction({
      action: {
        ...action(featureId),
        targetTokenId: heroToken.id,
        dnd5ePluginAction: { featureId, payload: { activeEffectId: controller.id } },
      },
      map,
      characters: [hero],
      initiativeOrder: [
        { slotId: 'hero-token:normal', tokenId: heroToken.id, label: hero.name, emoji: 'H', color: '#fff', roll: 20 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('combat-1:1:hero-token:normal'),
    })).toEqual({ ok: false, reason: 'feature-not-selected' })
  })

  it('rejects a used once-per-turn granted Activity before opening its DM interrupt', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const featureId = 'srd-5.1:effect-control.spell:tree-stride:teleport'
    const heroToken = token('hero-token', 'hero', 25)
    const controller = createDnd5eMechanicalEffect({
      definitionId: 'activity:tree-stride:tree-stride-teleport:modifiers:0',
      label: '树跃术·树跃能力',
      source: {
        kind: 'spell', actorId: heroToken.id, pluginId: 'srd-5.1',
        rulesId: 'tree-stride', spellLevel: 5, magical: true,
      },
      targetId: heroToken.id,
      grantedActivities: ['spell:tree-stride:teleport'],
      duration: { type: 'concentration', sourceActorId: heroToken.id, remainingRounds: 10 },
    })
    const hero = character('hero', {
      dnd5eCombatState: {
        activeEffects: [controller],
      },
    })
    const map: BattleMap = {
      id: 'map-1', name: 'Tree Stride once per turn', width: 500, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
      tokens: [heroToken],
    }
    const initiativeOrder: InitiativeEntry[] = [
      { slotId: 'hero-token:normal', tokenId: heroToken.id, label: hero.name, emoji: 'H', color: '#fff', roll: 20 },
    ]

    expect(prepareDnd5ePluginFeatureAction({
      action: {
        ...action(featureId),
        targetTokenId: heroToken.id,
        dnd5ePluginAction: {
          featureId,
          payload: { activeEffectId: controller.id },
        },
      },
      map,
      characters: [hero],
      initiativeOrder,
      turnEconomy: {
        ...createDnd5eTurnEconomyCounts('combat-1:1:hero-token:normal'),
        usedOncePerTurnKeys: ['tree-stride-teleport'],
      },
      roomRequiredPlugins: [],
    })).toEqual({ ok: false, reason: 'feature-already-used' })
  })

  it('keeps the captured spell DC for a spell-granted follow-up Activity', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const featureId = 'srd-5.1:effect-control.spell:magic-jar:possess'
    const heroToken = token('hero-token', 'hero', 25)
    const targetToken = token('ally-token', 'target', 75, 'enemy')
    const controller = createDnd5eMechanicalEffect({
      definitionId: 'activity:magic-jar:magic-jar-controller:modifiers:0',
      label: '魔魂壶·灵魂容器',
      source: {
        kind: 'spell', actorId: heroToken.id, pluginId: 'srd-5.1',
        rulesId: 'magic-jar', spellLevel: 6, spellSaveDc: 19, magical: true,
      },
      targetId: heroToken.id,
      grantedActivities: ['spell:magic-jar:possess', 'spell:magic-jar:return', 'spell:magic-jar:return-body'],
      duration: { type: 'permanent' },
    })
    const hero = character('hero', {
      charClass: '法师',
      level: 20,
      abilities: { ...ABILITIES, int: 20 },
      saveDC: 12,
      dnd5eCombatState: { activeEffects: [controller] },
    })
    const target = character('target')
    const map: BattleMap = {
      id: 'map-1', name: 'Magic Jar save DC', width: 500, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
      tokens: [heroToken, targetToken],
    }
    const initiativeOrder: InitiativeEntry[] = [
      { slotId: 'hero-token:normal', tokenId: heroToken.id, label: hero.name, emoji: 'H', color: '#fff', roll: 20 },
      { slotId: 'ally-token:normal', tokenId: targetToken.id, label: target.name, emoji: 'T', color: '#f00', roll: 10 },
    ]
    const prepared = prepareDnd5ePluginFeatureAction({
      action: {
        ...action(featureId),
        targetTokenId: targetToken.id,
        dnd5ePluginAction: {
          featureId,
          payload: { activeEffectId: controller.id },
        },
      },
      map,
      characters: [hero, target],
      initiativeOrder,
      roomRequiredPlugins: [],
    })

    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.state.combatants[heroToken.id].saveDc).toBe(19)
  })

  it('resolves the Instant Summons recall granted by its live controller effect with an airborne witness', async () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const featureId = 'srd-5.1:effect-control.spell:instant-summons:recall'
    const heroToken = token('hero-token', 'hero', 25)
    const controller = createDnd5eMechanicalEffect({
      definitionId: 'activity:instant-summons:instant-summons-controller:modifiers:0',
      label: '瞬间召唤·物品连结',
      source: {
        kind: 'spell', actorId: heroToken.id, pluginId: 'srd-5.1',
        rulesId: 'instant-summons', spellLevel: 6, magical: true,
      },
      targetId: heroToken.id,
      grantedActivities: ['spell:instant-summons:recall'],
      duration: { type: 'permanent' },
    })
    const recordId = `linked-planar-object:instant-summons:${heroToken.id}:knife-1`
    const secondRecordId = `linked-planar-object:instant-summons:${heroToken.id}:parchment-1`
    const hero = character('hero', {
      dnd5eCombatState: {
        activeEffects: [controller],
        spellAuthorityRecords: {
          [recordId]: {
            schemaVersion: 1,
            id: recordId,
            sourceActorId: heroToken.id,
            subjectActorId: heroToken.id,
            sourceActivityId: 'spell:instant-summons',
            createdWorldMinute: 1,
            kind: 'linked-planar-object',
            profile: 'instant-summons',
            inventoryInstanceId: 'knife-1',
            planarState: 'material',
          },
          [secondRecordId]: {
            schemaVersion: 1,
            id: secondRecordId,
            sourceActorId: heroToken.id,
            subjectActorId: heroToken.id,
            sourceActivityId: 'spell:instant-summons',
            createdWorldMinute: 2,
            kind: 'linked-planar-object',
            profile: 'instant-summons',
            inventoryInstanceId: 'parchment-1',
            spellLevel: 8,
            planarState: 'material',
          },
        },
      },
    })
    const airborneWitness: Token = {
      ...token('airborne-witness', '', 125, 'enemy'),
      characterId: undefined,
      hp: 10,
      maxHp: 10,
      elevationFeet: 10,
    }
    const map: BattleMap = {
      id: 'map-1', name: 'Instant Summons exploration', width: 600, height: 400,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
      tokens: [heroToken, airborneWitness],
    }
    const initiativeOrder: InitiativeEntry[] = [
      {
        slotId: `exploration:${heroToken.id}`, tokenId: heroToken.id,
        label: hero.name, emoji: 'H', color: '#fff', roll: 20,
      },
      {
        slotId: `exploration:${airborneWitness.id}`, tokenId: airborneWitness.id,
        label: airborneWitness.label, emoji: 'W', color: '#f00', roll: 10,
      },
    ]
    const requested: SharedPlayerActionState = {
      ...action(featureId),
      combatId: undefined,
      targetTokenId: heroToken.id,
      dnd5ePluginAction: {
        featureId,
        payload: {
          activeEffectId: controller.id,
          activitySpellAuthorityRecordId: secondRecordId,
        },
      },
    }
    const prepared = prepareDnd5ePluginFeatureAction({
      action: requested, map, characters: [hero], initiativeOrder,
      roomRequiredPlugins: [],
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    const resolved = await resolvePreparedDnd5ePluginFeatureAction({
      prepared: prepared.prepared,
      authoritativePayload: { activitySpellAuthorityRecordId: secondRecordId },
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    if (!resolved.result.ok) return
    expect(resolved.result.state.combatants[heroToken.id].classState.spellAuthorityRecords?.[recordId])
      .toBeDefined()
    expect(resolved.result.state.combatants[heroToken.id].classState.spellAuthorityRecords?.[secondRecordId])
      .toBeUndefined()
    expect(resolved.result.state.combatants[heroToken.id].classState.activeEffects?.map((effect) => effect.id))
      .toContain(controller.id)
  })

  it('authorizes an unowned Activity only while its authoritative effect grant is live', () => {
    const pluginId = 'local.effect-grant-test'
    const featureId = `${pluginId}:effect-control.levitate-control`
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: pluginId, name: 'Effect grant', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0',
      },
      setup(api) {
        api.registerFeature({
          id: 'effect-control.levitate-control', name: 'Levitate control',
          summary: 'Move a levitated target.', description: 'Effect-owned action.',
          automation: 'full',
          action: {
            id: 'levitate-control', label: 'Levitate control', economy: 'none',
            targeting: { kind: 'self' },
          },
        })
        api.registerHeadlessAction({ id: 'levitate-control', resolve: ({ succeed }) => succeed() })
      },
    })
    try {
      const activeEffect = createDnd5eMechanicalEffect({
        definitionId: 'activity:levitate-control', label: 'Levitate control',
        source: { kind: 'spell', actorId: 'hero-token', pluginId }, targetId: 'hero-token',
        grantedActivities: ['levitate-control'],
      })
      const hero = character('hero', { dnd5eCombatState: { activeEffects: [activeEffect] } })
      const heroToken = token('hero-token', hero.id, 25)
      const map: BattleMap = {
        id: 'map-1', name: 'Effect grant map', width: 600, height: 400,
        gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
        tokens: [heroToken],
      }
      const initiativeOrder: InitiativeEntry[] = [{
        slotId: 'hero-token:normal', tokenId: heroToken.id, label: hero.name,
        emoji: 'H', color: '#fff', roll: 20,
      }]
      const requested = {
        ...action(featureId),
        targetTokenId: heroToken.id,
        dnd5ePluginAction: { featureId, payload: { activeEffectId: activeEffect.id } },
      }
      const prepared = prepareDnd5ePluginFeatureAction({
        action: requested, map, characters: [hero], initiativeOrder,
      })
      expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
      if (prepared.ok) expect(prepared.prepared.headlessAction.hostEntitlement).toEqual({
        kind: 'active-effect', effectId: activeEffect.id,
      })
      expect(prepareDnd5ePluginFeatureAction({
        action: requested, map,
        characters: [{ ...hero, dnd5eCombatState: { activeEffects: [] } }], initiativeOrder,
      })).toEqual({ ok: false, reason: 'feature-not-selected' })
    } finally {
      dispose()
    }
  })

  it('authorizes an unowned Activity only through its live persistent area and derives range from the area', () => {
    const pluginId = 'local.area-grant-test'
    const featureId = `${pluginId}:area-control.vine-control`
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: pluginId, name: 'Area grant', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0',
      },
      setup(api) {
        api.registerFeature({
          id: 'area-control.vine-control', name: 'Vine control', summary: 'Vine control',
          description: 'Pull from a Host-owned area.', automation: 'full',
          action: {
            id: 'vine-control', label: 'Vine control', economy: 'bonusAction',
            targeting: { kind: 'single-creature', relation: 'enemy', rangeFeet: 30 },
          },
        })
        api.registerHeadlessAction({ id: 'vine-control', resolve: ({ succeed }) => succeed() })
      },
    })
    try {
      const hero = character('hero')
      const enemy = character('enemy')
      const heroToken = token('hero-token', hero.id, 25)
      const enemyToken = token('enemy-token', enemy.id, 325, 'enemy')
      const map: BattleMap = {
        id: 'map-1', name: 'Area grant map', width: 600, height: 400,
        gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
        tokens: [heroToken, enemyToken],
        dnd5ePluginAreas: [{
          id: 'vine-area', pluginId, featureId: 'vine-cast', label: 'Vine', color: '#166534',
          sourceCharacterId: hero.id, sourceTokenId: heroToken.id,
          cells: [{ col: 5, row: 0 }], anchorCell: { col: 5, row: 0 },
          createdRound: 1, expiresAfterRound: 10,
          grantedActivities: [{ activityId: 'vine-control', activateOnCreate: true }],
        }],
      }
      const initiativeOrder: InitiativeEntry[] = [
        { slotId: 'hero-token:normal', tokenId: heroToken.id, label: hero.name, emoji: 'H', color: '#fff', roll: 20 },
        { slotId: 'enemy-token:normal', tokenId: enemyToken.id, label: enemy.name, emoji: 'E', color: '#f00', roll: 10 },
      ]
      const requested = {
        ...action(featureId),
        targetTokenId: enemyToken.id,
        dnd5ePluginAction: { featureId, payload: { persistentAreaId: 'vine-area' } },
      }
      const prepared = prepareDnd5ePluginFeatureAction({
        action: requested,
        map,
        characters: [hero, enemy],
        initiativeOrder,
        turnEconomy: {
          turnKey: 'combat-1:1:hero-token:normal',
          attacksUsed: 0,
          action: { current: 1, max: 1 }, bonusAction: { current: 0, max: 1 },
          reaction: { current: 1, max: 1 }, movement: { current: 30, max: 30 },
        },
      })
      expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
      if (!prepared.ok) return
      expect(prepared.prepared.distanceFeet).toBe(5)
      expect(prepared.prepared.headlessAction).toMatchObject({
        hostEntitlement: { kind: 'persistent-area', areaId: 'vine-area' },
        hostWaiveActionEconomy: true,
        hostDistanceFeetByTargetId: { 'enemy-token': 5 },
      })

      const consumedMap = {
        ...map,
        dnd5ePluginAreas: map.dnd5ePluginAreas?.map((area) => ({
          ...area,
          grantedActivityUseReceipts: ['vine-control'],
        })),
      }
      expect(prepareDnd5ePluginFeatureAction({
        action: requested,
        map: consumedMap,
        characters: [hero, enemy],
        initiativeOrder,
        turnEconomy: {
          turnKey: 'combat-1:1:hero-token:normal',
          attacksUsed: 0,
          action: { current: 1, max: 1 }, bonusAction: { current: 0, max: 1 },
          reaction: { current: 1, max: 1 }, movement: { current: 30, max: 30 },
        },
      })).toEqual({ ok: false, reason: 'bonus-action-unavailable' })
    } finally {
      dispose()
    }
  })

  it('replays a Worker condition with Host-provided airborne fall dice', async () => {
    const pluginId = 'com.example.worker-airborne'
    const featureId = `${pluginId}:drop-flyer`
    const manifest = {
      id: pluginId, name: 'Worker airborne', version: '1.0.0', apiVersion: 2 as const,
      rulesetId: 'dnd5e-2014-srd-5.1' as const, publisher: 'Tests', license: 'CC0-1.0',
    }
    const feature = {
      id: 'drop-flyer', name: 'Drop Flyer', summary: 'Drop Flyer',
      description: 'Drops a non-hover flyer.', automation: 'full' as const,
      action: {
        id: 'drop-flyer', label: 'Drop Flyer', economy: 'action' as const,
        targeting: {
          kind: 'single-creature' as const,
          relation: 'enemy' as const,
          rangeFeet: 120,
        },
      },
    }
    let workerResolveCount = 0
    const session: Dnd5ePluginSandboxSession = {
      manifest,
      features: [feature],
      feats: [],
      actions: [{ id: 'drop-flyer' }],
      races: [],
      backgrounds: [],
      abilityGenerationMethods: [],
      spells: [],
      items: [],
      monsters: [],
      resources: [],
      subclasses: [],
      migrations: [],
      async resolve() {
        workerResolveCount += 1
        return {
          ok: true,
          operations: [{
            kind: 'apply-standard-condition',
            targetId: 'enemy-token',
            condition: 'prone',
            duration: { expiresAt: 'target-turn-end', remainingRounds: 1 },
          }],
        }
      },
      async migrateState(fromVersion, state) {
        return { state, fromVersion, toVersion: fromVersion }
      },
      terminate() {},
    }
    const dispose = registerDnd5eRulesPlugin(activateDnd5ePluginSandbox(session))
    try {
      const hero = character('hero', { dnd5ePluginFeatureIds: [featureId] })
      const enemy = character('enemy', { dnd5eMovementSpeeds: { fly: 60 } })
      const heroToken = token('hero-token', hero.id, 25)
      const enemyToken = {
        ...token('enemy-token', enemy.id, 125, 'enemy'),
        elevationFeet: 30,
      }
      const map: BattleMap = {
        id: 'map-1', name: 'Worker airborne map', width: 500, height: 500,
        gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
        tokens: [heroToken, enemyToken],
      }
      const initiativeOrder: InitiativeEntry[] = [
        { slotId: 'hero-token:normal', tokenId: heroToken.id, label: hero.name, emoji: 'H', color: '#fff', roll: 20 },
        { slotId: 'enemy-token:normal', tokenId: enemyToken.id, label: enemy.name, emoji: 'E', color: '#f00', roll: 10 },
      ]
      const prepared = prepareDnd5ePluginFeatureAction({
        action: { ...action(featureId), targetTokenId: enemyToken.id },
        map,
        characters: [hero, enemy],
        initiativeOrder,
      })
      expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
      if (!prepared.ok) return

      const preview = await resolvePreparedDnd5ePluginFeatureAction({
        prepared: prepared.prepared,
      })
      expect(preview.result).toMatchObject({ ok: false, reason: 'invalid-dice' })
      expect(preview.application).toBeUndefined()
      expect(preview.airborneFalls).toEqual([{
        combatantId: enemyToken.id,
        fromElevationFeet: 30,
        groundElevationFeet: 0,
        fallDistanceFeet: 30,
        fallingDamageDice: 3,
      }])

      const settled = await resolvePreparedDnd5ePluginFeatureAction({
        prepared: prepared.prepared,
        airborneFallDamageRollsByCombatantId: { [enemyToken.id]: [2, 3, 4] },
      })
      expect(settled.result.ok, settled.result.ok ? undefined : settled.result.reason).toBe(true)
      expect(settled.airborneFalls).toBeUndefined()
      expect(settled.application?.characters.find((candidate) => candidate.id === enemy.id)).toMatchObject({
        currentHp: 11,
        conditions: expect.arrayContaining(['prone']),
      })
      expect(settled.application?.map.tokens.find((candidate) => candidate.id === enemyToken.id)).toMatchObject({
        elevationFeet: 0,
      })
      expect(workerResolveCount).toBe(1)
    } finally {
      dispose()
    }
  })

  it('creates a declared summon, joins initiative, and starts concentration', async () => {
    let featureId = ''
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: 'com.example.summon', name: 'Summon', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Example', license: 'CC0-1.0',
      },
      setup(api) {
        api.registerHeadlessAction({ id: 'call-wolf', resolve: ({ succeed }) => succeed() })
        featureId = api.registerFeature({
          id: 'call-wolf', name: '召狼', summary: '召唤一只狼。', description: '测试召唤。', automation: 'full',
          action: {
            id: 'call-wolf', label: '召狼', economy: 'action',
            targeting: {
              kind: 'area', relation: 'any', maximumTargets: 1,
              template: { shape: 'circle', origin: 'point', radiusFeet: 0, placeRangeFeet: 30 },
            },
            summon: { monsterId: 'srd-5.1:wolf', durationRounds: 10, concentration: true },
          },
        })
      },
    })
    try {
      const hero = character('hero', { dnd5ePluginFeatureIds: [featureId] })
      const enemy = character('enemy')
      const map: BattleMap = {
        id: 'map-1', name: 'Summon map', width: 500, height: 500,
        gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
        tokens: [token('hero-token', hero.id, 25), token('enemy-token', enemy.id, 425, 'enemy')],
      }
      const initiativeOrder: InitiativeEntry[] = [
        { slotId: 'hero-token:normal', tokenId: 'hero-token', label: 'hero', emoji: 'H', color: '#fff', roll: 20 },
        { slotId: 'enemy-token:normal', tokenId: 'enemy-token', label: 'enemy', emoji: 'E', color: '#f00', roll: 5 },
      ]
      const prepared = prepareDnd5ePluginFeatureAction({
        action: { ...action(featureId), targetTokenId: undefined, targetCell: { col: 2, row: 0 } },
        map, characters: [hero, enemy], initiativeOrder,
      })
      expect(prepared.ok).toBe(true)
      if (!prepared.ok) return
      const resolved = await resolvePreparedDnd5ePluginFeatureAction({
        prepared: prepared.prepared,
        summonInitiativeD20: 12,
      })
      expect(resolved.result.ok ? 'ok' : resolved.result.reason).toBe('ok')
      expect(resolved.application?.map.tokens).toHaveLength(3)
      expect(resolved.application?.map.tokens[2]).toMatchObject({
        id: 'plugin-summon:plugin-action-1', poolId: 'srd-5.1:wolf',
        dnd5eSummon: { side: 'player', concentrationId: 'plugin-summon:plugin-action-1' },
      })
      expect(resolved.summonedInitiativeEntries).toEqual([
        expect.objectContaining({
          tokenId: 'plugin-summon:plugin-action-1',
          roll: 14,
          initiativeCalculation: { rolls: [12], d20: 12, modifier: 2, mode: 'normal' },
        }),
      ])
      expect(resolved.application?.characters[0]).toMatchObject({
        concentrating: true,
        dnd5eCombatState: { concentrationSpellId: 'plugin-summon:plugin-action-1' },
      })
    } finally {
      dispose()
    }
  })

  it('rebuilds area targets and creates a concentration-bound persistent map entity', async () => {
    let featureId = ''
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: 'com.example.area', name: 'Area', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Example', license: 'CC0-1.0',
      },
      setup(api) {
        api.registerHeadlessAction({ id: 'ward', resolve: ({ succeed }) => succeed() })
        featureId = api.registerFeature({
          id: 'ward', name: '守护区域', summary: '测试范围。', description: '测试范围。', automation: 'full',
          action: {
            id: 'ward', label: '放置', economy: 'action',
            targeting: {
              kind: 'area', relation: 'ally', maximumTargets: 4,
              template: { shape: 'circle', origin: 'point', radiusFeet: 5, placeRangeFeet: 30 },
            },
            persistentArea: {
              label: '守护区域', color: '#22c55e', durationRounds: 3, concentration: true,
              vertical: { mode: 'volume', heightFeet: 20 },
              visual: { preset: 'toxic-cloud', intensity: 'strong' },
            },
          },
        })
      },
    })
    try {
      const hero = character('hero', { dnd5ePluginFeatureIds: [featureId] })
      const ally = character('ally')
      const enemy = character('enemy')
      const map: BattleMap = {
        id: 'map-1', name: 'Area map', width: 500, height: 500,
        gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
        tokens: [
          token('hero-token', hero.id, 25),
          token('ally-token', ally.id, 125),
          token('enemy-token', enemy.id, 125, 'enemy'),
        ],
      }
      const geometry = createEmptyMapGeometry(map.id, 1)
      geometry.obstacles.push({
        id: 'raised-anchor', kind: 'obstacle', label: 'Raised anchor',
        points: [{ x: 200, y: 0 }, { x: 250, y: 0 }, { x: 250, y: 50 }, { x: 200, y: 50 }],
        blocksVision: false, blocksMovement: false, blocksLineOfEffect: false, cover: 'none',
        baseHeightFeet: 0, heightFeet: 0, terrainRegion: true, terrainElevationFeet: 35, createdAt: 1,
      })
      setMapGeometryRuntime([geometry])
      const initiativeOrder: InitiativeEntry[] = [
        { slotId: 'hero-token:normal', tokenId: 'hero-token', label: 'hero', emoji: '●', color: '#fff', roll: 20 },
        { slotId: 'ally-token:normal', tokenId: 'ally-token', label: 'ally', emoji: '●', color: '#fff', roll: 15 },
        { slotId: 'enemy-token:normal', tokenId: 'enemy-token', label: 'enemy', emoji: '●', color: '#fff', roll: 10 },
      ]
      const prepared = prepareDnd5ePluginFeatureAction({
        action: {
          ...action(featureId),
          targetTokenId: undefined,
          targetTokenIds: ['enemy-token'],
          targetCell: { col: 4, row: 0 },
          targetElevationFeet: 30,
        },
        map,
        characters: [hero, ally, enemy],
        initiativeOrder,
      })
      expect(prepared.ok).toBe(true)
      if (!prepared.ok) return
      expect(prepared.prepared.targetTokens).toEqual([])
      expect(prepared.prepared.headlessAction.targetId).toBeUndefined()
      expect(prepared.prepared.headlessAction.targetIds).toEqual([])
      expect(prepared.prepared.headlessAction.targetCell).toEqual({ col: 4, row: 0 })
      const resolved = await resolvePreparedDnd5ePluginFeatureAction({ prepared: prepared.prepared })
      expect(resolved.result.ok).toBe(true)
      expect(resolved.application?.map.dnd5ePluginAreas).toEqual([
        expect.objectContaining({
          id: 'plugin-area:plugin-action-1', label: '守护区域', color: '#22c55e',
          cells: expect.arrayContaining([{ col: 4, row: 0 }]),
          concentrationId: 'plugin-area:plugin-action-1', expiresAfterRound: 3,
          vertical: { mode: 'volume', baseElevationFeet: 30, heightFeet: 20 },
          visual: { preset: 'toxic-cloud', intensity: 'strong' },
        }),
      ])
      expect(resolved.application?.characters.find((entry) => entry.id === hero.id)).toMatchObject({
        concentrating: true,
        dnd5eCombatState: { concentrationSpellId: 'plugin-area:plugin-action-1' },
      })
    } finally {
      setMapGeometryRuntime([])
      dispose()
    }
  })

  it('rebuilds plugin area targets against the selected Z-axis volume', () => {
    let featureId = ''
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: 'com.example.airburst', name: 'Airburst', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Example', license: 'CC0-1.0',
      },
      setup(api) {
        api.registerHeadlessAction({ id: 'airburst', resolve: ({ succeed }) => succeed() })
        featureId = api.registerFeature({
          id: 'airburst', name: 'Airburst', summary: 'Airburst', description: 'Airburst', automation: 'full',
          action: {
            id: 'airburst', label: 'Airburst', economy: 'action',
            targeting: {
              kind: 'area', relation: 'enemy', maximumTargets: 8,
              template: { shape: 'circle', origin: 'point', radiusFeet: 5, placeRangeFeet: 60 },
            },
          },
        })
      },
    })
    try {
      const hero = character('hero', { dnd5ePluginFeatureIds: [featureId] })
      const ground = character('ground')
      const airborne = character('airborne')
      const groundToken = token('ground-token', ground.id, 125, 'enemy')
      const airborneToken = {
        ...token('airborne-token', airborne.id, 125, 'enemy'),
        elevationFeet: 40,
      }
      const map: BattleMap = {
        id: 'map-1', name: 'Airburst map', width: 500, height: 500,
        gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
        tokens: [token('hero-token', hero.id, 25), groundToken, airborneToken],
      }
      const initiativeOrder: InitiativeEntry[] = map.tokens.map((entry, index) => ({
        slotId: `${entry.id}:normal`, tokenId: entry.id, label: entry.label,
        emoji: entry.emoji ?? '', color: entry.color ?? '', roll: 20 - index,
      }))
      const baseAction = {
        ...action(featureId),
        targetTokenId: undefined,
        targetCell: { col: 2, row: 0 },
      }

      const groundCast = prepareDnd5ePluginFeatureAction({
        action: baseAction,
        map,
        characters: [hero, ground, airborne],
        initiativeOrder,
      })
      expect(groundCast).toMatchObject({
        ok: true,
        prepared: { targetTokens: [{ id: groundToken.id }] },
      })

      const airCast = prepareDnd5ePluginFeatureAction({
        action: { ...baseAction, targetElevationFeet: 40 },
        map,
        characters: [hero, ground, airborne],
        initiativeOrder,
      })
      expect(airCast).toMatchObject({
        ok: true,
        prepared: {
          areaTargetElevationFeet: 40,
          targetTokens: [{ id: airborneToken.id }],
        },
      })
    } finally {
      dispose()
    }
  })

  it('validates character ownership, spends the action, and applies Headless state', async () => {
    let featureId = ''
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: 'com.example.vertical-slice',
        name: 'Vertical Slice',
        version: '1.0.0',
        apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1',
        publisher: 'Example',
        license: 'CC0-1.0',
      },
      setup(api) {
        api.registerHeadlessAction({
          id: 'guardian-spark',
          resolve({ target, grantTemporaryHitPoints, succeed, fail }) {
            if (!target) return fail('invalid-target')
            grantTemporaryHitPoints(target.id, 3)
            return succeed()
          },
        })
        featureId = api.registerFeature({
          id: 'guardian-spark',
          name: '守护火花',
          summary: '纵向切片测试特性。',
          description: '以一个动作令30尺内友方获得3点临时生命值。',
          minimumLevel: 1,
          automation: 'full',
          action: {
            id: 'guardian-spark',
            label: '使用守护火花',
            economy: 'action',
            targeting: { kind: 'single-creature', relation: 'ally', rangeFeet: 30, includeSelf: true },
          },
        })
      },
    }, { integrity: 'sha256-YWJjZA==' })
    try {
      const hero = character('hero', { dnd5ePluginFeatureIds: [featureId] })
      const ally = character('ally')
      const enemy = character('enemy')
      const map: BattleMap = {
        id: 'map-1',
        name: 'Plugin map',
        width: 500,
        height: 500,
        gridSize: 50,
        gridOffsetX: 0,
        gridOffsetY: 0,
        feetPerCell: 5,
        showGrid: true,
        tokens: [
          token('hero-token', hero.id, 25),
          token('ally-token', ally.id, 75),
          token('enemy-token', enemy.id, 225, 'enemy'),
        ],
      }
      const initiativeOrder: InitiativeEntry[] = [
        { slotId: 'hero-token:normal', tokenId: 'hero-token', label: 'hero', emoji: '●', color: '#fff', roll: 20 },
        { slotId: 'ally-token:normal', tokenId: 'ally-token', label: 'ally', emoji: '●', color: '#fff', roll: 15 },
        { slotId: 'enemy-token:normal', tokenId: 'enemy-token', label: 'enemy', emoji: '●', color: '#fff', roll: 10 },
      ]
      const prepared = prepareDnd5ePluginFeatureAction({
        action: action(featureId),
        map,
        characters: [hero, ally, enemy],
        initiativeOrder,
        roomRequiredPlugins: [{
          id: 'com.example.vertical-slice',
          version: '1.0.0',
          integrity: 'sha256-YWJjZA==',
        }],
        turnEconomy: {
          turnKey: 'combat-1:1:hero-token',
          attacksUsed: 0,
          action: { current: 1, max: 1 },
          bonusAction: { current: 1, max: 1 },
          reaction: { current: 1, max: 1 },
          movement: { current: 30, max: 30 },
        },
      })
      expect(prepared.ok).toBe(true)
      if (!prepared.ok) return

      const resolved = await resolvePreparedDnd5ePluginFeatureAction({ prepared: prepared.prepared })
      expect(resolved.result.ok).toBe(true)
      expect(resolved.result.events).toContainEqual({
        type: 'turn-resource-spent',
        actorId: 'hero-token',
        resource: 'action',
      })
      expect(resolved.application?.characters.find((item) => item.id === ally.id)?.tempHp).toBe(3)

      expect(prepareDnd5ePluginFeatureAction({
        action: action(featureId),
        map,
        characters: [hero, ally, enemy],
        initiativeOrder,
        roomRequiredPlugins: [],
      })).toEqual({ ok: false, reason: 'plugin-not-enabled-for-room' })
      expect(prepareDnd5ePluginFeatureAction({
        action: action(featureId),
        map,
        characters: [hero, ally, enemy],
        initiativeOrder,
        roomRequiredPlugins: null,
      })).toEqual({ ok: false, reason: 'room-rules-unavailable' })
    } finally {
      dispose()
    }
  })

  it('lets the Host replace an untrusted player payload before Headless resolution', async () => {
    let featureId = ''
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: 'com.example.authoritative-payload',
        name: 'Authoritative Payload',
        version: '1.0.0',
        apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1',
        publisher: 'Example',
        license: 'CC0-1.0',
      },
      setup(api) {
        api.registerHeadlessAction({
          id: 'trusted-action',
          resolve({ action, succeed, fail }) {
            const payload = action.payload
            return payload && typeof payload === 'object' && !Array.isArray(payload) &&
              payload.source === 'host'
              ? succeed()
              : fail('invalid-plugin-action')
          },
        })
        featureId = api.registerFeature({
          id: 'trusted-action',
          name: '可信动作',
          summary: '测试 Host 载荷覆盖。',
          description: '测试 Host 载荷覆盖。',
          automation: 'full',
          action: {
            id: 'trusted-action',
            label: '使用',
            economy: 'none',
            targeting: { kind: 'self' },
          },
        })
      },
    })
    try {
      const hero = character('hero', { dnd5ePluginFeatureIds: [featureId] })
      const enemy = character('enemy')
      const map: BattleMap = {
        id: 'map-1',
        name: 'Payload map',
        width: 500,
        height: 500,
        gridSize: 50,
        gridOffsetX: 0,
        gridOffsetY: 0,
        feetPerCell: 5,
        showGrid: true,
        tokens: [
          token('hero-token', hero.id, 25),
          token('enemy-token', enemy.id, 225, 'enemy'),
        ],
      }
      const initiativeOrder: InitiativeEntry[] = [
        { slotId: 'hero-token:normal', tokenId: 'hero-token', label: 'hero', emoji: 'H', color: '#fff', roll: 20 },
        { slotId: 'enemy-token:normal', tokenId: 'enemy-token', label: 'enemy', emoji: 'E', color: '#f00', roll: 10 },
      ]
      const prepared = prepareDnd5ePluginFeatureAction({
        action: {
          ...action(featureId),
          targetTokenId: 'hero-token',
          dnd5ePluginAction: { featureId, payload: { source: 'player' } },
        },
        map,
        characters: [hero, enemy],
        initiativeOrder,
      })
      expect(prepared.ok).toBe(true)
      if (!prepared.ok) return
      const rejected = await resolvePreparedDnd5ePluginFeatureAction({
        prepared: prepared.prepared,
      })
      expect(rejected.result).toMatchObject({ ok: false, reason: 'invalid-plugin-action' })
      const accepted = await resolvePreparedDnd5ePluginFeatureAction({
        prepared: prepared.prepared,
        authoritativePayload: { source: 'host' },
      })
      expect(accepted.result.ok).toBe(true)
    } finally {
      dispose()
    }
  })

  it('executes a workshop multi-target save as independent Host rolls', async () => {
    let featureId = ''
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: 'com.example.workshop-multi-save',
        name: 'Workshop multi save',
        version: '1.0.0',
        apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1',
        publisher: 'Tests',
        license: 'CC0-1.0',
      },
      setup(api) {
        api.registerHeadlessAction(dnd5eHeadlessActionFromDeclarativeDraft({
          id: 'thunder-burst',
          label: 'Thunder Burst',
          savingThrow: { ability: 'con', dc: 'source-save-dc', onSuccess: 'half' },
          effects: [
            { kind: 'damage', dice: { count: 2, sides: 6 }, damageType: 'thunder' },
            {
              kind: 'condition',
              condition: 'prone',
              duration: { expiresAt: 'target-turn-end', remainingRounds: 1 },
            },
          ],
        }))
        featureId = api.registerFeature({
          id: 'thunder-burst',
          name: 'Thunder Burst',
          summary: 'Each selected target makes its own save.',
          description: 'Workshop vertical-slice fixture.',
          automation: 'full',
          action: {
            id: 'thunder-burst',
            label: 'Use Thunder Burst',
            economy: 'action',
            targeting: {
              kind: 'multiple-creatures',
              relation: 'enemy',
              rangeFeet: 30,
              maximumTargets: 3,
            },
          },
        })
      },
    })
    try {
      const hero = character('hero', { dnd5ePluginFeatureIds: [featureId], saveDC: 14 })
      const savedEnemy = character('saved-enemy')
      const failedEnemy = character('failed-enemy')
      const map: BattleMap = {
        id: 'map-1',
        name: 'Workshop multi-save map',
        width: 500,
        height: 500,
        gridSize: 50,
        gridOffsetX: 0,
        gridOffsetY: 0,
        feetPerCell: 5,
        showGrid: true,
        tokens: [
          token('hero-token', hero.id, 25),
          token('saved-token', savedEnemy.id, 125, 'enemy'),
          token('failed-token', failedEnemy.id, 175, 'enemy'),
        ],
      }
      const initiativeOrder: InitiativeEntry[] = map.tokens.map((entry, index) => ({
        slotId: `${entry.id}:normal`,
        tokenId: entry.id,
        label: entry.label,
        emoji: entry.emoji ?? '',
        color: entry.color ?? '',
        roll: 20 - index,
      }))
      const prepared = prepareDnd5ePluginFeatureAction({
        action: {
          ...action(featureId),
          targetTokenId: undefined,
          targetTokenIds: ['saved-token', 'failed-token'],
        },
        map,
        characters: [hero, savedEnemy, failedEnemy],
        initiativeOrder,
      })
      expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
      if (!prepared.ok) return
      expect(prepared.prepared.targetTokens.map((entry) => entry.id)).toEqual([
        'saved-token',
        'failed-token',
      ])

      const resolved = await resolvePreparedDnd5ePluginFeatureAction({
        prepared: prepared.prepared,
        rolls: {
          'effect-0': { values: [6, 4], modifier: 0, total: 10 },
          'target-save-d20:saved-token': { values: [20], modifier: 0, total: 20 },
          'target-save-d20:failed-token': { values: [2], modifier: 0, total: 2 },
        },
      })
      expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
      expect(resolved.application?.characters.find((entry) => entry.id === savedEnemy.id)).toMatchObject({
        currentHp: 15,
        conditions: [],
      })
      expect(resolved.application?.characters.find((entry) => entry.id === failedEnemy.id)).toMatchObject({
        currentHp: 10,
        conditions: expect.arrayContaining(['prone']),
      })
    } finally {
      dispose()
    }
  })

  it('rejects a registered feature that the actor did not select', () => {
    let featureId = ''
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: 'com.example.ownership',
        name: 'Ownership',
        version: '1.0.0',
        apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1',
        publisher: 'Example',
        license: 'CC0-1.0',
      },
      setup(api) {
        api.registerHeadlessAction({ id: 'self', resolve: ({ succeed }) => succeed() })
        featureId = api.registerFeature({
          id: 'self',
          name: '未选择特性',
          summary: '测试。',
          description: '测试角色所有权。',
          automation: 'full',
          action: { id: 'self', label: '使用', economy: 'none', targeting: { kind: 'self' } },
        })
      },
    })
    try {
      const hero = character('hero')
      const ally = character('ally')
      const map: BattleMap = {
        id: 'map-1',
        name: 'Plugin map',
        width: 500,
        height: 500,
        gridSize: 50,
        gridOffsetX: 0,
        gridOffsetY: 0,
        showGrid: true,
        tokens: [token('hero-token', hero.id, 25), token('ally-token', ally.id, 75)],
      }
      const initiativeOrder: InitiativeEntry[] = [
        { slotId: 'hero-token:normal', tokenId: 'hero-token', label: 'hero', emoji: '●', color: '#fff', roll: 20 },
        { slotId: 'ally-token:normal', tokenId: 'ally-token', label: 'ally', emoji: '●', color: '#fff', roll: 10 },
      ]
      expect(prepareDnd5ePluginFeatureAction({
        action: { ...action(featureId), targetTokenId: 'hero-token' },
        map,
        characters: [hero, ally],
        initiativeOrder,
      })).toEqual({ ok: false, reason: 'feature-not-selected' })
    } finally {
      dispose()
    }
  })
})

describe('插件事务提交重基线', () => {
  it('保留等待期间发生在无关 Token 上的移动与 HP 更新', () => {
    const hero = character('hero')
    const enemy = character('enemy')
    const heroToken = token('hero-token', hero.id, 25)
    const enemyToken = { ...token('enemy-token', enemy.id, 125, 'enemy'), hp: 10, maxHp: 10 }
    const baseMap = {
      id: 'map-1', name: 'map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
      tokens: [heroToken, enemyToken],
    } as BattleMap
    const result = rebaseDnd5ePluginFeatureApplication({
      baseMap,
      baseCharacters: [hero, enemy],
      application: {
        map: { ...baseMap, tokens: [{ ...heroToken, hp: 8 }, enemyToken] },
        characters: [hero, enemy],
        changedTokenIds: ['hero-token'],
        changedCharacterIds: [],
      },
      latestMap: {
        ...baseMap,
        tokens: [heroToken, { ...enemyToken, x: 225, hp: 4 }],
      },
      latestCharacters: [hero, enemy],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.application.map.tokens.find((candidate) => candidate.id === 'hero-token')?.hp).toBe(8)
    expect(result.application.map.tokens.find((candidate) => candidate.id === 'enemy-token')).toMatchObject({
      x: 225,
      hp: 4,
    })
  })

  it('同一实体被并发修改或召唤 ID 已存在时 fail closed', () => {
    const hero = character('hero')
    const heroToken = token('hero-token', hero.id, 25)
    const summon = { ...token('summon-token', '', 75, 'npc'), characterId: undefined }
    const baseMap = {
      id: 'map-1', name: 'map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [heroToken],
    } as BattleMap
    const application = {
      map: { ...baseMap, tokens: [{ ...heroToken, hp: 8 }, summon] },
      characters: [hero],
      changedTokenIds: ['hero-token', 'summon-token'],
      changedCharacterIds: [],
    }
    expect(rebaseDnd5ePluginFeatureApplication({
      baseMap,
      baseCharacters: [hero],
      application,
      latestMap: { ...baseMap, tokens: [{ ...heroToken, x: 75 }] },
      latestCharacters: [hero],
    })).toEqual({ ok: false, reason: 'plugin-commit-conflict' })
    expect(rebaseDnd5ePluginFeatureApplication({
      baseMap,
      baseCharacters: [hero],
      application,
      latestMap: { ...baseMap, tokens: [heroToken, summon] },
      latestCharacters: [hero],
    })).toEqual({ ok: false, reason: 'plugin-commit-conflict' })
  })
})
