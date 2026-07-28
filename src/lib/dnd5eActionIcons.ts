import type { Dnd5eInventoryItemTemplate, Dnd5eMagicItemRarity } from '../types/inventory'
import { DND5E_SRD_SPELL_CATALOG } from '../rulesets/dnd5e/spellCatalog'

export type Dnd5eActionIconMotif =
  | 'acid'
  | 'arcane'
  | 'armor'
  | 'beast'
  | 'cold'
  | 'control'
  | 'dash'
  | 'death'
  | 'disengage'
  | 'divination'
  | 'dodge'
  | 'fire'
  | 'force'
  | 'healing'
  | 'illusion'
  | 'lightning'
  | 'melee-attack'
  | 'monster-attack'
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
  /** Optional painted layer. Transparent foreground assets preserve the generated class-color background. */
  asset?: string
  assetMode?: 'cover' | 'foreground'
  /** Optional semantic backdrop rendered beneath transparent artwork. */
  classBackdropId?: string
  /** Magic-item rarity controls the inventory background and ornamental frame. */
  rarityBackdropId?: Dnd5eMagicItemRarity
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
  castingClassId?: string
}

type IconPalette = readonly [background: string, backgroundDeep: string, accent: string, glow: string]

const PALETTES: Record<Dnd5eActionIconMotif, readonly IconPalette[]> = {
  acid: [['#315f45', '#071d16', '#b7ff60', '#86efac'], ['#4f5f17', '#171d05', '#e8ff75', '#bef264']],
  arcane: [['#51308a', '#12082b', '#d8b4fe', '#a78bfa'], ['#284f91', '#07162f', '#a5c8ff', '#60a5fa']],
  armor: [['#41576b', '#0d1720', '#d9ecff', '#93c5fd'], ['#675330', '#1e1608', '#ffe0a3', '#fbbf24']],
  beast: [['#704523', '#211207', '#ffd08a', '#fb923c'], ['#355637', '#0c1c0e', '#bcf7ad', '#4ade80']],
  cold: [['#167187', '#041d29', '#d5fbff', '#67e8f9'], ['#315ca5', '#071a38', '#dbeafe', '#7dd3fc']],
  control: [['#5f3a7e', '#1a0a29', '#f0c8ff', '#c084fc'], ['#71304f', '#230917', '#ffd0e3', '#f472b6']],
  dash: [['#126d76', '#031e22', '#c7fbff', '#22d3ee'], ['#3558a0', '#081432', '#dbeafe', '#60a5fa']],
  death: [['#49315f', '#100718', '#e0c3ff', '#a78bfa'], ['#365044', '#071711', '#c0f4ce', '#4ade80']],
  disengage: [['#174f68', '#041720', '#bceeff', '#38bdf8'], ['#71304f', '#230917', '#ffd0e3', '#f472b6']],
  divination: [['#174f68', '#041720', '#bceeff', '#38bdf8'], ['#493d82', '#100b26', '#ddd6fe', '#8b5cf6']],
  dodge: [['#174f68', '#041720', '#bceeff', '#38bdf8'], ['#71304f', '#230917', '#ffd0e3', '#f472b6']],
  fire: [['#a63a18', '#2b0904', '#ffe1a8', '#fb923c'], ['#8d211c', '#270606', '#ffd0a1', '#f97316']],
  force: [['#4358a6', '#0b1235', '#d8e1ff', '#818cf8'], ['#6d3ba1', '#1d092f', '#e9d5ff', '#c084fc']],
  healing: [['#176b54', '#041d15', '#d5ffef', '#34d399'], ['#217160', '#06231b', '#ccfbf1', '#2dd4bf']],
  illusion: [['#73376e', '#21081f', '#ffd6fb', '#e879f9'], ['#3e3d83', '#0c0b25', '#e0e7ff', '#818cf8']],
  lightning: [['#3157a6', '#071232', '#fff6a8', '#fde047'], ['#4f3b9c', '#100927', '#e0f2fe', '#38bdf8']],
  'melee-attack': [['#7a2e1f', '#230907', '#ffe0b2', '#fb923c'], ['#73412a', '#211008', '#ffe4bd', '#f59e0b']],
  'monster-attack': [['#7f1d1d', '#170506', '#fecaca', '#ef4444'], ['#581c1c', '#120304', '#fee2e2', '#f87171']],
  move: [['#126d76', '#031e22', '#d9ffff', '#22d3ee'], ['#285ea3', '#07172f', '#e0f2fe', '#60a5fa']],
  movement: [['#126d76', '#031e22', '#c7fbff', '#22d3ee'], ['#3558a0', '#081432', '#dbeafe', '#60a5fa']],
  nature: [['#2d6734', '#071d0c', '#d9f99d', '#4ade80'], ['#596324', '#171d07', '#efffa7', '#a3e635']],
  poison: [['#4b6824', '#101d06', '#deff9e', '#84cc16'], ['#345f3a', '#071d0d', '#c7f9cc', '#22c55e']],
  radiant: [['#8a661a', '#2b1a03', '#fff2b5', '#facc15'], ['#8a4f26', '#291104', '#ffdfb5', '#fb923c']],
  summon: [['#335d6d', '#071b22', '#cef4ff', '#67e8f9'], ['#4c4689', '#100d28', '#e0ddff', '#a78bfa']],
  weapon: [['#653329', '#210b07', '#ffd1bd', '#fb7185'], ['#4d5563', '#10141a', '#e5e7eb', '#94a3b8']],
}

