import { describe, expect, it } from 'vitest'
import {
  assignEnemyVisualVariants,
  DND5E_SRD_ENEMY_POOL,
  enemyTemplateToTokenPatch,
  searchEnemyPool,
  selectNextEnemyVisualVariantId,
} from '../../lib/enemyPool'
import { getEnemyStatBlock } from '../../lib/enemyStatBlocks'
import reviewedMonsterTranslations from './generated/srdMonsterTranslationsZh.reviewed.generated.json'
import {
  createDnd5eCombatant,
  dnd5eCombatantPairKey,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eCombatant,
} from './headlessCombatEngine'
import {
  DND5E_SRD_MONSTERS,
  dnd5eMonsterAreaSavingThrowVariants,
  dnd5eMonsterProficiencyBonus,
  dnd5eMonsterWeaponAttackAbility,
  getDnd5eSrdMonster,
  searchDnd5eSrdMonsters,
} from './monsters'

function combatant(
  id: string,
  initiative: number,
  patch: Partial<Dnd5eCombatant> = {},
): Dnd5eCombatant {
  return createDnd5eCombatant({
    id,
    name: id,
    controller: id === 'monster' ? 'dm' : 'player',
    initiative,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    proficiencyBonus: 2,
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

describe('SRD 5.1 monster catalog', () => {
  it('仅发布通过上下文复核且无英文正文残留的怪物译文', () => {
    expect(Object.keys(reviewedMonsterTranslations)).toHaveLength(334)
    type ReviewedMonsterTranslation = {
      spellcastingDescription: string
      traits: Array<{ description: string }>
      actions: Array<{ description: string }>
      reactions: Array<{ description: string }>
      legendaryActions: Array<{ description: string }>
      lairActions: Array<{ description: string }>
    }
    const reviewed = Object.values(reviewedMonsterTranslations) as ReviewedMonsterTranslation[]
    const descriptions = reviewed.flatMap((monster) => [
      monster.spellcastingDescription,
      ...monster.traits.map((entry) => entry.description),
      ...monster.actions.map((entry) => entry.description),
      ...monster.reactions.map((entry) => entry.description),
      ...monster.legendaryActions.map((entry) => entry.description),
      ...monster.lairActions.map((entry) => entry.description),
    ])
    const englishResidual = descriptions
      .join('\n')
      .replace(/\b(?:AC|DC|SRD|d\d+)\b/g, '')
      .match(/[A-Za-z]{2,}/g)
    expect(englishResidual).toBeNull()
    expect(reviewedMonsterTranslations.archmage.spellcastingDescription).toContain('法术反制')
  })

  it('contains the namespaced SRD monster and Wild Shape foundation without legacy custom templates', () => {
    expect(DND5E_SRD_MONSTERS).toHaveLength(334)
    expect(new Set(DND5E_SRD_MONSTERS.map((monster) => monster.id)).size).toBe(334)
    expect(DND5E_SRD_MONSTERS.every((monster) => monster.id.startsWith('srd-5.1:'))).toBe(true)
    expect(DND5E_SRD_MONSTERS.every((monster) => monster.source === 'SRD 5.1')).toBe(true)
    expect(DND5E_SRD_MONSTERS.some((monster) => monster.slug === 'slime')).toBe(false)
  })

  it('keeps exact SRD combat anchors for representative monsters', () => {
    const goblin = getDnd5eSrdMonster('srd-5.1:goblin')!
    expect(goblin).toMatchObject({
      armorClass: { value: 15, note: '皮甲、盾牌' },
      hitPoints: { average: 7, dice: '2d6' },
      speed: { walk: 30 },
      abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
      challenge: { rating: '1/4', xp: 50 },
    })
    expect(goblin.actions.find((action) => action.id === 'scimitar')?.attack).toMatchObject({ toHit: 4 })
    expect(goblin.traits[0]).toMatchObject({
      automation: 'headless',
      rule: { kind: 'nimble-escape', bonusActionOptions: ['disengage', 'hide'] },
    })

    const skeleton = getDnd5eSrdMonster('srd-5.1:skeleton')!
    expect(skeleton.damageVulnerabilities).toEqual(['bludgeoning'])
    expect(skeleton.damageImmunities).toEqual(['poison'])

    const owlbear = getDnd5eSrdMonster('srd-5.1:owlbear')!
    expect(owlbear.actions.find((action) => action.id === 'multiattack')?.sequence).toEqual(['beak', 'claws'])

    const adultBlackDragon = getDnd5eSrdMonster('srd-5.1:adult-black-dragon')!
    expect(adultBlackDragon.actions.find((action) => action.id === 'acid-breath')).toMatchObject({
      automation: 'headless',
      rule: {
        kind: 'area-saving-throw',
        area: { shape: 'line', lengthFeet: 60, widthFeet: 5 },
        ability: 'dex', dc: 18,
        damage: { count: 12, sides: 8, type: 'acid' },
        damageOnSuccessfulSave: 'half',
      },
    })
    expect(adultBlackDragon.actions.find((action) => action.id === 'frightful-presence')).toMatchObject({
      automation: 'headless',
      rule: {
        kind: 'area-saving-throw',
        area: { shape: 'circle', radiusFeet: 120 },
        ability: 'wis', dc: 16,
        conditionOnFailedSave: { condition: 'frightened', durationRounds: 10 },
        frightfulPresenceImmunityRounds: 14_400,
      },
    })
    expect(adultBlackDragon.actions.find((action) => action.id === 'multiattack')?.automation)
      .toBe('headless')
    expect(adultBlackDragon.actions.find((action) =>
      action.id === 'multiattack-weapons-only')).toMatchObject({
      automation: 'headless',
      sequence: ['bite', 'claw', 'claw'],
    })

    const adultBlueDragon = getDnd5eSrdMonster('srd-5.1:adult-blue-dragon')!
    expect(adultBlueDragon.actions.find((action) => action.id === 'lightning-breath')).toMatchObject({
      automation: 'headless',
      rule: {
        kind: 'area-saving-throw',
        area: { shape: 'line', lengthFeet: 90, widthFeet: 5 },
        ability: 'dex', dc: 19,
        damage: { count: 12, sides: 10, type: 'lightning' },
        damageOnSuccessfulSave: 'half',
      },
    })
    expect(adultBlueDragon.actions.find((action) => action.id === 'frightful-presence')).toMatchObject({
      automation: 'headless', rule: { ability: 'wis', dc: 17 },
    })
    expect(adultBlueDragon.legendaryActions?.find((action) => action.id === 'detect')?.automation).toBe('headless')

    const adultBrassDragon = getDnd5eSrdMonster('srd-5.1:adult-brass-dragon')!
    expect(adultBrassDragon.actions.find((action) => action.id === 'multiattack')?.automation)
      .toBe('headless')
    expect(adultBrassDragon.actions.find((action) =>
      action.id === 'multiattack-weapons-only')).toMatchObject({
      automation: 'headless',
      sequence: ['bite', 'claw', 'claw'],
    })
    expect(adultBrassDragon.actions.find((action) => action.id === 'frightful-presence')).toMatchObject({
      automation: 'headless', rule: { ability: 'wis', dc: 16 },
    })
    expect(adultBrassDragon.legendaryActions?.find((action) => action.id === 'detect')?.automation).toBe('headless')
    expect(adultBrassDragon.actions.find((action) => action.id === 'breath-weapons')).toMatchObject({
      automation: 'headless',
      usage: { kind: 'recharge', dieSides: 6, minimum: 5 },
      rule: {
        kind: 'area-saving-throw',
        variants: [
          { id: 'fire-breath', ability: 'dex', dc: 18, damage: { count: 13, sides: 6, type: 'fire' } },
          {
            id: 'sleep-breath', ability: 'con', dc: 18,
            conditionOnFailedSave: { condition: 'unconscious', breakOnDamage: true },
          },
        ],
      },
    })

    const ancientSilverDragon = getDnd5eSrdMonster('srd-5.1:ancient-silver-dragon')!
    expect(ancientSilverDragon.actions.find((action) => action.id === 'breath-weapons')).toMatchObject({
      automation: 'headless',
      rule: {
        variants: [
          { id: 'cold-breath', dc: 24, damage: { count: 15, sides: 8, type: 'cold' } },
          {
            id: 'paralyzing-breath', dc: 24,
            conditionOnFailedSave: { condition: 'paralyzed', repeatSaveAtEndOfTargetTurn: true },
          },
        ],
      },
    })

    const ankheg = getDnd5eSrdMonster('srd-5.1:ankheg')!
    expect(ankheg.actions.find((action) => action.id === 'acid-spray')).toMatchObject({
      automation: 'headless',
      usage: { kind: 'recharge', dieSides: 6, minimum: 6 },
      relationRequirement: { kind: 'none-from-source', slotGroup: 'bite' },
      rule: {
        kind: 'area-saving-throw',
        area: {
          shape: 'line',
          origin: 'self',
          lengthFeet: 30,
          widthFeet: 5,
          aimRangeFeet: 30,
        },
        target: 'all-creatures-except-self',
        ability: 'dex',
        dc: 13,
        damage: { average: 10, count: 3, sides: 6, bonus: 0, type: 'acid' },
        damageOnSuccessfulSave: 'half',
      },
    })
    expect(ankheg.actions.find((action) => action.id === 'bite')?.automation).toBe('headless')

    const bugbear = getDnd5eSrdMonster('srd-5.1:bugbear')!
    expect(bugbear.actions.find((action) => action.id === 'javelin')?.attack).toMatchObject({
      mode: 'melee-or-ranged',
      damage: [{ average: 9, count: 2, sides: 6, bonus: 2, type: 'piercing' }],
      rangedDamage: [{ average: 5, count: 1, sides: 6, bonus: 2, type: 'piercing' }],
      reachFeet: 5,
      rangeFeet: { normal: 30, long: 120 },
    })

    const cultFanatic = getDnd5eSrdMonster('srd-5.1:cult-fanatic')!
    expect(cultFanatic.actions.find((action) => action.id === 'multiattack')).toMatchObject({
      automation: 'headless',
      sequence: ['dagger', 'dagger'],
      sequenceAttackMode: 'melee',
    })

    const aboleth = getDnd5eSrdMonster('srd-5.1:aboleth')!
    expect(aboleth.traits[0]).toMatchObject({
      name: '两栖',
      automation: 'dm-adjudication',
    })
    expect(aboleth.traits[0]?.rule).toBeUndefined()
    expect(aboleth.traits[1]).toMatchObject({
      automation: 'headless',
      rule: {
        kind: 'mucous-cloud',
        saveDc: 14,
        condition: 'disease',
        maximumTriggerDistanceFeet: 5,
      },
    })

    const blackWyrmling = getDnd5eSrdMonster('srd-5.1:black-dragon-wyrmling')!
    expect(blackWyrmling.actions.find((action) => action.id === 'acid-breath')).toMatchObject({
      automation: 'headless',
      usage: { kind: 'recharge', dieSides: 6, minimum: 5 },
      rule: {
        kind: 'area-saving-throw',
        area: { shape: 'line', lengthFeet: 15, widthFeet: 5 },
        ability: 'dex',
        dc: 11,
        damage: { count: 5, sides: 8, type: 'acid' },
        damageOnSuccessfulSave: 'half',
      },
    })

    const blueWyrmling = getDnd5eSrdMonster('srd-5.1:blue-dragon-wyrmling')!
    expect(blueWyrmling.actions.find((action) => action.id === 'lightning-breath')).toMatchObject({
      automation: 'headless',
      rule: {
        area: { shape: 'line', lengthFeet: 30, widthFeet: 5 },
        ability: 'dex',
        dc: 12,
        damage: { count: 4, sides: 10, type: 'lightning' },
      },
    })

    const behir = getDnd5eSrdMonster('srd-5.1:behir')!
    expect(behir.actions.find((action) => action.id === 'lightning-breath')).toMatchObject({
      automation: 'headless',
      rule: {
        area: { shape: 'line', lengthFeet: 20, widthFeet: 5 },
        ability: 'dex',
        dc: 16,
        damage: { count: 12, sides: 10, type: 'lightning' },
      },
    })
    expect(behir.actions.find((action) => action.id === 'constrict')?.automation).toBe('headless')
    expect(behir.actions.find((action) => action.id === 'multiattack')).toMatchObject({
      automation: 'headless',
      sequence: ['bite', 'constrict'],
    })

    const brassWyrmling = getDnd5eSrdMonster('srd-5.1:brass-dragon-wyrmling')!
    expect(brassWyrmling.actions.find((action) => action.id === 'breath-weapons')).toMatchObject({
      automation: 'headless',
      usage: { kind: 'recharge', dieSides: 6, minimum: 5 },
      rule: {
        kind: 'area-saving-throw',
        variants: [
          {
            id: 'fire-breath',
            area: { shape: 'line', lengthFeet: 20, widthFeet: 5 },
            ability: 'dex',
            dc: 11,
            damage: { count: 4, sides: 6, type: 'fire' },
          },
          {
            id: 'sleep-breath',
            area: { shape: 'cone', lengthFeet: 15 },
            ability: 'con',
            dc: 11,
            conditionOnFailedSave: {
              condition: 'unconscious',
              durationRounds: 10,
              repeatSaveAtEndOfTargetTurn: false,
              breakOnDamage: true,
            },
          },
        ],
      },
    })

    for (const expected of [
      {
        id: 'srd-5.1:silver-dragon-wyrmling',
        damage: { dc: 13, count: 4, sides: 8, lengthFeet: 15 },
        control: { dc: 13, lengthFeet: 15 },
      },
      {
        id: 'srd-5.1:young-brass-dragon',
        damage: { dc: 14, count: 12, sides: 6, lengthFeet: 40 },
        control: { dc: 14, lengthFeet: 30 },
      },
      {
        id: 'srd-5.1:young-silver-dragon',
        damage: { dc: 17, count: 12, sides: 8, lengthFeet: 30 },
        control: { dc: 17, lengthFeet: 30 },
      },
    ] as const) {
      const monster = getDnd5eSrdMonster(expected.id)!
      const breath = monster.actions.find((action) => action.id === 'breath-weapons')
      expect(breath).toMatchObject({
        automation: 'headless',
        usage: { kind: 'recharge', dieSides: 6, minimum: 5 },
        rule: {
          kind: 'area-saving-throw',
          variants: [
            {
              area: { lengthFeet: expected.damage.lengthFeet },
              dc: expected.damage.dc,
              damage: { count: expected.damage.count, sides: expected.damage.sides },
            },
            {
              area: { shape: 'cone', lengthFeet: expected.control.lengthFeet },
              dc: expected.control.dc,
              conditionOnFailedSave: {
                repeatSaveAtEndOfTargetTurn: expected.id !== 'srd-5.1:young-brass-dragon',
              },
            },
          ],
        },
      })
    }

    const badger = getDnd5eSrdMonster('srd-5.1:badger')!
    expect(badger.actions.find((action) => action.id === 'bite')).toMatchObject({
      kind: 'weapon-attack',
      automation: 'headless',
      attack: {
        toHit: 2,
        damage: [{ average: 1, count: 0, bonus: 1, type: 'piercing' }],
      },
    })
    const cat = getDnd5eSrdMonster('srd-5.1:cat')!
    expect(cat.actions.find((action) => action.id === 'claws')).toMatchObject({
      kind: 'weapon-attack',
      automation: 'headless',
      attack: {
        toHit: 0,
        damage: [{ average: 1, count: 0, bonus: 1, type: 'slashing' }],
      },
    })
    const crab = getDnd5eSrdMonster('srd-5.1:crab')!
    expect(crab.actions.find((action) => action.id === 'claw')).toMatchObject({
      kind: 'weapon-attack',
      automation: 'headless',
      attack: {
        mode: 'melee',
        toHit: 0,
        reachFeet: 5,
        damage: [{ average: 1, count: 0, bonus: 1, type: 'bludgeoning' }],
      },
    })
    const barbedDevil = getDnd5eSrdMonster('srd-5.1:barbed-devil')!
    expect(barbedDevil.actions.find((action) => action.id === 'multiattack')).toMatchObject({
      kind: 'multiattack',
      automation: 'headless',
      sequence: ['tail', 'claw', 'claw'],
    })
    expect(barbedDevil.actions.find((action) => action.id === 'multiattack-hurl-flame')).toMatchObject({
      kind: 'multiattack',
      automation: 'headless',
      sequence: ['hurl-flame', 'hurl-flame'],
    })
    expect(barbedDevil.actions.find((action) => action.id === 'hurl-flame')).toMatchObject({
      kind: 'weapon-attack',
      automation: 'headless',
      attack: {
        mode: 'ranged',
        toHit: 5,
        rangeFeet: { normal: 150, long: 150 },
        damage: [{ count: 3, sides: 6, type: 'fire' }],
      },
    })

    const boneDevil = getDnd5eSrdMonster('srd-5.1:bone-devil')!
    expect(boneDevil.actions.find((action) => action.id === 'multiattack')).toMatchObject({
      kind: 'multiattack',
      automation: 'headless',
      sequence: ['claw', 'claw', 'sting'],
      sequenceAttackMode: 'melee',
    })
    expect(boneDevil.actions.find((action) => action.id === 'sting')).toMatchObject({
      kind: 'weapon-attack',
      automation: 'headless',
      attack: {
        damage: [
          { average: 13, count: 2, sides: 8, bonus: 4, type: 'piercing' },
          { average: 17, count: 5, sides: 6, bonus: 0, type: 'poison' },
        ],
        onHitEffects: [{
          id: 'sting-poisoned',
          kind: 'saving-throw-condition',
          ability: 'con',
          dc: 14,
          conditionOnFailedSave: {
            condition: 'poisoned',
            durationRounds: 10,
            repeatSaveAtEndOfTargetTurn: true,
          },
        }],
      },
    })

    const chimera = getDnd5eSrdMonster('srd-5.1:chimera')!
    expect(chimera.actions.find((action) => action.id === 'multiattack')).toMatchObject({
      kind: 'multiattack',
      automation: 'headless',
      sequence: ['bite', 'horns', 'claws'],
    })
    expect(chimera.actions.find((action) => action.id === 'fire-breath')).toMatchObject({
      automation: 'headless',
      usage: { kind: 'recharge', dieSides: 6, minimum: 5 },
      rule: {
        kind: 'area-saving-throw',
        area: { shape: 'cone', origin: 'self', lengthFeet: 15, aimRangeFeet: 15 },
        target: 'all-creatures-except-self',
        ability: 'dex',
        dc: 15,
        damage: { average: 31, count: 7, sides: 8, bonus: 0, type: 'fire' },
        damageOnSuccessfulSave: 'half',
      },
    })

    const dragonTurtle = getDnd5eSrdMonster('srd-5.1:dragon-turtle')!
    expect(dragonTurtle.actions.find((action) => action.id === 'multiattack')).toMatchObject({
      kind: 'multiattack',
      automation: 'headless',
      sequence: ['bite', 'claw', 'claw'],
    })
    expect(dragonTurtle.actions.find((action) => action.id === 'tail')).toMatchObject({
      kind: 'weapon-attack',
      automation: 'headless',
      attack: {
        onHitEffects: [{
          kind: 'forced-movement',
          maximumDistanceFeet: 10,
          conditionOnFailedResistance: 'prone',
        }],
      },
    })
    expect(dragonTurtle.actions.find((action) => action.id === 'steam-breath')).toMatchObject({
      automation: 'headless',
      usage: { kind: 'recharge', dieSides: 6, minimum: 5 },
      rule: {
        kind: 'area-saving-throw',
        area: { shape: 'cone', origin: 'self', lengthFeet: 60, aimRangeFeet: 60 },
        target: 'all-creatures-except-self',
        ability: 'con',
        dc: 18,
        damage: { average: 52, count: 15, sides: 6, bonus: 0, type: 'fire' },
        damageOnSuccessfulSave: 'half',
      },
    })

    const blackBear = getDnd5eSrdMonster('srd-5.1:black-bear')!
    expect(blackBear).toMatchObject({ creatureType: '野兽', challenge: { rating: '1/2' }, speed: { walk: 40, climb: 30 } })
    expect(blackBear.actions.find((action) => action.id === 'multiattack')?.sequence).toEqual(['bite', 'claws'])
    expect(getDnd5eSrdMonster('srd-5.1:bat')).toMatchObject({ challenge: { rating: '0' }, speed: { fly: 30 } })
    expect(getDnd5eSrdMonster('srd-5.1:frog')).toMatchObject({ challenge: { rating: '0' }, speed: { swim: 20 } })
  })

  it('gives legacy legendary wrappers stable unique IDs that reference their base actions', () => {
    for (const expected of [
      {
        monsterId: 'srd-5.1:unicorn',
        baseActionId: 'hooves',
        legendaryActionId: 'legendary-hooves',
        automation: 'headless',
      },
      {
        monsterId: 'srd-5.1:vampire-vampire',
        baseActionId: 'unarmed-strike',
        legendaryActionId: 'legendary-unarmed-strike',
        automation: 'dm-adjudication',
      },
      {
        monsterId: 'srd-5.1:lich',
        baseActionId: 'paralyzing-touch',
        legendaryActionId: 'paralyzing-touch-costs-2-actions',
        automation: 'headless',
      },
    ] as const) {
      const monster = getDnd5eSrdMonster(expected.monsterId)!
      expect(monster.actions.some((action) => action.id === expected.baseActionId)).toBe(true)
      expect(monster.legendaryActions).toContainEqual(expect.objectContaining({
        id: expected.legendaryActionId,
        referencedActionId: expected.baseActionId,
        automation: expected.automation,
      }))
      expect(monster.legendaryActions?.some((action) =>
        action.id === expected.baseActionId)).toBe(false)
    }
  })

  it('preserves legendary resistance uses and canonical CR experience', () => {
    const legendary = DND5E_SRD_MONSTERS.filter((monster) => monster.legendaryResistanceUses != null)
    expect(legendary.length).toBeGreaterThanOrEqual(20)
    expect(legendary.every((monster) => (monster.legendaryResistanceUses ?? 0) > 0)).toBe(true)
    expect(getDnd5eSrdMonster('srd-5.1:lich')?.legendaryResistanceUses).toBe(3)
    expect(getDnd5eSrdMonster('srd-5.1:brass-dragon-wyrmling')?.challenge).toEqual({ rating: '1', xp: 200 })
    expect(getDnd5eSrdMonster('srd-5.1:dretch')?.challenge).toEqual({ rating: '1/4', xp: 50 })
    expect(getDnd5eSrdMonster('srd-5.1:riding-horse')?.challenge).toEqual({ rating: '1/4', xp: 50 })
    expect(getDnd5eSrdMonster('srd-5.1:deep-gnome-svirfneblin')?.challenge).toEqual({ rating: '1/2', xp: 100 })
  })

  it('keeps the next catalog breath batch on exact Headless area rules', () => {
    const examples = [
      {
        slug: 'dust-mephit', actionId: 'blinding-breath', shape: 'cone',
        lengthFeet: 15, ability: 'dex', dc: 10, rechargeMinimum: 6,
        condition: {
          condition: 'blinded',
          durationRounds: 10,
          repeatSaveAtEndOfTargetTurn: true,
        },
      },
      {
        slug: 'green-dragon-wyrmling', actionId: 'poison-breath', shape: 'cone',
        lengthFeet: 15, ability: 'con', dc: 11, rechargeMinimum: 5,
        damage: { average: 21, count: 6, sides: 6, bonus: 0, type: 'poison' },
      },
      {
        slug: 'half-red-dragon-veteran', actionId: 'fire-breath', shape: 'cone',
        lengthFeet: 15, ability: 'dex', dc: 15, rechargeMinimum: 5,
        damage: { average: 24, count: 7, sides: 6, bonus: 0, type: 'fire' },
      },
      {
        slug: 'hell-hound', actionId: 'fire-breath', shape: 'cone',
        lengthFeet: 15, ability: 'dex', dc: 12, rechargeMinimum: 5,
        damage: { average: 21, count: 6, sides: 6, bonus: 0, type: 'fire' },
      },
      {
        slug: 'ice-mephit', actionId: 'frost-breath', shape: 'cone',
        lengthFeet: 15, ability: 'dex', dc: 10, rechargeMinimum: 6,
        damage: { average: 5, count: 2, sides: 4, bonus: 0, type: 'cold' },
      },
      {
        slug: 'iron-golem', actionId: 'poison-breath', shape: 'cone',
        lengthFeet: 15, ability: 'con', dc: 19, rechargeMinimum: 5,
        damage: { average: 45, count: 10, sides: 8, bonus: 0, type: 'poison' },
      },
      {
        slug: 'magma-mephit', actionId: 'fire-breath', shape: 'cone',
        lengthFeet: 15, ability: 'dex', dc: 11, rechargeMinimum: 6,
        damage: { average: 7, count: 2, sides: 6, bonus: 0, type: 'fire' },
      },
      {
        slug: 'red-dragon-wyrmling', actionId: 'fire-breath', shape: 'cone',
        lengthFeet: 15, ability: 'dex', dc: 13, rechargeMinimum: 5,
        damage: { average: 24, count: 7, sides: 6, bonus: 0, type: 'fire' },
      },
      {
        slug: 'white-dragon-wyrmling', actionId: 'cold-breath', shape: 'cone',
        lengthFeet: 15, ability: 'con', dc: 12, rechargeMinimum: 5,
        damage: { average: 22, count: 5, sides: 8, bonus: 0, type: 'cold' },
      },
      {
        slug: 'winter-wolf', actionId: 'cold-breath', shape: 'cone',
        lengthFeet: 15, ability: 'dex', dc: 12, rechargeMinimum: 5,
        damage: { average: 18, count: 4, sides: 8, bonus: 0, type: 'cold' },
      },
      {
        slug: 'young-black-dragon', actionId: 'acid-breath', shape: 'line',
        lengthFeet: 30, ability: 'dex', dc: 14, rechargeMinimum: 5,
        damage: { average: 49, count: 11, sides: 8, bonus: 0, type: 'acid' },
      },
      {
        slug: 'young-blue-dragon', actionId: 'lightning-breath', shape: 'line',
        lengthFeet: 60, ability: 'dex', dc: 16, rechargeMinimum: 5,
        damage: { average: 55, count: 10, sides: 10, bonus: 0, type: 'lightning' },
      },
      {
        slug: 'young-green-dragon', actionId: 'poison-breath', shape: 'cone',
        lengthFeet: 30, ability: 'con', dc: 14, rechargeMinimum: 5,
        damage: { average: 42, count: 12, sides: 6, bonus: 0, type: 'poison' },
      },
      {
        slug: 'young-red-dragon', actionId: 'fire-breath', shape: 'cone',
        lengthFeet: 30, ability: 'dex', dc: 17, rechargeMinimum: 5,
        damage: { average: 56, count: 16, sides: 6, bonus: 0, type: 'fire' },
      },
      {
        slug: 'young-white-dragon', actionId: 'cold-breath', shape: 'cone',
        lengthFeet: 30, ability: 'con', dc: 15, rechargeMinimum: 5,
        damage: { average: 45, count: 10, sides: 8, bonus: 0, type: 'cold' },
      },
    ] as const

    expect(examples).toHaveLength(15)
    for (const example of examples) {
      const action = getDnd5eSrdMonster(`srd-5.1:${example.slug}`)!
        .actions.find((candidate) => candidate.id === example.actionId)
      expect(action, `${example.slug}/${example.actionId}`).toMatchObject({
        automation: 'headless',
        usage: { kind: 'recharge', dieSides: 6, minimum: example.rechargeMinimum },
        rule: {
          kind: 'area-saving-throw',
          area: {
            shape: example.shape,
            origin: 'self',
            lengthFeet: example.lengthFeet,
            aimRangeFeet: example.lengthFeet,
            ...(example.shape === 'line' ? { widthFeet: 5 } : {}),
          },
          target: 'all-creatures-except-self',
          ability: example.ability,
          dc: example.dc,
          ...('damage' in example
            ? { damage: example.damage, damageOnSuccessfulSave: 'half' }
            : { conditionOnFailedSave: example.condition }),
        },
      })
    }
  })

  it('does not filter indiscriminate SRD breaths and acid spray down to hostiles', () => {
    const effects = DND5E_SRD_MONSTERS.flatMap((monster) =>
      monster.actions.flatMap((action) => {
        if (
          action.rule?.kind !== 'area-saving-throw' ||
          (!action.id.includes('breath') && action.id !== 'acid-spray')
        ) return []
        return dnd5eMonsterAreaSavingThrowVariants(action).map((variant) => ({
          monster: monster.slug,
          action: action.id,
          variant: variant.id,
          target: variant.target,
        }))
      }))

    // Chromatic and metallic dragons at four age bands plus the catalog's
    // other breath users make this broad enough to catch table regressions.
    expect(effects.length).toBeGreaterThanOrEqual(60)
    expect(effects.filter((effect) => effect.target !== 'all-creatures-except-self')).toEqual([])
  })

  it('structures fixed one-point attacks and the selected catalog weapon gaps exactly', () => {
    const fixedDamageAttacks = [
      ['hawk', 'talons', 5, 'slashing'],
      ['lizard', 'bite', 0, 'piercing'],
      ['owl', 'talons', 3, 'slashing'],
      ['quipper', 'bite', 5, 'piercing'],
      ['rat', 'bite', 0, 'piercing'],
      ['raven', 'beak', 4, 'piercing'],
      ['weasel', 'bite', 5, 'piercing'],
    ] as const
    for (const [slug, actionId, toHit, damageType] of fixedDamageAttacks) {
      expect(getDnd5eSrdMonster(`srd-5.1:${slug}`)?.actions
        .find((action) => action.id === actionId)).toMatchObject({
        kind: 'weapon-attack',
        automation: 'headless',
        attack: {
          mode: 'melee',
          toHit,
          reachFeet: 5,
          damage: [{
            average: 1,
            count: 0,
            sides: 4,
            bonus: 1,
            type: damageType,
          }],
        },
      })
    }

    expect(getDnd5eSrdMonster('srd-5.1:flying-snake')?.actions
      .find((action) => action.id === 'bite')).toMatchObject({
      kind: 'weapon-attack',
      automation: 'headless',
      attack: {
        mode: 'melee',
        toHit: 6,
        reachFeet: 5,
        damage: [
          { average: 1, count: 0, sides: 4, bonus: 1, type: 'piercing' },
          { average: 7, count: 3, sides: 4, bonus: 0, type: 'poison' },
        ],
      },
    })

    for (const slug of ['guard', 'tribal-warrior'] as const) {
      expect(getDnd5eSrdMonster(`srd-5.1:${slug}`)?.actions
        .find((action) => action.id === 'spear')).toMatchObject({
        kind: 'weapon-attack',
        automation: 'headless',
        attack: {
          mode: 'melee-or-ranged',
          toHit: 3,
          reachFeet: 5,
          rangeFeet: { normal: 20, long: 60 },
          damage: [{ average: 4, count: 1, sides: 6, bonus: 1, type: 'piercing' }],
        },
      })
    }

    expect(getDnd5eSrdMonster('srd-5.1:merfolk')?.actions
      .find((action) => action.id === 'spear')).toMatchObject({
      kind: 'weapon-attack',
      automation: 'headless',
      attack: {
        mode: 'melee-or-ranged',
        toHit: 2,
        reachFeet: 5,
        rangeFeet: { normal: 20, long: 60 },
        damage: [{ average: 4, count: 1, sides: 8, bonus: 0, type: 'piercing' }],
        rangedDamage: [{ average: 3, count: 1, sides: 6, bonus: 0, type: 'piercing' }],
      },
    })

    const longswordUsers = [
      ['hobgoblin', 3, 1],
      ['half-red-dragon-veteran', 5, 3],
      ['veteran', 5, 3],
    ] as const
    for (const [slug, toHit, bonus] of longswordUsers) {
      expect(getDnd5eSrdMonster(`srd-5.1:${slug}`)?.actions
        .find((action) => action.id === 'longsword')).toMatchObject({
        kind: 'weapon-attack',
        automation: 'headless',
        attack: {
          mode: 'melee',
          toHit,
          reachFeet: 5,
          damage: [{
            average: 4 + bonus,
            count: 1,
            sides: 8,
            bonus,
            type: 'slashing',
          }],
        },
      })
    }
    for (const slug of ['half-red-dragon-veteran', 'veteran'] as const) {
      expect(getDnd5eSrdMonster(`srd-5.1:${slug}`)?.actions
        .find((action) => action.id === 'multiattack')).toMatchObject({
        kind: 'multiattack',
        automation: 'headless',
        sequence: ['longsword', 'longsword', 'shortsword'],
      })
    }
  })

  it('structures each Assassin poison weapon hit as an indexed saving-throw damage effect', () => {
    const assassin = getDnd5eSrdMonster('srd-5.1:assassin')!
    expect(assassin.actions.find((action) => action.id === 'multiattack')).toMatchObject({
      kind: 'multiattack',
      automation: 'headless',
      sequence: ['shortsword', 'shortsword'],
    })

    for (const [actionId, mode, baseDamage] of [
      [
        'shortsword',
        'melee',
        { average: 6, count: 1, sides: 6, bonus: 3, type: 'piercing' },
      ],
      [
        'light-crossbow',
        'ranged',
        { average: 7, count: 1, sides: 8, bonus: 3, type: 'piercing' },
      ],
    ] as const) {
      const action = assassin.actions.find((candidate) => candidate.id === actionId)
      expect(action, actionId).toMatchObject({
        kind: 'weapon-attack',
        automation: 'headless',
        attack: {
          mode,
          toHit: 6,
          damage: [baseDamage],
          onHitEffects: [{
            id: 'poison-save-damage',
            kind: 'saving-throw-damage',
            ability: 'con',
            dc: 15,
            damage: [
              { average: 24, count: 7, sides: 6, bonus: 0, type: 'poison' },
            ],
            damageOnSuccessfulSave: 'half',
          }],
        },
      })
      expect(action?.attack?.damage).toHaveLength(1)
      expect(action?.attack?.onHitEffects).toHaveLength(1)
    }
  })

  it('structures the next catalog poison weapon riders without changing base or half-HP damage', () => {
    const cases = [
      [
        'giant-poisonous-snake',
        'bite',
        11,
        { average: 10, count: 3, sides: 6, bonus: 0, type: 'poison' },
        [{ average: 6, count: 1, sides: 4, bonus: 4, type: 'piercing' }],
        undefined,
      ],
      [
        'giant-scorpion',
        'sting',
        12,
        { average: 22, count: 4, sides: 10, bonus: 0, type: 'poison' },
        [{ average: 7, count: 1, sides: 10, bonus: 2, type: 'piercing' }],
        undefined,
      ],
      [
        'guardian-naga',
        'bite',
        15,
        { average: 45, count: 10, sides: 8, bonus: 0, type: 'poison' },
        [{ average: 8, count: 1, sides: 8, bonus: 4, type: 'piercing' }],
        undefined,
      ],
      [
        'imp',
        'sting-bite-in-beast-form',
        11,
        { average: 10, count: 3, sides: 6, bonus: 0, type: 'poison' },
        [{ average: 5, count: 1, sides: 4, bonus: 3, type: 'piercing' }],
        undefined,
      ],
      [
        'purple-worm',
        'tail-stinger',
        19,
        { average: 42, count: 12, sides: 6, bonus: 0, type: 'poison' },
        [{ average: 19, count: 3, sides: 6, bonus: 9, type: 'piercing' }],
        undefined,
      ],
      [
        'spirit-naga',
        'bite',
        13,
        { average: 31, count: 7, sides: 8, bonus: 0, type: 'poison' },
        [{ average: 7, count: 1, sides: 6, bonus: 4, type: 'piercing' }],
        undefined,
      ],
      [
        'swarm-of-poisonous-snakes',
        'bites',
        10,
        { average: 14, count: 4, sides: 6, bonus: 0, type: 'poison' },
        [{ average: 7, count: 2, sides: 6, bonus: 0, type: 'piercing' }],
        [{ average: 3, count: 1, sides: 6, bonus: 0, type: 'piercing' }],
      ],
      [
        'wyvern',
        'stinger',
        15,
        { average: 24, count: 7, sides: 6, bonus: 0, type: 'poison' },
        [{ average: 11, count: 2, sides: 6, bonus: 4, type: 'piercing' }],
        undefined,
      ],
    ] as const

    for (const [slug, actionId, dc, poisonDamage, baseDamage, damageAtHalfHp] of cases) {
      const action = getDnd5eSrdMonster(`srd-5.1:${slug}`)?.actions
        .find((candidate) => candidate.id === actionId)
      expect(action, `${slug}/${actionId}`).toMatchObject({
        kind: 'weapon-attack',
        automation: 'headless',
        attack: {
          damage: baseDamage,
          onHitEffects: [{
            id: 'poison-save-damage',
            kind: 'saving-throw-damage',
            ability: 'con',
            dc,
            damage: [poisonDamage],
            damageOnSuccessfulSave: 'half',
          }],
        },
      })
      expect(action?.attack?.damage).toEqual(baseDamage)
      expect(action?.attack?.damage.some((damage) => damage.type === 'poison')).toBe(false)
      expect(action?.attack?.damageAtHalfHp).toEqual(damageAtHalfHp)
      expect(action?.attack?.onHitEffects).toHaveLength(1)
    }

    for (const slug of ['purple-worm', 'wyvern'] as const) {
      expect(getDnd5eSrdMonster(`srd-5.1:${slug}`)?.actions
        .find((action) => action.id === 'multiattack')?.automation).toBe('headless')
    }
  })

  it('structures the first source-linked grapple and restrained catalog actions', () => {
    const cases = [
      {
        slug: 'ankheg',
        actionId: 'bite',
        effectId: 'bite-grapple',
        slotGroup: 'bite',
        capacity: 1,
        maxDistanceFeet: 5,
        targetMaxSizeRank: 3,
        whenCapacityFull: 'linked-target-only',
        attackAdvantageAgainstLinkedTarget: true,
        escapeDc: 13,
        conditions: [{ condition: 'grappled' }],
      },
      {
        slug: 'behir',
        actionId: 'constrict',
        effectId: 'constrict-grapple',
        slotGroup: 'constrict',
        capacity: 1,
        maxDistanceFeet: 5,
        targetMaxSizeRank: 3,
        whenCapacityFull: 'skip-application',
        escapeDc: 16,
        conditions: [
          { condition: 'grappled' },
          { condition: 'restrained', dependsOnCondition: 'grappled' },
        ],
      },
      {
        slug: 'constrictor-snake',
        actionId: 'constrict',
        effectId: 'constrict-grapple',
        slotGroup: 'constrict',
        capacity: 1,
        maxDistanceFeet: 5,
        targetMaxSizeRank: 5,
        whenCapacityFull: 'linked-target-only',
        escapeDc: 14,
        conditions: [
          { condition: 'grappled' },
          { condition: 'restrained', dependsOnCondition: 'grappled' },
        ],
      },
      {
        slug: 'giant-constrictor-snake',
        actionId: 'constrict',
        effectId: 'constrict-grapple',
        slotGroup: 'constrict',
        capacity: 1,
        maxDistanceFeet: 5,
        targetMaxSizeRank: 5,
        whenCapacityFull: 'linked-target-only',
        escapeDc: 16,
        conditions: [
          { condition: 'grappled' },
          { condition: 'restrained', dependsOnCondition: 'grappled' },
        ],
      },
      {
        slug: 'giant-octopus',
        actionId: 'tentacles',
        effectId: 'tentacles-grapple',
        slotGroup: 'tentacles',
        capacity: 1,
        maxDistanceFeet: 15,
        targetMaxSizeRank: 5,
        whenCapacityFull: 'linked-target-only',
        escapeDc: 16,
        conditions: [
          { condition: 'grappled' },
          { condition: 'restrained', dependsOnCondition: 'grappled' },
        ],
      },
      {
        slug: 'giant-scorpion',
        actionId: 'claw',
        effectId: 'claw-grapple',
        slotGroup: 'claw',
        capacity: 2,
        maxDistanceFeet: 5,
        targetMaxSizeRank: 5,
        whenCapacityFull: 'skip-application',
        escapeDc: 12,
        conditions: [{ condition: 'grappled' }],
      },
    ] as const

    for (const expected of cases) {
      const action = getDnd5eSrdMonster(`srd-5.1:${expected.slug}`)?.actions
        .find((candidate) => candidate.id === expected.actionId)
      expect(action, `${expected.slug}/${expected.actionId}`).toMatchObject({
        kind: 'weapon-attack',
        automation: 'headless',
        attack: {
          onHitEffects: [{
            id: expected.effectId,
            kind: 'source-linked-condition',
            relation: {
              kind: 'grapple',
              slotGroup: expected.slotGroup,
              capacity: expected.capacity,
              maxDistanceFeet: expected.maxDistanceFeet,
              targetMaxSizeRank: expected.targetMaxSizeRank,
              whenCapacityFull: expected.whenCapacityFull,
              ...('attackAdvantageAgainstLinkedTarget' in expected
                ? {
                    attackAdvantageAgainstLinkedTarget:
                      expected.attackAdvantageAgainstLinkedTarget,
                  }
                : {}),
            },
            escapeDc: expected.escapeDc,
            conditions: expected.conditions,
          }],
        },
      })
      expect(action?.attack?.onHitEffects).toHaveLength(1)
    }

    expect(getDnd5eSrdMonster('srd-5.1:behir')?.actions
      .find((action) => action.id === 'constrict')?.attack?.targetMaxSizeRank).toBe(3)
    expect(getDnd5eSrdMonster('srd-5.1:ankheg')?.actions
      .find((action) => action.id === 'bite')?.attack?.targetMaxSizeRank).toBeUndefined()
    expect(getDnd5eSrdMonster('srd-5.1:giant-scorpion')?.actions
      .find((action) => action.id === 'multiattack')).toMatchObject({
      automation: 'headless',
      sequence: ['claw', 'claw', 'sting'],
    })
  })

  it('structures the selected knockdown, undead fortitude, and Magic Resistance traits', () => {
    for (const [slug, dc] of [
      ['mastiff', 11],
      ['winter-wolf', 14],
      ['worg', 13],
    ] as const) {
      expect(getDnd5eSrdMonster(`srd-5.1:${slug}`)?.actions
        .find((action) => action.id === 'bite')).toMatchObject({
        kind: 'weapon-attack',
        automation: 'headless',
        attack: {
          onHitRule: {
            kind: 'saving-throw-condition',
            ability: 'str',
            dc,
            condition: 'prone',
          },
        },
      })
    }
    for (const [slug, actionId, dc] of [
      ['stone-giant', 'rock', 17],
      ['tarrasque', 'tail', 20],
    ] as const) {
      expect(getDnd5eSrdMonster(`srd-5.1:${slug}`)?.actions
        .find((action) => action.id === actionId)).toMatchObject({
        automation: 'headless',
        attack: {
          onHitRule: {
            kind: 'saving-throw-condition',
            ability: 'str',
            dc,
            condition: 'prone',
          },
        },
      })
    }

    expect(getDnd5eSrdMonster('srd-5.1:ogre-zombie')?.traits[0]).toMatchObject({
      automation: 'headless',
      rule: {
        kind: 'undead-fortitude',
        dcBase: 5,
        excludedDamageTypes: ['radiant'],
        excludedOnCritical: true,
      },
    })

    const magicResistanceTraits = DND5E_SRD_MONSTERS.flatMap((monster) =>
      monster.traits
        .filter((trait) => /^(?:Magic Resistance|\u9b54\u6cd5\u6297\u6027)$/i.test(trait.name.trim()))
        .map((trait) => ({ slug: monster.slug, trait })))
    expect(magicResistanceTraits.length).toBeGreaterThan(0)
    for (const { slug, trait } of magicResistanceTraits) {
      expect(trait, slug).toMatchObject({
        automation: 'headless',
        rule: {
          kind: 'magic-resistance',
          savingThrowAdvantageAgainstMagic: true,
        },
      })
    }
  })

  it('structures all bronze, copper, and gold dragon breath variants with one shared recharge action', () => {
    const cases = [
      ['bronze-dragon-wyrmling', 12, 40, 5, 16, 3, 30, 30],
      ['young-bronze-dragon', 15, 60, 5, 55, 10, 30, 40],
      ['adult-bronze-dragon', 19, 90, 5, 66, 12, 30, 60],
      ['ancient-bronze-dragon', 23, 120, 10, 88, 16, 30, 60],
    ] as const
    for (const [slug, dc, lineLength, lineWidth, average, dice, coneLength, push] of cases) {
      const action = getDnd5eSrdMonster(`srd-5.1:${slug}`)?.actions
        .find((candidate) => candidate.id === 'breath-weapons')
      expect(action, slug).toMatchObject({
        automation: 'headless',
        usage: { kind: 'recharge', dieSides: 6, minimum: 5 },
        rule: {
          kind: 'area-saving-throw',
          variants: [
            {
              id: 'lightning-breath',
              target: 'all-creatures-except-self',
              ability: 'dex',
              dc,
              area: { shape: 'line', lengthFeet: lineLength, widthFeet: lineWidth },
              damage: { average, count: dice, sides: 10, type: 'lightning' },
              damageOnSuccessfulSave: 'half',
            },
            {
              id: 'repulsion-breath',
              target: 'all-creatures-except-self',
              ability: 'str',
              dc,
              area: { shape: 'cone', lengthFeet: coneLength },
              forcedMovementOnFailedSave: {
                direction: 'away-from-source',
                maximumDistanceFeet: push,
              },
            },
          ],
        },
      })
    }

    for (const [slug, dc, lineLength, lineWidth, average, dice, coneLength] of [
      ['copper-dragon-wyrmling', 11, 20, 5, 18, 4, 15],
      ['young-copper-dragon', 14, 40, 5, 40, 9, 30],
      ['adult-copper-dragon', 18, 60, 5, 54, 12, 60],
      ['ancient-copper-dragon', 22, 90, 10, 63, 14, 90],
    ] as const) {
      const action = getDnd5eSrdMonster(`srd-5.1:${slug}`)?.actions
        .find((candidate) => candidate.id === 'breath-weapons')
      expect(action, slug).toMatchObject({
        automation: 'headless',
        usage: { kind: 'recharge', dieSides: 6, minimum: 5 },
        rule: {
          kind: 'area-saving-throw',
          variants: [
            {
              id: 'acid-breath',
              target: 'all-creatures-except-self',
              ability: 'dex',
              dc,
              area: { shape: 'line', lengthFeet: lineLength, widthFeet: lineWidth },
              damage: { average, count: dice, sides: 8, type: 'acid' },
              damageOnSuccessfulSave: 'half',
            },
            {
              id: 'slowing-breath',
              target: 'all-creatures-except-self',
              ability: 'con',
              dc,
              area: { shape: 'cone', lengthFeet: coneLength },
              activeEffectOnFailedSave: {
                durationRounds: 10,
                repeatSaveAtEndOfTargetTurn: true,
                modifiers: {
                  speedMultiplier: 0.5,
                  preventReactions: true,
                  maximumAttacksPerTurn: 1,
                  actionOrBonusActionOnly: true,
                },
              },
            },
          ],
        },
      })
    }

    for (const [slug, dc, length, average, dice] of [
      ['gold-dragon-wyrmling', 13, 15, 22, 4],
      ['young-gold-dragon', 17, 30, 55, 10],
      ['adult-gold-dragon', 21, 60, 66, 12],
      ['ancient-gold-dragon', 24, 90, 71, 13],
    ] as const) {
      const action = getDnd5eSrdMonster(`srd-5.1:${slug}`)?.actions
        .find((candidate) => candidate.id === 'breath-weapons')
      expect(action, slug).toMatchObject({
        automation: 'headless',
        usage: { kind: 'recharge', dieSides: 6, minimum: 5 },
        rule: {
          kind: 'area-saving-throw',
          variants: [
            {
              id: 'fire-breath',
              target: 'all-creatures-except-self',
              ability: 'dex',
              dc,
              area: { shape: 'cone', lengthFeet: length },
              damage: { average, count: dice, sides: 10, type: 'fire' },
              damageOnSuccessfulSave: 'half',
            },
            {
              id: 'weakening-breath',
              target: 'all-creatures-except-self',
              ability: 'str',
              dc,
              area: { shape: 'cone', lengthFeet: length },
              activeEffectOnFailedSave: {
                durationRounds: 10,
                repeatSaveAtEndOfTargetTurn: true,
                modifiers: { strengthRollMode: 'disadvantage' },
              },
            },
          ],
        },
      })
    }
  })

  it('infers monster weapon abilities without treating every melee attack as Strength', () => {
    const spy = getDnd5eSrdMonster('srd-5.1:spy')!
    expect(dnd5eMonsterWeaponAttackAbility(
      spy,
      spy.actions.find((action) => action.id === 'shortsword')!.attack!,
    )).toBe('dex')
    expect(dnd5eMonsterWeaponAttackAbility(
      spy,
      spy.actions.find((action) => action.id === 'hand-crossbow')!.attack!,
    )).toBe('dex')

    expect(dnd5eMonsterWeaponAttackAbility(
      {
        abilities: { str: 16, dex: 12, con: 10, int: 10, wis: 10, cha: 10 },
        challenge: { rating: '1', xp: 200 },
      },
      {
        mode: 'ranged',
        toHit: 5,
        damage: [{ average: 6, count: 1, sides: 6, bonus: 3, type: 'piercing' }],
      },
    )).toBe('str')
  })

  it('migrates only the Rakshasa Limited Magic Immunity trait exactly', () => {
    const rakshasa = getDnd5eSrdMonster('srd-5.1:rakshasa')!
    expect(rakshasa.traits.filter((trait) =>
      trait.rule?.kind === 'limited-magic-immunity')).toEqual([
      expect.objectContaining({
        name: '有限魔法免疫',
        automation: 'headless',
        rule: {
          kind: 'limited-magic-immunity',
          maximumSpellLevel: 6,
          advantageAboveMaximum: true,
          allowsWilling: true,
        },
      }),
    ])
    expect(DND5E_SRD_MONSTERS.filter((monster) => monster.slug !== 'rakshasa')
      .flatMap((monster) => monster.traits)
      .some((trait) => trait.rule?.kind === 'limited-magic-immunity')).toBe(false)
  })

  it('preserves complete special weapon damage when opting catalog attacks into Headless', () => {
    expect(getDnd5eSrdMonster('srd-5.1:balor')?.actions
      .find((action) => action.id === 'longsword')).toMatchObject({
      automation: 'headless',
      attack: {
        criticalExtraDamage: [
          { count: 3, sides: 8, bonus: 0, type: 'slashing' },
          { count: 3, sides: 8, bonus: 0, type: 'lightning' },
        ],
      },
    })
    expect(getDnd5eSrdMonster('srd-5.1:pit-fiend')?.actions
      .find((action) => action.id === 'mace')).toMatchObject({
      automation: 'headless',
      attack: {
        damage: [
          { count: 2, sides: 6, bonus: 8, type: 'bludgeoning' },
          { count: 6, sides: 6, bonus: 0, type: 'fire' },
        ],
      },
    })
  })

  it('keeps every reviewed damage segment before marking generated attacks Headless', () => {
    expect(getDnd5eSrdMonster('srd-5.1:djinni')?.actions
      .find((action) => action.id === 'scimitar')).toMatchObject({
      automation: 'headless',
      attack: {
        damage: [
          { count: 2, sides: 6, bonus: 5, type: 'slashing' },
          { count: 1, sides: 6, bonus: 0, type: 'lightning' },
        ],
      },
    })
    expect(getDnd5eSrdMonster('srd-5.1:pit-fiend')?.actions
      .find((action) => action.id === 'bite')).toMatchObject({
      automation: 'headless',
      attack: {
        damage: [{ count: 4, sides: 6, bonus: 8, type: 'piercing' }],
        onHitEffects: [{
          id: 'bite-poison',
          kind: 'persistent-effect',
          standardCondition: 'poisoned',
        }],
      },
    })
  })

  it('supports Chinese, English and type search plus CR proficiency', () => {
    expect(searchDnd5eSrdMonsters('地精').map((monster) => monster.slug)).toEqual(['bugbear', 'goblin', 'hobgoblin'])
    expect(searchDnd5eSrdMonsters('dire wolf').map((monster) => monster.slug)).toEqual(['dire-wolf'])
    expect(searchDnd5eSrdMonsters('亡灵').map((monster) => monster.slug)).toEqual(expect.arrayContaining(['skeleton', 'zombie', 'lich']))
    expect(dnd5eMonsterProficiencyBonus('1/8')).toBe(2)
    expect(dnd5eMonsterProficiencyBonus('17')).toBe(6)
    expect(dnd5eMonsterProficiencyBonus('23')).toBe(7)
  })

  it('drives the visible map pool and the compatibility detail block from the same SRD source', () => {
    expect(DND5E_SRD_ENEMY_POOL).toHaveLength(DND5E_SRD_MONSTERS.length)
    expect(DND5E_SRD_ENEMY_POOL.every((entry) => new Set(entry.tags).size === entry.tags.length)).toBe(true)
    const template = DND5E_SRD_ENEMY_POOL.find((entry) => entry.id === 'srd-5.1:goblin')!
    expect(template).toMatchObject({
      name: '地精',
      maxHp: 7,
      armorClass: 15,
      challengeRating: '1/4',
      tokenPortrait: '/assets/portraits/goblin-forest-scout-token.png',
      initiativePortrait: '/assets/portraits/goblin-forest-scout-initiative.png',
      searchAliases: ['哥布林'],
    })
    expect(template.visualVariants?.map((variant) => variant.id)).toEqual([
      'forest-scout',
      'woodland-archer',
      'ruin-raider',
      'cave-skulk',
    ])
    expect(searchEnemyPool('哥布林').map((entry) => entry.id)).toContain('srd-5.1:goblin')
    expect(enemyTemplateToTokenPatch(template)).toMatchObject({ maxHp: 7, hp: 7, poolId: 'srd-5.1:goblin' })
    expect(enemyTemplateToTokenPatch({ ...template, visualVariantId: 'ruin-raider' }))
      .toMatchObject({ poolId: 'srd-5.1:goblin', visualVariantId: 'ruin-raider' })
    expect(getEnemyStatBlock(template.id)).toMatchObject({ ac: 15, maxHp: 7, hitDice: '2d6', source: 'SRD 5.1' })
  })

  it('selects the next portrait not yet used by the same monster on the map', () => {
    const template = DND5E_SRD_ENEMY_POOL.find((entry) => entry.id === 'srd-5.1:goblin')!
    expect(selectNextEnemyVisualVariantId(template, [])).toBe('forest-scout')
    expect(selectNextEnemyVisualVariantId(template, [undefined])).toBe('woodland-archer')
    expect(selectNextEnemyVisualVariantId(template, ['forest-scout', 'ruin-raider'])).toBe('woodland-archer')
    expect(selectNextEnemyVisualVariantId(template, [
      'forest-scout',
      'woodland-archer',
      'ruin-raider',
      'cave-skulk',
    ])).toBe('forest-scout')
    expect(selectNextEnemyVisualVariantId(template, [
      'forest-scout',
      'woodland-archer',
      'ruin-raider',
      'cave-skulk',
      'forest-scout',
    ])).toBe('woodland-archer')
  })

  it('assigns explicit rotating portraits to every monster in a batch insertion', () => {
    const template = DND5E_SRD_ENEMY_POOL.find((entry) => entry.id === 'srd-5.1:goblin')!
    const assigned = assignEnemyVisualVariants(
      [template, template, template],
      [{ poolId: template.id, visualVariantId: undefined }],
    )
    expect(assigned.map((entry) => entry.visualVariantId)).toEqual([
      'woodland-archer',
      'ruin-raider',
      'cave-skulk',
    ])

    expect(assignEnemyVisualVariants(
      [{ ...template, visualVariantId: 'ruin-raider' }],
      [{ poolId: template.id, visualVariantId: 'forest-scout' }],
    )[0].visualVariantId).toBe('ruin-raider')
  })
})

describe('SRD monster actions in the D&D 5e Headless engine', () => {
  it('resolves structured Pack Tactics inside the authoritative monster transaction', () => {
    const resolveWithAlly = (allyPatch: Partial<Dnd5eCombatant> = {}) => {
      const state = startDnd5eHeadlessCombat('pack-tactics', [
        combatant('monster', 20, { statBlockId: 'srd-5.1:giant-rat' }),
        combatant('ally', 15, { controller: 'dm', ...allyPatch }),
        combatant('hero', 10),
      ])
      state.distanceFeetByCombatantPair = {
        [dnd5eCombatantPairKey('monster', 'hero')]: 5,
        [dnd5eCombatantPairKey('ally', 'hero')]: 5,
      }
      return resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: 'monster',
        actionId: 'bite',
        rolls: [{
          targetId: 'hero',
          d20: 1,
          d20Second: 15,
          damageRolls: [[2]],
        }],
      })
    }

    expect(resolveWithAlly()).toMatchObject({
      ok: true,
      state: { combatants: { hero: { currentHp: 36 } } },
    })
    expect(resolveWithAlly({ classState: { stunnedByActorId: 'hero' } })).toMatchObject({
      ok: true,
      state: { combatants: { hero: { currentHp: 40 } } },
    })
    expect(resolveWithAlly({ currentHp: 0 })).toMatchObject({
      ok: true,
      state: { combatants: { hero: { currentHp: 40 } } },
    })
  })

  it('validates Nimble Escape from the monster stat block and spends a bonus action', () => {
    const state = startDnd5eHeadlessCombat('combat', [
      combatant('monster', 20, { statBlockId: 'srd-5.1:goblin' }),
      combatant('hero', 10),
    ])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'monster-nimble-escape',
      actorId: 'monster',
      option: 'disengage',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.monster).toMatchObject({
      disengaged: true,
      turn: { actionAvailable: true, bonusActionAvailable: false },
    })
    expect(resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('invalid', [
        combatant('monster', 20, { statBlockId: 'srd-5.1:wolf' }),
        combatant('hero', 10),
      ]),
      { type: 'monster-nimble-escape', actorId: 'monster', option: 'disengage' },
    )).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })

  it('resolves a stat-block weapon attack without accepting client supplied modifiers', () => {
    const state = startDnd5eHeadlessCombat('combat', [
      combatant('monster', 20, { statBlockId: 'srd-5.1:goblin' }),
      combatant('hero', 10, { currentHp: 20, maxHp: 20 }),
    ])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'monster-action',
      actorId: 'monster',
      actionId: 'scimitar',
      rolls: [{ targetId: 'hero', d20: 11, damageRolls: [[3]] }],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.hero.currentHp).toBe(15)
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', total: 15, hit: true }))
  })

  it('resolves every migrated fixed one-point attack without fabricated damage dice', () => {
    for (const [statBlockId, actionId] of [
      ['srd-5.1:badger', 'bite'],
      ['srd-5.1:cat', 'claws'],
      ['srd-5.1:crab', 'claw'],
      ['srd-5.1:hawk', 'talons'],
      ['srd-5.1:lizard', 'bite'],
      ['srd-5.1:owl', 'talons'],
      ['srd-5.1:quipper', 'bite'],
      ['srd-5.1:rat', 'bite'],
      ['srd-5.1:raven', 'beak'],
      ['srd-5.1:weasel', 'bite'],
    ] as const) {
      const state = startDnd5eHeadlessCombat(`fixed-damage:${statBlockId}`, [
        combatant('monster', 20, { statBlockId }),
        combatant('hero', 10),
      ])
      const result = resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: 'monster',
        actionId,
        rolls: [{ targetId: 'hero', d20: 20, damageRolls: [[]] }],
      })
      expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
      if (!result.ok) continue
      expect(result.state.combatants.hero.currentHp).toBe(39)
      expect(result.transaction?.rollLedger.entries.some((entry) =>
        entry.kind === 'damage' && entry.dice.values.length > 0)).toBe(false)
    }
  })

  it('resolves the Mastiff, Winter Wolf, and Worg bite knockdown riders', () => {
    const examples = [
      { statBlockId: 'srd-5.1:mastiff', damageRolls: [[3]], dc: 11 },
      { statBlockId: 'srd-5.1:winter-wolf', damageRolls: [[3, 4]], dc: 14 },
      { statBlockId: 'srd-5.1:worg', damageRolls: [[3, 4]], dc: 13 },
    ] as const
    for (const example of examples) {
      const hit = resolveDnd5eHeadlessAction(
        startDnd5eHeadlessCombat(`knockdown:${example.statBlockId}`, [
          combatant('monster', 20, { statBlockId: example.statBlockId }),
          combatant('hero', 10),
        ]),
        {
          type: 'monster-action',
          actorId: 'monster',
          actionId: 'bite',
          rolls: [{ targetId: 'hero', d20: 12, damageRolls: example.damageRolls }],
        },
      )
      expect(hit.ok, hit.ok ? undefined : hit.reason).toBe(true)
      if (!hit.ok) continue
      expect(hit.events).toContainEqual({
        type: 'monster-on-hit-save-required',
        targetId: 'hero',
        sourceId: 'monster',
        actionId: 'bite',
        ability: 'str',
        dc: example.dc,
        condition: 'prone',
      })
      const failedSave = resolveDnd5eHeadlessAction(hit.state, {
        type: 'monster-on-hit-save',
        actorId: 'hero',
        sourceId: 'monster',
        actionId: 'bite',
        d20: 1,
      })
      expect(failedSave.ok, failedSave.ok ? undefined : failedSave.reason).toBe(true)
      expect(failedSave.ok && failedSave.state.combatants.hero.conditions).toContain('prone')
    }
  })

  it('reuses the authoritative Undead Fortitude transaction for the Ogre Zombie', () => {
    const pending = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('ogre-zombie-undead-fortitude', [
        combatant('hero', 20),
        combatant('monster', 10, {
          statBlockId: 'srd-5.1:ogre-zombie',
          usesDeathSaves: false,
          abilities: { str: 19, dex: 6, con: 18, int: 3, wis: 6, cha: 5 },
          currentHp: 5,
          maxHp: 85,
        }),
      ]),
      {
        type: 'attack',
        actorId: 'hero',
        targetId: 'monster',
        attackModifier: 20,
        d20: 10,
        damage: { count: 1, sides: 8, bonus: 0, rolls: [5], type: 'slashing' },
      },
    )
    expect(pending.ok, pending.ok ? undefined : pending.reason).toBe(true)
    if (!pending.ok) return
    expect(pending.state.combatants.monster).toMatchObject({
      currentHp: 0,
      deathSaves: { dead: false },
      classState: {
        undeadFortitudePending: {
          dc: 10,
          damage: 5,
          sourceId: 'hero',
        },
      },
    })
    const survived = resolveDnd5eHeadlessAction(pending.state, {
      type: 'monster-undead-fortitude-save',
      actorId: 'monster',
      d20: 20,
    })
    expect(survived.ok, survived.ok ? undefined : survived.reason).toBe(true)
    expect(survived.ok && survived.state.combatants.monster.currentHp).toBe(1)
  })

  it('spends one action to resolve the owlbear beak-and-claws multiattack', () => {
    const state = startDnd5eHeadlessCombat('combat', [
      combatant('monster', 20, { statBlockId: 'srd-5.1:owlbear' }),
      combatant('hero', 10),
    ])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'monster-action',
      actorId: 'monster',
      actionId: 'multiattack',
      rolls: [
        { targetId: 'hero', d20: 10, damageRolls: [[5]] },
        { targetId: 'hero', d20: 10, damageRolls: [[4, 4]] },
      ],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.hero.currentHp).toBe(17)
    expect(result.events.filter((event) => event.type === 'attack-resolved')).toHaveLength(2)
    expect(result.events.filter((event) => event.type === 'turn-resource-spent')).toHaveLength(1)
  })

  it('uses an explicit weapon-only sibling when Frightful Presence is declined', () => {
    const state = startDnd5eHeadlessCombat('dragon-multiattack', [
      combatant('dragon', 20, { statBlockId: 'srd-5.1:adult-black-dragon' }),
      combatant('hero', 10, { currentHp: 100, maxHp: 100 }),
    ])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'monster-action',
      actorId: 'dragon',
      actionId: 'multiattack-weapons-only',
      rolls: [
        { targetId: 'hero', d20: 10, damageRolls: [[5, 5], [4]] },
        { targetId: 'hero', d20: 10, damageRolls: [[3, 3]] },
        { targetId: 'hero', d20: 10, damageRolls: [[3, 3]] },
      ],
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.hero.currentHp).toBe(56)
    expect(result.events.filter((event) => event.type === 'attack-resolved')).toHaveLength(3)
  })

  it('resolves the canonical Chimera and Dragon Turtle three-part weapon multiattacks', () => {
    const examples: Array<{
      statBlockId: string
      rolls: Array<{ targetId: string; d20: number; damageRolls: number[][] }>
      expectedHp: number
    }> = [
      {
        statBlockId: 'srd-5.1:chimera',
        rolls: [
          { targetId: 'hero', d20: 10, damageRolls: [[1, 1]] },
          { targetId: 'hero', d20: 10, damageRolls: [[1]] },
          { targetId: 'hero', d20: 10, damageRolls: [[1, 1]] },
        ],
        expectedHp: 83,
      },
      {
        statBlockId: 'srd-5.1:dragon-turtle',
        rolls: [
          { targetId: 'hero', d20: 10, damageRolls: [[1, 1, 1]] },
          { targetId: 'hero', d20: 10, damageRolls: [[1, 1]] },
          { targetId: 'hero', d20: 10, damageRolls: [[1, 1]] },
        ],
        expectedHp: 72,
      },
    ]

    for (const example of examples) {
      const state = startDnd5eHeadlessCombat(`multiattack:${example.statBlockId}`, [
        combatant('monster', 20, { statBlockId: example.statBlockId }),
        combatant('hero', 10, { currentHp: 100, maxHp: 100 }),
      ])
      const result = resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: 'monster',
        actionId: 'multiattack',
        rolls: example.rolls,
      })

      expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
      if (!result.ok) continue
      expect(result.state.combatants.hero.currentHp).toBe(example.expectedHp)
      expect(result.events.filter((event) => event.type === 'attack-resolved')).toHaveLength(3)
      expect(result.events.filter((event) => event.type === 'turn-resource-spent')).toHaveLength(1)
    }
  })

  it('applies SRD damage vulnerability and immunity in the same authoritative resolver', () => {
    const vulnerable = startDnd5eHeadlessCombat('vulnerable', [
      combatant('monster', 20),
      combatant('hero', 10, { currentHp: 13, maxHp: 13, damageVulnerabilities: ['bludgeoning'] }),
    ])
    const hit = resolveDnd5eHeadlessAction(vulnerable, {
      type: 'attack', actorId: 'monster', targetId: 'hero', attackModifier: 5, d20: 10,
      damage: { count: 1, sides: 6, bonus: 0, rolls: [4], type: 'bludgeoning' },
    })
    expect(hit.ok && hit.state.combatants.hero.currentHp).toBe(5)

    const immune = startDnd5eHeadlessCombat('immune', [
      combatant('monster', 20),
      combatant('hero', 10, { currentHp: 13, maxHp: 13, damageImmunities: ['poison'] }),
    ])
    const noDamage = resolveDnd5eHeadlessAction(immune, {
      type: 'attack', actorId: 'monster', targetId: 'hero', attackModifier: 5, d20: 10,
      damage: { count: 1, sides: 6, bonus: 0, rolls: [4], type: 'poison' },
    })
    expect(noDamage.ok && noDamage.state.combatants.hero.currentHp).toBe(13)
  })

  it('rejects actions that do not belong to the actor stat block', () => {
    const state = startDnd5eHeadlessCombat('combat', [
      combatant('monster', 20, { statBlockId: 'srd-5.1:goblin' }),
      combatant('hero', 10),
    ])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'monster-action', actorId: 'monster', actionId: 'beak',
      rolls: [{ targetId: 'hero', d20: 10, damageRolls: [[5]] }],
    })
    expect(result).toMatchObject({ ok: false, reason: 'invalid-monster-action' })
  })

  it('runs generated plain attacks and the structured aboleth tentacle rider', () => {
    const acolyte = startDnd5eHeadlessCombat('generated', [
      combatant('monster', 20, { statBlockId: 'srd-5.1:acolyte' }),
      combatant('hero', 10, { currentHp: 20, maxHp: 20 }),
    ])
    const club = resolveDnd5eHeadlessAction(acolyte, {
      type: 'monster-action', actorId: 'monster', actionId: 'club',
      rolls: [{ targetId: 'hero', d20: 13, damageRolls: [[4]] }],
    })
    expect(club.ok && club.state.combatants.hero.currentHp).toBe(16)

    const aboleth = startDnd5eHeadlessCombat('adjudication', [
      combatant('monster', 20, { statBlockId: 'srd-5.1:aboleth' }),
      combatant('hero', 10),
    ])
    aboleth.distanceFeetByCombatantPair = { ['monster\u0000hero']: 10 }
    const tentacle = resolveDnd5eHeadlessAction(aboleth, {
      type: 'monster-action', actorId: 'monster', actionId: 'tentacle',
      rolls: [{ targetId: 'hero', d20: 12, damageRolls: [[3, 3]] }],
    })
    expect(tentacle.ok, tentacle.ok ? undefined : tentacle.reason).toBe(true)
    expect(tentacle.state.combatants.hero.classState.monsterOnHitSavePending).toMatchObject({
      sourceId: 'monster',
      actionId: 'tentacle',
      ability: 'con',
      dc: 14,
      condition: 'disease',
    })
    const disease = resolveDnd5eHeadlessAction(tentacle.state, {
      type: 'monster-on-hit-save',
      actorId: 'hero',
      sourceId: 'monster',
      actionId: 'tentacle',
      d20: 1,
    })
    expect(disease.ok, disease.ok ? undefined : disease.reason).toBe(true)
    expect(disease.state.combatants.hero.conditions).toContain('disease')
  })

  it('resolves the aboleth mucous cloud only after a nearby melee hit underwater', () => {
    const underwater = startDnd5eHeadlessCombat('aboleth-mucous-cloud', [
      combatant('hero', 20, { position: { x: 0, y: 0 } }),
      combatant('aboleth', 10, { statBlockId: 'srd-5.1:aboleth', position: { x: 1, y: 0 } }),
    ])
    underwater.environment = 'underwater'
    underwater.distanceFeetByCombatantPair = { ['aboleth\u0000hero']: 5 }
    const hit = resolveDnd5eHeadlessAction(underwater, {
      type: 'attack', actorId: 'hero', targetId: 'aboleth', attackModifier: 5, d20: 15,
      damage: { count: 1, sides: 6, bonus: 0, rolls: [3], type: 'slashing' },
    })
    expect(hit.ok, hit.ok ? undefined : hit.reason).toBe(true)
    if (!hit.ok) return
    expect(hit.events).toContainEqual({
      type: 'monster-on-hit-save-required', targetId: 'hero', sourceId: 'aboleth',
      actionId: 'mucous-cloud', ability: 'con', dc: 14, condition: 'disease',
    })
    const failedSave = resolveDnd5eHeadlessAction(hit.state, {
      type: 'monster-on-hit-save', actorId: 'hero', sourceId: 'aboleth', actionId: 'mucous-cloud', d20: 1,
    })
    expect(failedSave.ok, failedSave.ok ? undefined : failedSave.reason).toBe(true)
    expect(failedSave.ok && failedSave.state.combatants.hero.conditions).toContain('disease')

    const dry = startDnd5eHeadlessCombat('aboleth-mucous-cloud-dry', [
      combatant('hero', 20),
      combatant('aboleth', 10, { statBlockId: 'srd-5.1:aboleth' }),
    ])
    dry.environment = 'normal'
    dry.distanceFeetByCombatantPair = { ['aboleth\u0000hero']: 5 }
    const dryHit = resolveDnd5eHeadlessAction(dry, {
      type: 'attack', actorId: 'hero', targetId: 'aboleth', attackModifier: 5, d20: 15,
      damage: { count: 1, sides: 6, bonus: 0, rolls: [3], type: 'slashing' },
    })
    expect(dryHit.ok, dryHit.ok ? undefined : dryHit.reason).toBe(true)
    expect(dryHit.ok && dryHit.events.some((event) => event.type === 'monster-on-hit-save-required')).toBe(false)
  })
})
