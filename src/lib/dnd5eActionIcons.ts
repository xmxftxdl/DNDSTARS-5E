import type { Dnd5eInventoryItemTemplate } from '../types/inventory'

export type Dnd5eActionIconMotif =
  | 'acid'
  | 'arcane'
  | 'armor'
  | 'beast'
  | 'cold'
  | 'control'
  | 'death'
  | 'divination'
  | 'fire'
  | 'force'
  | 'healing'
  | 'illusion'
  | 'lightning'
  | 'move'
  | 'movement'
  | 'nature'
  | 'poison'
  | 'radiant'
  | 'summon'
  | 'weapon'

export interface Dnd5eActionIconSpec {
  /** Stable content key. The renderer uses it to keep gradients and rune marks deterministic. */
  key: string
  motif: Dnd5eActionIconMotif
  background: string
  backgroundDeep: string
  accent: string
  glow: string
  runeIndex: number
  textureRotation: number
}

export interface Dnd5eSpellActionIconInput {
  id: string
  name: string
  englishName?: string
  level?: number
  school?: string
  effect?: string
  damageType?: string
  tags?: readonly string[]
}

type IconPalette = readonly [background: string, backgroundDeep: string, accent: string, glow: string]

const PALETTES: Record<Dnd5eActionIconMotif, readonly IconPalette[]> = {
  acid: [['#315f45', '#071d16', '#b7ff60', '#86efac'], ['#4f5f17', '#171d05', '#e8ff75', '#bef264']],
  arcane: [['#51308a', '#12082b', '#d8b4fe', '#a78bfa'], ['#284f91', '#07162f', '#a5c8ff', '#60a5fa']],
  armor: [['#41576b', '#0d1720', '#d9ecff', '#93c5fd'], ['#675330', '#1e1608', '#ffe0a3', '#fbbf24']],
  beast: [['#704523', '#211207', '#ffd08a', '#fb923c'], ['#355637', '#0c1c0e', '#bcf7ad', '#4ade80']],
  cold: [['#167187', '#041d29', '#d5fbff', '#67e8f9'], ['#315ca5', '#071a38', '#dbeafe', '#7dd3fc']],
  control: [['#5f3a7e', '#1a0a29', '#f0c8ff', '#c084fc'], ['#71304f', '#230917', '#ffd0e3', '#f472b6']],
  death: [['#49315f', '#100718', '#e0c3ff', '#a78bfa'], ['#365044', '#071711', '#c0f4ce', '#4ade80']],
  divination: [['#174f68', '#041720', '#bceeff', '#38bdf8'], ['#493d82', '#100b26', '#ddd6fe', '#8b5cf6']],
  fire: [['#a63a18', '#2b0904', '#ffe1a8', '#fb923c'], ['#8d211c', '#270606', '#ffd0a1', '#f97316']],
  force: [['#4358a6', '#0b1235', '#d8e1ff', '#818cf8'], ['#6d3ba1', '#1d092f', '#e9d5ff', '#c084fc']],
  healing: [['#176b54', '#041d15', '#d5ffef', '#34d399'], ['#217160', '#06231b', '#ccfbf1', '#2dd4bf']],
  illusion: [['#73376e', '#21081f', '#ffd6fb', '#e879f9'], ['#3e3d83', '#0c0b25', '#e0e7ff', '#818cf8']],
  lightning: [['#3157a6', '#071232', '#fff6a8', '#fde047'], ['#4f3b9c', '#100927', '#e0f2fe', '#38bdf8']],
  move: [['#126d76', '#031e22', '#d9ffff', '#22d3ee'], ['#285ea3', '#07172f', '#e0f2fe', '#60a5fa']],
  movement: [['#126d76', '#031e22', '#c7fbff', '#22d3ee'], ['#3558a0', '#081432', '#dbeafe', '#60a5fa']],
  nature: [['#2d6734', '#071d0c', '#d9f99d', '#4ade80'], ['#596324', '#171d07', '#efffa7', '#a3e635']],
  poison: [['#4b6824', '#101d06', '#deff9e', '#84cc16'], ['#345f3a', '#071d0d', '#c7f9cc', '#22c55e']],
  radiant: [['#8a661a', '#2b1a03', '#fff2b5', '#facc15'], ['#8a4f26', '#291104', '#ffdfb5', '#fb923c']],
  summon: [['#335d6d', '#071b22', '#cef4ff', '#67e8f9'], ['#4c4689', '#100d28', '#e0ddff', '#a78bfa']],
  weapon: [['#653329', '#210b07', '#ffd1bd', '#fb7185'], ['#4d5563', '#10141a', '#e5e7eb', '#94a3b8']],
}

