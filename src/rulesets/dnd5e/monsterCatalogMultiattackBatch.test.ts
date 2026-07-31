import { describe, expect, it } from 'vitest'
import {
  createDnd5eCombatant,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eCombatant,
} from './headlessCombatEngine'
import {
  DND5E_SRD_MONSTERS,
  getDnd5eSrdMonsterBySlug,
} from './monsters'
import { auditDnd5eMonsterHeadlessCoverage } from './monsterHeadlessCoverage'
import { dnd5eMonsterMultiattackConstraint } from './monsterMultiattackConstraints'

interface ExpectedMultiattack {
  slug: string
  actionId: string
  sequence: readonly string[]
  mode?: 'melee' | 'ranged'
}

const FIXED_MULTIATTACKS: readonly ExpectedMultiattack[] = [
  {
    slug: 'bandit-captain',
    actionId: 'multiattack',
    sequence: ['scimitar', 'scimitar', 'dagger'],
    mode: 'melee',
  },
  {
    slug: 'half-red-dragon-veteran',
    actionId: 'multiattack',
    sequence: ['longsword', 'longsword', 'shortsword'],
  },
  {
    slug: 'veteran',
    actionId: 'multiattack',
    sequence: ['longsword', 'longsword', 'shortsword'],
  },
  {
    slug: 'assassin',
    actionId: 'multiattack',
    sequence: ['shortsword', 'shortsword'],
  },
  {
    slug: 'behir',
    actionId: 'multiattack',
    sequence: ['bite', 'constrict'],
  },
  {
    slug: 'giant-scorpion',
    actionId: 'multiattack',
    sequence: ['claw', 'claw', 'sting'],
  },
  {
    slug: 'barbed-devil',
    actionId: 'multiattack',
    sequence: ['tail', 'claw', 'claw'],
    mode: 'melee',
  },
  {
    slug: 'bone-devil',
    actionId: 'multiattack',
    sequence: ['claw', 'claw', 'sting'],
    mode: 'melee',
  },
  {
    slug: 'centaur',
    actionId: 'multiattack',
    sequence: ['pike', 'hooves'],
    mode: 'melee',
  },
  {
    slug: 'efreeti',
    actionId: 'multiattack',
    sequence: ['scimitar', 'scimitar'],
    mode: 'melee',
  },
  {
    slug: 'ettercap',
    actionId: 'multiattack',
    sequence: ['bite', 'claws'],
    mode: 'melee',
  },
  {
    slug: 'iron-golem',
    actionId: 'multiattack',
    sequence: ['sword', 'sword'],
    mode: 'melee',
  },
  {
    slug: 'lizardfolk',
    actionId: 'multiattack',
    sequence: ['bite', 'heavy-club'],
    mode: 'melee',
  },
  {
    slug: 'medusa',
    actionId: 'multiattack',
    sequence: ['snake-hair', 'shortsword', 'shortsword'],
    mode: 'melee',
  },
  {
    slug: 'roc',
    actionId: 'multiattack',
    sequence: ['beak', 'talons'],
    mode: 'melee',
  },
  {
    slug: 'scout',
    actionId: 'multiattack',
    sequence: ['shortsword', 'shortsword'],
    mode: 'melee',
  },
  {
    slug: 'werebear-bear',
    actionId: 'multiattack',
    sequence: ['claw', 'claw'],
    mode: 'melee',
  },
  {
    slug: 'werebear-human',
    actionId: 'multiattack',
    sequence: ['greataxe', 'greataxe'],
    mode: 'melee',
  },
  {
    slug: 'werebear-hybrid',
    actionId: 'multiattack',
    sequence: ['claw', 'claw'],
    mode: 'melee',
  },
  {
    slug: 'wereboar-human',
    actionId: 'multiattack',
    sequence: ['maul', 'maul'],
    mode: 'melee',
  },
  {
    slug: 'wererat-human',
    actionId: 'multiattack',
    sequence: ['shortsword', 'shortsword'],
    mode: 'melee',
  },
  {
    slug: 'weretiger-human',
    actionId: 'multiattack',
    sequence: ['scimitar', 'scimitar'],
    mode: 'melee',
  },
  {
    slug: 'weretiger-hybrid',
    actionId: 'multiattack',
    sequence: ['claw', 'claw'],
    mode: 'melee',
  },
]

