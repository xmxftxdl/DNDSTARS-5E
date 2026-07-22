export type Dnd5eSpellSchoolZh = '防护' | '咒法' | '预言' | '附魔' | '塑能' | '幻术' | '死灵' | '变化'

export interface Dnd5eSrdSpellDescriptionZh {
  level: number
  school: Dnd5eSpellSchoolZh
  ritual: boolean
  castingTime: string
  range: string
  components: string
  duration: string
  description: string
  higherLevels?: string
  sourceName: string
  sourceEnglishName: string
  sourcePage: number
}