/** Semantic class colors used behind spell artwork when the casting source is known. */
export const DND5E_CLASS_ICON_PALETTES: Readonly<Record<string, IconPalette>> = {
  // 怪物使用与敌方当前回合流光相同的 #EF4444，但以暗血红为横幅底色，
  // 避免与野蛮人的明亮珊瑚猩红混淆。
  monster: ['#7F1D1D', '#170506', '#FECACA', '#EF4444'],
  barbarian: ['#E5484D', '#2B090B', '#FFE0E0', '#FF6B6B'],
  bard: ['#D946EF', '#26072C', '#F9D5FF', '#E879F9'],
  cleric: ['#FBBF24', '#2B1903', '#FFF3BF', '#FDE047'],
  druid: ['#22C55E', '#05230F', '#D7FFE3', '#4ADE80'],
  fighter: ['#94A3B8', '#111827', '#F1F5F9', '#CBD5E1'],
  monk: ['#F97316', '#2B1003', '#FFE3C2', '#FB923C'],
  paladin: ['#BAE6FD', '#0A2030', '#F0F9FF', '#7DD3FC'],
  ranger: ['#65A30D', '#142304', '#ECFCCB', '#A3E635'],
  rogue: ['#475569', '#090E17', '#E2E8F0', '#94A3B8'],
  sorcerer: ['#FB7185', '#30070E', '#FFE4E8', '#FDA4AF'],
  warlock: ['#8B5CF6', '#170A31', '#EDE9FE', '#A78BFA'],
  wizard: ['#3B82F6', '#071A38', '#DBEAFE', '#60A5FA'],
}

export const DND5E_MAGIC_ITEM_RARITY_PALETTES: Readonly<Record<Dnd5eMagicItemRarity, IconPalette>> = {
  common: ['#52606D', '#111820', '#E5E7EB', '#CBD5E1'],
  uncommon: ['#237A4A', '#061F13', '#BBF7D0', '#4ADE80'],
  rare: ['#2563A8', '#071A38', '#DBEAFE', '#60A5FA'],
  'very-rare': ['#7138A8', '#1C082E', '#F3E8FF', '#C084FC'],
  legendary: ['#B86A12', '#2B1403', '#FFF0B5', '#FBBF24'],
  artifact: ['#A51D2D', '#2A050A', '#FFE4E6', '#FB7185'],
  varies: ['#326C8C', '#160A2E', '#E0F2FE', '#A78BFA'],
}