const EXPANDED_FIXED_MULTIATTACKS: readonly ExpectedMultiattack[] = [
  { slug: 'balor', actionId: 'multiattack', sequence: ['longsword', 'whip'], mode: 'melee' },
  {
    slug: 'bearded-devil',
    actionId: 'multiattack',
    sequence: ['beard', 'glaive'],
    mode: 'melee',
  },
  {
    slug: 'chain-devil',
    actionId: 'multiattack',
    sequence: ['chain', 'chain'],
    mode: 'melee',
  },
  {
    slug: 'chuul',
    actionId: 'multiattack',
    sequence: ['pincer', 'pincer'],
    mode: 'melee',
  },
  {
    slug: 'clay-golem',
    actionId: 'multiattack',
    sequence: ['slam', 'slam'],
    mode: 'melee',
  },
  {
    slug: 'cloaker',
    actionId: 'multiattack',
    sequence: ['bite', 'tail'],
    mode: 'melee',
  },
  {
    slug: 'death-dog',
    actionId: 'multiattack',
    sequence: ['bite', 'bite'],
    mode: 'melee',
  },
  {
    slug: 'djinni',
    actionId: 'multiattack',
    sequence: ['scimitar', 'scimitar', 'scimitar'],
    mode: 'melee',
  },
  {
    slug: 'drider',
    actionId: 'multiattack',
    sequence: ['longbow', 'longbow', 'longbow'],
    mode: 'ranged',
  },
  {
    slug: 'erinyes',
    actionId: 'multiattack',
    sequence: ['longsword', 'longsword', 'longsword'],
    mode: 'melee',
  },
  {
    slug: 'fire-elemental',
    actionId: 'multiattack',
    sequence: ['touch', 'touch'],
    mode: 'melee',
  },
  {
    slug: 'giant-crocodile',
    actionId: 'multiattack',
    sequence: ['bite', 'tail'],
    mode: 'melee',
  },
  {
    slug: 'gibbering-mouther',
    actionId: 'multiattack',
    sequence: ['bites', 'blinding-spittle'],
    mode: 'melee',
  },
  {
    slug: 'glabrezu',
    actionId: 'multiattack',
    sequence: ['pincer', 'pincer', 'fist', 'fist'],
    mode: 'melee',
  },
  {
    slug: 'gladiator',
    actionId: 'multiattack',
    sequence: ['spear', 'spear', 'spear'],
    mode: 'melee',
  },
  {
    slug: 'grick',
    actionId: 'multiattack',
    sequence: ['tentacles', 'beak'],
    mode: 'melee',
  },
  {
    slug: 'horned-devil',
    actionId: 'multiattack',
    sequence: ['fork', 'fork', 'tail'],
    mode: 'melee',
  },
  {
    slug: 'hydra',
    actionId: 'multiattack',
    sequence: ['bite', 'bite', 'bite', 'bite', 'bite'],
    mode: 'melee',
  },
  {
    slug: 'kraken',
    actionId: 'multiattack',
    sequence: ['tentacle', 'tentacle', 'tentacle'],
    mode: 'melee',
  },
  {
    slug: 'lamia',
    actionId: 'multiattack',
    sequence: ['claws', 'dagger'],
    mode: 'melee',
  },
  {
    slug: 'manticore',
    actionId: 'multiattack',
    sequence: ['bite', 'claw', 'claw'],
    mode: 'melee',
  },
  {
    slug: 'marilith',
    actionId: 'multiattack',
    sequence: ['longsword', 'longsword', 'longsword', 'longsword', 'longsword', 'longsword', 'tail'],
    mode: 'melee',
  },
  {
    slug: 'merrow',
    actionId: 'multiattack',
    sequence: ['bite', 'claws'],
    mode: 'melee',
  },
  {
    slug: 'mummy',
    actionId: 'multiattack',
    sequence: ['dreadful-glare', 'rotting-fist'],
    mode: 'melee',
  },
  {
    slug: 'mummy-lord',
    actionId: 'multiattack',
    sequence: ['dreadful-glare', 'rotting-fist'],
    mode: 'melee',
  },
  {
    slug: 'nalfeshnee',
    actionId: 'multiattack',
    sequence: ['horror-nimbus', 'bite', 'claw', 'claw'],
    mode: 'melee',
  },
  {
    slug: 'oni',
    actionId: 'multiattack',
    sequence: ['claw-oni-form-only', 'claw-oni-form-only'],
    mode: 'melee',
  },
  {
    slug: 'otyugh',
    actionId: 'multiattack',
    sequence: ['bite', 'tentacle', 'tentacle'],
    mode: 'melee',
  },
  {
    slug: 'pit-fiend',
    actionId: 'multiattack',
    sequence: ['bite', 'claw', 'mace', 'tail'],
    mode: 'melee',
  },
  {
    slug: 'purple-worm',
    actionId: 'multiattack',
    sequence: ['bite', 'tail-stinger'],
    mode: 'melee',
  },
  {
    slug: 'rakshasa',
    actionId: 'multiattack',
    sequence: ['claw', 'claw'],
    mode: 'melee',
  },
  {
    slug: 'roper',
    actionId: 'multiattack',
    sequence: ['tendril', 'tendril', 'tendril', 'tendril', 'reel', 'bite'],
    mode: 'melee',
  },
  {
    slug: 'sahuagin',
    actionId: 'multiattack',
    sequence: ['bite', 'claws'],
    mode: 'melee',
  },
  {
    slug: 'salamander',
    actionId: 'multiattack',
    sequence: ['spear', 'tail'],
    mode: 'melee',
  },
  {
    slug: 'shambling-mound',
    actionId: 'multiattack',
    sequence: ['slam', 'slam', 'engulf'],
    mode: 'melee',
  },
  {
    slug: 'tarrasque',
    actionId: 'multiattack',
    sequence: ['bite', 'claw', 'claw', 'horns', 'tail'],
    mode: 'melee',
  },
  {
    slug: 'tyrannosaurus-rex',
    actionId: 'multiattack',
    sequence: ['bite', 'tail'],
    mode: 'melee',
  },
  {
    slug: 'vampire-spawn',
    actionId: 'multiattack',
    sequence: ['claws', 'claws'],
    mode: 'melee',
  },
  {
    slug: 'vampire-vampire',
    actionId: 'multiattack',
    sequence: ['unarmed-strike', 'unarmed-strike'],
    mode: 'melee',
  },
  {
    slug: 'wereboar-hybrid',
    actionId: 'multiattack',
    sequence: ['maul', 'maul'],
    mode: 'melee',
  },
  {
    slug: 'wererat-hybrid',
    actionId: 'multiattack',
    sequence: ['shortsword', 'shortsword'],
    mode: 'melee',
  },
  {
    slug: 'werewolf-human',
    actionId: 'multiattack',
    sequence: ['spear', 'spear'],
    mode: 'melee',
  },
  {
    slug: 'werewolf-hybrid',
    actionId: 'multiattack',
    sequence: ['bite', 'claws'],
    mode: 'melee',
  },
  {
    slug: 'wight',
    actionId: 'multiattack',
    sequence: ['longbow', 'longbow'],
    mode: 'ranged',
  },
  {
    slug: 'wyvern',
    actionId: 'multiattack',
    sequence: ['bite', 'stinger'],
    mode: 'melee',
  },
]