const TEXT_RULES: readonly [RegExp, Dnd5eActionIconMotif][] = [
  [/fire|flame|burn|scorch|heat|焰|火|燃烧/i, 'fire'],
  [/cold|ice|frost|freeze|寒|冰|霜|冷冻/i, 'cold'],
  [/lightning|thunder|storm|shock|雷|闪电|风暴/i, 'lightning'],
  [/acid|corros|强酸|腐蚀/i, 'acid'],
  [/poison|venom|toxic|毒/i, 'poison'],
  [/radiant|sun|moonbeam|sacred|holy|light|光耀|神圣|阳炎|月华/i, 'radiant'],
  [/necrot|death|dead|vamp|wither|黯蚀|死亡|亡灵|吸血/i, 'death'],
  [/heal|cure|restore|reviv|aid|healing|治疗|治愈|复原|复活/i, 'healing'],
  [/shield|armor|ward|protect|barrier|护盾|护甲|防护|结界/i, 'armor'],
  [/teleport|misty|fly|levitat|haste|slow|jump|step|传送|飞行|浮空|加速|缓慢|跳跃/i, 'movement'],
  [/summon|conjure|animate|create|召唤|咒唤|操纵死尸/i, 'summon'],
  [/charm|hold|command|suggest|dominat|sleep|fear|魅惑|定身|命令|暗示|支配|睡眠|恐惧/i, 'control'],
  [/illusion|image|invisib|disguise|幻术|幻影|隐形|伪装/i, 'illusion'],
  [/detect|divin|augury|scry|true seeing|侦测|预言|卜筮|探知|真知/i, 'divination'],
  [/animal|beast|fang|claw|野兽|动物|爪|牙/i, 'beast'],
  [/plant|thorn|bark|entangle|druid|植物|荆棘|树肤|纠缠/i, 'nature'],
  [/force|magic missile|eldritch|arcane|力场|魔法飞弹|魔能|奥术/i, 'force'],
]

function hashText(value: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function paletteFor(key: string, motif: Dnd5eActionIconMotif): Dnd5eActionIconSpec {
  const hash = hashText(key)
  const palettes = PALETTES[motif]
  const palette = palettes[hash % palettes.length]
  return {
    key,
    motif,
    background: palette[0],
    backgroundDeep: palette[1],
    accent: palette[2],
    glow: palette[3],
    runeIndex: (hash >>> 5) % 8,
    textureRotation: (hash >>> 12) % 360,
  }
}

export function dnd5eSystemActionIcon(id: string, motif: Dnd5eActionIconMotif): Dnd5eActionIconSpec {
  return paletteFor(`action:${id}`, motif)
}

function motifFromText(value: string): Dnd5eActionIconMotif | undefined {
  return TEXT_RULES.find(([pattern]) => pattern.test(value))?.[1]
}

function motifFromSchool(school: string | undefined): Dnd5eActionIconMotif {
  const normalized = school?.toLowerCase() ?? ''
  if (/illusion|幻术/.test(normalized)) return 'illusion'
  if (/divination|预言/.test(normalized)) return 'divination'
  if (/necromancy|死灵/.test(normalized)) return 'death'
  if (/conjuration|咒法/.test(normalized)) return 'summon'
  if (/enchantment|惑控/.test(normalized)) return 'control'
  if (/abjuration|防护/.test(normalized)) return 'armor'
  if (/transmutation|变化/.test(normalized)) return 'nature'
  return 'arcane'
}

export function dnd5eSpellActionIcon(input: Dnd5eSpellActionIconInput): Dnd5eActionIconSpec {
  const key = `spell:${input.id}`
  const explicitDamageMotif = motifFromText(input.damageType ?? '')
  const searchable = [input.id, input.name, input.englishName, input.effect, ...(input.tags ?? [])]
    .filter(Boolean)
    .join(' ')
  const motif = explicitDamageMotif ?? motifFromText(searchable) ?? motifFromSchool(input.school)
  return paletteFor(key, motif)
}

export function dnd5eItemActionIcon(item: Pick<Dnd5eInventoryItemTemplate, 'id' | 'name' | 'englishName' | 'category' | 'icon' | 'magicItem' | 'use'>): Dnd5eActionIconSpec {
  const key = `item:${item.id}`
  const searchable = `${item.id} ${item.name} ${item.englishName ?? ''}`
  const textMotif = motifFromText(searchable)
  if (textMotif) return paletteFor(key, textMotif)
  if (item.icon === 'weapon' || item.magicItem?.kind === 'weapon' || item.magicItem?.kind === 'ammunition') return paletteFor(key, 'weapon')
  if (item.icon === 'armor' || item.icon === 'shield' || item.magicItem?.kind === 'armor') return paletteFor(key, 'armor')
  if (item.icon === 'healing-potion' || item.icon === 'healers-kit' || item.use?.effect.kind === 'healing') return paletteFor(key, 'healing')
  if (item.icon === 'acid') return paletteFor(key, 'acid')
  if (item.icon === 'alchemists-fire' || item.icon === 'torch' || item.icon === 'tinderbox') return paletteFor(key, 'fire')
  if (item.icon === 'poison' || item.icon === 'antitoxin') return paletteFor(key, 'poison')
  if (item.icon === 'holy-water') return paletteFor(key, 'radiant')
  if (item.icon === 'magic-ring' || item.icon === 'magic-wand' || item.icon === 'magic-staff' || item.icon === 'magic-scroll' || item.icon === 'magic-wondrous') return paletteFor(key, 'arcane')
  if (item.category === 'equipment') return paletteFor(key, 'weapon')
  return paletteFor(key, 'beast')
}
