import { existsSync, readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import {
  declarativeSubclassCompatibilityReportV1,
  type DeclarativeSubclassDefinitionV1,
  type Dnd5e2014TotemWarriorFeatureId,
} from './declarativeSubclassAbility'
import {
  createDnd5eCombatant,
  dnd5eCombatantPairKey,
  dnd5eEffectiveFlySpeed,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eActionResult,
  type Dnd5eCombatant,
  type Dnd5eHeadlessCombatState,
} from './headlessCombatEngine'
import { dnd5eInventoryLoad } from './items'
import { prepareDnd5ePlayerEndTurn } from './endTurnAction'
import {
  prepareDnd5eEquipmentAttack,
  resolvePreparedDnd5eEquipmentAttack,
} from './equipmentAttackAction'
import {
  prepareDnd5eClassFeature,
  resolvePreparedDnd5eClassFeature,
} from './classFeatureAction'
import {
  dnd5ePluginFeaturesAvailableForCharacter,
  registerDnd5eRulesPlugin,
} from './pluginApi'
import { DND5E_FIGHTER_STARTING_EQUIPMENT } from './equipment'
import { createDnd5eTurnEconomyCounts } from './turnEconomy'

const PLUGIN_ID = 'local.doco.totem-warrior-2014'
const SUBCLASS_ID = `${PLUGIN_ID}:totem-warrior-2014`
const ABILITIES = { str: 16, dex: 14, con: 16, int: 8, wis: 12, cha: 10 }
const LOCAL_DEFINITION_PATH = new URL(
  '../../../local-content/phb-2014/subclasses/totem-warrior/subclasses.json',
  import.meta.url,
)
let sequence = 0
let unregister: (() => void) | undefined

function definition(): DeclarativeSubclassDefinitionV1 {
  return JSON.parse(readFileSync(LOCAL_DEFINITION_PATH, 'utf8'))[0] as DeclarativeSubclassDefinitionV1
}

function featureId(feature: Dnd5e2014TotemWarriorFeatureId): string {
  return `${SUBCLASS_ID}.${feature}`
}

function combatant(
  id: string,
  controller: 'player' | 'dm',
  initiative: number,
  patch: Partial<Dnd5eCombatant> = {},
): Dnd5eCombatant {
  return createDnd5eCombatant({
    id,
    name: id,
    controller,
    initiative,
    abilities: ABILITIES,
    proficiencyBonus: 3,
    armorClass: 15,
    currentHp: 40,
    maxHp: 40,
    temporaryHp: 0,
    speed: 30,
    position: { x: 0, y: 0 },
    concentrating: false,
    ...patch,
  })
}

function totem(
  id: string,
  level: number,
  features: readonly Dnd5e2014TotemWarriorFeatureId[],
  patch: Partial<Dnd5eCombatant> = {},
): Dnd5eCombatant {
  return combatant(id, 'player', 20, {
    classId: 'barbarian',
    level,
    classLevels: { barbarian: level },
    subclassId: SUBCLASS_ID,
    subclassIds: { barbarian: SUBCLASS_ID },
    pluginFeatureIds: features.map(featureId),
    classState: {
      raging: true,
      rageTurnsRemaining: 10,
      rageSustainedThisTurn: true,
    },
    ...patch,
  })
}

function stateWith(combatants: readonly Dnd5eCombatant[]): Dnd5eHeadlessCombatState {
  sequence += 1
  const state = startDnd5eHeadlessCombat(`totem-warrior-${sequence}`, combatants)
  state.distanceFeetByCombatantPair = Object.fromEntries(combatants.flatMap((left, leftIndex) =>
    combatants.slice(leftIndex + 1).map((right) => [
      dnd5eCombatantPairKey(left.id, right.id),
      Math.hypot(left.position.x - right.position.x, left.position.y - right.position.y),
    ]),
  ))
  return state
}

function success(result: Dnd5eActionResult): Dnd5eActionResult & { ok: true } {
  expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
  if (!result.ok) throw new Error(result.reason)
  return result
}

function weaponAttack(
  state: Dnd5eHeadlessCombatState,
  input: {
    actorId: string
    targetId: string
    d20: number
    d20Second?: number
    mode?: 'melee' | 'ranged'
    damageType?: 'fire' | 'psychic' | 'slashing'
  },
): Dnd5eActionResult {
  const mode = input.mode ?? 'melee'
  return resolveDnd5eHeadlessAction(state, {
    type: 'attack',
    actorId: input.actorId,
    targetId: input.targetId,
    attackModifier: 0,
    d20: input.d20,
    d20Second: input.d20Second,
    spendAction: false,
    damage: {
      count: 1,
      sides: 8,
      bonus: 0,
      rolls: [8],
      type: input.damageType ?? 'slashing',
    },
    classDamageContext: {
      mode,
      finesse: mode === 'ranged',
      strengthBased: mode === 'melee',
      weaponDamageSides: 8,
      damageType: input.damageType ?? 'slashing',
      adjacentEnemyOfTarget: false,
      ...(mode === 'ranged' ? { normalRangeFeet: 30, longRangeFeet: 120, distanceFeet: 5 } : {}),
    },
  })
}

function characterWithChoices(): Character {
  return {
    rulesetId: 'dnd5e-2014-srd-5.1',
    id: 'barbarian',
    name: 'Local Totem Barbarian',
    player: '',
    avatar: '',
    accent: '',
    race: 'human',
    charClass: '野蛮人',
    level: 14,
    background: '',
    experience: 0,
    reputation: 0,
    abilities: ABILITIES,
    savingThrows: [],
    skills: [],
    maxHp: 100,
    currentHp: 100,
    tempHp: 0,
    hitDice: '14d12',
    ac: 15,
    speed: 30,
    initiativeBonus: 2,
    saveDC: 14,
    passivePerception: 11,
    inspiration: 0,
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    dnd5eClassLevels: { barbarian: 14 },
    dnd5eClassChoices: {
      classes: {
        barbarian: {
          subclass: SUBCLASS_ID,
          selections: {
            [`${SUBCLASS_ID}/totem-spirit`]: ['eagle'],
            [`${SUBCLASS_ID}/aspect-of-the-beast`]: ['bear'],
            [`${SUBCLASS_ID}/totemic-attunement`]: ['wolf'],
          },
        },
      },
    },
  }
}

describe.runIf(existsSync(LOCAL_DEFINITION_PATH))('2014 Totem Warrior local Headless protocol', () => {
  beforeAll(() => {
    unregister = registerDnd5eRulesPlugin({
      manifest: {
        id: PLUGIN_ID,
        name: 'Totem Warrior Headless Test',
        version: '1.0.0',
        apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1',
        publisher: 'Local test',
        license: 'Private local use',
      },
      setup(api) {
        api.registerDeclarativeSubclass(definition())
      },
    })
  })

  afterAll(() => unregister?.())

  it('keeps all three totem choices independent and reports the closed mechanics as fully automated', () => {
    const hero = characterWithChoices()
    const available = dnd5ePluginFeaturesAvailableForCharacter(hero).map((feature) => feature.id)
    expect(available).toEqual(expect.arrayContaining([
      featureId('spirit-seeker'),
      featureId('totem-spirit-eagle'),
      featureId('aspect-of-the-beast-bear'),
      featureId('spirit-walker'),
      featureId('totemic-attunement-wolf'),
    ]))
    expect(available).not.toContain(featureId('totem-spirit-bear'))
    expect(available).not.toContain(featureId('aspect-of-the-beast-eagle'))
    expect(available).not.toContain(featureId('totemic-attunement-eagle'))
    expect(declarativeSubclassCompatibilityReportV1([definition()]).abilities).toSatisfy(
      (entries: readonly { effective: string; reasons: readonly string[] }[]) =>
        entries.length === 11 &&
        entries.every((entry) => entry.effective === 'full' && entry.reasons.length === 0),
    )
    expect(dnd5eInventoryLoad(hero).carryingCapacityLb).toBe(480)
  })

  it('applies Bear Spirit resistance to elemental damage but not psychic damage while raging', () => {
    const fire = success(weaponAttack(stateWith([
      combatant('enemy', 'dm', 30, { position: { x: 5, y: 0 } }),
      totem('bear', 3, ['totem-spirit-bear']),
    ]), {
      actorId: 'enemy',
      targetId: 'bear',
      d20: 15,
      damageType: 'fire',
    }))
    expect(fire.state.combatants.bear.currentHp).toBe(36)

    const psychic = success(weaponAttack(stateWith([
      combatant('enemy', 'dm', 30, { position: { x: 5, y: 0 } }),
      totem('bear', 3, ['totem-spirit-bear']),
    ]), {
      actorId: 'enemy',
      targetId: 'bear',
      d20: 15,
      damageType: 'psychic',
    }))
    expect(psychic.state.combatants.bear.currentHp).toBe(32)

    const calm = success(weaponAttack(stateWith([
      combatant('enemy', 'dm', 30, { position: { x: 5, y: 0 } }),
      totem('bear', 3, ['totem-spirit-bear'], { classState: {} }),
    ]), {
      actorId: 'enemy',
      targetId: 'bear',
      d20: 15,
      damageType: 'fire',
    }))
    expect(calm.state.combatants.bear.currentHp).toBe(32)
  })

  it('settles Eagle Spirit bonus-action Dash and opportunity-attack disadvantage without a prompt', () => {
    const dashed = success(resolveDnd5eHeadlessAction(stateWith([
      totem('eagle', 3, ['totem-spirit-eagle']),
      combatant('enemy', 'dm', 10, { position: { x: 5, y: 0 } }),
    ]), {
      type: 'barbarian-totem-eagle-dash',
      actorId: 'eagle',
    }))
    expect(dashed.state.combatants.eagle.turn).toMatchObject({
      bonusActionAvailable: false,
      movementRemaining: 60,
    })

    const opportunity = success(resolveDnd5eHeadlessAction(stateWith([
      totem('eagle', 3, ['totem-spirit-eagle'], { initiative: 30 }),
      combatant('enemy', 'dm', 20, { position: { x: 5, y: 0 } }),
    ]), {
      type: 'opportunity-attack',
      actorId: 'enemy',
      targetId: 'eagle',
      attackModifier: 0,
      d20: 18,
      d20Second: 2,
      damage: { count: 1, sides: 8, bonus: 0, rolls: [8], type: 'slashing' },
    }))
    expect(opportunity.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved',
      actorId: 'enemy',
      targetId: 'eagle',
      d20: 2,
      hit: false,
    }))

    expect(resolveDnd5eHeadlessAction(stateWith([
      totem('armored-eagle', 3, ['totem-spirit-eagle'], { wearingHeavyArmor: true }),
      combatant('enemy', 'dm', 10, { position: { x: 5, y: 0 } }),
    ]), {
      type: 'barbarian-totem-eagle-dash',
      actorId: 'armored-eagle',
    })).toMatchObject({ ok: false, reason: 'invalid-class-feature' })

    expect(resolveDnd5eHeadlessAction(stateWith([
      totem('calm-eagle', 3, ['totem-spirit-eagle'], { classState: {} }),
      combatant('enemy', 'dm', 10, { position: { x: 5, y: 0 } }),
    ]), {
      type: 'barbarian-totem-eagle-dash',
      actorId: 'calm-eagle',
    })).toMatchObject({ ok: false, reason: 'invalid-class-feature' })

    const armoredOpportunity = success(resolveDnd5eHeadlessAction(stateWith([
      totem('armored-eagle', 3, ['totem-spirit-eagle'], {
        initiative: 30,
        wearingHeavyArmor: true,
      }),
      combatant('enemy', 'dm', 20, { position: { x: 5, y: 0 } }),
    ]), {
      type: 'opportunity-attack',
      actorId: 'enemy',
      targetId: 'armored-eagle',
      attackModifier: 0,
      d20: 18,
      d20Second: 2,
      damage: { count: 1, sides: 8, bonus: 0, rolls: [8], type: 'slashing' },
    }))
    expect(armoredOpportunity.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved',
      d20: 18,
      hit: true,
    }))
  })

  it('grants Wolf Spirit advantage only to an ally melee attack against a nearby enemy', () => {
    const melee = success(weaponAttack(stateWith([
      combatant('ally', 'player', 30),
      totem('wolf', 3, ['totem-spirit-wolf'], { position: { x: 5, y: 0 } }),
      combatant('enemy', 'dm', 10, { position: { x: 5, y: 0 } }),
    ]), {
      actorId: 'ally',
      targetId: 'enemy',
      d20: 2,
      d20Second: 18,
    }))
    expect(melee.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved',
      d20: 18,
      hit: true,
    }))

    const ranged = success(weaponAttack(stateWith([
      combatant('ally', 'player', 30),
      totem('wolf', 3, ['totem-spirit-wolf'], { position: { x: 5, y: 0 } }),
      combatant('enemy', 'dm', 10, { position: { x: 5, y: 0 } }),
    ]), {
      actorId: 'ally',
      targetId: 'enemy',
      d20: 2,
      d20Second: 18,
      mode: 'ranged',
    }))
    expect(ranged.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved',
      d20: 2,
      hit: false,
    }))

    const calmSource = success(weaponAttack(stateWith([
      combatant('ally', 'player', 30),
      totem('wolf', 3, ['totem-spirit-wolf'], {
        position: { x: 5, y: 0 },
        classState: {},
      }),
      combatant('enemy', 'dm', 10, { position: { x: 5, y: 0 } }),
    ]), {
      actorId: 'ally',
      targetId: 'enemy',
      d20: 2,
      d20Second: 18,
    }))
    expect(calmSource.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved',
      d20: 2,
      hit: false,
    }))
  })

  it('applies Bear Attunement disadvantage only when a nearby enemy attacks an ally', () => {
    const protectedAlly = success(weaponAttack(stateWith([
      combatant('enemy', 'dm', 30, { position: { x: 5, y: 0 } }),
      totem('bear', 14, ['totemic-attunement-bear']),
      combatant('ally', 'player', 10, { position: { x: 5, y: 0 } }),
    ]), {
      actorId: 'enemy',
      targetId: 'ally',
      d20: 18,
      d20Second: 2,
    }))
    expect(protectedAlly.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved',
      d20: 2,
      hit: false,
    }))

    const attackedBear = success(weaponAttack(stateWith([
      combatant('enemy', 'dm', 30, { position: { x: 5, y: 0 } }),
      totem('bear', 14, ['totemic-attunement-bear']),
    ]), {
      actorId: 'enemy',
      targetId: 'bear',
      d20: 18,
      d20Second: 2,
    }))
    expect(attackedBear.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved',
      d20: 18,
      hit: true,
    }))

    const attackedOtherBear = success(weaponAttack(stateWith([
      combatant('enemy', 'dm', 30, { position: { x: 5, y: 0 } }),
      totem('guardian-bear', 14, ['totemic-attunement-bear']),
      totem('other-bear', 14, ['totemic-attunement-bear'], {
        initiative: 10,
        classState: {},
        position: { x: 5, y: 0 },
      }),
    ]), {
      actorId: 'enemy',
      targetId: 'other-bear',
      d20: 18,
      d20Second: 2,
    }))
    expect(attackedOtherBear.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved',
      d20: 18,
      hit: true,
    }))

    const immuneAttacker = success(weaponAttack(stateWith([
      combatant('immune-enemy', 'dm', 30, {
        position: { x: 5, y: 0 },
        conditionImmunities: ['frightened'],
      }),
      totem('bear', 14, ['totemic-attunement-bear']),
      combatant('ally', 'player', 10, { position: { x: 5, y: 0 } }),
    ]), {
      actorId: 'immune-enemy',
      targetId: 'ally',
      d20: 18,
      d20Second: 2,
    }))
    expect(immuneAttacker.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved',
      d20: 18,
      hit: true,
    }))
  })

  it('opens Wolf Attunement only after a melee hit and spends the bonus action to knock down', () => {
    const hit = success(weaponAttack(stateWith([
      totem('wolf', 14, ['totemic-attunement-wolf'], { initiative: 30 }),
      combatant('enemy', 'dm', 10, { armorClass: 10, position: { x: 5, y: 0 } }),
    ]), {
      actorId: 'wolf',
      targetId: 'enemy',
      d20: 15,
    }))
    expect(hit.state.combatants.wolf.classState.totemWarriorWolfAttunementTargetIds)
      .toEqual(['enemy'])

    const knockedDown = success(resolveDnd5eHeadlessAction(hit.state, {
      type: 'barbarian-totem-wolf-knockdown',
      actorId: 'wolf',
      targetId: 'enemy',
    }))
    expect(knockedDown.state.combatants.wolf.turn.bonusActionAvailable).toBe(false)
    expect(knockedDown.state.combatants.wolf.classState.totemWarriorWolfAttunementTargetIds)
      .toBeUndefined()
    expect(knockedDown.state.combatants.enemy.conditions).toContain('prone')

    const missed = success(weaponAttack(stateWith([
      totem('wolf', 14, ['totemic-attunement-wolf'], { initiative: 30 }),
      combatant('enemy', 'dm', 10, { armorClass: 20, position: { x: 5, y: 0 } }),
    ]), {
      actorId: 'wolf',
      targetId: 'enemy',
      d20: 2,
    }))
    expect(
      missed.state.combatants.wolf.classState.totemWarriorWolfAttunementTargetIds,
    ).toBeUndefined()

    const rangedHit = success(weaponAttack(stateWith([
      totem('wolf', 14, ['totemic-attunement-wolf'], { initiative: 30 }),
      combatant('enemy', 'dm', 10, { armorClass: 10, position: { x: 5, y: 0 } }),
    ]), {
      actorId: 'wolf',
      targetId: 'enemy',
      d20: 15,
      mode: 'ranged',
    }))
    expect(
      rangedHit.state.combatants.wolf.classState.totemWarriorWolfAttunementTargetIds,
    ).toBeUndefined()

    const turnEnded = success(resolveDnd5eHeadlessAction(hit.state, {
      type: 'end-turn',
      actorId: 'wolf',
    }))
    expect(
      turnEnded.state.combatants.wolf.classState.totemWarriorWolfAttunementTargetIds,
    ).toBeUndefined()
    expect(resolveDnd5eHeadlessAction(turnEnded.state, {
      type: 'barbarian-totem-wolf-knockdown',
      actorId: 'wolf',
      targetId: 'enemy',
    }).ok).toBe(false)
  })

  it('persists Wolf Attunement from an equipment hit through the map bridge and resolves the knockdown', () => {
    const hero: Character = {
      ...characterWithChoices(),
      equipment: DND5E_FIGHTER_STARTING_EQUIPMENT,
      dnd5eCombatState: {
        schemaVersion: 2,
        raging: true,
        rageTurnsRemaining: 10,
        rageSustainedThisTurn: true,
      },
    }
    const actorToken: Token = {
      id: 'wolf-token',
      label: hero.name,
      x: 25,
      y: 25,
      color: '',
      emoji: '',
      size: 1,
      type: 'player',
      characterId: hero.id,
    }
    const enemyToken: Token = {
      id: 'enemy-token',
      label: 'Enemy',
      x: 75,
      y: 25,
      color: '',
      emoji: '',
      size: 1,
      type: 'enemy',
      hp: 20,
      maxHp: 20,
    }
    const map: BattleMap = {
      id: 'wolf-attunement-map',
      name: 'Map',
      width: 200,
      height: 200,
      gridSize: 50,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens: [actorToken, enemyToken],
    }
    const initiativeOrder = [
      { tokenId: actorToken.id, label: actorToken.label, emoji: '', color: '', roll: 20 },
      { tokenId: enemyToken.id, label: enemyToken.label, emoji: '', color: '', roll: 10 },
    ]
    const attackAction: SharedPlayerActionState = {
      id: 'attack',
      mapId: map.id,
      combatId: 'wolf-attunement',
      sourceMode: 'player',
      status: 'pending',
      type: 'dnd5e-weapon-attack',
      actorTokenId: actorToken.id,
      characterId: hero.id,
      targetTokenId: enemyToken.id,
      round: 1,
      initiativeIndex: 0,
      seq: 1,
      updatedAt: 1,
    }
    const preparedAttack = prepareDnd5eEquipmentAttack({
      action: attackAction,
      map,
      characters: [hero],
      initiativeOrder,
      attacksUsed: 0,
      turnEconomy: createDnd5eTurnEconomyCounts('wolf-turn'),
    })
    expect(preparedAttack.ok, preparedAttack.ok ? undefined : preparedAttack.reason).toBe(true)
    if (!preparedAttack.ok) return
    const hit = resolvePreparedDnd5eEquipmentAttack({
      prepared: preparedAttack.prepared,
      d20: 15,
      damageRolls: [5],
    })
    expect(hit.result.ok).toBe(true)
    if (!hit.application) return
    expect(
      hit.application.characters[0].dnd5eCombatState?.totemWarriorWolfAttunementTargetIds,
    ).toEqual([enemyToken.id])

    const knockdownAction: SharedPlayerActionState = {
      ...attackAction,
      id: 'knockdown',
      type: 'dnd5e-class-feature',
      dnd5eClassFeature: {
        feature: 'barbarian-totem-wolf-knockdown',
        targetTokenId: enemyToken.id,
      },
      seq: 2,
    }
    const preparedKnockdown = prepareDnd5eClassFeature({
      action: knockdownAction,
      map: hit.application.map,
      characters: hit.application.characters,
      initiativeOrder,
      turnEconomy: createDnd5eTurnEconomyCounts('wolf-turn'),
    })
    expect(
      preparedKnockdown.ok,
      preparedKnockdown.ok ? undefined : preparedKnockdown.reason,
    ).toBe(true)
    if (!preparedKnockdown.ok) return
    const knockedDown = resolvePreparedDnd5eClassFeature({
      prepared: preparedKnockdown.prepared,
    })
    expect(knockedDown.result.ok).toBe(true)
    expect(
      knockedDown.application?.map.tokens.find((entry) => entry.id === enemyToken.id)
        ?.dnd5eCombatState?.conditions,
    ).toContain('prone')
  })

  it('grants Eagle Attunement flight during rage and settles the unsupported landing at turn end', () => {
    const eagle = totem('eagle', 14, ['totemic-attunement-eagle'], {
      initiative: 30,
      elevationFeet: 30,
      airborne: true,
    })
    const state = stateWith([
      eagle,
      combatant('enemy', 'dm', 10, { position: { x: 30, y: 0 } }),
    ])
    expect(dnd5eEffectiveFlySpeed(state.combatants.eagle)).toBe(30)

    const landed = success(resolveDnd5eHeadlessAction(state, {
      type: 'end-turn',
      actorId: 'eagle',
      totemEagleLandingElevationFeet: 0,
      totemEagleFallingDamageRolls: [6, 6, 6],
    }))
    expect(landed.state.combatants.eagle).toMatchObject({
      currentHp: 31,
      elevationFeet: 0,
      airborne: false,
    })
    expect(landed.state.combatants.eagle.conditions).toContain('prone')
    expect(landed.events).toContainEqual(expect.objectContaining({
      type: 'falling-damage-resolved',
      actorId: 'eagle',
      distanceFeet: 30,
      damage: 9,
    }))
  })

  it('still settles Eagle Attunement landing after Rage was ended voluntarily', () => {
    const state = stateWith([
      totem('eagle', 14, ['totemic-attunement-eagle'], {
        initiative: 30,
        elevationFeet: 30,
        airborne: true,
      }),
      combatant('enemy', 'dm', 10, { position: { x: 30, y: 0 } }),
    ])
    const rageEnded = success(resolveDnd5eHeadlessAction(state, {
      type: 'barbarian-rage',
      actorId: 'eagle',
      end: true,
    }))
    expect(rageEnded.state.combatants.eagle).toMatchObject({
      airborne: true,
      classState: { raging: undefined },
    })

    const landed = success(resolveDnd5eHeadlessAction(rageEnded.state, {
      type: 'end-turn',
      actorId: 'eagle',
      totemEagleLandingElevationFeet: 0,
      totemEagleFallingDamageRolls: [6, 6, 6],
    }))
    expect(landed.state.combatants.eagle).toMatchObject({
      elevationFeet: 0,
      airborne: false,
      currentHp: 22,
    })
    expect(landed.events).toContainEqual(expect.objectContaining({
      type: 'falling-damage-resolved',
      actorId: 'eagle',
      distanceFeet: 30,
      damage: 18,
    }))
  })

  it('prepares the Eagle Attunement landing and falling dice recipe on the Host', () => {
    const hero = characterWithChoices()
    hero.dnd5eClassChoices!.classes!.barbarian!.selections![
      `${SUBCLASS_ID}/totemic-attunement`
    ] = ['eagle']
    hero.dnd5eCombatState = {
      schemaVersion: 2,
      raging: true,
      rageTurnsRemaining: 10,
      rageSustainedThisTurn: true,
    }
    const actorToken: Token = {
      id: 'eagle-token',
      label: hero.name,
      x: 25,
      y: 25,
      elevationFeet: 30,
      color: '',
      emoji: '',
      size: 1,
      type: 'player',
      characterId: hero.id,
    }
    const enemyToken: Token = {
      id: 'enemy-token',
      label: 'Enemy',
      x: 75,
      y: 25,
      color: '',
      emoji: '',
      size: 1,
      type: 'enemy',
      hp: 10,
      maxHp: 10,
    }
    const map: BattleMap = {
      id: 'totem-eagle-fall-map',
      name: 'Map',
      width: 200,
      height: 200,
      gridSize: 50,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      tokens: [actorToken, enemyToken],
    }
    const action: SharedPlayerActionState = {
      id: 'end',
      mapId: map.id,
      combatId: 'totem-eagle-fall',
      sourceMode: 'player',
      status: 'pending',
      type: 'end-turn',
      actorTokenId: actorToken.id,
      characterId: hero.id,
      round: 1,
      initiativeIndex: 0,
      seq: 1,
      updatedAt: 1,
    }
    const prepared = prepareDnd5ePlayerEndTurn({
      action,
      map,
      characters: [hero],
      initiativeOrder: [
        { tokenId: actorToken.id, label: actorToken.label, emoji: '', color: '', roll: 20 },
        { tokenId: enemyToken.id, label: enemyToken.label, emoji: '', color: '', roll: 10 },
      ],
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.totemEagleFall).toEqual({
      landingElevationFeet: 0,
      distanceFeet: 30,
      fallingDamageDice: 3,
    })

    hero.dnd5eCombatState = { schemaVersion: 2 }
    const afterRage = prepareDnd5ePlayerEndTurn({
      action,
      map,
      characters: [hero],
      initiativeOrder: [
        { tokenId: actorToken.id, label: actorToken.label, emoji: '', color: '', roll: 20 },
        { tokenId: enemyToken.id, label: enemyToken.label, emoji: '', color: '', roll: 10 },
      ],
    })
    expect(afterRage.ok, afterRage.ok ? undefined : afterRage.reason).toBe(true)
    if (!afterRage.ok) return
    expect(afterRage.prepared.totemEagleFall).toEqual({
      landingElevationFeet: 0,
      distanceFeet: 30,
      fallingDamageDice: 3,
    })
  })

  it('gives Bear Aspect advantage only for the explicit Strength context', () => {
    const state = stateWith([
      totem('bear', 6, ['aspect-of-the-beast-bear'], {
        initiative: 30,
        classState: {},
      }),
      combatant('enemy', 'dm', 10),
    ])
    const check = success(resolveDnd5eHeadlessAction(state, {
      type: 'ability-check',
      actorId: 'bear',
      ability: 'str',
      context: 'push-pull-lift-break',
      d20: 2,
      d20Second: 18,
      dc: 15,
    }))
    expect(check.events).toContainEqual(expect.objectContaining({
      type: 'ability-check-resolved',
      actorId: 'bear',
      d20: 18,
      mode: 'advantage',
      success: true,
    }))

    expect(resolveDnd5eHeadlessAction(stateWith([
      combatant('barbarian', 'player', 30, {
        classId: 'barbarian',
        level: 6,
        classLevels: { barbarian: 6 },
      }),
      combatant('enemy', 'dm', 10),
    ]), {
      type: 'ability-check',
      actorId: 'barbarian',
      ability: 'str',
      context: 'push-pull-lift-break',
      d20: 10,
      d20Second: 12,
    })).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })
})