const FIXED_SIBLINGS: readonly ExpectedMultiattack[] = [
  {
    slug: 'bandit-captain',
    actionId: 'multiattack-daggers-ranged',
    sequence: ['dagger', 'dagger'],
    mode: 'ranged',
  },
  {
    slug: 'barbed-devil',
    actionId: 'multiattack-hurl-flame',
    sequence: ['hurl-flame', 'hurl-flame'],
    mode: 'ranged',
  },
  {
    slug: 'centaur',
    actionId: 'multiattack-longbow',
    sequence: ['longbow', 'longbow'],
    mode: 'ranged',
  },
  {
    slug: 'efreeti',
    actionId: 'multiattack-hurl-flame',
    sequence: ['hurl-flame', 'hurl-flame'],
    mode: 'ranged',
  },
  {
    slug: 'iron-golem',
    actionId: 'multiattack-slams',
    sequence: ['slam', 'slam'],
    mode: 'melee',
  },
  {
    slug: 'iron-golem',
    actionId: 'multiattack-sword-and-slam',
    sequence: ['sword', 'slam'],
    mode: 'melee',
  },
  {
    slug: 'lizardfolk',
    actionId: 'multiattack-bite-javelin',
    sequence: ['bite', 'javelin'],
    mode: 'melee',
  },
  {
    slug: 'lizardfolk',
    actionId: 'multiattack-bite-spiked-shield',
    sequence: ['bite', 'spiked-shield'],
    mode: 'melee',
  },
  {
    slug: 'lizardfolk',
    actionId: 'multiattack-heavy-club-javelin',
    sequence: ['heavy-club', 'javelin'],
    mode: 'melee',
  },
  {
    slug: 'lizardfolk',
    actionId: 'multiattack-heavy-club-spiked-shield',
    sequence: ['heavy-club', 'spiked-shield'],
    mode: 'melee',
  },
  {
    slug: 'lizardfolk',
    actionId: 'multiattack-javelin-spiked-shield',
    sequence: ['javelin', 'spiked-shield'],
    mode: 'melee',
  },
  {
    slug: 'medusa',
    actionId: 'multiattack-longbow',
    sequence: ['longbow', 'longbow'],
    mode: 'ranged',
  },
  {
    slug: 'scout',
    actionId: 'multiattack-longbow',
    sequence: ['longbow', 'longbow'],
    mode: 'ranged',
  },
  {
    slug: 'werebear-hybrid',
    actionId: 'multiattack-greataxe',
    sequence: ['greataxe', 'greataxe'],
    mode: 'melee',
  },
  {
    slug: 'wererat-human',
    actionId: 'multiattack-hand-crossbow',
    sequence: ['hand-crossbow', 'hand-crossbow'],
    mode: 'ranged',
  },
  {
    slug: 'weretiger-human',
    actionId: 'multiattack-longbow',
    sequence: ['longbow', 'longbow'],
    mode: 'ranged',
  },
  {
    slug: 'weretiger-hybrid',
    actionId: 'multiattack-scimitar',
    sequence: ['scimitar', 'scimitar'],
    mode: 'melee',
  },
  {
    slug: 'weretiger-hybrid',
    actionId: 'multiattack-longbow',
    sequence: ['longbow', 'longbow'],
    mode: 'ranged',
  },
]

