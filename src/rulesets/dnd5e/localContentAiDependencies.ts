import { DND5E_SRD_MONSTERS } from './monsters'
import { DND5E_SRD_SPELL_CATALOG } from './spellCatalog'
import { dnd5eClassDefinition } from './classes'
import classResourceSource from '../../classes/dnd5e/classDefinitions.ts?raw'
import { DND5E_RACIAL_STATIC_RESOURCES } from './racialResourceCatalog'

/** Read literal Host resource declarations without loading character-building runtime code. */
export const DND5E_AI_CORE_RESOURCE_REFERENCES = [...new Map(
  [...[...classResourceSource.matchAll(/\bresource\(\s*'([^']+)'\s*,\s*'([^']+)'/gu)]
    .map(match => [match[1], {id: match[1], name: match[2]}] as const),
    ...Object.values(DND5E_RACIAL_STATIC_RESOURCES).map(entry => [entry.id, entry] as const)],
).values()]

const compact = (value: string) => value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/gu, '')

export function dnd5eLocalContentAiSpellReferences(sourceText: string): string {
  const body=sourceText.split('[职业清单参考]')[0],folded=compact(body)
  const spells=DND5E_SRD_SPELL_CATALOG.filter(spell => folded.includes(compact(spell.name)) ||
    (spell.englishName.length >= 5 && folded.includes(compact(spell.englishName))))
    .map(({id,name,englishName,level,classes})=>({id,name,englishName,level,classes}))
  const classes=[['warlock','邪术师'],['wizard','法师'],['druid','德鲁伊'],['cleric','牧师'],['bard','吟游诗人'],['sorcerer','术士'],['paladin','圣武士'],['ranger','游侠']]
    .filter(([id,name])=>body.includes(name) || new RegExp(`\\b${id}\\b`,'iu').test(body))
    .flatMap(([classId])=>{const definition=dnd5eClassDefinition(classId);return definition?.spellcasting ? [{classId,ability:definition.spellcasting.ability}] : []})
  if(!spells.length)return ''
  return 'Host 内置 SRD 法术目录引用：level 是实际目录环级，可用于原文明示无升环的独立施法；classes 只证明目录归属，不赋予角色职业，也不证明机制已自动化。职业施法属性来自 Host 规则，只有原文或明确章节上下文确定施法职业时才能使用；不要从同页其他子职或法术列表猜测当前条目归属。\n'+JSON.stringify({spells,classes})
}

/** Only cite real built-in records. This is reference retrieval, not a generated stat block. */
export function dnd5eLocalContentAiMonsterReferences(sourceText: string): string {
  const body = sourceText.split('[职业清单参考]')[0]
  const folded = compact(body)
  const needsCreatureChoices = /召唤|召来|变形|形态|唤起|唤醒|summon|polymorph|transform|animate/iu.test(body)
  const requestedSubtypes = needsCreatureChoices
    ? [
        ...(/恶魔|\bdemons?\b/iu.test(body) ? ['demon', '恶魔'] : []),
        ...(/魔鬼|\bdevils?\b/iu.test(body) ? ['devil', '魔鬼'] : []),
      ] : []
  const typeNames = [
    ['beast', '野兽'], ['fey', '精类'], ['elemental', '元素'], ['celestial', '天界'],
    ['undead', '不死'], ['construct', '构装'], ['dragon', '龙'], ['fiend', '邪魔'],
  ] as const
  const requestedTypes = needsCreatureChoices ? typeNames.filter(([english, chinese]) =>
    (english === 'dragon' ? /巨龙|龙类|\bdragons?\b/iu.test(body) : body.includes(chinese) ||
      new RegExp(`\\b${english}s?\\b`, 'iu').test(body)),
  ) : []
  const references = DND5E_SRD_MONSTERS.filter(monster => {
    const chinese = compact(monster.name)
    const english = compact(monster.englishName)
    return (chinese.length >= 2 && folded.includes(chinese)) ||
      (english.length >= 5 && folded.includes(english)) ||
      body.toLocaleLowerCase().split(/[^a-z]+/u).includes(monster.englishName.toLocaleLowerCase()) ||
      requestedSubtypes.some(subtype => monster.subtypes?.includes(subtype)) ||
      requestedTypes.some(([type, label]) => monster.creatureType.toLowerCase() === type || monster.creatureType.includes(label))
  }).map(monster => ({
    id: monster.id, name: monster.name, englishName: monster.englishName,
    creatureType: monster.creatureType, subtypes: monster.subtypes, challengeRating: monster.challenge.rating,
    source: monster.source,
  }))
  if (!references.length) return ''
  return 'Host 已安装且可按 ID 解析的内置怪物引用（来自实际目录，不是要求创建的新怪物）。原文明确选择这些生物时，可在 summon/形态协议中引用对应 ID，基础属性由 Host 加载，无需原文重复属性块；原文的额外限制仍须声明。不在此表中的生物不能臆造 ID 或属性。此表只证明资料存在，不证明该法术全部机制已覆盖。\n' + JSON.stringify(references)
}