const DND5E_PAINTED_SPELL_ASSETS: Readonly<Record<string, string>> = Object.freeze({
  ...Object.fromEntries(DND5E_SRD_SPELL_CATALOG.map(({ id }) => [
    id,
    `/assets/icons/${id}-spell-action.png`,
  ])),
  message: '/assets/icons/message-spell-action.png',
  'minor-illusion': '/assets/icons/minor-illusion-spell-action.png',
  druidcraft: '/assets/icons/druidcraft-spell-action.png',
  'shocking-grasp': '/assets/icons/shocking-grasp-spell-action.png',
  'chill-touch': '/assets/icons/chill-touch-spell-action.png',
  'poison-spray': '/assets/icons/poison-spray-spell-action.png',
  fireball: '/assets/icons/fireball-spell-action.png',
  'wall-of-fire': '/assets/icons/wall-of-fire-spell-action.png',
  'fire-bolt': '/assets/icons/fire-bolt-spell-action.png',
  light: '/assets/icons/light-spell-action.png',
  'burning-hands': '/assets/icons/burning-hands-spell-action.png',
  shatter: '/assets/icons/shatter-spell-action.png',
  'true-strike': '/assets/icons/true-strike-spell-action.png',
  'ray-of-frost': '/assets/icons/ray-of-frost-spell-action.png',
  prestidigitation: '/assets/icons/prestidigitation-spell-action.png',
  'eldritch-blast': '/assets/icons/eldritch-blast-spell-action.png',
  'mage-hand': '/assets/icons/mage-hand-spell-action.png',
  thaumaturgy: '/assets/icons/thaumaturgy-spell-action.png',
  'produce-flame': '/assets/icons/produce-flame-spell-action.png',
  guidance: '/assets/icons/guidance-spell-action.png',
  'sacred-flame': '/assets/icons/sacred-flame-spell-action.png',
  'acid-splash': '/assets/icons/acid-splash-spell-action.png',
  resistance: '/assets/icons/resistance-spell-action.png',
  'spare-the-dying': '/assets/icons/spare-the-dying-spell-action.png',
  'dancing-lights': '/assets/icons/dancing-lights-spell-action.png',
  shillelagh: '/assets/icons/shillelagh-spell-action.png',
  mending: '/assets/icons/mending-spell-action.png',
  'vicious-mockery': '/assets/icons/vicious-mockery-spell-action.png',
  sanctuary: '/assets/icons/sanctuary-spell-action.png',
  longstrider: '/assets/icons/longstrider-spell-action.png',
  'speak-with-animals': '/assets/icons/speak-with-animals-spell-action.png',
  'mage-armor': '/assets/icons/mage-armor-spell-action.png',
  'protection-from-evil-and-good': '/assets/icons/protection-from-evil-and-good-spell-action.png',
  'floating-disk': '/assets/icons/floating-disk-spell-action.png',
  shield: '/assets/icons/shield-spell-action.png',
  'animal-friendship': '/assets/icons/animal-friendship-spell-action.png',
  'find-familiar': '/assets/icons/find-familiar-spell-action.png',
  identify: '/assets/icons/identify-spell-action.png',
  'expeditious-retreat': '/assets/icons/expeditious-retreat-spell-action.png',
  alarm: '/assets/icons/alarm-spell-action.png',
  'purify-food-and-drink': '/assets/icons/purify-food-and-drink-spell-action.png',
  entangle: '/assets/icons/entangle-spell-action.png',
  'hideous-laughter': '/assets/icons/hideous-laughter-spell-action.png',
  thunderwave: '/assets/icons/thunderwave-spell-action.png',
  'hellish-rebuke': '/assets/icons/hellish-rebuke-spell-action.png',
  'cure-wounds': '/assets/icons/cure-wounds-spell-action.png',
  'hunters-mark': '/assets/icons/hunters-mark-spell-action.png',
  'charm-person': '/assets/icons/charm-person-spell-action.png',
  'illusory-script': '/assets/icons/illusory-script-spell-action.png',
  command: '/assets/icons/command-spell-action.png',
  'magic-missile': '/assets/icons/magic-missile-spell-action.png',
  'color-spray': '/assets/icons/color-spray-spell-action.png',
  'shield-of-faith': '/assets/icons/shield-of-faith-spell-action.png',
  'divine-favor': '/assets/icons/divine-favor-spell-action.png',
  goodberry: '/assets/icons/goodberry-spell-action.png',
  sleep: '/assets/icons/sleep-spell-action.png',
  jump: '/assets/icons/jump-spell-action.png',
  'comprehend-languages': '/assets/icons/comprehend-languages-spell-action.png',
  'silent-image': '/assets/icons/silent-image-spell-action.png',
  'false-life': '/assets/icons/false-life-spell-action.png',
  'faerie-fire': '/assets/icons/faerie-fire-spell-action.png',
  'guiding-bolt': '/assets/icons/guiding-bolt-spell-action.png',
  'disguise-self': '/assets/icons/disguise-self-spell-action.png',
  'unseen-servant': '/assets/icons/unseen-servant-spell-action.png',
  heroism: '/assets/icons/heroism-spell-action.png',
  grease: '/assets/icons/grease-spell-action.png',
  'feather-fall': '/assets/icons/feather-fall-spell-action.png',
  'fog-cloud': '/assets/icons/fog-cloud-spell-action.png',
  bane: '/assets/icons/bane-spell-action.png',
  'create-or-destroy-water': '/assets/icons/create-or-destroy-water-spell-action.png',
  'detect-poison-and-disease': '/assets/icons/detect-poison-and-disease-spell-action.png',
  'detect-magic': '/assets/icons/detect-magic-spell-action.png',
  'detect-evil-and-good': '/assets/icons/detect-evil-and-good-spell-action.png',
  'healing-word': '/assets/icons/healing-word-spell-action.png',
  'inflict-wounds': '/assets/icons/inflict-wounds-spell-action.png',
  bless: '/assets/icons/bless-spell-action.png',
  'calm-emotions': '/assets/icons/calm-emotions-spell-action.png',
  suggestion: '/assets/icons/suggestion-spell-action.png',
  'arcanists-magic-aura': '/assets/icons/arcanists-magic-aura-spell-action.png',
  'enlarge-reduce': '/assets/icons/enlarge-reduce-spell-action.png',
  'alter-self': '/assets/icons/alter-self-spell-action.png',
  augury: '/assets/icons/augury-spell-action.png',
  'continual-flame': '/assets/icons/continual-flame-spell-action.png',
  silence: '/assets/icons/silence-spell-action.png',
  'zone-of-truth': '/assets/icons/zone-of-truth-spell-action.png',
  'flaming-sphere': '/assets/icons/flaming-sphere-spell-action.png',
  'lesser-restoration': '/assets/icons/lesser-restoration-spell-action.png',
  'animal-messenger': '/assets/icons/animal-messenger-spell-action.png',
  'locate-animals-or-plants': '/assets/icons/locate-animals-or-plants-spell-action.png',
  'protection-from-poison': '/assets/icons/protection-from-poison-spell-action.png',
  'flame-blade': '/assets/icons/flame-blade-spell-action.png',
  'spike-growth': '/assets/icons/spike-growth-spell-action.png',
  'mirror-image': '/assets/icons/mirror-image-spell-action.png',
  'spiritual-weapon': '/assets/icons/spiritual-weapon-spell-action.png',
  'misty-step': '/assets/icons/misty-step-spell-action.png',
  'arcane-lock': '/assets/icons/arcane-lock-spell-action.png',
  'magic-weapon': '/assets/icons/magic-weapon-spell-action.png',
  'rope-trick': '/assets/icons/rope-trick-spell-action.png',
  'magic-mouth': '/assets/icons/magic-mouth-spell-action.png',
  'blindness-deafness': '/assets/icons/blindness-deafness-spell-action.png',
  'enhance-ability': '/assets/icons/enhance-ability-spell-action.png',
  'acid-arrow': '/assets/icons/acid-arrow-spell-action.png',
  'hold-person': '/assets/icons/hold-person-spell-action.png',
  'see-invisibility': '/assets/icons/see-invisibility-spell-action.png',
  'warding-bond': '/assets/icons/warding-bond-spell-action.png',
  'ray-of-enfeeblement': '/assets/icons/ray-of-enfeeblement-spell-action.png',
  'locate-object': '/assets/icons/locate-object-spell-action.png',
  'pass-without-trace': '/assets/icons/pass-without-trace-spell-action.png',
  'find-traps': '/assets/icons/find-traps-spell-action.png',
  'gentle-repose': '/assets/icons/gentle-repose-spell-action.png',
  'branding-smite': '/assets/icons/branding-smite-spell-action.png',
  'gust-of-wind': '/assets/icons/gust-of-wind-spell-action.png',
  'find-steed': '/assets/icons/find-steed-spell-action.png',
  'detect-thoughts': '/assets/icons/detect-thoughts-spell-action.png',
  'prayer-of-healing': '/assets/icons/prayer-of-healing-spell-action.png',
  web: '/assets/icons/web-spell-action.png',
  'spider-climb': '/assets/icons/spider-climb-spell-action.png',
  enthrall: '/assets/icons/enthrall-spell-action.png',
  'heat-metal': '/assets/icons/heat-metal-spell-action.png',
  'scorching-ray': '/assets/icons/scorching-ray-spell-action.png',
  levitate: '/assets/icons/levitate-spell-action.png',
  darkvision: '/assets/icons/darkvision-spell-action.png',
  darkness: '/assets/icons/darkness-spell-action.png',
  blur: '/assets/icons/blur-spell-action.png',
  knock: '/assets/icons/knock-spell-action.png',
  barkskin: '/assets/icons/barkskin-spell-action.png',
  invisibility: '/assets/icons/invisibility-spell-action.png',
  aid: '/assets/icons/aid-spell-action.png',
  moonbeam: '/assets/icons/moonbeam-spell-action.png',
  'animate-dead': '/assets/icons/animate-dead-spell-action.png',
  'stinking-cloud': '/assets/icons/stinking-cloud-spell-action.png',
  'hypnotic-pattern': '/assets/icons/hypnotic-pattern-spell-action.png',
  'beacon-of-hope': '/assets/icons/beacon-of-hope-spell-action.png',
  'bestow-curse': '/assets/icons/bestow-curse-spell-action.png',
  blink: '/assets/icons/blink-spell-action.png',
  'call-lightning': '/assets/icons/call-lightning-spell-action.png',
  clairvoyance: '/assets/icons/clairvoyance-spell-action.png',
  'conjure-animals': '/assets/icons/conjure-animals-spell-action.png',
  counterspell: '/assets/icons/counterspell-spell-action.png',
  'create-food-and-water': '/assets/icons/create-food-and-water-spell-action.png',
  daylight: '/assets/icons/daylight-spell-action.png',
  'dispel-magic': '/assets/icons/dispel-magic-spell-action.png',
  fear: '/assets/icons/fear-spell-action.png',
  fly: '/assets/icons/fly-spell-action.png',
  'gaseous-form': '/assets/icons/gaseous-form-spell-action.png',
  'glyph-of-warding': '/assets/icons/glyph-of-warding-spell-action.png',
  haste: '/assets/icons/haste-spell-action.png',
  'lightning-bolt': '/assets/icons/lightning-bolt-spell-action.png',
  'magic-circle': '/assets/icons/magic-circle-spell-action.png',
  'major-image': '/assets/icons/major-image-spell-action.png',
  'mass-healing-word': '/assets/icons/mass-healing-word-spell-action.png',
  'meld-into-stone': '/assets/icons/meld-into-stone-spell-action.png',
  nondetection: '/assets/icons/nondetection-spell-action.png',
  'phantom-steed': '/assets/icons/phantom-steed-spell-action.png',
  'plant-growth': '/assets/icons/plant-growth-spell-action.png',
  'protection-from-energy': '/assets/icons/protection-from-energy-spell-action.png',
  'remove-curse': '/assets/icons/remove-curse-spell-action.png',
  revivify: '/assets/icons/revivify-spell-action.png',
  sending: '/assets/icons/sending-spell-action.png',
  'sleet-storm': '/assets/icons/sleet-storm-spell-action.png',
  slow: '/assets/icons/slow-spell-action.png',
  'speak-with-dead': '/assets/icons/speak-with-dead-spell-action.png',
  'speak-with-plants': '/assets/icons/speak-with-plants-spell-action.png',
  'spirit-guardians': '/assets/icons/spirit-guardians-spell-action.png',
  'tiny-hut': '/assets/icons/tiny-hut-spell-action.png',
  tongues: '/assets/icons/tongues-spell-action.png',
  'vampiric-touch': '/assets/icons/vampiric-touch-spell-action.png',
  'water-breathing': '/assets/icons/water-breathing-spell-action.png',
  'water-walk': '/assets/icons/water-walk-spell-action.png',
  'wind-wall': '/assets/icons/wind-wall-spell-action.png',
  'arcane-eye': '/assets/icons/arcane-eye-spell-action.png',
  banishment: '/assets/icons/banishment-spell-action.png',
  'black-tentacles': '/assets/icons/black-tentacles-spell-action.png',
  blight: '/assets/icons/blight-spell-action.png',
  compulsion: '/assets/icons/compulsion-spell-action.png',
  confusion: '/assets/icons/confusion-spell-action.png',
  'conjure-minor-elementals': '/assets/icons/conjure-minor-elementals-spell-action.png',
  'conjure-woodland-beings': '/assets/icons/conjure-woodland-beings-spell-action.png',
  'control-water': '/assets/icons/control-water-spell-action.png',
  'death-ward': '/assets/icons/death-ward-spell-action.png',
  'dimension-door': '/assets/icons/dimension-door-spell-action.png',
  divination: '/assets/icons/divination-spell-action.png',
  'dominate-beast': '/assets/icons/dominate-beast-spell-action.png',
  fabricate: '/assets/icons/fabricate-spell-action.png',
})