const EXPANDED_FIXED_SIBLINGS: readonly ExpectedMultiattack[] = [
  {
    slug: 'chuul',
    actionId: 'multiattack-pincers-and-tentacles',
    sequence: ['pincer', 'pincer', 'tentacles'],
    mode: 'melee',
  },
  {
    slug: 'drider',
    actionId: 'multiattack-longsword',
    sequence: ['longsword', 'longsword', 'longsword'],
    mode: 'melee',
  },
  {
    slug: 'drider',
    actionId: 'multiattack-bite-and-longbow',
    sequence: ['bite', 'longbow', 'longbow'],
  },
  {
    slug: 'drider',
    actionId: 'multiattack-bite-and-longsword',
    sequence: ['bite', 'longsword', 'longsword'],
    mode: 'melee',
  },
  {
    slug: 'erinyes',
    actionId: 'multiattack-two-longswords-and-longbow',
    sequence: ['longsword', 'longsword', 'longbow'],
  },
  {
    slug: 'erinyes',
    actionId: 'multiattack-longsword-and-two-longbows',
    sequence: ['longsword', 'longbow', 'longbow'],
  },
  {
    slug: 'erinyes',
    actionId: 'multiattack-longbow',
    sequence: ['longbow', 'longbow', 'longbow'],
    mode: 'ranged',
  },
  {
    slug: 'gladiator',
    actionId: 'multiattack-shield-bash-and-two-spears',
    sequence: ['shield-bash', 'spear', 'spear'],
    mode: 'melee',
  },
  {
    slug: 'gladiator',
    actionId: 'multiattack-two-shield-bashes-and-spear',
    sequence: ['shield-bash', 'shield-bash', 'spear'],
    mode: 'melee',
  },
  {
    slug: 'gladiator',
    actionId: 'multiattack-shield-bashes',
    sequence: ['shield-bash', 'shield-bash', 'shield-bash'],
    mode: 'melee',
  },
  {
    slug: 'gladiator',
    actionId: 'multiattack-spears-ranged',
    sequence: ['spear', 'spear'],
    mode: 'ranged',
  },
  {
    slug: 'horned-devil',
    actionId: 'multiattack-forks-and-hurl-flame',
    sequence: ['fork', 'fork', 'hurl-flame'],
  },
  {
    slug: 'horned-devil',
    actionId: 'multiattack-fork-tail-and-hurl-flame',
    sequence: ['fork', 'tail', 'hurl-flame'],
  },
  {
    slug: 'horned-devil',
    actionId: 'multiattack-fork-and-two-hurl-flames',
    sequence: ['fork', 'hurl-flame', 'hurl-flame'],
  },
  {
    slug: 'horned-devil',
    actionId: 'multiattack-tail-and-two-hurl-flames',
    sequence: ['tail', 'hurl-flame', 'hurl-flame'],
  },
  {
    slug: 'horned-devil',
    actionId: 'multiattack-hurl-flames',
    sequence: ['hurl-flame', 'hurl-flame', 'hurl-flame'],
    mode: 'ranged',
  },
  {
    slug: 'kraken',
    actionId: 'multiattack-two-tentacles-and-fling',
    sequence: ['tentacle', 'tentacle', 'fling'],
    mode: 'melee',
  },
  {
    slug: 'kraken',
    actionId: 'multiattack-tentacle-and-two-flings',
    sequence: ['tentacle', 'fling', 'fling'],
    mode: 'melee',
  },
  {
    slug: 'kraken',
    actionId: 'multiattack-flings',
    sequence: ['fling', 'fling', 'fling'],
  },
  {
    slug: 'lamia',
    actionId: 'multiattack-claws-and-intoxicating-touch',
    sequence: ['claws', 'intoxicating-touch'],
    mode: 'melee',
  },
  {
    slug: 'manticore',
    actionId: 'multiattack-tail-spikes',
    sequence: ['tail-spike', 'tail-spike', 'tail-spike'],
    mode: 'ranged',
  },
  {
    slug: 'merrow',
    actionId: 'multiattack-bite-and-harpoon',
    sequence: ['bite', 'harpoon'],
  },
  {
    slug: 'oni',
    actionId: 'multiattack-glaive',
    sequence: ['glaive', 'glaive'],
    mode: 'melee',
  },
  {
    slug: 'sahuagin',
    actionId: 'multiattack-bite-and-spear',
    sequence: ['bite', 'spear'],
    mode: 'melee',
  },
  {
    slug: 'tarrasque',
    actionId: 'multiattack-swallow',
    sequence: ['swallow', 'claw', 'claw', 'horns', 'tail'],
    mode: 'melee',
  },
  {
    slug: 'tarrasque',
    actionId: 'multiattack-frightful-presence',
    sequence: ['frightful-presence', 'bite', 'claw', 'claw', 'horns', 'tail'],
    mode: 'melee',
  },
  {
    slug: 'tarrasque',
    actionId: 'multiattack-frightful-presence-and-swallow',
    sequence: ['frightful-presence', 'swallow', 'claw', 'claw', 'horns', 'tail'],
    mode: 'melee',
  },
  {
    slug: 'vampire-spawn',
    actionId: 'multiattack-claws-and-bite',
    sequence: ['claws', 'bite'],
    mode: 'melee',
  },
  {
    slug: 'vampire-vampire',
    actionId: 'multiattack-unarmed-strike-and-bite',
    sequence: ['unarmed-strike', 'bite'],
    mode: 'melee',
  },
  {
    slug: 'wereboar-hybrid',
    actionId: 'multiattack-maul-and-tusks',
    sequence: ['maul', 'tusks'],
    mode: 'melee',
  },
  {
    slug: 'wererat-hybrid',
    actionId: 'multiattack-hand-crossbow',
    sequence: ['hand-crossbow', 'hand-crossbow'],
    mode: 'ranged',
  },
  {
    slug: 'wererat-hybrid',
    actionId: 'multiattack-shortsword-and-hand-crossbow',
    sequence: ['shortsword', 'hand-crossbow'],
  },
  {
    slug: 'wererat-hybrid',
    actionId: 'multiattack-shortsword-and-bite',
    sequence: ['shortsword', 'bite'],
    mode: 'melee',
  },
  {
    slug: 'wererat-hybrid',
    actionId: 'multiattack-hand-crossbow-and-bite',
    sequence: ['hand-crossbow', 'bite'],
  },
  {
    slug: 'werewolf-human',
    actionId: 'multiattack-spears-ranged',
    sequence: ['spear', 'spear'],
    mode: 'ranged',
  },
  {
    slug: 'wight',
    actionId: 'multiattack-longsword',
    sequence: ['longsword', 'longsword'],
    mode: 'melee',
  },
  {
    slug: 'wight',
    actionId: 'multiattack-life-drain-and-longsword',
    sequence: ['life-drain', 'longsword'],
    mode: 'melee',
  },
  {
    slug: 'wyvern',
    actionId: 'multiattack-claws-and-stinger',
    sequence: ['claws', 'stinger'],
    mode: 'melee',
  },
  {
    slug: 'wyvern',
    actionId: 'multiattack-bite-and-claws',
    sequence: ['bite', 'claws'],
    mode: 'melee',
  },
]

