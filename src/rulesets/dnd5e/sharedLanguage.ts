import { dnd5eActivityCreatureTypeMatches } from './creatureTypeMatching'
/** Known-language facts only; unspecified choices and prose need source data resolution. */
const languageAliases: Readonly<Record<string, string>> = {
  '通用语': 'common', '矮人语': 'dwarvish', '精灵语': 'elvish', '巨人语': 'giant',
  '侏儒语': 'gnomish', '地精语': 'goblin', '半身人语': 'halfling', '兽人语': 'orc',
  '深渊语': 'abyssal', '天界语': 'celestial', '龙语': 'draconic', '深潜语': 'deep-speech',
  'deep speech': 'deep-speech', '炼狱语': 'infernal', '原初语': 'primordial',
  '木族语': 'sylvan', '地下通用语': 'undercommon',
}

function concreteLanguages(languages: readonly string[] | undefined): Set<string> {
  return new Set((languages ?? []).flatMap(language => language.split(/[，,、;；/]/u)).flatMap(value => {
    const entry = value.trim().toLowerCase().replace(/\s+/gu, ' ')
    if (['all languages', '所有语言', '一切语言'].includes(entry)) return ['*all-languages*']
    if (!entry || /^(?:[-—–*]+|none|any|all|unknown|无|不详)$/u.test(entry) ||
        /\b(?:understands?|cannot|can't|can’t|telepathy|any|all)\b|任意|所有语言|无法|不能|理解|心灵感应/iu.test(entry)) return []
    return [languageAliases[entry] ?? entry]
  }))
}

export function dnd5eShareKnownLanguage(source: readonly string[] | undefined, target: readonly string[] | undefined): boolean {
  const left = concreteLanguages(source), right = concreteLanguages(target)
  if (left.size && right.size && (left.has('*all-languages*') || right.has('*all-languages*'))) return true
  return [...left].some(language => right.has(language))
}

/** Linguistic comprehension only; hearing and speech production are separate requirements. */
export function dnd5eCanUnderstandSourceLanguage(
  source: { creatureType?: string; communicationCreatureTypes?: readonly string[]; languages?: readonly string[]; languageCapabilities?: { intelligibleCommunicationRestricted: boolean; speechUnderstoodByAnyLanguageKnower: boolean } },
  target: { creatureType?: string; communicationCreatureTypes?: readonly string[]; languages?: readonly string[]; languageCapabilities?: { understandLanguagesRestricted: boolean; understandSpoken: boolean } } | undefined,
): boolean {
  if (!target || source.languageCapabilities?.intelligibleCommunicationRestricted || target.languageCapabilities?.understandLanguagesRestricted) return false
  // Creature communication grants mutual understanding without teaching a shared language.
  // Hearing, speech, visibility of gestures and attitude remain separate requirements.
  if ((target.creatureType && source.communicationCreatureTypes?.some(type => dnd5eActivityCreatureTypeMatches(type, target.creatureType!))) ||
      (source.creatureType && target.communicationCreatureTypes?.some(type => dnd5eActivityCreatureTypeMatches(type, source.creatureType!)))) return true
  if (!concreteLanguages(source.languages).size) return false
  return target.languageCapabilities?.understandSpoken === true ||
    (source.languageCapabilities?.speechUnderstoodByAnyLanguageKnower === true && concreteLanguages(target.languages).size > 0) ||
    dnd5eShareKnownLanguage(source.languages, target.languages)
}
