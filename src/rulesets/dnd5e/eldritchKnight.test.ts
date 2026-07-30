import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Character } from '../../types/character'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import type { BattleMap, Token } from '../../store/maps'
import { dnd5eClassProgression } from './classes'
import type { DeclarativeSubclassDefinitionV1 } from './declarativeSubclassAbility'
import {
  dnd5eEffectiveSpellcastingSource,
} from './subclassSpellcasting'
import {
  createDnd5eCombatant,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
} from './headlessCombatEngine'
import {
  createDnd5eMapCombatSnapshot,
  planDnd5eMapResultApplication,
} from './mapBridge'
import { dnd5ePluginSubclassDefinition, registerDnd5eRulesPlugin } from './pluginApi'
import { dnd5eSelectedSpellIdsForClass } from './spells'
import { dnd5eEldritchKnightFeatureForCombatant } from './eldritchKnight'
import { FIGHTER_RESOURCE_KEYS } from './fighter'
import { prepareDnd5eAdjudicatedSpell } from './adjudicatedSpellAction'
import {
  dnd5eSpellbookEntries,
  type Dnd5eImportedSpell,
} from './spellbook'

const PLUGIN_ID = 'local.test.eldritch-knight'
const SUBCLASS_ID = `${PLUGIN_ID}:eldritch-knight-2014`
const abilities = { str: 16, dex: 12, con: 14, int: 18, wis: 10, cha: 8 }
const LOCAL_DEFINITION_PATH = new URL(
  '../../../local-content/phb-2014/subclasses/eldritch-knight/subclasses.json',
  import.meta.url,
)

function definition(): DeclarativeSubclassDefinitionV1 {
  return JSON.parse(readFileSync(LOCAL_DEFINITION_PATH, 'utf8'))[0] as DeclarativeSubclassDefinitionV1
}

function register() {
  return registerDnd5eRulesPlugin({
    manifest: {
      id: PLUGIN_ID,
      name: 'Eldritch Knight Test',
      version: '1.0.0',
      apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1',
      publisher: 'Test',
      license: 'Private local use',
    },
    setup(api) {
      api.registerDeclarativeSubclass(definition())
    },
  })
}

function character(level: number): Character {
  return {
    rulesetId: 'dnd5e-2014-srd-5.1',
    id: 'fighter',
    name: 'Fighter',
    player: '',
    avatar: '',
    accent: '',
    race: 'human',
    charClass: '战士',
    level,
    background: 'soldier',
    experience: 0,
    reputation: 0,
    abilities,
    savingThrows: [],
    skills: [],
    maxHp: 60,
    currentHp: 60,
    tempHp: 0,
    hitDice: '1d10',
    ac: 18,
    speed: 30,
    initiativeBonus: 1,
    saveDC: 15,
    passivePerception: 10,
    inspiration: 0,
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    dnd5eClassLevels: { fighter: level },
    dnd5eClassChoices: {
      fighter: {
        subclass: SUBCLASS_ID,
        fightingStyles: [],
        extensionChoices: {
          [`${SUBCLASS_ID}/spell-cantrips`]: ['fire-bolt', 'acid-splash'],
          [`${SUBCLASS_ID}/spell-known`]: ['shield', 'magic-missile', 'burning-hands'],
        },
      },
    },
  }
}

function combatant(level: number) {
  const featureIds = definition().abilities
    .filter((ability) => ability.level <= level)
    .map((ability) => `${PLUGIN_ID}:eldritch-knight-2014.${ability.id}`)
  return createDnd5eCombatant({
    id: 'fighter',
    name: 'Fighter',
    controller: 'player',
    initiative: 20,
    abilities,
    proficiencyBonus: level >= 9 ? 4 : 3,
    armorClass: 18,
    currentHp: 60,
    maxHp: 60,
    temporaryHp: 0,
    speed: 30,
    position: { x: 0, y: 0 },
    concentrating: false,
    classId: 'fighter',
    level,
    classLevels: { fighter: level },
    subclassId: SUBCLASS_ID,
    subclassIds: { fighter: SUBCLASS_ID },
    pluginFeatureIds: featureIds,
    classResources: {
      [FIGHTER_RESOURCE_KEYS.actionSurge]: { current: level >= 2 ? 1 : 0, max: level >= 2 ? 1 : 0 },
    },
    mainWeaponId: 'longsword',
    weaponDamageSources: {
      longsword: { magical: false },
    },
    classState: level >= 3
      ? { eldritchKnightBondedWeaponIds: ['longsword'] }
      : undefined,
    classSelections: {
      [`${SUBCLASS_ID}/spell-cantrips`]: ['fire-bolt', 'acid-splash'],
      [`${SUBCLASS_ID}/spell-known`]: ['shield', 'magic-missile', 'burning-hands'],
    },
    classSelectionsByClass: {
      fighter: {
        [`${SUBCLASS_ID}/spell-cantrips`]: ['fire-bolt', 'acid-splash'],
        [`${SUBCLASS_ID}/spell-known`]: ['shield', 'magic-missile', 'burning-hands'],
      },
    },
  })
}