const CONDITIONAL_FIXED_SIBLINGS: readonly ExpectedMultiattack[] = [
  {
    slug: 'gibbering-mouther',
    actionId: 'multiattack-bites-only',
    sequence: ['bites'],
    mode: 'melee',
  },
  {
    slug: 'mummy',
    actionId: 'multiattack-rotting-fist-only',
    sequence: ['rotting-fist'],
    mode: 'melee',
  },
  {
    slug: 'mummy-lord',
    actionId: 'multiattack-rotting-fist-only',
    sequence: ['rotting-fist'],
    mode: 'melee',
  },
  {
    slug: 'nalfeshnee',
    actionId: 'multiattack-weapons-only',
    sequence: ['bite', 'claw', 'claw'],
    mode: 'melee',
  },
]

const ENGINE_GATED_MULTIATTACK_EXCEPTIONS: Readonly<Record<string, string>> = {}

function expectExactHeadlessMultiattack(expected: ExpectedMultiattack): void {
  const monster = getDnd5eSrdMonsterBySlug(expected.slug)
  const action = monster?.actions.find((candidate) => candidate.id === expected.actionId)

  expect(monster, expected.slug).toBeDefined()
  expect(action, `${expected.slug}:${expected.actionId}`).toBeDefined()
  expect(action?.kind, `${expected.slug}:${expected.actionId}`).toBe('multiattack')
  expect(action?.automation, `${expected.slug}:${expected.actionId}`).toBe('headless')
  expect(action?.sequence, `${expected.slug}:${expected.actionId}`).toEqual(expected.sequence)
  expect(
    action?.sequenceAttackMode,
    `${expected.slug}:${expected.actionId}`,
  ).toBe(expected.mode)
}