const DND5E_PAINTED_ITEM_ASSETS: Readonly<Record<string, string>> = {
  'srd-5.1:magic-item:adamantine-armor': '/assets/icons/adamantine-armor-item-action.png',
  'srd-5.1:magic-item:ammunition': '/assets/icons/ammunition-item-action.png',
  'srd-5.1:magic-item:amulet-of-health': '/assets/icons/amulet-of-health-item-action.png',
  'srd-5.1:magic-item:amulet-of-proof-against-detection-and-location': '/assets/icons/amulet-of-proof-against-detection-and-location-item-action.png',
  'srd-5.1:magic-item:amulet-of-the-planes': '/assets/icons/amulet-of-the-planes-item-action.png',
  'srd-5.1:magic-item:animated-shield': '/assets/icons/animated-shield-item-action.png',
  'srd-5.1:magic-item:apparatus-of-the-crab': '/assets/icons/apparatus-of-the-crab-item-action.png',
  'srd-5.1:magic-item:armor-chain-mail-plus-1': '/assets/icons/armor-chain-mail-plus-1-item-action.png',
  'srd-5.1:magic-item:armor-chain-mail-plus-2': '/assets/icons/armor-chain-mail-plus-2-item-action.png',
  'srd-5.1:magic-item:armor-chain-mail-plus-3': '/assets/icons/armor-chain-mail-plus-3-item-action.png',
  'srd-5.1:magic-item:armor-scale-mail-plus-1': '/assets/icons/armor-scale-mail-plus-1-item-action.png',
  'srd-5.1:magic-item:armor-scale-mail-plus-2': '/assets/icons/armor-scale-mail-plus-2-item-action.png',
  'srd-5.1:magic-item:armor-scale-mail-plus-3': '/assets/icons/armor-scale-mail-plus-3-item-action.png',
  'srd-5.1:magic-item:armor-leather-armor-plus-1': '/assets/icons/armor-leather-armor-plus-1-item-action.png',
  'srd-5.1:magic-item:armor-leather-armor-plus-2': '/assets/icons/armor-leather-armor-plus-2-item-action.png',
  'srd-5.1:magic-item:armor-leather-armor-plus-3': '/assets/icons/armor-leather-armor-plus-3-item-action.png',
  'srd-5.1:magic-item:armor-of-invulnerability': '/assets/icons/armor-of-invulnerability-item-action.png',
  'srd-5.1:magic-item:armor-of-resistance': '/assets/icons/armor-of-resistance-item-action.png',
  'srd-5.1:magic-item:armor-of-vulnerability': '/assets/icons/armor-of-vulnerability-item-action.png',
  'srd-5.1:magic-item:arrow-catching-shield': '/assets/icons/arrow-catching-shield-item-action.png',
  'srd-5.1:magic-item:arrow-of-slaying': '/assets/icons/arrow-of-slaying-item-action.png',
  'srd-5.1:magic-item:bag-of-beans': '/assets/icons/bag-of-beans-item-action.png',
  'srd-5.1:magic-item:bag-of-devouring': '/assets/icons/bag-of-devouring-item-action.png',
  'srd-5.1:magic-item:bag-of-holding': '/assets/icons/bag-of-holding-item-action.png',
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
  const spec = paletteFor(key, motif)
  const asset = DND5E_PAINTED_SPELL_ASSETS[input.id]
  const classPalette = input.castingClassId ? DND5E_CLASS_ICON_PALETTES[input.castingClassId] : undefined
  return {
    ...spec,
    ...(classPalette ? {
      background: classPalette[0],
      backgroundDeep: classPalette[1],
      accent: classPalette[2],
      glow: classPalette[3],
    } : {}),
    ...(asset ? { asset, assetMode: 'foreground' as const } : {}),
    classBackdropId: input.castingClassId,
  }
}