function enemy() {
  return createDnd5eCombatant({
    id: 'enemy',
    name: 'Enemy',
    controller: 'dm',
    initiative: 10,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    proficiencyBonus: 2,
    armorClass: 12,
    currentHp: 50,
    maxHp: 50,
    temporaryHp: 0,
    speed: 30,
    position: { x: 5, y: 0 },
    concentrating: false,
  })
}

describe.runIf(existsSync(LOCAL_DEFINITION_PATH))('2014 Eldritch Knight local Host protocol', () => {
  it('uses fighter-owned one-third slots with the wizard spell list', () => {
    const dispose = register()
    try {
      const hero = character(7)
      const source = dnd5eEffectiveSpellcastingSource(hero, 'fighter')
      expect(source).toMatchObject({
        classId: 'fighter',
        classLevel: 7,
        spellListClassId: 'wizard',
        definition: { spellcasting: { kind: 'one-third-known', ability: 'int' } },
      })
      expect(dnd5eClassProgression(source!.definition)[6].spellSlots).toEqual([4, 2])
      expect(dnd5eSelectedSpellIdsForClass(hero, 'fighter')).toContain('fire-bolt')
    } finally {
      dispose()
    }
  })

  it('casts a cantrip as fighter and opens exactly one War Magic bonus attack', () => {
    const dispose = register()
    try {
      const state = startDnd5eHeadlessCombat('ek-war-magic', [combatant(7), enemy()])
      expect(dnd5ePluginSubclassDefinition(SUBCLASS_ID)?.features.map((feature) => ({
        featureId: feature.featureId,
        automation: feature.automation,
        mechanic: feature.declarativeAbility?.mechanic,
      }))).toContainEqual(expect.objectContaining({
        featureId: `${PLUGIN_ID}:eldritch-knight-2014.war-magic`,
        automation: 'full',
        mechanic: { kind: 'eldritch-knight-2014', feature: 'war-magic' },
      }))
      expect(state.combatants.fighter.pluginFeatureIds).toContain(
        `${PLUGIN_ID}:eldritch-knight-2014.war-magic`,
      )
      expect(dnd5eEldritchKnightFeatureForCombatant(
        state.combatants.fighter,
        'war-magic',
      )).toBeTruthy()
      const cast = resolveDnd5eHeadlessAction(state, {
        type: 'cast-spell',
        actorId: 'fighter',
        targetId: 'enemy',
        spellId: 'fire-bolt',
        castingClassId: 'fighter',
        slotLevel: 0,
        d20: 12,
        effectRolls: [4, 5],
      })
      expect(cast.ok).toBe(true)
      if (!cast.ok) return
      expect(cast.state.combatants.fighter.classState.eldritchKnightWarMagicCantripTurnKey).toBeTruthy()
      const attack = resolveDnd5eHeadlessAction(cast.state, {
        type: 'attack',
        actorId: 'fighter',
        targetId: 'enemy',
        attackModifier: 6,
        d20: 12,
        spendAction: false,
        spendBonusAction: true,
        eldritchKnightWarMagicAttack: true,
        damage: { count: 1, sides: 8, bonus: 3, rolls: [5], type: 'slashing' },
        classDamageContext: {
          mode: 'melee',
          finesse: false,
          strengthBased: true,
          weaponDamageSides: 8,
          damageType: 'slashing',
          adjacentEnemyOfTarget: false,
        },
      })
      expect(attack.ok).toBe(true)
      if (!attack.ok) return
      expect(attack.state.combatants.fighter.turn.bonusActionAvailable).toBe(false)
      expect(attack.state.combatants.fighter.classState.eldritchKnightWarMagicCantripTurnKey).toBeUndefined()
    } finally {
      dispose()
    }
  })

  it('marks a weapon-hit target and consumes Eldritch Strike on the next spell save', () => {
    const dispose = register()
    try {
      const state = startDnd5eHeadlessCombat('ek-strike', [combatant(10), enemy()])
      const attack = resolveDnd5eHeadlessAction(state, {
        type: 'attack',
        actorId: 'fighter',
        targetId: 'enemy',
        attackModifier: 7,
        d20: 12,
        damage: { count: 1, sides: 8, bonus: 3, rolls: [5], type: 'slashing' },
        classDamageContext: {
          mode: 'melee',
          finesse: false,
          strengthBased: true,
          weaponDamageSides: 8,
          damageType: 'slashing',
          adjacentEnemyOfTarget: false,
        },
      })
      expect(attack.ok).toBe(true)
      if (!attack.ok) return
      expect(attack.state.combatants.enemy.classState.eldritchStrikeBySource?.fighter).toBeTruthy()
      attack.state.combatants.fighter.turn.actionAvailable = true
      const cast = resolveDnd5eHeadlessAction(attack.state, {
        type: 'cast-spell',
        actorId: 'fighter',
        targetId: 'enemy',
        spellId: 'acid-splash',
        castingClassId: 'fighter',
        slotLevel: 0,
        savingThrowD20: 18,
        savingThrowD20Second: 2,
        effectRolls: [3, 4],
      })
      expect(cast.ok).toBe(true)
      if (!cast.ok) return
      expect(cast.events).toContainEqual(expect.objectContaining({
        type: 'saving-throw-resolved',
        targetId: 'enemy',
        d20: 2,
      }))
      expect(cast.state.combatants.enemy.classState.eldritchStrikeBySource).toBeUndefined()
    } finally {
      dispose()
    }
  })

  it('persists Eldritch Strike on an unlinked monster token between map transactions', () => {
    const dispose = register()
    try {
      const hero = character(10)
      hero.equipment = {
        mainWeapon: {
          id: 'longsword',
          name: 'Longsword',
          slot: 'mainWeapon',
          dnd5e: {
            kind: 'weapon',
            category: 'martial',
            mode: 'melee',
            damage: { count: 1, sides: 8, type: 'slashing' },
            attackAbility: 'str',
            properties: [],
          },
        },
      }
      const actorToken: Token = {
        id: 'fighter-token',
        label: 'Fighter',
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
        id: 'map-bridge',
        name: 'Map Bridge',
        width: 500,
        height: 500,
        gridSize: 50,
        gridOffsetX: 0,
        gridOffsetY: 0,
        showGrid: true,
        feetPerCell: 5,
        tokens: [actorToken, enemyToken],
      }
      const initiativeOrder = [
        { slotId: 'fighter-token:normal', tokenId: actorToken.id, label: actorToken.label, emoji: '', color: '', roll: 20 },
        { slotId: 'enemy-token:normal', tokenId: enemyToken.id, label: enemyToken.label, emoji: '', color: '', roll: 10 },
      ]
      const snapshot = createDnd5eMapCombatSnapshot({
        combatId: 'eldritch-strike-map-bridge',
        round: 1,
        turnSlotId: initiativeOrder[0].slotId,
        map,
        characters: [hero],
        initiativeOrder,
      })
      const attack = resolveDnd5eHeadlessAction(snapshot.state, {
        type: 'attack',
        actorId: actorToken.id,
        targetId: enemyToken.id,
        attackModifier: 7,
        d20: 12,
        damage: { count: 1, sides: 8, bonus: 3, rolls: [5], type: 'slashing' },
        classDamageContext: {
          mode: 'melee',
          finesse: false,
          strengthBased: true,
          weaponDamageSides: 8,
          damageType: 'slashing',
          adjacentEnemyOfTarget: false,
        },
      })
      expect(attack.ok).toBe(true)
      if (!attack.ok) return
      const application = planDnd5eMapResultApplication({
        state: attack.state,
        map,
        characters: [hero],
        characterIdByCombatantId: snapshot.characterIdByCombatantId,
      })
      const persistedTarget = application.map.tokens.find((token) => token.id === enemyToken.id)
      expect(persistedTarget?.dnd5eCombatState?.eldritchStrikeBySource?.[actorToken.id]).toBeTruthy()

      const restored = createDnd5eMapCombatSnapshot({
        combatId: 'eldritch-strike-map-bridge',
        round: 1,
        turnSlotId: initiativeOrder[0].slotId,
        map: application.map,
        characters: application.characters,
        initiativeOrder,
      })
      expect(restored.state.combatants[enemyToken.id].classState
        .eldritchStrikeBySource?.[actorToken.id]).toBeTruthy()
    } finally {
      dispose()
    }
  })

  it('opens one Arcane Charge window from Action Surge and resolves a single 30-foot teleport', () => {
    const dispose = register()
    try {
      const state = startDnd5eHeadlessCombat('ek-arcane-charge', [combatant(15), enemy()])
      const surge = resolveDnd5eHeadlessAction(state, {
        type: 'fighter-action-surge',
        actorId: 'fighter',
        resourceKey: FIGHTER_RESOURCE_KEYS.actionSurge,
        alreadyUsedThisTurn: false,
      })
      expect(surge.ok).toBe(true)
      if (!surge.ok) return
      const turnKey = surge.state.combatants.fighter.classState.eldritchKnightArcaneChargeTurnKey
      expect(turnKey).toBeTruthy()

      const teleport = resolveDnd5eHeadlessAction(surge.state, {
        type: 'eldritch-knight-arcane-charge',
        actorId: 'fighter',
        to: { x: 30, y: 0 },
        distanceFeet: 30,
      })
      expect(teleport.ok).toBe(true)
      if (!teleport.ok) return
      expect(teleport.state.combatants.fighter.position).toEqual({ x: 30, y: 0 })
      expect(teleport.events).toContainEqual(expect.objectContaining({
        type: 'teleported',
        actorId: 'fighter',
        spellId: 'eldritch-knight:arcane-charge',
      }))

      const repeat = resolveDnd5eHeadlessAction(teleport.state, {
        type: 'eldritch-knight-arcane-charge',
        actorId: 'fighter',
        to: { x: 40, y: 0 },
        distanceFeet: 10,
      })
      expect(repeat).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
    } finally {
      dispose()
    }
  })

  it('summons the bonded main weapon with a bonus action and restores a dropped weapon', () => {
    const dispose = register()
    try {
      const fighter = combatant(3)
      fighter.classState.battleMasterDroppedWeaponIds = ['longsword']
      const state = startDnd5eHeadlessCombat('ek-weapon-bond', [fighter, enemy()])
      const summon = resolveDnd5eHeadlessAction(state, {
        type: 'eldritch-knight-summon-bonded-weapon',
        actorId: 'fighter',
        weaponId: 'longsword',
      })
      expect(summon.ok).toBe(true)
      if (!summon.ok) return
      expect(summon.state.combatants.fighter.turn.bonusActionAvailable).toBe(false)
      expect(summon.state.combatants.fighter.classState.battleMasterDroppedWeaponIds).toBeUndefined()
      expect(summon.events).toContainEqual({
        type: 'eldritch-knight-weapon-summoned',
        actorId: 'fighter',
        weaponId: 'longsword',
      })
    } finally {
      dispose()
    }
  })

  it('routes a local reference-only wizard spell through fighter-owned adjudicated casting', () => {
    const dispose = register()
    try {
      const spell: Dnd5eImportedSpell = {
        id: 'local.test:force-ward',
        name: '力场守护',
        englishName: 'Force Ward',
        level: 1,
        school: 'abjuration',
        ritual: false,
        castingTime: { value: 1, unit: 'action' },
        range: { type: 'self' },
        components: { verbal: true, somatic: true, material: false },
        duration: { type: 'timed', value: 1, unit: 'minute', concentration: false },
        classes: ['wizard'],
        description: '具体效果由本房间 DM 裁定。',
        source: { title: 'Local test data', publisher: 'Local DM', license: 'Private local use' },
        automation: { mode: 'reference-only' },
      }
      const hero = character(7)
      hero.classResources = { 'dnd5e-spell-slot-1': { current: 4, max: 4 } }
      hero.dnd5eClassChoices!.fighter!.extensionChoices![
        `${SUBCLASS_ID}/spell-known`
      ]!.push(spell.id)
      const actorToken: Token = {
        id: 'fighter-token',
        label: 'Fighter',
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
        id: 'map',
        name: 'Map',
        width: 500,
        height: 500,
        gridSize: 50,
        gridOffsetX: 0,
        gridOffsetY: 0,
        showGrid: true,
        feetPerCell: 5,
        tokens: [actorToken, enemyToken],
      }
      const action: SharedPlayerActionState = {
        id: 'cast',
        mapId: map.id,
        combatId: 'combat',
        sourceMode: 'player',
        status: 'pending',
        type: 'dnd5e-adjudicated-spell',
        actorTokenId: actorToken.id,
        characterId: hero.id,
        dnd5eAdjudicatedSpell: {
          spellId: spell.id,
          castingClassId: 'fighter',
          slotLevel: 1,
        },
        round: 1,
        initiativeIndex: 0,
        seq: 1,
        updatedAt: 1,
      }
      const spellbookEntries = dnd5eSpellbookEntries([spell])
      const prepared = prepareDnd5eAdjudicatedSpell({
        action,
        spell: spellbookEntries.find((entry) => entry.id === spell.id),
        spellbookEntries,
        map,
        characters: [hero],
        initiativeOrder: [
          { tokenId: actorToken.id, label: actorToken.label, emoji: '', color: '', roll: 20 },
          { tokenId: enemyToken.id, label: enemyToken.label, emoji: '', color: '', roll: 10 },
        ],
      })
      expect(prepared.ok).toBe(true)
      if (!prepared.ok) return
      expect(prepared.prepared).toMatchObject({
        castingClassId: 'fighter',
        castingClassLevel: 7,
        slotLevel: 1,
      })
    } finally {
      dispose()
    }
  })
})