function combatant(
  id: string,
  initiative: number,
  patch: Partial<Dnd5eCombatant> = {},
): Dnd5eCombatant {
  return createDnd5eCombatant({
    id,
    name: id,
    controller: id === 'golem' ? 'dm' : 'player',
    initiative,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    proficiencyBonus: 2,
    armorClass: 10,
    currentHp: 100,
    maxHp: 100,
    temporaryHp: 0,
    speed: 30,
    position: { x: 0, y: 0 },
    concentrating: false,
    ...patch,
  })
}

describe('catalog Multiattack batch', () => {
  it('keeps every catalog Multiattack executable or explicitly engine-gated', () => {
    const rows = auditDnd5eMonsterHeadlessCoverage().actions.rows
      .filter((row) =>
        row.structure === 'multiattack' || row.structure === 'unparsed-multiattack')
    const catalogKeys = new Set(rows.map((row) => `${row.slug}:${row.actionId}`))
    const exceptionEntries = Object.entries(ENGINE_GATED_MULTIATTACK_EXCEPTIONS)

    expect(
      exceptionEntries.filter(([key]) => !catalogKeys.has(key)),
      'Engine-gated exceptions must refer to a current catalog Multiattack.',
    ).toEqual([])
    expect(
      exceptionEntries.filter(([, reason]) => reason.trim().length === 0),
      'Every engine-gated exception must explain the exact missing transaction.',
    ).toEqual([])

    const unexpectedIncomplete = rows.flatMap((row) => {
      const key = `${row.slug}:${row.actionId}`
      const hasExecutableDragonWeaponChoice =
        row.actionId === 'multiattack' &&
        /^(?:adult|ancient)-.+-dragon$/.test(row.slug) &&
        rows.some((candidate) =>
          candidate.slug === row.slug &&
          candidate.actionId === 'multiattack-weapons-only' &&
          candidate.effectiveAutomation === 'headless')
      if (
        row.effectiveAutomation === 'headless' ||
        hasExecutableDragonWeaponChoice ||
        Object.hasOwn(ENGINE_GATED_MULTIATTACK_EXCEPTIONS, key)
      ) return []
      return [{
        key,
        effectiveAutomation: row.effectiveAutomation,
        blockedChildIds: row.blockedChildIds,
        reasonCodes: row.reasonCodes,
      }]
    })

    expect(
      unexpectedIncomplete,
      'Every non-spell catalog Multiattack must be executable Headless.',
    ).toEqual([])
  })

  it('eliminates every prose-only Multiattack declaration', () => {
    const unparsed = auditDnd5eMonsterHeadlessCoverage().actions.rows
      .filter((row) => row.structure === 'unparsed-multiattack')
      .map((row) => `${row.slug}:${row.actionId}`)

    expect(unparsed).toEqual([])
  })

  it.each([...FIXED_MULTIATTACKS, ...EXPANDED_FIXED_MULTIATTACKS])(
    'publishes $slug:$actionId with its reviewed fixed sequence',
    (expected) => {
      expectExactHeadlessMultiattack(expected)
    },
  )

  it.each([...FIXED_SIBLINGS, ...EXPANDED_FIXED_SIBLINGS])(
    'publishes $slug:$actionId as an exact fixed sibling',
    (expected) => {
      expectExactHeadlessMultiattack(expected)
    },
  )

  it.each(CONDITIONAL_FIXED_SIBLINGS)(
    'publishes $slug:$actionId for the legal no-special branch',
    (expected) => {
      expectExactHeadlessMultiattack(expected)
    },
  )

  it('keeps all 20 dragon composites Headless and adds exact weapon-only siblings', () => {
    const dragons = DND5E_SRD_MONSTERS.filter((monster) =>
      /^(?:adult|ancient)-.+-dragon$/.test(monster.slug))

    expect(dragons).toHaveLength(20)
    for (const dragon of dragons) {
      const original = dragon.actions.find((action) => action.id === 'multiattack')
      const sibling = dragon.actions.find((action) =>
        action.id === 'multiattack-weapons-only')

      expect(original, `${dragon.slug}:multiattack`).toBeDefined()
      expect(original?.kind, `${dragon.slug}:multiattack`).toBe('multiattack')
      expect(original?.automation, `${dragon.slug}:multiattack`).toBe('headless')
      expect(original?.sequence, `${dragon.slug}:multiattack`).toEqual([
        'frightful-presence',
        'bite',
        'claw',
        'claw',
      ])
      expect(original?.sequenceAttackMode, `${dragon.slug}:multiattack`).toBeUndefined()

      expect(sibling, `${dragon.slug}:multiattack-weapons-only`).toBeDefined()
      expect(sibling?.kind, `${dragon.slug}:multiattack-weapons-only`).toBe('multiattack')
      expect(sibling?.automation, `${dragon.slug}:multiattack-weapons-only`).toBe('headless')
      expect(sibling?.sequence, `${dragon.slug}:multiattack-weapons-only`).toEqual([
        'bite',
        'claw',
        'claw',
      ])
      expect(
        sibling?.sequenceAttackMode,
        `${dragon.slug}:multiattack-weapons-only`,
      ).toBeUndefined()
    }
  })

  it('executes every ordinary fixed weapon Multiattack through one Headless transaction', () => {
    const executable = DND5E_SRD_MONSTERS.flatMap((monster) =>
      monster.actions.flatMap((action) => {
        if (
          action.kind !== 'multiattack' ||
          action.automation !== 'headless' ||
          !action.sequence?.length ||
          action.randomRepeat ||
          dnd5eMonsterMultiattackConstraint(monster.id, action.id)
        ) return []
        const children = action.sequence.map((actionId) =>
          monster.actions.find((candidate) => candidate.id === actionId))
        if (children.some((child) =>
          !child?.attack ||
          child.automation !== 'headless' ||
          child.usage != null ||
          child.targetEligibility != null ||
          child.relationRequirement != null)) return []
        return [{ monster, action }]
      }))
    const failures: Array<{ key: string; reason: string }> = []

    for (const { monster, action } of executable) {
      const state = startDnd5eHeadlessCombat(
        `catalog-fixed-${monster.slug}-${action.id}`,
        [
          combatant('golem', 20, { statBlockId: monster.id }),
          combatant('hero', 10, { position: { x: 5, y: 0 } }),
        ],
      )
      const result = resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: 'golem',
        actionId: action.id,
        rolls: action.sequence!.map(() => ({
          targetId: 'hero',
          d20: 1,
          damageRolls: [],
        })),
      })
      if (!result.ok) {
        failures.push({
          key: `${monster.slug}:${action.id}`,
          reason: result.reason,
        })
      }
    }

    expect(executable.length).toBeGreaterThan(150)
    expect(failures).toEqual([])
  })

  it('resolves the Iron Golem sword-and-slam fixed sibling as one atomic action', () => {
    const state = startDnd5eHeadlessCombat('iron-golem-fixed-multiattack', [
      combatant('golem', 20, {
        statBlockId: 'srd-5.1:iron-golem',
      }),
      combatant('hero', 10, {
        position: { x: 5, y: 0 },
      }),
    ])

    const result = resolveDnd5eHeadlessAction(state, {
      type: 'monster-action',
      actorId: 'golem',
      actionId: 'multiattack-sword-and-slam',
      rolls: [
        { targetId: 'hero', d20: 10, damageRolls: [[1, 1, 1]] },
        { targetId: 'hero', d20: 10, damageRolls: [[1, 1, 1]] },
      ],
    })

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.hero.currentHp).toBe(80)
    expect(result.events.filter((event) =>
      event.type === 'attack-resolved' &&
      event.actorId === 'golem' &&
      event.targetId === 'hero')).toHaveLength(2)
    expect(result.events.filter((event) =>
      event.type === 'turn-resource-spent' &&
      event.actorId === 'golem' &&
      event.resource === 'action')).toHaveLength(1)
  })
})
