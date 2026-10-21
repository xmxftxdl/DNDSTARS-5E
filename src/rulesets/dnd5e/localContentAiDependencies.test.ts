import { expect, it } from 'vitest'
import { dnd5eLocalContentAiMonsterReferences, dnd5eLocalContentAiSpellReferences, DND5E_AI_CORE_RESOURCE_REFERENCES } from './localContentAiDependencies'
import { getDnd5eSrdMonster, DND5E_SRD_MONSTERS } from './monsters'
import { normalizeCharacter } from '../../store/characters'
import { dnd5eRacialResourceDefinitions } from './racialAutomation'
import { DND5E_RACIAL_STATIC_RESOURCES } from './racialResourceCatalog'

it('retrieves referenced spell levels and explicit class attributes without assigning ownership',()=>{
  const result=JSON.parse(dnd5eLocalContentAiSpellReferences('邪术师可以以自己为目标施展 freedom of movement，无需法术位。').split('\n')[1])
  expect(result.spells).toContainEqual(expect.objectContaining({id:'freedom-of-movement',level:4}))
  expect(result.classes).toContainEqual({classId:'warlock',ability:'cha'})
  const unrelated=JSON.parse(dnd5eLocalContentAiSpellReferences('施展 invisibility。[职业清单参考] 邪术师 freedom of movement').split('\n')[1])
  expect(unrelated.spells.map((spell:{id:string})=>spell.id)).toEqual(['invisibility'])
  expect(unrelated.classes).toEqual([])
})

it('retrieves actual shared class resource identifiers without copying executable providers', () => {
  expect(DND5E_AI_CORE_RESOURCE_REFERENCES).toContainEqual({id: 'dnd5e-channel-divinity', name: '引导神力'})
  expect(new Set(DND5E_AI_CORE_RESOURCE_REFERENCES.map(entry => entry.id)).size).toBe(DND5E_AI_CORE_RESOURCE_REFERENCES.length)
  expect(DND5E_AI_CORE_RESOURCE_REFERENCES.every(entry => entry.id.startsWith('dnd5e-'))).toBe(true)
})

it.each([
  ['龙裔', DND5E_RACIAL_STATIC_RESOURCES.dragonbornBreath],
  ['半兽人', DND5E_RACIAL_STATIC_RESOURCES.relentlessEndurance],
] as const)('retrieves %s resources from the same definitions used by the Host without granting ownership', (race, reference) => {
  expect(DND5E_AI_CORE_RESOURCE_REFERENCES).toContainEqual(reference)
  const owner = normalizeCharacter({ id: 'owner', name: 'Owner', race, level: 1,
    dnd5eRacialChoices: { dragonbornAncestry: 'red' } })
  const actual = dnd5eRacialResourceDefinitions(owner).find(resource => resource.key === reference.id)
  expect(actual?.label).toBe(reference.name)
  expect(actual?.max(owner)).toBe(1)
  const human = normalizeCharacter({ id: 'human', name: 'Human', race: '人类', level: 1 })
  expect(dnd5eRacialResourceDefinitions(human).some(resource => resource.key === reference.id)).toBe(false)
})

it('retrieves real built-in summon references without inventing absent creatures', () => {
  const guide = dnd5eLocalContentAiMonsterReferences('Choose a G riffon, P egasus, Dire Wolf, Rhinoceros, Saber-Toothed Tiger, or Imaginary Sapphire Steed.')
  const references = JSON.parse(guide.split('\n')[1]) as { id: string; englishName: string }[]
  expect(references.map(entry => entry.englishName)).toEqual(expect.arrayContaining([
    'Griffon', 'Pegasus', 'Dire Wolf', 'Rhinoceros', 'Saber-Toothed Tiger',
  ]))
  for (const reference of references) expect(getDnd5eSrdMonster(reference.id)).toBeDefined()
  expect(references.some(entry => entry.englishName === 'Imaginary Sapphire Steed')).toBe(false)
})

it('keeps unrelated source and class-catalog mentions out of the dependency guide', () => {
  expect(dnd5eLocalContentAiMonsterReferences('A magical ward. [职业清单参考] Griffon')).toBe('')
  expect(dnd5eLocalContentAiMonsterReferences('Catapult a stone.')).toBe('')
})

it.each([['召唤一个恶魔', '恶魔'], ['Summon a devil', '魔鬼']])('retrieves installed subtype candidates for %s without a named creature', (source, subtype) => {
  const references = JSON.parse(dnd5eLocalContentAiMonsterReferences(source).split('\n')[1])
  const expected = DND5E_SRD_MONSTERS.filter(monster => monster.subtypes?.includes(subtype))
  expect(expected.length).toBeGreaterThan(0)
  expect(references.map((entry: { id: string }) => entry.id).sort()).toEqual(expected.map(entry => entry.id).sort())
  expect(references.every((entry: { subtypes: string[] }) => entry.subtypes.includes(subtype))).toBe(true)
})

it('retrieves all installed beasts for form selection without inventing profiles', () => {
  const references = JSON.parse(dnd5eLocalContentAiMonsterReferences('变形为野兽形态').split('\n')[1])
  const expected = DND5E_SRD_MONSTERS.filter(monster => monster.creatureType.includes('野兽'))
  expect(references.map((entry: { id: string }) => entry.id).sort()).toEqual(expected.map(entry => entry.id).sort())
})