export function dnd5eItemActionIcon(item: Pick<Dnd5eInventoryItemTemplate, 'id' | 'name' | 'englishName' | 'category' | 'icon' | 'magicItem' | 'use'>): Dnd5eActionIconSpec {
  const key = `item:${item.id}`
  const searchable = `${item.id} ${item.name} ${item.englishName ?? ''}`
  const textMotif = motifFromText(searchable)
  const motif = textMotif ??
    (item.icon === 'weapon' || item.magicItem?.kind === 'weapon' || item.magicItem?.kind === 'ammunition' ? 'weapon'
      : item.icon === 'armor' || item.icon === 'shield' || item.magicItem?.kind === 'armor' ? 'armor'
        : item.icon === 'healing-potion' || item.icon === 'healers-kit' || item.use?.effect.kind === 'healing' ? 'healing'
          : item.icon === 'acid' ? 'acid'
            : item.icon === 'alchemists-fire' || item.icon === 'torch' || item.icon === 'tinderbox' ? 'fire'
              : item.icon === 'poison' || item.icon === 'antitoxin' ? 'poison'
                : item.icon === 'holy-water' ? 'radiant'
                  : item.icon === 'magic-ring' || item.icon === 'magic-wand' || item.icon === 'magic-staff' || item.icon === 'magic-scroll' || item.icon === 'magic-wondrous' ? 'arcane'
                    : item.category === 'equipment' ? 'weapon' : 'beast')
  const base = paletteFor(key, motif)
  const rarityPalette = item.magicItem ? DND5E_MAGIC_ITEM_RARITY_PALETTES[item.magicItem.rarity] : undefined
  const asset = DND5E_PAINTED_ITEM_ASSETS[item.id]
  return {
    ...base,
    ...(rarityPalette ? {
      background: rarityPalette[0],
      backgroundDeep: rarityPalette[1],
      accent: rarityPalette[2],
      glow: rarityPalette[3],
      rarityBackdropId: item.magicItem!.rarity,
    } : {}),
    ...(asset ? { asset, assetMode: 'foreground' as const } : {}),
  }
}
