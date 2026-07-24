import { describe, expect, it } from 'vitest'
import {
  DND5E_SRD_ENEMY_POOL,
  enemyTemplateToTokenPatch,
  searchEnemyPool,
} from '../../lib/enemyPool'
import { getEnemyStatBlock } from '../../lib/enemyStatBlocks'
import reviewedMonsterTranslations from './generated/srdMonsterTranslationsZh.reviewed.generated.json'
import {
  createDnd5eCombatant,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eCombatant,
} from './headlessCombatEngine'
import {
  DND5E_SRD_MONSTERS,
  dnd5eMonsterProficiencyBonus,
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

    const blackBear = getDnd5eSrdMonster('srd-5.1:black-bear')!
    expect(blackBear).toMatchObject({ creatureType: '野兽', challenge: { rating: '1/2' }, speed: { walk: 40, climb: 30 } })
    expect(blackBear.actions.find((action) => action.id === 'multiattack')?.sequence).toEqual(['bite', 'claws'])
    expect(getDnd5eSrdMonster('srd-5.1:bat')).toMatchObject({ challenge: { rating: '0' }, speed: { fly: 30 } })
    expect(getDnd5eSrdMonster('srd-5.1:frog')).toMatchObject({ challenge: { rating: '0' }, speed: { swim: 20 } })
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

  it('never marks a generated weapon attack headless after dropping a damage segment', () => {
    for (const slug of ['djinni', 'flying-snake', 'pit-fiend']) {
      const monster = getDnd5eSrdMonster(`srd-5.1:${slug}`)!
      const suspect = monster.actions.filter((action) => action.kind === 'weapon-attack')
      expect(suspect.some((action) => action.automation === 'dm-adjudication')).toBe(true)
    }
  })

  it('supports Chinese, English and type search plus CR proficiency', () => {
    expect(searchDnd5eSrdMonsters('地精').map((monster) => monster.slug)).toEqual(['bugbear', 'goblin', 'hobgoblin'])
    expect(searchDnd5eSrdMonsters('dire wolf').map((monster) => monster.slug)).toEqual(['dire-wolf'])
    expect(searchDnd5eSrdMonsters('亡灵').map((monster) => monster.slug)).toEqual(expect.arrayContaining(['skeleton', 'zombie', 'lich']))
    expect(dnd5eMonsterProficiencyBonus('1/8')).toBe(2)
    expect(dnd5eMonsterProficiencyBonus('17')).toBe(6)
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
})

describe('SRD monster actions in the D&D 5e Headless engine', () => {
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

  it('runs generated plain attacks but refuses actions explicitly assigned to DM adjudication', () => {
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
    expect(resolveDnd5eHeadlessAction(aboleth, {
      type: 'monster-action', actorId: 'monster', actionId: 'tentacle',
      rolls: [{ targetId: 'hero', d20: 12, damageRolls: [[3, 3], [6]] }],
    })).toMatchObject({ ok: false, reason: 'invalid-monster-action' })
  })
})
