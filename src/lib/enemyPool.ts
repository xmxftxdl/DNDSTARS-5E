import { enemyHasDerivedCombat, getEnemyMaxHp } from './enemyCombatStats'
import {
  creatureSizeToTokenSize,
  inferCreatureSizeFromTags,
  inferCreatureTypesFromTags,
  type CreatureSize,
  type CreatureType,
} from './monsterTypes'
import {
  DND5E_SRD_MONSTERS,
  getDnd5eSrdMonster,
  getDnd5eSrdMonsterBySlug,
  type Dnd5eMonsterStatBlock,
} from '../rulesets/dnd5e/monsters'

/** 怪物池模板（用于 DM 快速放置敌人 Token）。 */
export interface EnemyTemplate {
  id: string
  name: string
  emoji: string
  color: string
  maxHp: number
  hp?: number
  size?: number
  creatureTypes?: CreatureType[]
  creatureSize?: CreatureSize
  tags: string[]
  description?: string
  armorClass?: number
  challengeRating?: string
  experiencePoints?: number
  hitDice?: string
  source?: string
  tokenPortrait?: string
  initiativePortrait?: string
  visualVariants?: readonly EnemyVisualVariant[]
  visualVariantId?: string
  searchAliases?: string[]
}

export interface EnemyVisualVariant {
  id: string
  label: string
  tokenPortrait: string
  initiativePortrait: string
}

interface SrdMonsterPresentation {
  emoji: string
  color: string
  tokenPortrait?: string
  initiativePortrait?: string
  visualVariants?: readonly EnemyVisualVariant[]
}

export interface EnemyVisualPresentation {
  tokenPortrait: string
  initiativePortrait: string
}

export function selectNextEnemyVisualVariantId(
  template: EnemyTemplate,
  usedVariantIds: readonly (string | undefined)[],
): string | undefined {
  const variants = template.visualVariants ?? []
  if (variants.length === 0) return template.visualVariantId

  const validIds = new Set(variants.map((variant) => variant.id))
  const used = new Set(
    usedVariantIds
      .map((id) => id == null ? variants[0].id : id)
      .filter((id) => validIds.has(id)),
  )
  const unused = variants.find((variant) => !used.has(variant.id))
  if (unused) return unused.id

  return variants[usedVariantIds.length % variants.length]?.id
}

const SRD_MONSTER_PRESENTATION: Record<string, SrdMonsterPresentation> = {
  aboleth: {
    emoji: '🐙',
    color: '#0f766e',
    tokenPortrait: '/assets/portraits/aboleth-ancient-depths-token.png',
    initiativePortrait: '/assets/portraits/aboleth-ancient-depths-initiative.png',
    visualVariants: [
      {
        id: 'ancient-depths',
        label: '远古深渊',
        tokenPortrait: '/assets/portraits/aboleth-ancient-depths-token.png',
        initiativePortrait: '/assets/portraits/aboleth-ancient-depths-initiative.png',
      },
      {
        id: 'drowned-temple',
        label: '熔火深渊',
        tokenPortrait: '/assets/portraits/aboleth-volcanic-trench-token.png',
        initiativePortrait: '/assets/portraits/aboleth-volcanic-trench-initiative.png',
      },
    ],
  },
  acolyte: {
    emoji: '🕯️',
    color: '#a16207',
    tokenPortrait: '/assets/portraits/acolyte-stone-shrine-token.png',
    initiativePortrait: '/assets/portraits/acolyte-stone-shrine-initiative.png',
    visualVariants: [
      {
        id: 'stone-shrine-female',
        label: '女性侍僧',
        tokenPortrait: '/assets/portraits/acolyte-stone-shrine-token.png',
        initiativePortrait: '/assets/portraits/acolyte-stone-shrine-initiative.png',
      },
      {
        id: 'stone-shrine-male',
        label: '男性修院侍僧',
        tokenPortrait: '/assets/portraits/acolyte-scriptorium-male-token.png',
        initiativePortrait: '/assets/portraits/acolyte-scriptorium-male-initiative.png',
      },
    ],
  },
  'adult-black-dragon': {
    emoji: '🐉',
    color: '#1f2937',
    tokenPortrait: '/assets/portraits/adult-black-dragon-acid-swamp-token.png',
    initiativePortrait: '/assets/portraits/adult-black-dragon-acid-swamp-initiative.png',
    visualVariants: [
      {
        id: 'acid-swamp',
        label: '酸沼暴君',
        tokenPortrait: '/assets/portraits/adult-black-dragon-acid-swamp-token.png',
        initiativePortrait: '/assets/portraits/adult-black-dragon-acid-swamp-initiative.png',
      },
      {
        id: 'flooded-crypt',
        label: '沉墓伏袭',
        tokenPortrait: '/assets/portraits/adult-black-dragon-flooded-crypt-token.png',
        initiativePortrait: '/assets/portraits/adult-black-dragon-flooded-crypt-initiative.png',
      },
    ],
  },
  'adult-blue-dragon': {
    emoji: '🐉',
    color: '#1d4ed8',
    tokenPortrait: '/assets/portraits/adult-blue-dragon-storm-citadel-token.png',
    initiativePortrait: '/assets/portraits/adult-blue-dragon-storm-citadel-initiative.png',
    visualVariants: [
      {
        id: 'storm-citadel',
        label: '雷冠沙王',
        tokenPortrait: '/assets/portraits/adult-blue-dragon-storm-citadel-token.png',
        initiativePortrait: '/assets/portraits/adult-blue-dragon-storm-citadel-initiative.png',
      },
      {
        id: 'sand-necropolis',
        label: '沙墓雷袭',
        tokenPortrait: '/assets/portraits/adult-blue-dragon-sand-necropolis-token.png',
        initiativePortrait: '/assets/portraits/adult-blue-dragon-sand-necropolis-initiative.png',
      },
    ],
  },
  'adult-brass-dragon': {
    emoji: '🐉',
    color: '#b45309',
    tokenPortrait: '/assets/portraits/adult-brass-dragon-canyon-library-token.png',
    initiativePortrait: '/assets/portraits/adult-brass-dragon-canyon-library-initiative.png',
    visualVariants: [
      {
        id: 'canyon-library',
        label: '古卷守望',
        tokenPortrait: '/assets/portraits/adult-brass-dragon-canyon-library-token.png',
        initiativePortrait: '/assets/portraits/adult-brass-dragon-canyon-library-initiative.png',
      },
      {
        id: 'twilight-flight',
        label: '暮沙巡游',
        tokenPortrait: '/assets/portraits/adult-brass-dragon-twilight-flight-v3-token.png',
        initiativePortrait: '/assets/portraits/adult-brass-dragon-twilight-flight-v3-initiative.png',
      },
    ],
  },
  'adult-bronze-dragon': {
    emoji: '🐉',
    color: '#0f766e',
    tokenPortrait: '/assets/portraits/adult-bronze-dragon-storm-cliff-token.png',
    initiativePortrait: '/assets/portraits/adult-bronze-dragon-storm-cliff-initiative.png',
    visualVariants: [
      {
        id: 'storm-cliff',
        label: '雷潮守望',
        tokenPortrait: '/assets/portraits/adult-bronze-dragon-storm-cliff-token.png',
        initiativePortrait: '/assets/portraits/adult-bronze-dragon-storm-cliff-initiative.png',
      },
      {
        id: 'sunken-galleon',
        label: '沉舰巡游',
        tokenPortrait: '/assets/portraits/adult-bronze-dragon-sunken-galleon-token.png',
        initiativePortrait: '/assets/portraits/adult-bronze-dragon-sunken-galleon-initiative.png',
      },
    ],
  },
  'adult-copper-dragon': {
    emoji: '🐉',
    color: '#c2410c',
    tokenPortrait: '/assets/portraits/adult-copper-dragon-riddle-gate-token.png',
    initiativePortrait: '/assets/portraits/adult-copper-dragon-riddle-gate-initiative.png',
    visualVariants: [
      {
        id: 'riddle-gate',
        label: '岩岭谜门',
        tokenPortrait: '/assets/portraits/adult-copper-dragon-riddle-gate-token.png',
        initiativePortrait: '/assets/portraits/adult-copper-dragon-riddle-gate-initiative.png',
      },
      {
        id: 'echo-valley',
        label: '幽谷君临',
        tokenPortrait: '/assets/portraits/adult-copper-dragon-echo-valley-v2-token.png',
        initiativePortrait: '/assets/portraits/adult-copper-dragon-echo-valley-v2-initiative.png',
      },
    ],
  },
  'adult-gold-dragon': {
    emoji: '🐉',
    color: '#ca8a04',
    tokenPortrait: '/assets/portraits/adult-gold-dragon-waterfall-sanctuary-token.png',
    initiativePortrait: '/assets/portraits/adult-gold-dragon-waterfall-sanctuary-initiative.png',
    visualVariants: [
      {
        id: 'waterfall-sanctuary',
        label: '瀑隐圣殿',
        tokenPortrait: '/assets/portraits/adult-gold-dragon-waterfall-sanctuary-token.png',
        initiativePortrait: '/assets/portraits/adult-gold-dragon-waterfall-sanctuary-initiative.png',
      },
      {
        id: 'sunrise-sovereign',
        label: '旭日天巡',
        tokenPortrait: '/assets/portraits/adult-gold-dragon-sunrise-sovereign-token.png',
        initiativePortrait: '/assets/portraits/adult-gold-dragon-sunrise-sovereign-initiative.png',
      },
    ],
  },
  'adult-green-dragon': {
    emoji: '🐉',
    color: '#166534',
    tokenPortrait: '/assets/portraits/adult-green-dragon-poison-forest-throne-token.png',
    initiativePortrait: '/assets/portraits/adult-green-dragon-poison-forest-throne-initiative.png',
    visualVariants: [
      {
        id: 'poison-forest-throne',
        label: '毒雾林王',
        tokenPortrait: '/assets/portraits/adult-green-dragon-poison-forest-throne-token.png',
        initiativePortrait: '/assets/portraits/adult-green-dragon-poison-forest-throne-initiative.png',
      },
      {
        id: 'moonlit-stalker',
        label: '古林潜猎',
        tokenPortrait: '/assets/portraits/adult-green-dragon-moonlit-stalker-token.png',
        initiativePortrait: '/assets/portraits/adult-green-dragon-moonlit-stalker-initiative.png',
      },
    ],
  },
  'adult-red-dragon': {
    emoji: '🐉',
    color: '#b91c1c',
    tokenPortrait: '/assets/portraits/adult-red-dragon-selected-flight-token.png',
    initiativePortrait: '/assets/portraits/adult-red-dragon-selected-flight-initiative.png',
    visualVariants: [
      {
        id: 'volcanic-sky-raid',
        label: '火山掠空',
        tokenPortrait: '/assets/portraits/adult-red-dragon-selected-flight-token.png',
        initiativePortrait: '/assets/portraits/adult-red-dragon-selected-flight-initiative.png',
      },
      {
        id: 'burning-citadel',
        label: '焚城践踏',
        tokenPortrait: '/assets/portraits/adult-red-dragon-burning-citadel-token.png',
        initiativePortrait: '/assets/portraits/adult-red-dragon-burning-citadel-initiative.png',
      },
      {
        id: 'inferno-breath',
        label: '烈焰吐息',
        tokenPortrait: '/assets/portraits/adult-red-dragon-inferno-breath-token.png',
        initiativePortrait: '/assets/portraits/adult-red-dragon-inferno-breath-initiative.png',
      },
    ],
  },
  'adult-silver-dragon': {
    emoji: '🐉',
    color: '#94a3b8',
    tokenPortrait: '/assets/portraits/adult-silver-dragon-cloud-crown-citadel-token.png',
    initiativePortrait: '/assets/portraits/adult-silver-dragon-cloud-crown-citadel-initiative.png',
    visualVariants: [
      {
        id: 'cloud-crown-citadel',
        label: '云巅冰宫',
        tokenPortrait: '/assets/portraits/adult-silver-dragon-cloud-crown-citadel-token.png',
        initiativePortrait: '/assets/portraits/adult-silver-dragon-cloud-crown-citadel-initiative.png',
      },
      {
        id: 'moonlit-guardian',
        label: '月夜护航',
        tokenPortrait: '/assets/portraits/adult-silver-dragon-moonlit-guardian-token.png',
        initiativePortrait: '/assets/portraits/adult-silver-dragon-moonlit-guardian-initiative.png',
      },
    ],
  },
  'adult-white-dragon': {
    emoji: '🐉',
    color: '#cbd5e1',
    tokenPortrait: '/assets/portraits/adult-white-dragon-glacial-cavern-apex-token.png',
    initiativePortrait: '/assets/portraits/adult-white-dragon-glacial-cavern-apex-initiative.png',
    visualVariants: [
      {
        id: 'glacial-cavern-apex',
        label: '冰窟霸主',
        tokenPortrait: '/assets/portraits/adult-white-dragon-glacial-cavern-apex-token.png',
        initiativePortrait: '/assets/portraits/adult-white-dragon-glacial-cavern-apex-initiative.png',
      },
      {
        id: 'blizzard-hunter',
        label: '暴雪猎杀',
        tokenPortrait: '/assets/portraits/adult-white-dragon-blizzard-hunter-token.png',
        initiativePortrait: '/assets/portraits/adult-white-dragon-blizzard-hunter-initiative.png',
      },
    ],
  },
  'air-elemental': {
    emoji: '🌪️',
    color: '#bae6fd',
    tokenPortrait: '/assets/portraits/air-elemental-storm-canyon-token.png',
    initiativePortrait: '/assets/portraits/air-elemental-storm-canyon-initiative.png',
    visualVariants: [
      {
        id: 'storm-canyon',
        label: '雷峡风暴',
        tokenPortrait: '/assets/portraits/air-elemental-storm-canyon-token.png',
        initiativePortrait: '/assets/portraits/air-elemental-storm-canyon-initiative.png',
      },
      {
        id: 'sky-temple-gale',
        label: '天殿晨风',
        tokenPortrait: '/assets/portraits/air-elemental-sky-temple-gale-token.png',
        initiativePortrait: '/assets/portraits/air-elemental-sky-temple-gale-initiative.png',
      },
    ],
  },
  'ancient-black-dragon': {
    emoji: '🐉',
    color: '#334155',
    tokenPortrait: '/assets/portraits/ancient-black-dragon-stygian-swamp-token.png',
    initiativePortrait: '/assets/portraits/ancient-black-dragon-stygian-swamp-initiative.png',
    visualVariants: [
      {
        id: 'stygian-swamp',
        label: '冥河沼泽',
        tokenPortrait: '/assets/portraits/ancient-black-dragon-stygian-swamp-token.png',
        initiativePortrait: '/assets/portraits/ancient-black-dragon-stygian-swamp-initiative.png',
      },
      {
        id: 'drowned-temple-stalker',
        label: '沉没神殿',
        tokenPortrait: '/assets/portraits/ancient-black-dragon-drowned-temple-stalker-token.png',
        initiativePortrait: '/assets/portraits/ancient-black-dragon-drowned-temple-stalker-initiative.png',
      },
    ],
  },
  'ancient-blue-dragon': {
    emoji: '🐉',
    color: '#1d4ed8',
    tokenPortrait: '/assets/portraits/ancient-blue-dragon-thunder-necropolis-token.png',
    initiativePortrait: '/assets/portraits/ancient-blue-dragon-thunder-necropolis-initiative.png',
    visualVariants: [
      {
        id: 'thunder-necropolis',
        label: '雷霆墓城',
        tokenPortrait: '/assets/portraits/ancient-blue-dragon-thunder-necropolis-token.png',
        initiativePortrait: '/assets/portraits/ancient-blue-dragon-thunder-necropolis-initiative.png',
      },
      {
        id: 'ziggurat-stormbreath',
        label: '塔巅雷息',
        tokenPortrait: '/assets/portraits/ancient-blue-dragon-ziggurat-stormbreath-token.png',
        initiativePortrait: '/assets/portraits/ancient-blue-dragon-ziggurat-stormbreath-initiative.png',
      },
    ],
  },
  'ancient-brass-dragon': {
    emoji: '🐉',
    color: '#d4a72c',
    tokenPortrait: '/assets/portraits/ancient-brass-dragon-canyon-fireflight-token.png',
    initiativePortrait: '/assets/portraits/ancient-brass-dragon-canyon-fireflight-initiative.png',
    visualVariants: [
      {
        id: 'canyon-fireflight',
        label: '峡谷焰翔',
        tokenPortrait: '/assets/portraits/ancient-brass-dragon-canyon-fireflight-token.png',
        initiativePortrait: '/assets/portraits/ancient-brass-dragon-canyon-fireflight-initiative.png',
      },
      {
        id: 'oasis-dreammist',
        label: '绿洲梦雾',
        tokenPortrait: '/assets/portraits/ancient-brass-dragon-oasis-dreammist-token.png',
        initiativePortrait: '/assets/portraits/ancient-brass-dragon-oasis-dreammist-initiative.png',
      },
    ],
  },
  'ancient-bronze-dragon': {
    emoji: '🐉',
    color: '#0f766e',
    tokenPortrait: '/assets/portraits/ancient-bronze-dragon-tempest-coast-token.png',
    initiativePortrait: '/assets/portraits/ancient-bronze-dragon-tempest-coast-initiative.png',
    visualVariants: [
      {
        id: 'tempest-coast',
        label: '风暴海岸',
        tokenPortrait: '/assets/portraits/ancient-bronze-dragon-tempest-coast-token.png',
        initiativePortrait: '/assets/portraits/ancient-bronze-dragon-tempest-coast-initiative.png',
      },
      {
        id: 'tidal-bastion',
        label: '潮汐海堡',
        tokenPortrait: '/assets/portraits/ancient-bronze-dragon-tidal-bastion-token.png',
        initiativePortrait: '/assets/portraits/ancient-bronze-dragon-tidal-bastion-initiative.png',
      },
    ],
  },
  'ancient-copper-dragon': {
    emoji: '🐉',
    color: '#c2410c',
    tokenPortrait: '/assets/portraits/ancient-copper-dragon-sunset-acidfall-token.png',
    initiativePortrait: '/assets/portraits/ancient-copper-dragon-sunset-acidfall-initiative.png',
    visualVariants: [
      {
        id: 'sunset-acidfall',
        label: '落日酸瀑',
        tokenPortrait: '/assets/portraits/ancient-copper-dragon-sunset-acidfall-token.png',
        initiativePortrait: '/assets/portraits/ancient-copper-dragon-sunset-acidfall-initiative.png',
      },
      {
        id: 'mooncrystal-slowmist',
        label: '月晶迟雾',
        tokenPortrait: '/assets/portraits/ancient-copper-dragon-mooncrystal-slowmist-token.png',
        initiativePortrait: '/assets/portraits/ancient-copper-dragon-mooncrystal-slowmist-initiative.png',
      },
    ],
  },
  'ancient-gold-dragon': {
    emoji: '🐉',
    color: '#eab308',
    tokenPortrait: '/assets/portraits/ancient-gold-dragon-cloud-citadel-fire-token.png',
    initiativePortrait: '/assets/portraits/ancient-gold-dragon-cloud-citadel-fire-initiative.png',
    visualVariants: [
      {
        id: 'cloud-citadel-fire',
        label: '云宫天火',
        tokenPortrait: '/assets/portraits/ancient-gold-dragon-cloud-citadel-fire-token.png',
        initiativePortrait: '/assets/portraits/ancient-gold-dragon-cloud-citadel-fire-initiative.png',
      },
      {
        id: 'stellar-sanctum',
        label: '星辰圣殿',
        tokenPortrait: '/assets/portraits/ancient-gold-dragon-stellar-sanctum-token.png',
        initiativePortrait: '/assets/portraits/ancient-gold-dragon-stellar-sanctum-initiative.png',
      },
    ],
  },
  'ancient-green-dragon': {
    emoji: '🐉',
    color: '#15803d',
    tokenPortrait: '/assets/portraits/ancient-green-dragon-primordial-stalker-token.png',
    initiativePortrait: '/assets/portraits/ancient-green-dragon-primordial-stalker-initiative.png',
    visualVariants: [
      {
        id: 'primordial-stalker',
        label: '原林潜猎',
        tokenPortrait: '/assets/portraits/ancient-green-dragon-primordial-stalker-token.png',
        initiativePortrait: '/assets/portraits/ancient-green-dragon-primordial-stalker-initiative.png',
      },
      {
        id: 'storm-ruin-poison',
        label: '暴雨毒袭',
        tokenPortrait: '/assets/portraits/ancient-green-dragon-storm-ruin-poison-token.png',
        initiativePortrait: '/assets/portraits/ancient-green-dragon-storm-ruin-poison-initiative.png',
      },
    ],
  },
  'ancient-red-dragon': {
    emoji: '🐉',
    color: '#dc2626',
    tokenPortrait: '/assets/portraits/ancient-red-dragon-caldera-tyrant-token.png',
    initiativePortrait: '/assets/portraits/ancient-red-dragon-caldera-tyrant-initiative.png',
    visualVariants: [
      {
        id: 'caldera-tyrant',
        label: '火山暴君',
        tokenPortrait: '/assets/portraits/ancient-red-dragon-caldera-tyrant-token.png',
        initiativePortrait: '/assets/portraits/ancient-red-dragon-caldera-tyrant-initiative.png',
      },
      {
        id: 'fortress-inferno',
        label: '焚城天灾',
        tokenPortrait: '/assets/portraits/ancient-red-dragon-fortress-inferno-token.png',
        initiativePortrait: '/assets/portraits/ancient-red-dragon-fortress-inferno-initiative.png',
      },
    ],
  },
  'ancient-silver-dragon': {
    emoji: '🐉',
    color: '#cbd5e1',
    tokenPortrait: '/assets/portraits/ancient-silver-dragon-alpine-skyflight-token.png',
    initiativePortrait: '/assets/portraits/ancient-silver-dragon-alpine-skyflight-initiative.png',
    visualVariants: [
      {
        id: 'alpine-skyflight',
        label: '云巅翱翔',
        tokenPortrait: '/assets/portraits/ancient-silver-dragon-alpine-skyflight-token.png',
        initiativePortrait: '/assets/portraits/ancient-silver-dragon-alpine-skyflight-initiative.png',
      },
      {
        id: 'treasure-vault-repose',
        label: '金库卧龙',
        tokenPortrait: '/assets/portraits/ancient-silver-dragon-treasure-vault-repose-token.png',
        initiativePortrait: '/assets/portraits/ancient-silver-dragon-treasure-vault-repose-initiative.png',
      },
    ],
  },
  'ancient-white-dragon': {
    emoji: '🐉',
    color: '#e0f2fe',
    tokenPortrait: '/assets/portraits/ancient-white-dragon-glacier-cavern-hunter-token.png',
    initiativePortrait: '/assets/portraits/ancient-white-dragon-glacier-cavern-hunter-initiative.png',
    visualVariants: [
      {
        id: 'glacier-cavern-hunter',
        label: '冰窟猎杀',
        tokenPortrait: '/assets/portraits/ancient-white-dragon-glacier-cavern-hunter-token.png',
        initiativePortrait: '/assets/portraits/ancient-white-dragon-glacier-cavern-hunter-initiative.png',
      },
      {
        id: 'aurora-frostfall',
        label: '极光霜袭',
        tokenPortrait: '/assets/portraits/ancient-white-dragon-aurora-frostfall-token.png',
        initiativePortrait: '/assets/portraits/ancient-white-dragon-aurora-frostfall-initiative.png',
      },
    ],
  },
  androsphinx: {
    emoji: '🦁',
    color: '#b45309',
    tokenPortrait: '/assets/portraits/androsphinx-sunset-procession-token.png',
    initiativePortrait: '/assets/portraits/androsphinx-sunset-procession-initiative.png',
    visualVariants: [
      {
        id: 'sunset-procession',
        label: '落日巡礼',
        tokenPortrait: '/assets/portraits/androsphinx-sunset-procession-token.png',
        initiativePortrait: '/assets/portraits/androsphinx-sunset-procession-initiative.png',
      },
      {
        id: 'celestial-archive',
        label: '星辰书库',
        tokenPortrait: '/assets/portraits/androsphinx-celestial-archive-token.png',
        initiativePortrait: '/assets/portraits/androsphinx-celestial-archive-initiative.png',
      },
    ],
  },
  'animated-armor': {
    emoji: '🛡️',
    color: '#475569',
    tokenPortrait: '/assets/portraits/animated-armor-blacksteel-haunt-token.png',
    initiativePortrait: '/assets/portraits/animated-armor-blacksteel-haunt-initiative.png',
    visualVariants: [
      {
        id: 'blacksteel-haunt',
        label: '黑钢凶甲',
        tokenPortrait: '/assets/portraits/animated-armor-blacksteel-haunt-token.png',
        initiativePortrait: '/assets/portraits/animated-armor-blacksteel-haunt-initiative.png',
      },
      {
        id: 'moonlit-ivory-sentinel',
        label: '月庭白甲',
        tokenPortrait: '/assets/portraits/animated-armor-moonlit-ivory-sentinel-token.png',
        initiativePortrait: '/assets/portraits/animated-armor-moonlit-ivory-sentinel-initiative.png',
      },
    ],
  },
  ankheg: {
    emoji: '🪲',
    color: '#a16207',
    tokenPortrait: '/assets/portraits/ankheg-root-tunnel-stalker-token.png',
    initiativePortrait: '/assets/portraits/ankheg-root-tunnel-stalker-initiative.png',
    visualVariants: [
      {
        id: 'root-tunnel-stalker',
        label: '根窟潜行',
        tokenPortrait: '/assets/portraits/ankheg-root-tunnel-stalker-token.png',
        initiativePortrait: '/assets/portraits/ankheg-root-tunnel-stalker-initiative.png',
      },
      {
        id: 'stormfield-eruption',
        label: '风田破土',
        tokenPortrait: '/assets/portraits/ankheg-stormfield-eruption-token.png',
        initiativePortrait: '/assets/portraits/ankheg-stormfield-eruption-initiative.png',
      },
    ],
  },
  ape: {
    emoji: '🦍',
    color: '#57534e',
    tokenPortrait: '/assets/portraits/ape-rainforest-silverback-token.png',
    initiativePortrait: '/assets/portraits/ape-rainforest-silverback-initiative.png',
    visualVariants: [
      {
        id: 'rainforest-silverback',
        label: '雨林银背',
        tokenPortrait: '/assets/portraits/ape-rainforest-silverback-token.png',
        initiativePortrait: '/assets/portraits/ape-rainforest-silverback-initiative.png',
      },
      {
        id: 'storm-ruin-rockthrower',
        label: '风暴投石',
        tokenPortrait: '/assets/portraits/ape-storm-ruin-rockthrower-token.png',
        initiativePortrait: '/assets/portraits/ape-storm-ruin-rockthrower-initiative.png',
      },
    ],
  },
  archmage: {
    emoji: '🧙',
    color: '#4338ca',
    tokenPortrait: '/assets/portraits/archmage-stellar-observatory-token.png',
    initiativePortrait: '/assets/portraits/archmage-stellar-observatory-initiative.png',
    visualVariants: [
      {
        id: 'stellar-observatory',
        label: '星塔贤者',
        tokenPortrait: '/assets/portraits/archmage-stellar-observatory-token.png',
        initiativePortrait: '/assets/portraits/archmage-stellar-observatory-initiative.png',
      },
      {
        id: 'crystal-archive',
        label: '晶库秘法师',
        tokenPortrait: '/assets/portraits/archmage-crystal-archive-token.png',
        initiativePortrait: '/assets/portraits/archmage-crystal-archive-initiative.png',
      },
    ],
  },
  assassin: {
    emoji: '🗡️',
    color: '#1f2937',
    tokenPortrait: '/assets/portraits/assassin-rainroof-blade-token.png',
    initiativePortrait: '/assets/portraits/assassin-rainroof-blade-initiative.png',
    visualVariants: [
      {
        id: 'rainroof-blade',
        label: '雨檐暗刃',
        tokenPortrait: '/assets/portraits/assassin-rainroof-blade-token.png',
        initiativePortrait: '/assets/portraits/assassin-rainroof-blade-initiative.png',
      },
      {
        id: 'winter-palace-crossbow',
        label: '冬宫伏弩',
        tokenPortrait: '/assets/portraits/assassin-winter-palace-crossbow-token.png',
        initiativePortrait: '/assets/portraits/assassin-winter-palace-crossbow-initiative.png',
      },
    ],
  },
  'awakened-shrub': {
    emoji: '🌿',
    color: '#4d7c0f',
    tokenPortrait: '/assets/portraits/awakened-shrub-spring-bloom-token.png',
    initiativePortrait: '/assets/portraits/awakened-shrub-spring-bloom-initiative.png',
    visualVariants: [
      {
        id: 'spring-bloom',
        label: '春花新芽',
        tokenPortrait: '/assets/portraits/awakened-shrub-spring-bloom-token.png',
        initiativePortrait: '/assets/portraits/awakened-shrub-spring-bloom-initiative.png',
      },
      {
        id: 'autumn-thorn',
        label: '秋庭荆棘',
        tokenPortrait: '/assets/portraits/awakened-shrub-autumn-thorn-token.png',
        initiativePortrait: '/assets/portraits/awakened-shrub-autumn-thorn-initiative.png',
      },
    ],
  },
  'awakened-tree': {
    emoji: '🌳',
    color: '#365314',
    tokenPortrait: '/assets/portraits/awakened-tree-sunrise-oak-token.png',
    initiativePortrait: '/assets/portraits/awakened-tree-sunrise-oak-initiative.png',
    visualVariants: [
      {
        id: 'sunrise-oak',
        label: '晨林古橡',
        tokenPortrait: '/assets/portraits/awakened-tree-sunrise-oak-token.png',
        initiativePortrait: '/assets/portraits/awakened-tree-sunrise-oak-initiative.png',
      },
      {
        id: 'moon-swamp-willow',
        label: '月沼枯柳',
        tokenPortrait: '/assets/portraits/awakened-tree-moon-swamp-willow-token.png',
        initiativePortrait: '/assets/portraits/awakened-tree-moon-swamp-willow-initiative.png',
      },
    ],
  },
  azer: {
    emoji: '🔥',
    color: '#c2410c',
    tokenPortrait: '/assets/portraits/azer-magma-forge-smith-token.png',
    initiativePortrait: '/assets/portraits/azer-magma-forge-smith-initiative.png',
    visualVariants: [
      {
        id: 'magma-forge-smith',
        label: '熔炉锻者',
        tokenPortrait: '/assets/portraits/azer-magma-forge-smith-token.png',
        initiativePortrait: '/assets/portraits/azer-magma-forge-smith-initiative.png',
      },
      {
        id: 'obsidian-bridge-guard',
        label: '黑曜桥卫',
        tokenPortrait: '/assets/portraits/azer-obsidian-bridge-guard-token.png',
        initiativePortrait: '/assets/portraits/azer-obsidian-bridge-guard-initiative.png',
      },
    ],
  },
  baboon: {
    emoji: '🐒',
    color: '#78716c',
    tokenPortrait: '/assets/portraits/baboon-jungle-sentinel-token.png',
    initiativePortrait: '/assets/portraits/baboon-jungle-sentinel-initiative.png',
    visualVariants: [
      {
        id: 'jungle-sentinel',
        label: '雨林哨兽',
        tokenPortrait: '/assets/portraits/baboon-jungle-sentinel-token.png',
        initiativePortrait: '/assets/portraits/baboon-jungle-sentinel-initiative.png',
      },
      {
        id: 'savanna-runner',
        label: '旱原疾奔',
        tokenPortrait: '/assets/portraits/baboon-savanna-runner-token.png',
        initiativePortrait: '/assets/portraits/baboon-savanna-runner-initiative.png',
      },
    ],
  },
  badger: {
    emoji: '🦡',
    color: '#57534e',
    tokenPortrait: '/assets/portraits/badger-woodland-burrower-token.png',
    initiativePortrait: '/assets/portraits/badger-woodland-burrower-initiative.png',
    visualVariants: [
      {
        id: 'woodland-burrower',
        label: '林穴掘者',
        tokenPortrait: '/assets/portraits/badger-woodland-burrower-token.png',
        initiativePortrait: '/assets/portraits/badger-woodland-burrower-initiative.png',
      },
      {
        id: 'heathland-defender',
        label: '荒原守兽',
        tokenPortrait: '/assets/portraits/badger-heathland-defender-token.png',
        initiativePortrait: '/assets/portraits/badger-heathland-defender-initiative.png',
      },
    ],
  },
  balor: {
    emoji: '👹',
    color: '#991b1b',
    tokenPortrait: '/assets/portraits/balor-volcanic-warlord-token.png',
    initiativePortrait: '/assets/portraits/balor-volcanic-warlord-initiative.png',
    visualVariants: [
      {
        id: 'volcanic-warlord',
        label: '火渊战魔',
        tokenPortrait: '/assets/portraits/balor-volcanic-warlord-token.png',
        initiativePortrait: '/assets/portraits/balor-volcanic-warlord-initiative.png',
      },
      {
        id: 'obsidian-bridge-tyrant',
        label: '黑曜桥暴君',
        tokenPortrait: '/assets/portraits/balor-obsidian-bridge-tyrant-token.png',
        initiativePortrait: '/assets/portraits/balor-obsidian-bridge-tyrant-initiative.png',
      },
    ],
  },
  'bandit-captain': {
    emoji: '⚔️',
    color: '#713f12',
    tokenPortrait: '/assets/portraits/bandit-captain-road-camp-commander-token.png',
    initiativePortrait: '/assets/portraits/bandit-captain-road-camp-commander-initiative.png',
    visualVariants: [
      {
        id: 'road-camp-commander',
        label: '路营匪首',
        tokenPortrait: '/assets/portraits/bandit-captain-road-camp-commander-token.png',
        initiativePortrait: '/assets/portraits/bandit-captain-road-camp-commander-initiative.png',
      },
      {
        id: 'storm-tollhouse-chief',
        label: '雷夜关寨',
        tokenPortrait: '/assets/portraits/bandit-captain-storm-tollhouse-chief-token.png',
        initiativePortrait: '/assets/portraits/bandit-captain-storm-tollhouse-chief-initiative.png',
      },
    ],
  },
  'barbed-devil': {
    emoji: '😈',
    color: '#7f1d1d',
    tokenPortrait: '/assets/portraits/barbed-devil-iron-battlement-stalker-token.png',
    initiativePortrait: '/assets/portraits/barbed-devil-iron-battlement-stalker-initiative.png',
    visualVariants: [
      {
        id: 'iron-battlement-stalker',
        label: '铁垒棘猎',
        tokenPortrait: '/assets/portraits/barbed-devil-iron-battlement-stalker-token.png',
        initiativePortrait: '/assets/portraits/barbed-devil-iron-battlement-stalker-initiative.png',
      },
      {
        id: 'ashfield-flame-hurler',
        label: '灰原掷焰',
        tokenPortrait: '/assets/portraits/barbed-devil-ashfield-flame-hurler-token.png',
        initiativePortrait: '/assets/portraits/barbed-devil-ashfield-flame-hurler-initiative.png',
      },
    ],
  },
  basilisk: {
    emoji: '🦎',
    color: '#4d7c0f',
    tokenPortrait: '/assets/portraits/basilisk-petrified-garden-stalker-token.png',
    initiativePortrait: '/assets/portraits/basilisk-petrified-garden-stalker-initiative.png',
    visualVariants: [
      {
        id: 'petrified-garden-stalker',
        label: '石像庭猎兽',
        tokenPortrait: '/assets/portraits/basilisk-petrified-garden-stalker-token.png',
        initiativePortrait: '/assets/portraits/basilisk-petrified-garden-stalker-initiative.png',
      },
      {
        id: 'sandstone-cavern-prowler',
        label: '砂窟八足兽',
        tokenPortrait: '/assets/portraits/basilisk-sandstone-cavern-prowler-token.png',
        initiativePortrait: '/assets/portraits/basilisk-sandstone-cavern-prowler-initiative.png',
      },
    ],
  },
  bat: {
    emoji: '🦇',
    color: '#292524',
    tokenPortrait: '/assets/portraits/bat-moonlit-cavern-flight-token.png',
    initiativePortrait: '/assets/portraits/bat-moonlit-cavern-flight-initiative.png',
    visualVariants: [
      {
        id: 'moonlit-cavern-flight',
        label: '月窟飞影',
        tokenPortrait: '/assets/portraits/bat-moonlit-cavern-flight-token.png',
        initiativePortrait: '/assets/portraits/bat-moonlit-cavern-flight-initiative.png',
      },
      {
        id: 'bell-tower-roost',
        label: '钟楼倒栖',
        tokenPortrait: '/assets/portraits/bat-bell-tower-roost-token.png',
        initiativePortrait: '/assets/portraits/bat-bell-tower-roost-initiative.png',
      },
    ],
  },
  'bearded-devil': {
    emoji: '👿',
    color: '#9f1239',
    tokenPortrait: '/assets/portraits/bearded-devil-infernal-legionnaire-token.png',
    initiativePortrait: '/assets/portraits/bearded-devil-infernal-legionnaire-initiative.png',
    visualVariants: [
      {
        id: 'infernal-legionnaire',
        label: '炼狱长戟兵',
        tokenPortrait: '/assets/portraits/bearded-devil-infernal-legionnaire-token.png',
        initiativePortrait: '/assets/portraits/bearded-devil-infernal-legionnaire-initiative.png',
      },
      {
        id: 'prison-lunger',
        label: '铁狱须袭',
        tokenPortrait: '/assets/portraits/bearded-devil-prison-lunger-token.png',
        initiativePortrait: '/assets/portraits/bearded-devil-prison-lunger-initiative.png',
      },
    ],
  },
  behir: {
    emoji: '⚡',
    color: '#1d4ed8',
    tokenPortrait: '/assets/portraits/behir-storm-gorge-climber-token.png',
    initiativePortrait: '/assets/portraits/behir-storm-gorge-climber-initiative.png',
    visualVariants: [
      {
        id: 'storm-gorge-climber',
        label: '暴峡攀兽',
        tokenPortrait: '/assets/portraits/behir-storm-gorge-climber-token.png',
        initiativePortrait: '/assets/portraits/behir-storm-gorge-climber-initiative.png',
      },
      {
        id: 'crystal-cavern-lightning',
        label: '晶窟雷息',
        tokenPortrait: '/assets/portraits/behir-crystal-cavern-lightning-token.png',
        initiativePortrait: '/assets/portraits/behir-crystal-cavern-lightning-initiative.png',
      },
    ],
  },
  berserker: {
    emoji: '🪓',
    color: '#9a3412',
    tokenPortrait: '/assets/portraits/berserker-snowfield-charge-token.png',
    initiativePortrait: '/assets/portraits/berserker-snowfield-charge-initiative.png',
    visualVariants: [
      {
        id: 'snowfield-charge',
        label: '雪原狂袭',
        tokenPortrait: '/assets/portraits/berserker-snowfield-charge-token.png',
        initiativePortrait: '/assets/portraits/berserker-snowfield-charge-initiative.png',
      },
      {
        id: 'desert-arena-guard',
        label: '荒场横斧',
        tokenPortrait: '/assets/portraits/berserker-desert-arena-guard-token.png',
        initiativePortrait: '/assets/portraits/berserker-desert-arena-guard-initiative.png',
      },
    ],
  },
  'black-bear': {
    emoji: '🐻',
    color: '#292524',
    tokenPortrait: '/assets/portraits/black-bear-rainforest-charge-token.png',
    initiativePortrait: '/assets/portraits/black-bear-rainforest-charge-initiative.png',
    visualVariants: [
      {
        id: 'rainforest-charge',
        label: '雨林冲熊',
        tokenPortrait: '/assets/portraits/black-bear-rainforest-charge-token.png',
        initiativePortrait: '/assets/portraits/black-bear-rainforest-charge-initiative.png',
      },
      {
        id: 'autumn-stream-fisher',
        label: '秋溪捕鱼',
        tokenPortrait: '/assets/portraits/black-bear-autumn-stream-fisher-token.png',
        initiativePortrait: '/assets/portraits/black-bear-autumn-stream-fisher-initiative.png',
      },
    ],
  },
  'black-dragon-wyrmling': {
    emoji: '🐉',
    color: '#111827',
    tokenPortrait: '/assets/portraits/black-dragon-wyrmling-drowned-shrine-stalker-token.png',
    initiativePortrait: '/assets/portraits/black-dragon-wyrmling-drowned-shrine-stalker-initiative.png',
    visualVariants: [
      {
        id: 'drowned-shrine-stalker',
        label: '沉祠幼猎',
        tokenPortrait: '/assets/portraits/black-dragon-wyrmling-drowned-shrine-stalker-token.png',
        initiativePortrait: '/assets/portraits/black-dragon-wyrmling-drowned-shrine-stalker-initiative.png',
      },
      {
        id: 'moonlit-bog-flight',
        label: '月沼幼翼',
        tokenPortrait: '/assets/portraits/black-dragon-wyrmling-moonlit-bog-flight-token.png',
        initiativePortrait: '/assets/portraits/black-dragon-wyrmling-moonlit-bog-flight-initiative.png',
      },
    ],
  },
  'black-pudding': {
    emoji: '🫧',
    color: '#18181b',
    tokenPortrait: '/assets/portraits/black-pudding-dungeon-step-flow-token.png',
    initiativePortrait: '/assets/portraits/black-pudding-dungeon-step-flow-initiative.png',
    visualVariants: [
      {
        id: 'dungeon-step-flow',
        label: '地牢腐流',
        tokenPortrait: '/assets/portraits/black-pudding-dungeon-step-flow-token.png',
        initiativePortrait: '/assets/portraits/black-pudding-dungeon-step-flow-initiative.png',
      },
      {
        id: 'sewer-ceiling-ambush',
        label: '穹顶黏伏',
        tokenPortrait: '/assets/portraits/black-pudding-sewer-ceiling-ambush-token.png',
        initiativePortrait: '/assets/portraits/black-pudding-sewer-ceiling-ambush-initiative.png',
      },
    ],
  },
  'blink-dog': {
    emoji: '🐕',
    color: '#0f766e',
    tokenPortrait: '/assets/portraits/blink-dog-moonstone-leap-token.png',
    initiativePortrait: '/assets/portraits/blink-dog-moonstone-leap-initiative.png',
    visualVariants: [
      {
        id: 'moonstone-leap',
        label: '月石闪跃',
        tokenPortrait: '/assets/portraits/blink-dog-moonstone-leap-token.png',
        initiativePortrait: '/assets/portraits/blink-dog-moonstone-leap-initiative.png',
      },
      {
        id: 'autumn-ravine-watch',
        label: '秋峡警望',
        tokenPortrait: '/assets/portraits/blink-dog-autumn-ravine-watch-token.png',
        initiativePortrait: '/assets/portraits/blink-dog-autumn-ravine-watch-initiative.png',
      },
    ],
  },
  'blood-hawk': {
    emoji: '🦅',
    color: '#991b1b',
    tokenPortrait: '/assets/portraits/blood-hawk-red-canyon-dive-token.png',
    initiativePortrait: '/assets/portraits/blood-hawk-red-canyon-dive-initiative.png',
    visualVariants: [
      {
        id: 'red-canyon-dive',
        label: '赤峡俯冲',
        tokenPortrait: '/assets/portraits/blood-hawk-red-canyon-dive-token.png',
        initiativePortrait: '/assets/portraits/blood-hawk-red-canyon-dive-initiative.png',
      },
      {
        id: 'frost-battlefield-sentry',
        label: '霜场鹰哨',
        tokenPortrait: '/assets/portraits/blood-hawk-frost-battlefield-sentry-token.png',
        initiativePortrait: '/assets/portraits/blood-hawk-frost-battlefield-sentry-initiative.png',
      },
    ],
  },
  'blue-dragon-wyrmling': {
    emoji: '🐉',
    color: '#1d4ed8',
    tokenPortrait: '/assets/portraits/blue-dragon-wyrmling-sunlit-dune-runner-token.png',
    initiativePortrait: '/assets/portraits/blue-dragon-wyrmling-sunlit-dune-runner-initiative.png',
    visualVariants: [
      {
        id: 'sunlit-dune-runner',
        label: '晴沙幼奔',
        tokenPortrait: '/assets/portraits/blue-dragon-wyrmling-sunlit-dune-runner-token.png',
        initiativePortrait: '/assets/portraits/blue-dragon-wyrmling-sunlit-dune-runner-initiative.png',
      },
      {
        id: 'thunder-mesa-flight',
        label: '雷台幼翼',
        tokenPortrait: '/assets/portraits/blue-dragon-wyrmling-thunder-mesa-flight-token.png',
        initiativePortrait: '/assets/portraits/blue-dragon-wyrmling-thunder-mesa-flight-initiative.png',
      },
    ],
  },
  boar: {
    emoji: '🐗',
    color: '#713f12',
    tokenPortrait: '/assets/portraits/boar-autumn-mud-charge-token.png',
    initiativePortrait: '/assets/portraits/boar-autumn-mud-charge-initiative.png',
    visualVariants: [
      {
        id: 'autumn-mud-charge',
        label: '秋林泥突',
        tokenPortrait: '/assets/portraits/boar-autumn-mud-charge-token.png',
        initiativePortrait: '/assets/portraits/boar-autumn-mud-charge-initiative.png',
      },
      {
        id: 'frost-hillside-sentry',
        label: '霜坡警兽',
        tokenPortrait: '/assets/portraits/boar-frost-hillside-sentry-token.png',
        initiativePortrait: '/assets/portraits/boar-frost-hillside-sentry-initiative.png',
      },
    ],
  },
  'bone-devil': {
    emoji: '☠️',
    color: '#78716c',
    tokenPortrait: '/assets/portraits/bone-devil-iron-watchtower-sentinel-token.png',
    initiativePortrait: '/assets/portraits/bone-devil-iron-watchtower-sentinel-initiative.png',
    visualVariants: [
      {
        id: 'iron-watchtower-sentinel',
        label: '铁塔骨哨',
        tokenPortrait: '/assets/portraits/bone-devil-iron-watchtower-sentinel-token.png',
        initiativePortrait: '/assets/portraits/bone-devil-iron-watchtower-sentinel-initiative.png',
      },
      {
        id: 'frozen-hell-hunter',
        label: '冻狱骨猎',
        tokenPortrait: '/assets/portraits/bone-devil-frozen-hell-hunter-token.png',
        initiativePortrait: '/assets/portraits/bone-devil-frozen-hell-hunter-initiative.png',
      },
    ],
  },
  'brass-dragon-wyrmling': {
    emoji: '🐉',
    color: '#b45309',
    tokenPortrait: '/assets/portraits/brass-dragon-wyrmling-desert-library-explorer-token.png',
    initiativePortrait: '/assets/portraits/brass-dragon-wyrmling-desert-library-explorer-initiative.png',
    visualVariants: [
      {
        id: 'desert-library-explorer',
        label: '沙库幼探',
        tokenPortrait: '/assets/portraits/brass-dragon-wyrmling-desert-library-explorer-token.png',
        initiativePortrait: '/assets/portraits/brass-dragon-wyrmling-desert-library-explorer-initiative.png',
      },
      {
        id: 'sunset-canyon-glide',
        label: '暮峡幼翔',
        tokenPortrait: '/assets/portraits/brass-dragon-wyrmling-sunset-canyon-glide-token.png',
        initiativePortrait: '/assets/portraits/brass-dragon-wyrmling-sunset-canyon-glide-initiative.png',
      },
    ],
  },
  'bronze-dragon-wyrmling': {
    emoji: '🐉',
    color: '#92400e',
    tokenPortrait: '/assets/portraits/bronze-dragon-wyrmling-tidal-ruin-explorer-token.png',
    initiativePortrait: '/assets/portraits/bronze-dragon-wyrmling-tidal-ruin-explorer-initiative.png',
    visualVariants: [
      {
        id: 'tidal-ruin-explorer',
        label: '潮墟幼探',
        tokenPortrait: '/assets/portraits/bronze-dragon-wyrmling-tidal-ruin-explorer-token.png',
        initiativePortrait: '/assets/portraits/bronze-dragon-wyrmling-tidal-ruin-explorer-initiative.png',
      },
      {
        id: 'storm-coast-flight',
        label: '暴岸幼翔',
        tokenPortrait: '/assets/portraits/bronze-dragon-wyrmling-storm-coast-flight-token.png',
        initiativePortrait: '/assets/portraits/bronze-dragon-wyrmling-storm-coast-flight-initiative.png',
      },
    ],
  },
  'brown-bear': {
    emoji: '🐻',
    color: '#78350f',
    tokenPortrait: '/assets/portraits/brown-bear-alpine-roar-token.png',
    initiativePortrait: '/assets/portraits/brown-bear-alpine-roar-initiative.png',
    visualVariants: [
      {
        id: 'alpine-roar',
        label: '高岭怒立',
        tokenPortrait: '/assets/portraits/brown-bear-alpine-roar-token.png',
        initiativePortrait: '/assets/portraits/brown-bear-alpine-roar-initiative.png',
      },
      {
        id: 'glacial-river-charge',
        label: '冰河奔袭',
        tokenPortrait: '/assets/portraits/brown-bear-glacial-river-charge-token.png',
        initiativePortrait: '/assets/portraits/brown-bear-glacial-river-charge-initiative.png',
      },
    ],
  },
  bulette: {
    emoji: '🦈',
    color: '#334155',
    tokenPortrait: '/assets/portraits/bulette-farmland-eruption-token.png',
    initiativePortrait: '/assets/portraits/bulette-farmland-eruption-initiative.png',
    visualVariants: [
      {
        id: 'farmland-eruption',
        label: '农道破土',
        tokenPortrait: '/assets/portraits/bulette-farmland-eruption-token.png',
        initiativePortrait: '/assets/portraits/bulette-farmland-eruption-initiative.png',
      },
      {
        id: 'badlands-stalker',
        label: '荒岩潜猎',
        tokenPortrait: '/assets/portraits/bulette-badlands-stalker-token.png',
        initiativePortrait: '/assets/portraits/bulette-badlands-stalker-initiative.png',
      },
    ],
  },
  camel: {
    emoji: '🐪',
    color: '#a16207',
    tokenPortrait: '/assets/portraits/camel-sunrise-dune-walker-token.png',
    initiativePortrait: '/assets/portraits/camel-sunrise-dune-walker-initiative.png',
    visualVariants: [
      {
        id: 'sunrise-dune-walker',
        label: '晨沙行者',
        tokenPortrait: '/assets/portraits/camel-sunrise-dune-walker-token.png',
        initiativePortrait: '/assets/portraits/camel-sunrise-dune-walker-initiative.png',
      },
      {
        id: 'rain-oasis-riser',
        label: '雨洲起身',
        tokenPortrait: '/assets/portraits/camel-rain-oasis-riser-token.png',
        initiativePortrait: '/assets/portraits/camel-rain-oasis-riser-initiative.png',
      },
    ],
  },
  cat: {
    emoji: '🐈',
    color: '#57534e',
    tokenPortrait: '/assets/portraits/cat-rainy-rooftop-leap-token.png',
    initiativePortrait: '/assets/portraits/cat-rainy-rooftop-leap-initiative.png',
    visualVariants: [
      {
        id: 'rainy-rooftop-leap',
        label: '雨夜跃檐',
        tokenPortrait: '/assets/portraits/cat-rainy-rooftop-leap-token.png',
        initiativePortrait: '/assets/portraits/cat-rainy-rooftop-leap-initiative.png',
      },
      {
        id: 'sunlit-library-sentry',
        label: '书窗静守',
        tokenPortrait: '/assets/portraits/cat-sunlit-library-sentry-token.png',
        initiativePortrait: '/assets/portraits/cat-sunlit-library-sentry-initiative.png',
      },
    ],
  },
  centaur: {
    emoji: '🏹',
    color: '#854d0e',
    tokenPortrait: '/assets/portraits/centaur-storm-grassland-lancer-token.png',
    initiativePortrait: '/assets/portraits/centaur-storm-grassland-lancer-initiative.png',
    visualVariants: [
      {
        id: 'storm-grassland-lancer',
        label: '风原矛骑',
        tokenPortrait: '/assets/portraits/centaur-storm-grassland-lancer-token.png',
        initiativePortrait: '/assets/portraits/centaur-storm-grassland-lancer-initiative.png',
      },
      {
        id: 'autumn-forest-archer',
        label: '秋林弓卫',
        tokenPortrait: '/assets/portraits/centaur-autumn-forest-archer-token.png',
        initiativePortrait: '/assets/portraits/centaur-autumn-forest-archer-initiative.png',
      },
    ],
  },
  'chain-devil': {
    emoji: '⛓️',
    color: '#7f1d1d',
    tokenPortrait: '/assets/portraits/chain-devil-iron-prison-march-token.png',
    initiativePortrait: '/assets/portraits/chain-devil-iron-prison-march-initiative.png',
    visualVariants: [
      {
        id: 'iron-prison-march',
        label: '铁狱链行',
        tokenPortrait: '/assets/portraits/chain-devil-iron-prison-march-token.png',
        initiativePortrait: '/assets/portraits/chain-devil-iron-prison-march-initiative.png',
      },
      {
        id: 'infernal-foundry-controller',
        label: '熔厂链御',
        tokenPortrait: '/assets/portraits/chain-devil-infernal-foundry-controller-token.png',
        initiativePortrait: '/assets/portraits/chain-devil-infernal-foundry-controller-initiative.png',
      },
    ],
  },
  chimera: {
    emoji: '🦁',
    color: '#9a3412',
    tokenPortrait: '/assets/portraits/chimera-mountain-temple-guardian-token.png',
    initiativePortrait: '/assets/portraits/chimera-mountain-temple-guardian-initiative.png',
    visualVariants: [
      {
        id: 'mountain-temple-guardian',
        label: '山殿三首',
        tokenPortrait: '/assets/portraits/chimera-mountain-temple-guardian-token.png',
        initiativePortrait: '/assets/portraits/chimera-mountain-temple-guardian-initiative.png',
      },
      {
        id: 'volcanic-canyon-flight',
        label: '火峡合翼',
        tokenPortrait: '/assets/portraits/chimera-volcanic-canyon-flight-token.png',
        initiativePortrait: '/assets/portraits/chimera-volcanic-canyon-flight-initiative.png',
      },
    ],
  },
  chuul: {
    emoji: '🦞',
    color: '#0f766e',
    tokenPortrait: '/assets/portraits/chuul-moonlit-swamp-ambusher-token.png',
    initiativePortrait: '/assets/portraits/chuul-moonlit-swamp-ambusher-initiative.png',
    visualVariants: [
      {
        id: 'moonlit-swamp-ambusher',
        label: '月沼钳伏',
        tokenPortrait: '/assets/portraits/chuul-moonlit-swamp-ambusher-token.png',
        initiativePortrait: '/assets/portraits/chuul-moonlit-swamp-ambusher-initiative.png',
      },
      {
        id: 'flooded-observatory-patrol',
        label: '沉殿巡钳',
        tokenPortrait: '/assets/portraits/chuul-flooded-observatory-patrol-token.png',
        initiativePortrait: '/assets/portraits/chuul-flooded-observatory-patrol-initiative.png',
      },
    ],
  },
  'clay-golem': {
    emoji: '🗿',
    color: '#9a3412',
    tokenPortrait: '/assets/portraits/clay-golem-sealed-temple-guardian-token.png',
    initiativePortrait: '/assets/portraits/clay-golem-sealed-temple-guardian-initiative.png',
    visualVariants: [
      {
        id: 'sealed-temple-guardian',
        label: '封殿泥卫',
        tokenPortrait: '/assets/portraits/clay-golem-sealed-temple-guardian-token.png',
        initiativePortrait: '/assets/portraits/clay-golem-sealed-temple-guardian-initiative.png',
      },
      {
        id: 'flooded-kiln-rampage',
        label: '雨窑破壁',
        tokenPortrait: '/assets/portraits/clay-golem-flooded-kiln-rampage-token.png',
        initiativePortrait: '/assets/portraits/clay-golem-flooded-kiln-rampage-initiative.png',
      },
    ],
  },
  cloaker: {
    emoji: '🦇',
    color: '#312e81',
    tokenPortrait: '/assets/portraits/cloaker-cavern-ceiling-ambush-token.png',
    initiativePortrait: '/assets/portraits/cloaker-cavern-ceiling-ambush-initiative.png',
    visualVariants: [
      {
        id: 'cavern-ceiling-ambush',
        label: '晶窟垂伏',
        tokenPortrait: '/assets/portraits/cloaker-cavern-ceiling-ambush-token.png',
        initiativePortrait: '/assets/portraits/cloaker-cavern-ceiling-ambush-initiative.png',
      },
      {
        id: 'buried-throne-dive',
        label: '沉殿掠影',
        tokenPortrait: '/assets/portraits/cloaker-buried-throne-dive-token.png',
        initiativePortrait: '/assets/portraits/cloaker-buried-throne-dive-initiative.png',
      },
    ],
  },
  'cloud-giant': {
    emoji: '☁️',
    color: '#6366f1',
    tokenPortrait: '/assets/portraits/cloud-giant-floating-palace-noble-token.png',
    initiativePortrait: '/assets/portraits/cloud-giant-floating-palace-noble-initiative.png',
    visualVariants: [
      {
        id: 'floating-palace-noble',
        label: '云宫贵胄',
        tokenPortrait: '/assets/portraits/cloud-giant-floating-palace-noble-token.png',
        initiativePortrait: '/assets/portraits/cloud-giant-floating-palace-noble-initiative.png',
      },
      {
        id: 'storm-peak-warrior',
        label: '雷巅巨刃',
        tokenPortrait: '/assets/portraits/cloud-giant-storm-peak-warrior-token.png',
        initiativePortrait: '/assets/portraits/cloud-giant-storm-peak-warrior-initiative.png',
      },
    ],
  },
  cockatrice: {
    emoji: '🐓',
    color: '#a16207',
    tokenPortrait: '/assets/portraits/cockatrice-misty-farm-threat-token.png',
    initiativePortrait: '/assets/portraits/cockatrice-misty-farm-threat-initiative.png',
    visualVariants: [
      {
        id: 'misty-farm-threat',
        label: '雾场石啼',
        tokenPortrait: '/assets/portraits/cockatrice-misty-farm-threat-token.png',
        initiativePortrait: '/assets/portraits/cockatrice-misty-farm-threat-initiative.png',
      },
      {
        id: 'ruined-belltower-dive',
        label: '残钟扑翼',
        tokenPortrait: '/assets/portraits/cockatrice-ruined-belltower-dive-token.png',
        initiativePortrait: '/assets/portraits/cockatrice-ruined-belltower-dive-initiative.png',
      },
    ],
  },
  commoner: {
    emoji: '🧑‍🌾',
    color: '#78716c',
    tokenPortrait: '/assets/portraits/commoner-dawn-village-farmer-token.png',
    initiativePortrait: '/assets/portraits/commoner-dawn-village-farmer-initiative.png',
    visualVariants: [
      {
        id: 'dawn-village-farmer',
        label: '晨村农夫',
        tokenPortrait: '/assets/portraits/commoner-dawn-village-farmer-token.png',
        initiativePortrait: '/assets/portraits/commoner-dawn-village-farmer-initiative.png',
      },
      {
        id: 'rainy-town-potter',
        label: '雨巷陶工',
        tokenPortrait: '/assets/portraits/commoner-rainy-town-potter-token.png',
        initiativePortrait: '/assets/portraits/commoner-rainy-town-potter-initiative.png',
      },
    ],
  },
  'constrictor-snake': {
    emoji: '🐍',
    color: '#365314',
    tokenPortrait: '/assets/portraits/constrictor-snake-jungle-branch-coil-token.png',
    initiativePortrait: '/assets/portraits/constrictor-snake-jungle-branch-coil-initiative.png',
    visualVariants: [
      {
        id: 'jungle-branch-coil',
        label: '雨林盘枝',
        tokenPortrait: '/assets/portraits/constrictor-snake-jungle-branch-coil-token.png',
        initiativePortrait: '/assets/portraits/constrictor-snake-jungle-branch-coil-initiative.png',
      },
      {
        id: 'ruined-temple-strike',
        label: '遗殿扑咬',
        tokenPortrait: '/assets/portraits/constrictor-snake-ruined-temple-strike-token.png',
        initiativePortrait: '/assets/portraits/constrictor-snake-ruined-temple-strike-initiative.png',
      },
    ],
  },
  'copper-dragon-wyrmling': {
    emoji: '🐉',
    color: '#b45309',
    tokenPortrait: '/assets/portraits/copper-dragon-wyrmling-red-canyon-leap-token.png',
    initiativePortrait: '/assets/portraits/copper-dragon-wyrmling-red-canyon-leap-initiative.png',
    visualVariants: [
      {
        id: 'red-canyon-leap',
        label: '赤峡跃岩',
        tokenPortrait: '/assets/portraits/copper-dragon-wyrmling-red-canyon-leap-token.png',
        initiativePortrait: '/assets/portraits/copper-dragon-wyrmling-red-canyon-leap-initiative.png',
      },
      {
        id: 'crystal-observatory',
        label: '晶殿窥机',
        tokenPortrait: '/assets/portraits/copper-dragon-wyrmling-crystal-observatory-token.png',
        initiativePortrait: '/assets/portraits/copper-dragon-wyrmling-crystal-observatory-initiative.png',
      },
    ],
  },
  couatl: {
    emoji: '🪶',
    color: '#0d9488',
    tokenPortrait: '/assets/portraits/couatl-sunrise-cloud-temple-token.png',
    initiativePortrait: '/assets/portraits/couatl-sunrise-cloud-temple-initiative.png',
    visualVariants: [
      {
        id: 'sunrise-cloud-temple',
        label: '曦殿虹羽',
        tokenPortrait: '/assets/portraits/couatl-sunrise-cloud-temple-token.png',
        initiativePortrait: '/assets/portraits/couatl-sunrise-cloud-temple-initiative.png',
      },
      {
        id: 'moonlit-flooded-sanctuary',
        label: '月沼圣巡',
        tokenPortrait: '/assets/portraits/couatl-moonlit-flooded-sanctuary-token.png',
        initiativePortrait: '/assets/portraits/couatl-moonlit-flooded-sanctuary-initiative.png',
      },
    ],
  },
  crab: {
    emoji: '🦀',
    color: '#b45309',
    tokenPortrait: '/assets/portraits/crab-sunrise-tidepool-defense-token.png',
    initiativePortrait: '/assets/portraits/crab-sunrise-tidepool-defense-initiative.png',
    visualVariants: [
      {
        id: 'sunrise-tidepool-defense',
        label: '曦礁举螯',
        tokenPortrait: '/assets/portraits/crab-sunrise-tidepool-defense-token.png',
        initiativePortrait: '/assets/portraits/crab-sunrise-tidepool-defense-initiative.png',
      },
      {
        id: 'underwater-seagrass-scuttle',
        label: '海草横行',
        tokenPortrait: '/assets/portraits/crab-underwater-seagrass-scuttle-token.png',
        initiativePortrait: '/assets/portraits/crab-underwater-seagrass-scuttle-initiative.png',
      },
    ],
  },
  crocodile: {
    emoji: '🐊',
    color: '#3f6212',
    tokenPortrait: '/assets/portraits/crocodile-sunlit-riverbank-bask-token.png',
    initiativePortrait: '/assets/portraits/crocodile-sunlit-riverbank-bask-initiative.png',
    visualVariants: [
      {
        id: 'sunlit-riverbank-bask',
        label: '晴滩晒甲',
        tokenPortrait: '/assets/portraits/crocodile-sunlit-riverbank-bask-token.png',
        initiativePortrait: '/assets/portraits/crocodile-sunlit-riverbank-bask-initiative.png',
      },
      {
        id: 'moonlit-swamp-ambush',
        label: '月沼冲伏',
        tokenPortrait: '/assets/portraits/crocodile-moonlit-swamp-ambush-token.png',
        initiativePortrait: '/assets/portraits/crocodile-moonlit-swamp-ambush-initiative.png',
      },
    ],
  },
  'cult-fanatic': {
    emoji: '📖',
    color: '#701a75',
    tokenPortrait: '/assets/portraits/cult-fanatic-ossuary-book-ritual-token.png',
    initiativePortrait: '/assets/portraits/cult-fanatic-ossuary-book-ritual-initiative.png',
    visualVariants: [
      {
        id: 'ossuary-book-ritual',
        label: '骨堂禁典',
        tokenPortrait: '/assets/portraits/cult-fanatic-ossuary-book-ritual-token.png',
        initiativePortrait: '/assets/portraits/cult-fanatic-ossuary-book-ritual-initiative.png',
      },
      {
        id: 'storm-cliff-binding',
        label: '雷崖缚咒',
        tokenPortrait: '/assets/portraits/cult-fanatic-storm-cliff-binding-token.png',
        initiativePortrait: '/assets/portraits/cult-fanatic-storm-cliff-binding-initiative.png',
      },
    ],
  },
  cultist: {
    emoji: '🕯️',
    color: '#3f3f46',
    tokenPortrait: '/assets/portraits/cultist-fog-harbor-guard-token.png',
    initiativePortrait: '/assets/portraits/cultist-fog-harbor-guard-initiative.png',
    visualVariants: [
      {
        id: 'fog-harbor-guard',
        label: '雾港守门',
        tokenPortrait: '/assets/portraits/cultist-fog-harbor-guard-token.png',
        initiativePortrait: '/assets/portraits/cultist-fog-harbor-guard-initiative.png',
      },
      {
        id: 'twilight-forest-offering',
        label: '暮林奉钵',
        tokenPortrait: '/assets/portraits/cultist-twilight-forest-offering-token.png',
        initiativePortrait: '/assets/portraits/cultist-twilight-forest-offering-initiative.png',
      },
    ],
  },
  darkmantle: {
    emoji: '🦑',
    color: '#312e81',
    tokenPortrait: '/assets/portraits/darkmantle-stalactite-camouflage-token.png',
    initiativePortrait: '/assets/portraits/darkmantle-stalactite-camouflage-initiative.png',
    visualVariants: [
      {
        id: 'stalactite-camouflage',
        label: '岩顶伪伏',
        tokenPortrait: '/assets/portraits/darkmantle-stalactite-camouflage-token.png',
        initiativePortrait: '/assets/portraits/darkmantle-stalactite-camouflage-initiative.png',
      },
      {
        id: 'abandoned-mine-dive',
        label: '废矿幕袭',
        tokenPortrait: '/assets/portraits/darkmantle-abandoned-mine-dive-token.png',
        initiativePortrait: '/assets/portraits/darkmantle-abandoned-mine-dive-initiative.png',
      },
    ],
  },
  'death-dog': {
    emoji: '🐕',
    color: '#7f1d1d',
    tokenPortrait: '/assets/portraits/death-dog-blue-graveyard-stalk-token.png',
    initiativePortrait: '/assets/portraits/death-dog-blue-graveyard-stalk-initiative.png',
    visualVariants: [
      {
        id: 'blue-graveyard-stalk',
        label: '蓝墓双嗅',
        tokenPortrait: '/assets/portraits/death-dog-blue-graveyard-stalk-token.png',
        initiativePortrait: '/assets/portraits/death-dog-blue-graveyard-stalk-initiative.png',
      },
      {
        id: 'desert-ruin-charge',
        label: '沙墟双袭',
        tokenPortrait: '/assets/portraits/death-dog-desert-ruin-charge-token.png',
        initiativePortrait: '/assets/portraits/death-dog-desert-ruin-charge-initiative.png',
      },
    ],
  },
  'deep-gnome-svirfneblin': {
    emoji: '⛏️',
    color: '#4b5563',
    tokenPortrait: '/assets/portraits/deep-gnome-svirfneblin-crystal-mine-guard-token.png',
    initiativePortrait: '/assets/portraits/deep-gnome-svirfneblin-crystal-mine-guard-initiative.png',
    visualVariants: [
      {
        id: 'crystal-mine-guard',
        label: '晶矿守道',
        tokenPortrait: '/assets/portraits/deep-gnome-svirfneblin-crystal-mine-guard-token.png',
        initiativePortrait: '/assets/portraits/deep-gnome-svirfneblin-crystal-mine-guard-initiative.png',
      },
      {
        id: 'fungal-illusion-scout',
        label: '菌窟幻巡',
        tokenPortrait: '/assets/portraits/deep-gnome-svirfneblin-fungal-illusion-scout-token.png',
        initiativePortrait: '/assets/portraits/deep-gnome-svirfneblin-fungal-illusion-scout-initiative.png',
      },
    ],
  },
  deer: {
    emoji: '🦌',
    color: '#92400e',
    tokenPortrait: '/assets/portraits/deer-autumn-sunrise-stag-token.png',
    initiativePortrait: '/assets/portraits/deer-autumn-sunrise-stag-initiative.png',
    visualVariants: [
      {
        id: 'autumn-sunrise-stag',
        label: '秋曦雄鹿',
        tokenPortrait: '/assets/portraits/deer-autumn-sunrise-stag-token.png',
        initiativePortrait: '/assets/portraits/deer-autumn-sunrise-stag-initiative.png',
      },
      {
        id: 'moonlit-snow-doe',
        label: '雪月雌跃',
        tokenPortrait: '/assets/portraits/deer-moonlit-snow-doe-token.png',
        initiativePortrait: '/assets/portraits/deer-moonlit-snow-doe-initiative.png',
      },
    ],
  },
  deva: {
    emoji: '🪽',
    color: '#d4af37',
    tokenPortrait: '/assets/portraits/deva-golden-archive-guardian-token.png',
    initiativePortrait: '/assets/portraits/deva-golden-archive-guardian-initiative.png',
    visualVariants: [
      {
        id: 'golden-archive-guardian',
        label: '金殿圣卫',
        tokenPortrait: '/assets/portraits/deva-golden-archive-guardian-token.png',
        initiativePortrait: '/assets/portraits/deva-golden-archive-guardian-initiative.png',
      },
      {
        id: 'silver-dawn-descent',
        label: '银曦降临',
        tokenPortrait: '/assets/portraits/deva-silver-dawn-descent-token.png',
        initiativePortrait: '/assets/portraits/deva-silver-dawn-descent-initiative.png',
      },
    ],
  },
  'dire-wolf': {
    emoji: '🐺',
    color: '#374151',
    tokenPortrait: '/assets/portraits/dire-wolf-snow-cedar-stalk-token.png',
    initiativePortrait: '/assets/portraits/dire-wolf-snow-cedar-stalk-initiative.png',
    visualVariants: [
      {
        id: 'snow-cedar-stalk',
        label: '雪杉潜猎',
        tokenPortrait: '/assets/portraits/dire-wolf-snow-cedar-stalk-token.png',
        initiativePortrait: '/assets/portraits/dire-wolf-snow-cedar-stalk-initiative.png',
      },
      {
        id: 'storm-moor-charge',
        label: '雷原疾袭',
        tokenPortrait: '/assets/portraits/dire-wolf-storm-moor-charge-token.png',
        initiativePortrait: '/assets/portraits/dire-wolf-storm-moor-charge-initiative.png',
      },
    ],
  },
  djinni: {
    emoji: '🌪️',
    color: '#0284c7',
    tokenPortrait: '/assets/portraits/djinni-cloud-palace-noble-token.png',
    initiativePortrait: '/assets/portraits/djinni-cloud-palace-noble-initiative.png',
    visualVariants: [
      {
        id: 'cloud-palace-noble',
        label: '云宫风侯',
        tokenPortrait: '/assets/portraits/djinni-cloud-palace-noble-token.png',
        initiativePortrait: '/assets/portraits/djinni-cloud-palace-noble-initiative.png',
      },
      {
        id: 'storm-cloudship-whirlwind',
        label: '雷舰御风',
        tokenPortrait: '/assets/portraits/djinni-storm-cloudship-whirlwind-token.png',
        initiativePortrait: '/assets/portraits/djinni-storm-cloudship-whirlwind-initiative.png',
      },
    ],
  },
  doppelganger: {
    emoji: '🪞',
    color: '#6b7280',
    tokenPortrait: '/assets/portraits/doppelganger-mirror-vault-true-form-token.png',
    initiativePortrait: '/assets/portraits/doppelganger-mirror-vault-true-form-initiative.png',
    visualVariants: [
      {
        id: 'mirror-vault-true-form',
        label: '镜窟真身',
        tokenPortrait: '/assets/portraits/doppelganger-mirror-vault-true-form-token.png',
        initiativePortrait: '/assets/portraits/doppelganger-mirror-vault-true-form-initiative.png',
      },
      {
        id: 'rainy-inn-transformation',
        label: '雨栈易容',
        tokenPortrait: '/assets/portraits/doppelganger-rainy-inn-transformation-token.png',
        initiativePortrait: '/assets/portraits/doppelganger-rainy-inn-transformation-initiative.png',
      },
    ],
  },
  'draft-horse': {
    emoji: '🐴',
    color: '#78350f',
    tokenPortrait: '/assets/portraits/draft-horse-spring-field-plow-token.png',
    initiativePortrait: '/assets/portraits/draft-horse-spring-field-plow-initiative.png',
    visualVariants: [
      {
        id: 'spring-field-plow',
        label: '春田挽耕',
        tokenPortrait: '/assets/portraits/draft-horse-spring-field-plow-token.png',
        initiativePortrait: '/assets/portraits/draft-horse-spring-field-plow-initiative.png',
      },
      {
        id: 'snow-pass-freight',
        label: '雪岭驮运',
        tokenPortrait: '/assets/portraits/draft-horse-snow-pass-freight-token.png',
        initiativePortrait: '/assets/portraits/draft-horse-snow-pass-freight-initiative.png',
      },
    ],
  },
  'dragon-turtle': {
    emoji: '🐢',
    color: '#0f766e',
    tokenPortrait: '/assets/portraits/dragon-turtle-sunken-city-patrol-token.png',
    initiativePortrait: '/assets/portraits/dragon-turtle-sunken-city-patrol-initiative.png',
    visualVariants: [
      {
        id: 'sunken-city-patrol',
        label: '沉城巡游',
        tokenPortrait: '/assets/portraits/dragon-turtle-sunken-city-patrol-token.png',
        initiativePortrait: '/assets/portraits/dragon-turtle-sunken-city-patrol-initiative.png',
      },
      {
        id: 'storm-harbor-surge',
        label: '风港破浪',
        tokenPortrait: '/assets/portraits/dragon-turtle-storm-harbor-surge-token.png',
        initiativePortrait: '/assets/portraits/dragon-turtle-storm-harbor-surge-initiative.png',
      },
    ],
  },
  dretch: {
    emoji: '👹',
    color: '#4d7c0f',
    tokenPortrait: '/assets/portraits/dretch-abyssal-bog-trudge-token.png',
    initiativePortrait: '/assets/portraits/dretch-abyssal-bog-trudge-initiative.png',
    visualVariants: [
      {
        id: 'abyssal-bog-trudge',
        label: '魔沼跋涉',
        tokenPortrait: '/assets/portraits/dretch-abyssal-bog-trudge-token.png',
        initiativePortrait: '/assets/portraits/dretch-abyssal-bog-trudge-initiative.png',
      },
      {
        id: 'abandoned-prison-break',
        label: '地牢破门',
        tokenPortrait: '/assets/portraits/dretch-abandoned-prison-break-token.png',
        initiativePortrait: '/assets/portraits/dretch-abandoned-prison-break-initiative.png',
      },
    ],
  },
  drider: {
    emoji: '🕷️',
    color: '#581c87',
    tokenPortrait: '/assets/portraits/drider-underdark-bridge-archer-token.png',
    initiativePortrait: '/assets/portraits/drider-underdark-bridge-archer-initiative.png',
    visualVariants: [
      {
        id: 'underdark-bridge-archer',
        label: '幽桥猎弓',
        tokenPortrait: '/assets/portraits/drider-underdark-bridge-archer-token.png',
        initiativePortrait: '/assets/portraits/drider-underdark-bridge-archer-initiative.png',
      },
      {
        id: 'ruined-shrine-blade',
        label: '蛛殿利刃',
        tokenPortrait: '/assets/portraits/drider-ruined-shrine-blade-token.png',
        initiativePortrait: '/assets/portraits/drider-ruined-shrine-blade-initiative.png',
      },
    ],
  },
  drow: {
    emoji: '🏹',
    color: '#312e81',
    tokenPortrait: '/assets/portraits/drow-luminous-fungal-scout-token.png',
    initiativePortrait: '/assets/portraits/drow-luminous-fungal-scout-initiative.png',
    visualVariants: [
      {
        id: 'luminous-fungal-scout',
        label: '荧菌斥候',
        tokenPortrait: '/assets/portraits/drow-luminous-fungal-scout-token.png',
        initiativePortrait: '/assets/portraits/drow-luminous-fungal-scout-initiative.png',
      },
      {
        id: 'rain-city-duelist',
        label: '雨城剑士',
        tokenPortrait: '/assets/portraits/drow-rain-city-duelist-token.png',
        initiativePortrait: '/assets/portraits/drow-rain-city-duelist-initiative.png',
      },
    ],
  },
  druid: {
    emoji: '🌿',
    color: '#3f6212',
    tokenPortrait: '/assets/portraits/druid-autumn-grove-shillelagh-token.png',
    initiativePortrait: '/assets/portraits/druid-autumn-grove-shillelagh-initiative.png',
    visualVariants: [
      {
        id: 'autumn-grove-shillelagh',
        label: '秋林橡棍',
        tokenPortrait: '/assets/portraits/druid-autumn-grove-shillelagh-token.png',
        initiativePortrait: '/assets/portraits/druid-autumn-grove-shillelagh-initiative.png',
      },
      {
        id: 'storm-cliff-thunderwave',
        label: '雷崖震波',
        tokenPortrait: '/assets/portraits/druid-storm-cliff-thunderwave-token.png',
        initiativePortrait: '/assets/portraits/druid-storm-cliff-thunderwave-initiative.png',
      },
    ],
  },
  dryad: {
    emoji: '🌳',
    color: '#166534',
    tokenPortrait: '/assets/portraits/dryad-spring-oak-tree-stride-token.png',
    initiativePortrait: '/assets/portraits/dryad-spring-oak-tree-stride-initiative.png',
    visualVariants: [
      {
        id: 'spring-oak-tree-stride',
        label: '春橡树行',
        tokenPortrait: '/assets/portraits/dryad-spring-oak-tree-stride-token.png',
        initiativePortrait: '/assets/portraits/dryad-spring-oak-tree-stride-initiative.png',
      },
      {
        id: 'winter-yew-stalker',
        label: '冬杉潜影',
        tokenPortrait: '/assets/portraits/dryad-winter-yew-stalker-token.png',
        initiativePortrait: '/assets/portraits/dryad-winter-yew-stalker-initiative.png',
      },
    ],
  },
  duergar: {
    emoji: '⛏️',
    color: '#3f3f46',
    tokenPortrait: '/assets/portraits/duergar-iron-forge-guard-token.png',
    initiativePortrait: '/assets/portraits/duergar-iron-forge-guard-initiative.png',
    visualVariants: [
      {
        id: 'iron-forge-guard',
        label: '铁炉守卫',
        tokenPortrait: '/assets/portraits/duergar-iron-forge-guard-token.png',
        initiativePortrait: '/assets/portraits/duergar-iron-forge-guard-initiative.png',
      },
      {
        id: 'crystal-gate-enlarged',
        label: '晶门巨化',
        tokenPortrait: '/assets/portraits/duergar-crystal-gate-enlarged-token.png',
        initiativePortrait: '/assets/portraits/duergar-crystal-gate-enlarged-initiative.png',
      },
    ],
  },
  'dust-mephit': {
    emoji: '🌪️',
    color: '#78716c',
    tokenPortrait: '/assets/portraits/dust-mephit-desert-tomb-breath-token.png',
    initiativePortrait: '/assets/portraits/dust-mephit-desert-tomb-breath-initiative.png',
    visualVariants: [
      {
        id: 'desert-tomb-breath',
        label: '沙墓尘息',
        tokenPortrait: '/assets/portraits/dust-mephit-desert-tomb-breath-token.png',
        initiativePortrait: '/assets/portraits/dust-mephit-desert-tomb-breath-initiative.png',
      },
      {
        id: 'ruined-library-dive',
        label: '废塔俯袭',
        tokenPortrait: '/assets/portraits/dust-mephit-ruined-library-dive-token.png',
        initiativePortrait: '/assets/portraits/dust-mephit-ruined-library-dive-initiative.png',
      },
    ],
  },
  eagle: {
    emoji: '🦅',
    color: '#92400e',
    tokenPortrait: '/assets/portraits/eagle-alpine-talon-dive-token.png',
    initiativePortrait: '/assets/portraits/eagle-alpine-talon-dive-initiative.png',
    visualVariants: [
      {
        id: 'alpine-talon-dive',
        label: '雪岭俯击',
        tokenPortrait: '/assets/portraits/eagle-alpine-talon-dive-token.png',
        initiativePortrait: '/assets/portraits/eagle-alpine-talon-dive-initiative.png',
      },
      {
        id: 'storm-coast-perch',
        label: '风海栖枝',
        tokenPortrait: '/assets/portraits/eagle-storm-coast-perch-token.png',
        initiativePortrait: '/assets/portraits/eagle-storm-coast-perch-initiative.png',
      },
    ],
  },
  'earth-elemental': {
    emoji: '🪨',
    color: '#57534e',
    tokenPortrait: '/assets/portraits/earth-elemental-red-canyon-glide-token.png',
    initiativePortrait: '/assets/portraits/earth-elemental-red-canyon-glide-initiative.png',
    visualVariants: [
      {
        id: 'red-canyon-glide',
        label: '赤峡土行',
        tokenPortrait: '/assets/portraits/earth-elemental-red-canyon-glide-token.png',
        initiativePortrait: '/assets/portraits/earth-elemental-red-canyon-glide-initiative.png',
      },
      {
        id: 'storm-fortress-siege',
        label: '雨堡攻城',
        tokenPortrait: '/assets/portraits/earth-elemental-storm-fortress-siege-token.png',
        initiativePortrait: '/assets/portraits/earth-elemental-storm-fortress-siege-initiative.png',
      },
    ],
  },
  efreeti: {
    emoji: '🔥',
    color: '#b91c1c',
    tokenPortrait: '/assets/portraits/efreeti-brass-palace-scimitar-token.png',
    initiativePortrait: '/assets/portraits/efreeti-brass-palace-scimitar-initiative.png',
    visualVariants: [
      {
        id: 'brass-palace-scimitar',
        label: '铜宫炎刃',
        tokenPortrait: '/assets/portraits/efreeti-brass-palace-scimitar-token.png',
        initiativePortrait: '/assets/portraits/efreeti-brass-palace-scimitar-initiative.png',
      },
      {
        id: 'black-sand-flame-hurl',
        label: '黑沙投火',
        tokenPortrait: '/assets/portraits/efreeti-black-sand-flame-hurl-token.png',
        initiativePortrait: '/assets/portraits/efreeti-black-sand-flame-hurl-initiative.png',
      },
    ],
  },
  elephant: {
    emoji: '🐘',
    color: '#6b7280',
    tokenPortrait: '/assets/portraits/elephant-savanna-trampling-charge-token.png',
    initiativePortrait: '/assets/portraits/elephant-savanna-trampling-charge-initiative.png',
    visualVariants: [
      {
        id: 'savanna-trampling-charge',
        label: '草原践踏',
        tokenPortrait: '/assets/portraits/elephant-savanna-trampling-charge-token.png',
        initiativePortrait: '/assets/portraits/elephant-savanna-trampling-charge-initiative.png',
      },
      {
        id: 'monsoon-temple-crossing',
        label: '雨林涉水',
        tokenPortrait: '/assets/portraits/elephant-monsoon-temple-crossing-token.png',
        initiativePortrait: '/assets/portraits/elephant-monsoon-temple-crossing-initiative.png',
      },
    ],
  },
  elk: {
    emoji: '🦌',
    color: '#854d0e',
    tokenPortrait: '/assets/portraits/elk-autumn-valley-charge-token.png',
    initiativePortrait: '/assets/portraits/elk-autumn-valley-charge-initiative.png',
    visualVariants: [
      {
        id: 'autumn-valley-charge',
        label: '秋谷冲锋',
        tokenPortrait: '/assets/portraits/elk-autumn-valley-charge-token.png',
        initiativePortrait: '/assets/portraits/elk-autumn-valley-charge-initiative.png',
      },
      {
        id: 'snow-cedar-watch',
        label: '雪杉警立',
        tokenPortrait: '/assets/portraits/elk-snow-cedar-watch-token.png',
        initiativePortrait: '/assets/portraits/elk-snow-cedar-watch-initiative.png',
      },
    ],
  },
  erinyes: {
    emoji: '🪽',
    color: '#7f1d1d',
    tokenPortrait: '/assets/portraits/erinyes-infernal-city-archer-token.png',
    initiativePortrait: '/assets/portraits/erinyes-infernal-city-archer-initiative.png',
    visualVariants: [
      {
        id: 'infernal-city-archer',
        label: '狱城毒弓',
        tokenPortrait: '/assets/portraits/erinyes-infernal-city-archer-token.png',
        initiativePortrait: '/assets/portraits/erinyes-infernal-city-archer-initiative.png',
      },
      {
        id: 'frozen-prison-blade',
        label: '冰狱长剑',
        tokenPortrait: '/assets/portraits/erinyes-frozen-prison-blade-token.png',
        initiativePortrait: '/assets/portraits/erinyes-frozen-prison-blade-initiative.png',
      },
    ],
  },
  ettercap: {
    emoji: '🕸️',
    color: '#44403c',
    tokenPortrait: '/assets/portraits/ettercap-redwood-web-ambush-token.png',
    initiativePortrait: '/assets/portraits/ettercap-redwood-web-ambush-initiative.png',
    visualVariants: [
      {
        id: 'redwood-web-ambush',
        label: '红杉网伏',
        tokenPortrait: '/assets/portraits/ettercap-redwood-web-ambush-token.png',
        initiativePortrait: '/assets/portraits/ettercap-redwood-web-ambush-initiative.png',
      },
      {
        id: 'abandoned-mine-climb',
        label: '废矿攀猎',
        tokenPortrait: '/assets/portraits/ettercap-abandoned-mine-climb-token.png',
        initiativePortrait: '/assets/portraits/ettercap-abandoned-mine-climb-initiative.png',
      },
    ],
  },
  ettin: {
    emoji: '👥',
    color: '#713f12',
    tokenPortrait: '/assets/portraits/ettin-misty-hillfort-charge-token.png',
    initiativePortrait: '/assets/portraits/ettin-misty-hillfort-charge-initiative.png',
    visualVariants: [
      {
        id: 'misty-hillfort-charge',
        label: '雾堡双袭',
        tokenPortrait: '/assets/portraits/ettin-misty-hillfort-charge-token.png',
        initiativePortrait: '/assets/portraits/ettin-misty-hillfort-charge-initiative.png',
      },
      {
        id: 'moon-cave-watch',
        label: '月窟轮守',
        tokenPortrait: '/assets/portraits/ettin-moon-cave-watch-token.png',
        initiativePortrait: '/assets/portraits/ettin-moon-cave-watch-initiative.png',
      },
    ],
  },
  'fire-elemental': {
    emoji: '🔥',
    color: '#ea580c',
    tokenPortrait: '/assets/portraits/fire-elemental-obsidian-caldera-rise-token.png',
    initiativePortrait: '/assets/portraits/fire-elemental-obsidian-caldera-rise-initiative.png',
    visualVariants: [
      {
        id: 'obsidian-caldera-rise',
        label: '黑岩炎升',
        tokenPortrait: '/assets/portraits/fire-elemental-obsidian-caldera-rise-token.png',
        initiativePortrait: '/assets/portraits/fire-elemental-obsidian-caldera-rise-initiative.png',
      },
      {
        id: 'rain-city-fireform',
        label: '雨城流火',
        tokenPortrait: '/assets/portraits/fire-elemental-rain-city-fireform-token.png',
        initiativePortrait: '/assets/portraits/fire-elemental-rain-city-fireform-initiative.png',
      },
    ],
  },
  'fire-giant': {
    emoji: '⚔️',
    color: '#991b1b',
    tokenPortrait: '/assets/portraits/fire-giant-volcanic-forge-greatsword-token.png',
    initiativePortrait: '/assets/portraits/fire-giant-volcanic-forge-greatsword-initiative.png',
    visualVariants: [
      {
        id: 'volcanic-forge-greatsword',
        label: '火城巨剑',
        tokenPortrait: '/assets/portraits/fire-giant-volcanic-forge-greatsword-token.png',
        initiativePortrait: '/assets/portraits/fire-giant-volcanic-forge-greatsword-initiative.png',
      },
      {
        id: 'glacier-pass-rockthrow',
        label: '冰峡投岩',
        tokenPortrait: '/assets/portraits/fire-giant-glacier-pass-rockthrow-token.png',
        initiativePortrait: '/assets/portraits/fire-giant-glacier-pass-rockthrow-initiative.png',
      },
    ],
  },
  'flesh-golem': {
    emoji: '🧟',
    color: '#57534e',
    tokenPortrait: '/assets/portraits/flesh-golem-lightning-laboratory-awakening-token.png',
    initiativePortrait: '/assets/portraits/flesh-golem-lightning-laboratory-awakening-initiative.png',
    visualVariants: [
      {
        id: 'lightning-laboratory-awakening',
        label: '雷塔苏醒',
        tokenPortrait: '/assets/portraits/flesh-golem-lightning-laboratory-awakening-token.png',
        initiativePortrait: '/assets/portraits/flesh-golem-lightning-laboratory-awakening-initiative.png',
      },
      {
        id: 'burning-barn-berserk',
        label: '火仓狂暴',
        tokenPortrait: '/assets/portraits/flesh-golem-burning-barn-berserk-token.png',
        initiativePortrait: '/assets/portraits/flesh-golem-burning-barn-berserk-initiative.png',
      },
    ],
  },
  'flying-snake': {
    emoji: '🐍',
    color: '#0f766e',
    tokenPortrait: '/assets/portraits/flying-snake-jungle-temple-flight-token.png',
    initiativePortrait: '/assets/portraits/flying-snake-jungle-temple-flight-initiative.png',
    visualVariants: [
      {
        id: 'jungle-temple-flight',
        label: '雨林飞掠',
        tokenPortrait: '/assets/portraits/flying-snake-jungle-temple-flight-token.png',
        initiativePortrait: '/assets/portraits/flying-snake-jungle-temple-flight-initiative.png',
      },
      {
        id: 'cenote-swim',
        label: '蓝潭潜游',
        tokenPortrait: '/assets/portraits/flying-snake-cenote-swim-token.png',
        initiativePortrait: '/assets/portraits/flying-snake-cenote-swim-initiative.png',
      },
    ],
  },
  'flying-sword': {
    emoji: '🗡️',
    color: '#64748b',
    tokenPortrait: '/assets/portraits/flying-sword-ruined-armory-awakening-token.png',
    initiativePortrait: '/assets/portraits/flying-sword-ruined-armory-awakening-initiative.png',
    visualVariants: [
      {
        id: 'ruined-armory-awakening',
        label: '荒械苏醒',
        tokenPortrait: '/assets/portraits/flying-sword-ruined-armory-awakening-token.png',
        initiativePortrait: '/assets/portraits/flying-sword-ruined-armory-awakening-initiative.png',
      },
      {
        id: 'moonlit-hall-charge',
        label: '月廊突刺',
        tokenPortrait: '/assets/portraits/flying-sword-moonlit-hall-charge-token.png',
        initiativePortrait: '/assets/portraits/flying-sword-moonlit-hall-charge-initiative.png',
      },
    ],
  },
  'frog': {
    emoji: '🐸',
    color: '#4d7c0f',
    tokenPortrait: '/assets/portraits/frog-rainforest-lotus-leap-token.png',
    initiativePortrait: '/assets/portraits/frog-rainforest-lotus-leap-initiative.png',
    visualVariants: [
      {
        id: 'rainforest-lotus-leap',
        label: '雨林跃叶',
        tokenPortrait: '/assets/portraits/frog-rainforest-lotus-leap-token.png',
        initiativePortrait: '/assets/portraits/frog-rainforest-lotus-leap-initiative.png',
      },
      {
        id: 'moonlit-pond-swim',
        label: '月塘潜游',
        tokenPortrait: '/assets/portraits/frog-moonlit-pond-swim-token.png',
        initiativePortrait: '/assets/portraits/frog-moonlit-pond-swim-initiative.png',
      },
    ],
  },
  'frost-giant': {
    emoji: '🧊',
    color: '#0e7490',
    tokenPortrait: '/assets/portraits/frost-giant-blizzard-greataxe-token.png',
    initiativePortrait: '/assets/portraits/frost-giant-blizzard-greataxe-initiative.png',
    visualVariants: [
      {
        id: 'blizzard-greataxe',
        label: '雪堡巨斧',
        tokenPortrait: '/assets/portraits/frost-giant-blizzard-greataxe-token.png',
        initiativePortrait: '/assets/portraits/frost-giant-blizzard-greataxe-initiative.png',
      },
      {
        id: 'glacier-rockthrow',
        label: '冰峡投岩',
        tokenPortrait: '/assets/portraits/frost-giant-glacier-rockthrow-token.png',
        initiativePortrait: '/assets/portraits/frost-giant-glacier-rockthrow-initiative.png',
      },
    ],
  },
  'gargoyle': {
    emoji: '🗿',
    color: '#57534e',
    tokenPortrait: '/assets/portraits/gargoyle-storm-cathedral-awakening-token.png',
    initiativePortrait: '/assets/portraits/gargoyle-storm-cathedral-awakening-initiative.png',
    visualVariants: [
      {
        id: 'storm-cathedral-awakening',
        label: '雨堂苏醒',
        tokenPortrait: '/assets/portraits/gargoyle-storm-cathedral-awakening-token.png',
        initiativePortrait: '/assets/portraits/gargoyle-storm-cathedral-awakening-initiative.png',
      },
      {
        id: 'desert-ziggurat-dive',
        label: '沙塔俯冲',
        tokenPortrait: '/assets/portraits/gargoyle-desert-ziggurat-dive-token.png',
        initiativePortrait: '/assets/portraits/gargoyle-desert-ziggurat-dive-initiative.png',
      },
    ],
  },
  'gelatinous-cube': {
    emoji: '🧊',
    color: '#16a34a',
    tokenPortrait: '/assets/portraits/gelatinous-cube-torch-dungeon-engulf-token.png',
    initiativePortrait: '/assets/portraits/gelatinous-cube-torch-dungeon-engulf-initiative.png',
    visualVariants: [
      {
        id: 'torch-dungeon-engulf',
        label: '火牢吞噬',
        tokenPortrait: '/assets/portraits/gelatinous-cube-torch-dungeon-engulf-token.png',
        initiativePortrait: '/assets/portraits/gelatinous-cube-torch-dungeon-engulf-initiative.png',
      },
      {
        id: 'flooded-archive-pseudopod',
        label: '水库伪足',
        tokenPortrait: '/assets/portraits/gelatinous-cube-flooded-archive-pseudopod-token.png',
        initiativePortrait: '/assets/portraits/gelatinous-cube-flooded-archive-pseudopod-initiative.png',
      },
    ],
  },
  'ghast': {
    emoji: '🧟',
    color: '#3f3f46',
    tokenPortrait: '/assets/portraits/ghast-royal-crypt-lunge-token.png',
    initiativePortrait: '/assets/portraits/ghast-royal-crypt-lunge-initiative.png',
    visualVariants: [
      {
        id: 'royal-crypt-lunge',
        label: '王陵扑袭',
        tokenPortrait: '/assets/portraits/ghast-royal-crypt-lunge-token.png',
        initiativePortrait: '/assets/portraits/ghast-royal-crypt-lunge-initiative.png',
      },
      {
        id: 'flooded-sewer-stalker',
        label: '污渠潜猎',
        tokenPortrait: '/assets/portraits/ghast-flooded-sewer-stalker-token.png',
        initiativePortrait: '/assets/portraits/ghast-flooded-sewer-stalker-initiative.png',
      },
    ],
  },
  'ghost': {
    emoji: '👻',
    color: '#7c3aed',
    tokenPortrait: '/assets/portraits/ghost-dawn-battlefield-touch-token.png',
    initiativePortrait: '/assets/portraits/ghost-dawn-battlefield-touch-initiative.png',
    visualVariants: [
      {
        id: 'dawn-battlefield-touch',
        label: '晓原枯触',
        tokenPortrait: '/assets/portraits/ghost-dawn-battlefield-touch-token.png',
        initiativePortrait: '/assets/portraits/ghost-dawn-battlefield-touch-initiative.png',
      },
      {
        id: 'storm-manor-visage',
        label: '雷宅骇容',
        tokenPortrait: '/assets/portraits/ghost-storm-manor-visage-token.png',
        initiativePortrait: '/assets/portraits/ghost-storm-manor-visage-initiative.png',
      },
    ],
  },
  'ghoul': {
    emoji: '🧟',
    color: '#52525b',
    tokenPortrait: '/assets/portraits/ghoul-dusk-graveyard-crawl-token.png',
    initiativePortrait: '/assets/portraits/ghoul-dusk-graveyard-crawl-initiative.png',
    visualVariants: [
      {
        id: 'dusk-graveyard-crawl',
        label: '暮墓爬袭',
        tokenPortrait: '/assets/portraits/ghoul-dusk-graveyard-crawl-token.png',
        initiativePortrait: '/assets/portraits/ghoul-dusk-graveyard-crawl-initiative.png',
      },
      {
        id: 'frost-kitchen-stalker',
        label: '寒厨潜猎',
        tokenPortrait: '/assets/portraits/ghoul-frost-kitchen-stalker-token.png',
        initiativePortrait: '/assets/portraits/ghoul-frost-kitchen-stalker-initiative.png',
      },
    ],
  },
  'giant-ape': {
    emoji: '🦍',
    color: '#292524',
    tokenPortrait: '/assets/portraits/giant-ape-jungle-ground-pound-token.png',
    initiativePortrait: '/assets/portraits/giant-ape-jungle-ground-pound-initiative.png',
    visualVariants: [
      {
        id: 'jungle-ground-pound',
        label: '雨林震拳',
        tokenPortrait: '/assets/portraits/giant-ape-jungle-ground-pound-token.png',
        initiativePortrait: '/assets/portraits/giant-ape-jungle-ground-pound-initiative.png',
      },
      {
        id: 'alpine-rockthrow',
        label: '峰崖投岩',
        tokenPortrait: '/assets/portraits/giant-ape-alpine-rockthrow-token.png',
        initiativePortrait: '/assets/portraits/giant-ape-alpine-rockthrow-initiative.png',
      },
    ],
  },
  'giant-badger': {
    emoji: '🦡',
    color: '#57534e',
    tokenPortrait: '/assets/portraits/giant-badger-autumn-burrow-lunge-token.png',
    initiativePortrait: '/assets/portraits/giant-badger-autumn-burrow-lunge-initiative.png',
    visualVariants: [
      {
        id: 'autumn-burrow-lunge',
        label: '秋穴扑袭',
        tokenPortrait: '/assets/portraits/giant-badger-autumn-burrow-lunge-token.png',
        initiativePortrait: '/assets/portraits/giant-badger-autumn-burrow-lunge-initiative.png',
      },
      {
        id: 'moonlit-chalk-charge',
        label: '月岭奔袭',
        tokenPortrait: '/assets/portraits/giant-badger-moonlit-chalk-charge-token.png',
        initiativePortrait: '/assets/portraits/giant-badger-moonlit-chalk-charge-initiative.png',
      },
    ],
  },
  'giant-bat': {
    emoji: '🦇',
    color: '#44403c',
    tokenPortrait: '/assets/portraits/giant-bat-cavern-bank-flight-token.png',
    initiativePortrait: '/assets/portraits/giant-bat-cavern-bank-flight-initiative.png',
    visualVariants: [
      {
        id: 'cavern-bank-flight',
        label: '洞河飞掠',
        tokenPortrait: '/assets/portraits/giant-bat-cavern-bank-flight-token.png',
        initiativePortrait: '/assets/portraits/giant-bat-cavern-bank-flight-initiative.png',
      },
      {
        id: 'dawn-bell-tower-perch',
        label: '晓钟停栖',
        tokenPortrait: '/assets/portraits/giant-bat-dawn-bell-tower-perch-token.png',
        initiativePortrait: '/assets/portraits/giant-bat-dawn-bell-tower-perch-initiative.png',
      },
    ],
  },
  'giant-boar': {
    emoji: '🐗',
    color: '#713f12',
    tokenPortrait: '/assets/portraits/giant-boar-golden-forest-charge-token.png',
    initiativePortrait: '/assets/portraits/giant-boar-golden-forest-charge-initiative.png',
    visualVariants: [
      {
        id: 'golden-forest-charge',
        label: '金林冲锋',
        tokenPortrait: '/assets/portraits/giant-boar-golden-forest-charge-token.png',
        initiativePortrait: '/assets/portraits/giant-boar-golden-forest-charge-initiative.png',
      },
      {
        id: 'storm-moor-relentless',
        label: '雷原不屈',
        tokenPortrait: '/assets/portraits/giant-boar-storm-moor-relentless-token.png',
        initiativePortrait: '/assets/portraits/giant-boar-storm-moor-relentless-initiative.png',
      },
    ],
  },
  'giant-centipede': {
    emoji: '🐛',
    color: '#7f1d1d',
    tokenPortrait: '/assets/portraits/giant-centipede-jungle-temple-climb-token.png',
    initiativePortrait: '/assets/portraits/giant-centipede-jungle-temple-climb-initiative.png',
    visualVariants: [
      {
        id: 'jungle-temple-climb',
        label: '雨寺攀行',
        tokenPortrait: '/assets/portraits/giant-centipede-jungle-temple-climb-token.png',
        initiativePortrait: '/assets/portraits/giant-centipede-jungle-temple-climb-initiative.png',
      },
      {
        id: 'moonlit-cellar-bite',
        label: '月窖毒噬',
        tokenPortrait: '/assets/portraits/giant-centipede-moonlit-cellar-bite-token.png',
        initiativePortrait: '/assets/portraits/giant-centipede-moonlit-cellar-bite-initiative.png',
      },
    ],
  },
  'giant-constrictor-snake': {
    emoji: '🐍',
    color: '#365314',
    tokenPortrait: '/assets/portraits/giant-constrictor-snake-jungle-temple-strike-token.png',
    initiativePortrait: '/assets/portraits/giant-constrictor-snake-jungle-temple-strike-initiative.png',
    visualVariants: [
      {
        id: 'jungle-temple-strike',
        label: '雨寺突噬',
        tokenPortrait: '/assets/portraits/giant-constrictor-snake-jungle-temple-strike-token.png',
        initiativePortrait: '/assets/portraits/giant-constrictor-snake-jungle-temple-strike-initiative.png',
      },
      {
        id: 'flooded-river-swim',
        label: '洪林潜游',
        tokenPortrait: '/assets/portraits/giant-constrictor-snake-flooded-river-swim-token.png',
        initiativePortrait: '/assets/portraits/giant-constrictor-snake-flooded-river-swim-initiative.png',
      },
    ],
  },
  'giant-crab': {
    emoji: '🦀',
    color: '#9f1239',
    tokenPortrait: '/assets/portraits/giant-crab-storm-beach-side-step-token.png',
    initiativePortrait: '/assets/portraits/giant-crab-storm-beach-side-step-initiative.png',
    visualVariants: [
      {
        id: 'storm-beach-side-step',
        label: '风滩横行',
        tokenPortrait: '/assets/portraits/giant-crab-storm-beach-side-step-token.png',
        initiativePortrait: '/assets/portraits/giant-crab-storm-beach-side-step-initiative.png',
      },
      {
        id: 'sunken-wreck-guard',
        label: '沉船守卫',
        tokenPortrait: '/assets/portraits/giant-crab-sunken-wreck-guard-token.png',
        initiativePortrait: '/assets/portraits/giant-crab-sunken-wreck-guard-initiative.png',
      },
    ],
  },
  'giant-crocodile': {
    emoji: '🐊',
    color: '#3f6212',
    tokenPortrait: '/assets/portraits/giant-crocodile-dawn-swamp-bite-token.png',
    initiativePortrait: '/assets/portraits/giant-crocodile-dawn-swamp-bite-initiative.png',
    visualVariants: [
      {
        id: 'dawn-swamp-bite',
        label: '晓泽突噬',
        tokenPortrait: '/assets/portraits/giant-crocodile-dawn-swamp-bite-token.png',
        initiativePortrait: '/assets/portraits/giant-crocodile-dawn-swamp-bite-initiative.png',
      },
      {
        id: 'sunken-ruins-tail-sweep',
        label: '沉墟尾扫',
        tokenPortrait: '/assets/portraits/giant-crocodile-sunken-ruins-tail-sweep-token.png',
        initiativePortrait: '/assets/portraits/giant-crocodile-sunken-ruins-tail-sweep-initiative.png',
      },
    ],
  },
  'giant-eagle': {
    emoji: '🦅',
    color: '#92400e',
    tokenPortrait: '/assets/portraits/giant-eagle-snow-peak-talon-dive-token.png',
    initiativePortrait: '/assets/portraits/giant-eagle-snow-peak-talon-dive-initiative.png',
    visualVariants: [
      {
        id: 'snow-peak-talon-dive',
        label: '雪峰擒掠',
        tokenPortrait: '/assets/portraits/giant-eagle-snow-peak-talon-dive-token.png',
        initiativePortrait: '/assets/portraits/giant-eagle-snow-peak-talon-dive-initiative.png',
      },
      {
        id: 'desert-mesa-watch',
        label: '赤崖守巢',
        tokenPortrait: '/assets/portraits/giant-eagle-desert-mesa-watch-token.png',
        initiativePortrait: '/assets/portraits/giant-eagle-desert-mesa-watch-initiative.png',
      },
    ],
  },
  'giant-elk': {
    emoji: '🫎',
    color: '#78350f',
    tokenPortrait: '/assets/portraits/giant-elk-snow-forest-charge-token.png',
    initiativePortrait: '/assets/portraits/giant-elk-snow-forest-charge-initiative.png',
    visualVariants: [
      {
        id: 'snow-forest-charge',
        label: '雪林冲角',
        tokenPortrait: '/assets/portraits/giant-elk-snow-forest-charge-token.png',
        initiativePortrait: '/assets/portraits/giant-elk-snow-forest-charge-initiative.png',
      },
      {
        id: 'moonlit-heather-hooves',
        label: '月原扬蹄',
        tokenPortrait: '/assets/portraits/giant-elk-moonlit-heather-hooves-token.png',
        initiativePortrait: '/assets/portraits/giant-elk-moonlit-heather-hooves-initiative.png',
      },
    ],
  },
  'giant-fire-beetle': {
    emoji: '🪲',
    color: '#b45309',
    tokenPortrait: '/assets/portraits/giant-fire-beetle-crystal-cavern-glow-token.png',
    initiativePortrait: '/assets/portraits/giant-fire-beetle-crystal-cavern-glow-initiative.png',
    visualVariants: [
      {
        id: 'crystal-cavern-glow',
        label: '晶洞荧行',
        tokenPortrait: '/assets/portraits/giant-fire-beetle-crystal-cavern-glow-token.png',
        initiativePortrait: '/assets/portraits/giant-fire-beetle-crystal-cavern-glow-initiative.png',
      },
      {
        id: 'rainforest-log-glow',
        label: '雨木夜行',
        tokenPortrait: '/assets/portraits/giant-fire-beetle-rainforest-log-glow-token.png',
        initiativePortrait: '/assets/portraits/giant-fire-beetle-rainforest-log-glow-initiative.png',
      },
    ],
  },
  'giant-frog': {
    emoji: '🐸',
    color: '#4d7c0f',
    tokenPortrait: '/assets/portraits/giant-frog-dawn-swamp-leap-token.png',
    initiativePortrait: '/assets/portraits/giant-frog-dawn-swamp-leap-initiative.png',
    visualVariants: [
      {
        id: 'dawn-swamp-leap',
        label: '晓泽跃噬',
        tokenPortrait: '/assets/portraits/giant-frog-dawn-swamp-leap-token.png',
        initiativePortrait: '/assets/portraits/giant-frog-dawn-swamp-leap-initiative.png',
      },
      {
        id: 'moonlit-quarry-swim',
        label: '月潭潜游',
        tokenPortrait: '/assets/portraits/giant-frog-moonlit-quarry-swim-token.png',
        initiativePortrait: '/assets/portraits/giant-frog-moonlit-quarry-swim-initiative.png',
      },
    ],
  },
  'giant-goat': {
    emoji: '🐐',
    color: '#78716c',
    tokenPortrait: '/assets/portraits/giant-goat-sunset-cliff-surefoot-token.png',
    initiativePortrait: '/assets/portraits/giant-goat-sunset-cliff-surefoot-initiative.png',
    visualVariants: [
      {
        id: 'sunset-cliff-surefoot',
        label: '夕崖稳足',
        tokenPortrait: '/assets/portraits/giant-goat-sunset-cliff-surefoot-token.png',
        initiativePortrait: '/assets/portraits/giant-goat-sunset-cliff-surefoot-initiative.png',
      },
      {
        id: 'storm-highland-charge',
        label: '雷岭冲角',
        tokenPortrait: '/assets/portraits/giant-goat-storm-highland-charge-token.png',
        initiativePortrait: '/assets/portraits/giant-goat-storm-highland-charge-initiative.png',
      },
    ],
  },
  'giant-hyena': {
    emoji: '🐕',
    color: '#854d0e',
    tokenPortrait: '/assets/portraits/giant-hyena-savanna-rampage-token.png',
    initiativePortrait: '/assets/portraits/giant-hyena-savanna-rampage-initiative.png',
    visualVariants: [
      {
        id: 'savanna-rampage',
        label: '赤原狂奔',
        tokenPortrait: '/assets/portraits/giant-hyena-savanna-rampage-token.png',
        initiativePortrait: '/assets/portraits/giant-hyena-savanna-rampage-initiative.png',
      },
      {
        id: 'moonlit-ruins-stalker',
        label: '月城潜猎',
        tokenPortrait: '/assets/portraits/giant-hyena-moonlit-ruins-stalker-token.png',
        initiativePortrait: '/assets/portraits/giant-hyena-moonlit-ruins-stalker-initiative.png',
      },
    ],
  },
  'giant-lizard': {
    emoji: '🦎',
    color: '#0f766e',
    tokenPortrait: '/assets/portraits/giant-lizard-desert-ruin-climb-token.png',
    initiativePortrait: '/assets/portraits/giant-lizard-desert-ruin-climb-initiative.png',
    visualVariants: [
      {
        id: 'desert-ruin-climb',
        label: '沙堡攀行',
        tokenPortrait: '/assets/portraits/giant-lizard-desert-ruin-climb-token.png',
        initiativePortrait: '/assets/portraits/giant-lizard-desert-ruin-climb-initiative.png',
      },
      {
        id: 'rainforest-stream-bite',
        label: '雨溪扑噬',
        tokenPortrait: '/assets/portraits/giant-lizard-rainforest-stream-bite-token.png',
        initiativePortrait: '/assets/portraits/giant-lizard-rainforest-stream-bite-initiative.png',
      },
    ],
  },
  'giant-octopus': {
    emoji: '🐙',
    color: '#6d28d9',
    tokenPortrait: '/assets/portraits/giant-octopus-coral-ruins-camouflage-token.png',
    initiativePortrait: '/assets/portraits/giant-octopus-coral-ruins-camouflage-initiative.png',
    visualVariants: [
      {
        id: 'coral-ruins-camouflage',
        label: '珊墟拟态',
        tokenPortrait: '/assets/portraits/giant-octopus-coral-ruins-camouflage-token.png',
        initiativePortrait: '/assets/portraits/giant-octopus-coral-ruins-camouflage-initiative.png',
      },
      {
        id: 'moonlit-kelp-ink-dash',
        label: '月藻墨遁',
        tokenPortrait: '/assets/portraits/giant-octopus-moonlit-kelp-ink-dash-token.png',
        initiativePortrait: '/assets/portraits/giant-octopus-moonlit-kelp-ink-dash-initiative.png',
      },
    ],
  },
  'giant-owl': {
    emoji: '🦉',
    color: '#475569',
    tokenPortrait: '/assets/portraits/giant-owl-moonlit-redwood-flyby-token.png',
    initiativePortrait: '/assets/portraits/giant-owl-moonlit-redwood-flyby-initiative.png',
    visualVariants: [
      {
        id: 'moonlit-redwood-flyby',
        label: '月林飞掠',
        tokenPortrait: '/assets/portraits/giant-owl-moonlit-redwood-flyby-token.png',
        initiativePortrait: '/assets/portraits/giant-owl-moonlit-redwood-flyby-initiative.png',
      },
      {
        id: 'dawn-bell-tower-perch',
        label: '晓钟停栖',
        tokenPortrait: '/assets/portraits/giant-owl-dawn-bell-tower-perch-token.png',
        initiativePortrait: '/assets/portraits/giant-owl-dawn-bell-tower-perch-initiative.png',
      },
    ],
  },
  'giant-poisonous-snake': {
    emoji: '🐍',
    color: '#365314',
    tokenPortrait: '/assets/portraits/giant-poisonous-snake-mangrove-swim-token.png',
    initiativePortrait: '/assets/portraits/giant-poisonous-snake-mangrove-swim-initiative.png',
    visualVariants: [
      {
        id: 'mangrove-swim',
        label: '红树林游猎',
        tokenPortrait: '/assets/portraits/giant-poisonous-snake-mangrove-swim-token.png',
        initiativePortrait: '/assets/portraits/giant-poisonous-snake-mangrove-swim-initiative.png',
      },
      {
        id: 'sunset-ziggurat-strike',
        label: '夕塔昂击',
        tokenPortrait: '/assets/portraits/giant-poisonous-snake-sunset-ziggurat-strike-token.png',
        initiativePortrait: '/assets/portraits/giant-poisonous-snake-sunset-ziggurat-strike-initiative.png',
      },
    ],
  },
  'giant-rat': {
    emoji: '🐀',
    color: '#57534e',
    tokenPortrait: '/assets/portraits/giant-rat-sewer-sprint-token.png',
    initiativePortrait: '/assets/portraits/giant-rat-sewer-sprint-initiative.png',
    visualVariants: [
      {
        id: 'sewer-sprint',
        label: '暗渠奔袭',
        tokenPortrait: '/assets/portraits/giant-rat-sewer-sprint-token.png',
        initiativePortrait: '/assets/portraits/giant-rat-sewer-sprint-initiative.png',
      },
      {
        id: 'dawn-barn-scent',
        label: '晓仓嗅踪',
        tokenPortrait: '/assets/portraits/giant-rat-dawn-barn-scent-token.png',
        initiativePortrait: '/assets/portraits/giant-rat-dawn-barn-scent-initiative.png',
      },
    ],
  },
  'giant-rat-diseased': {
    emoji: '🐀',
    color: '#3f6212',
    tokenPortrait: '/assets/portraits/giant-rat-diseased-plague-alley-stalk-token.png',
    initiativePortrait: '/assets/portraits/giant-rat-diseased-plague-alley-stalk-initiative.png',
    visualVariants: [
      {
        id: 'plague-alley-stalk',
        label: '疫巷潜行',
        tokenPortrait: '/assets/portraits/giant-rat-diseased-plague-alley-stalk-token.png',
        initiativePortrait: '/assets/portraits/giant-rat-diseased-plague-alley-stalk-initiative.png',
      },
      {
        id: 'moonlit-apothecary-scent',
        label: '月窖嗅疫',
        tokenPortrait: '/assets/portraits/giant-rat-diseased-moonlit-apothecary-scent-token.png',
        initiativePortrait: '/assets/portraits/giant-rat-diseased-moonlit-apothecary-scent-initiative.png',
      },
    ],
  },
  'giant-scorpion': {
    emoji: '🦂',
    color: '#92400e',
    tokenPortrait: '/assets/portraits/giant-scorpion-desert-fortress-guard-token.png',
    initiativePortrait: '/assets/portraits/giant-scorpion-desert-fortress-guard-initiative.png',
    visualVariants: [
      {
        id: 'desert-fortress-guard',
        label: '沙堡钳卫',
        tokenPortrait: '/assets/portraits/giant-scorpion-desert-fortress-guard-token.png',
        initiativePortrait: '/assets/portraits/giant-scorpion-desert-fortress-guard-initiative.png',
      },
      {
        id: 'moonlit-salt-canyon-charge',
        label: '月盐疾刺',
        tokenPortrait: '/assets/portraits/giant-scorpion-moonlit-salt-canyon-charge-token.png',
        initiativePortrait: '/assets/portraits/giant-scorpion-moonlit-salt-canyon-charge-initiative.png',
      },
    ],
  },
  'giant-sea-horse': {
    emoji: '🐠',
    color: '#0e7490',
    tokenPortrait: '/assets/portraits/giant-sea-horse-coral-canyon-charge-token.png',
    initiativePortrait: '/assets/portraits/giant-sea-horse-coral-canyon-charge-initiative.png',
    visualVariants: [
      {
        id: 'coral-canyon-charge',
        label: '珊谷冲撞',
        tokenPortrait: '/assets/portraits/giant-sea-horse-coral-canyon-charge-token.png',
        initiativePortrait: '/assets/portraits/giant-sea-horse-coral-canyon-charge-initiative.png',
      },
      {
        id: 'drowned-bell-tower-perch',
        label: '沉钟盘尾',
        tokenPortrait: '/assets/portraits/giant-sea-horse-drowned-bell-tower-perch-token.png',
        initiativePortrait: '/assets/portraits/giant-sea-horse-drowned-bell-tower-perch-initiative.png',
      },
    ],
  },
  'giant-shark': {
    emoji: '🦈',
    color: '#155e75',
    tokenPortrait: '/assets/portraits/giant-shark-sunken-warship-patrol-token.png',
    initiativePortrait: '/assets/portraits/giant-shark-sunken-warship-patrol-initiative.png',
    visualVariants: [
      {
        id: 'sunken-warship-patrol',
        label: '沉舰巡猎',
        tokenPortrait: '/assets/portraits/giant-shark-sunken-warship-patrol-token.png',
        initiativePortrait: '/assets/portraits/giant-shark-sunken-warship-patrol-initiative.png',
      },
      {
        id: 'volcanic-rift-blood-frenzy',
        label: '熔渊嗜血',
        tokenPortrait: '/assets/portraits/giant-shark-volcanic-rift-blood-frenzy-token.png',
        initiativePortrait: '/assets/portraits/giant-shark-volcanic-rift-blood-frenzy-initiative.png',
      },
    ],
  },
  'giant-spider': {
    emoji: '🕷️',
    color: '#3f3f46',
    tokenPortrait: '/assets/portraits/giant-spider-moonlit-cathedral-descent-token.png',
    initiativePortrait: '/assets/portraits/giant-spider-moonlit-cathedral-descent-initiative.png',
    visualVariants: [
      {
        id: 'moonlit-cathedral-descent',
        label: '月堂垂猎',
        tokenPortrait: '/assets/portraits/giant-spider-moonlit-cathedral-descent-token.png',
        initiativePortrait: '/assets/portraits/giant-spider-moonlit-cathedral-descent-initiative.png',
      },
      {
        id: 'rainforest-ruin-silk-run',
        label: '雨墟牵丝',
        tokenPortrait: '/assets/portraits/giant-spider-rainforest-ruin-silk-run-token.png',
        initiativePortrait: '/assets/portraits/giant-spider-rainforest-ruin-silk-run-initiative.png',
      },
    ],
  },
  'giant-toad': {
    emoji: '🐸',
    color: '#4d7c0f',
    tokenPortrait: '/assets/portraits/giant-toad-dawn-marsh-leap-token.png',
    initiativePortrait: '/assets/portraits/giant-toad-dawn-marsh-leap-initiative.png',
    visualVariants: [
      {
        id: 'dawn-marsh-leap',
        label: '晓泽飞跃',
        tokenPortrait: '/assets/portraits/giant-toad-dawn-marsh-leap-token.png',
        initiativePortrait: '/assets/portraits/giant-toad-dawn-marsh-leap-initiative.png',
      },
      {
        id: 'moonlit-sunken-temple-swim',
        label: '月殿潜游',
        tokenPortrait: '/assets/portraits/giant-toad-moonlit-sunken-temple-swim-token.png',
        initiativePortrait: '/assets/portraits/giant-toad-moonlit-sunken-temple-swim-initiative.png',
      },
    ],
  },
  'giant-vulture': {
    emoji: '🦅',
    color: '#713f12',
    tokenPortrait: '/assets/portraits/giant-vulture-red-canyon-circle-token.png',
    initiativePortrait: '/assets/portraits/giant-vulture-red-canyon-circle-initiative.png',
    visualVariants: [
      {
        id: 'red-canyon-circle',
        label: '赤峡盘旋',
        tokenPortrait: '/assets/portraits/giant-vulture-red-canyon-circle-token.png',
        initiativePortrait: '/assets/portraits/giant-vulture-red-canyon-circle-initiative.png',
      },
      {
        id: 'storm-monument-watch',
        label: '雷碑哨立',
        tokenPortrait: '/assets/portraits/giant-vulture-storm-monument-watch-token.png',
        initiativePortrait: '/assets/portraits/giant-vulture-storm-monument-watch-initiative.png',
      },
    ],
  },
  'giant-wasp': {
    emoji: '🐝',
    color: '#ca8a04',
    tokenPortrait: '/assets/portraits/giant-wasp-dawn-orchard-dive-token.png',
    initiativePortrait: '/assets/portraits/giant-wasp-dawn-orchard-dive-initiative.png',
    visualVariants: [
      {
        id: 'dawn-orchard-dive',
        label: '晓园俯螫',
        tokenPortrait: '/assets/portraits/giant-wasp-dawn-orchard-dive-token.png',
        initiativePortrait: '/assets/portraits/giant-wasp-dawn-orchard-dive-initiative.png',
      },
      {
        id: 'storm-watchtower-guard',
        label: '雷塔守巢',
        tokenPortrait: '/assets/portraits/giant-wasp-storm-watchtower-guard-token.png',
        initiativePortrait: '/assets/portraits/giant-wasp-storm-watchtower-guard-initiative.png',
      },
    ],
  },
  'giant-weasel': {
    emoji: '🦦',
    color: '#92400e',
    tokenPortrait: '/assets/portraits/giant-weasel-autumn-log-leap-token.png',
    initiativePortrait: '/assets/portraits/giant-weasel-autumn-log-leap-initiative.png',
    visualVariants: [
      {
        id: 'autumn-log-leap',
        label: '秋林飞袭',
        tokenPortrait: '/assets/portraits/giant-weasel-autumn-log-leap-token.png',
        initiativePortrait: '/assets/portraits/giant-weasel-autumn-log-leap-initiative.png',
      },
      {
        id: 'moonlit-monastery-scent',
        label: '月寺嗅踪',
        tokenPortrait: '/assets/portraits/giant-weasel-moonlit-monastery-scent-token.png',
        initiativePortrait: '/assets/portraits/giant-weasel-moonlit-monastery-scent-initiative.png',
      },
    ],
  },
  'giant-wolf-spider': {
    emoji: '🕷️',
    color: '#57534e',
    tokenPortrait: '/assets/portraits/giant-wolf-spider-storm-prairie-stalk-token.png',
    initiativePortrait: '/assets/portraits/giant-wolf-spider-storm-prairie-stalk-initiative.png',
    visualVariants: [
      {
        id: 'storm-prairie-stalk',
        label: '暮原伏猎',
        tokenPortrait: '/assets/portraits/giant-wolf-spider-storm-prairie-stalk-token.png',
        initiativePortrait: '/assets/portraits/giant-wolf-spider-storm-prairie-stalk-initiative.png',
      },
      {
        id: 'silver-mine-wall-descent',
        label: '银矿壁降',
        tokenPortrait: '/assets/portraits/giant-wolf-spider-silver-mine-wall-descent-token.png',
        initiativePortrait: '/assets/portraits/giant-wolf-spider-silver-mine-wall-descent-initiative.png',
      },
    ],
  },
  'gibbering-mouther': {
    emoji: '👁️',
    color: '#7e22ce',
    tokenPortrait: '/assets/portraits/gibbering-mouther-fungal-cavern-warp-token.png',
    initiativePortrait: '/assets/portraits/gibbering-mouther-fungal-cavern-warp-initiative.png',
    visualVariants: [
      {
        id: 'fungal-cavern-warp',
        label: '菌窟乱语',
        tokenPortrait: '/assets/portraits/gibbering-mouther-fungal-cavern-warp-token.png',
        initiativePortrait: '/assets/portraits/gibbering-mouther-fungal-cavern-warp-initiative.png',
      },
      {
        id: 'moonlit-flooded-temple-spit',
        label: '月殿盲唾',
        tokenPortrait: '/assets/portraits/gibbering-mouther-moonlit-flooded-temple-spit-token.png',
        initiativePortrait: '/assets/portraits/gibbering-mouther-moonlit-flooded-temple-spit-initiative.png',
      },
    ],
  },
  glabrezu: {
    emoji: '👹',
    color: '#7f1d1d',
    tokenPortrait: '/assets/portraits/glabrezu-abyssal-obsidian-hall-token.png',
    initiativePortrait: '/assets/portraits/glabrezu-abyssal-obsidian-hall-initiative.png',
    visualVariants: [
      {
        id: 'abyssal-obsidian-hall',
        label: '熔殿钳行',
        tokenPortrait: '/assets/portraits/glabrezu-abyssal-obsidian-hall-token.png',
        initiativePortrait: '/assets/portraits/glabrezu-abyssal-obsidian-hall-initiative.png',
      },
      {
        id: 'moonlit-observatory-darkness',
        label: '月台暗咒',
        tokenPortrait: '/assets/portraits/glabrezu-moonlit-observatory-darkness-token.png',
        initiativePortrait: '/assets/portraits/glabrezu-moonlit-observatory-darkness-initiative.png',
      },
    ],
  },
  gladiator: {
    emoji: '⚔️',
    color: '#b45309',
    tokenPortrait: '/assets/portraits/gladiator-sunlit-arena-veteran-token.png',
    initiativePortrait: '/assets/portraits/gladiator-sunlit-arena-veteran-initiative.png',
    visualVariants: [
      {
        id: 'sunlit-arena-veteran',
        label: '日场矛盾',
        tokenPortrait: '/assets/portraits/gladiator-sunlit-arena-veteran-token.png',
        initiativePortrait: '/assets/portraits/gladiator-sunlit-arena-veteran-initiative.png',
      },
      {
        id: 'storm-cliff-shield-bash',
        label: '雷崖盾冲',
        tokenPortrait: '/assets/portraits/gladiator-storm-cliff-shield-bash-token.png',
        initiativePortrait: '/assets/portraits/gladiator-storm-cliff-shield-bash-initiative.png',
      },
    ],
  },
  gnoll: {
    emoji: '🐕',
    color: '#92400e',
    tokenPortrait: '/assets/portraits/gnoll-sunset-savanna-spear-charge-token.png',
    initiativePortrait: '/assets/portraits/gnoll-sunset-savanna-spear-charge-initiative.png',
    visualVariants: [
      {
        id: 'sunset-savanna-spear-charge',
        label: '夕原矛袭',
        tokenPortrait: '/assets/portraits/gnoll-sunset-savanna-spear-charge-token.png',
        initiativePortrait: '/assets/portraits/gnoll-sunset-savanna-spear-charge-initiative.png',
      },
      {
        id: 'moonlit-badlands-longbow',
        label: '月岭弓伏',
        tokenPortrait: '/assets/portraits/gnoll-moonlit-badlands-longbow-token.png',
        initiativePortrait: '/assets/portraits/gnoll-moonlit-badlands-longbow-initiative.png',
      },
    ],
  },
  goat: {
    emoji: '🐐',
    color: '#78716c',
    tokenPortrait: '/assets/portraits/goat-alpine-meadow-charge-token.png',
    initiativePortrait: '/assets/portraits/goat-alpine-meadow-charge-initiative.png',
    visualVariants: [
      {
        id: 'alpine-meadow-charge',
        label: '晨岭冲角',
        tokenPortrait: '/assets/portraits/goat-alpine-meadow-charge-token.png',
        initiativePortrait: '/assets/portraits/goat-alpine-meadow-charge-initiative.png',
      },
      {
        id: 'misty-cliff-surefoot',
        label: '雾崖稳步',
        tokenPortrait: '/assets/portraits/goat-misty-cliff-surefoot-token.png',
        initiativePortrait: '/assets/portraits/goat-misty-cliff-surefoot-initiative.png',
      },
    ],
  },
  'gold-dragon-wyrmling': {
    emoji: '🐉',
    color: '#ca8a04',
    tokenPortrait: '/assets/portraits/gold-dragon-wyrmling-sunrise-terrace-flight-token.png',
    initiativePortrait: '/assets/portraits/gold-dragon-wyrmling-sunrise-terrace-flight-initiative.png',
    visualVariants: [
      {
        id: 'sunrise-terrace-flight',
        label: '晨岚翔游',
        tokenPortrait: '/assets/portraits/gold-dragon-wyrmling-sunrise-terrace-flight-token.png',
        initiativePortrait: '/assets/portraits/gold-dragon-wyrmling-sunrise-terrace-flight-initiative.png',
      },
      {
        id: 'coral-palace-swim',
        label: '珊宫潜游',
        tokenPortrait: '/assets/portraits/gold-dragon-wyrmling-coral-palace-swim-token.png',
        initiativePortrait: '/assets/portraits/gold-dragon-wyrmling-coral-palace-swim-initiative.png',
      },
    ],
  },
  gorgon: {
    emoji: '🐂',
    color: '#374151',
    tokenPortrait: '/assets/portraits/gorgon-sunset-basalt-charge-token.png',
    initiativePortrait: '/assets/portraits/gorgon-sunset-basalt-charge-initiative.png',
    visualVariants: [
      {
        id: 'sunset-basalt-charge',
        label: '夕岩践踏',
        tokenPortrait: '/assets/portraits/gorgon-sunset-basalt-charge-token.png',
        initiativePortrait: '/assets/portraits/gorgon-sunset-basalt-charge-initiative.png',
      },
      {
        id: 'moonlit-foundry-petrify',
        label: '月炉石息',
        tokenPortrait: '/assets/portraits/gorgon-moonlit-foundry-petrify-token.png',
        initiativePortrait: '/assets/portraits/gorgon-moonlit-foundry-petrify-initiative.png',
      },
    ],
  },
  'gray-ooze': {
    emoji: '🫧',
    color: '#6b7280',
    tokenPortrait: '/assets/portraits/gray-ooze-torchlit-dungeon-disguise-token.png',
    initiativePortrait: '/assets/portraits/gray-ooze-torchlit-dungeon-disguise-initiative.png',
    visualVariants: [
      {
        id: 'torchlit-dungeon-disguise',
        label: '火牢伪岩',
        tokenPortrait: '/assets/portraits/gray-ooze-torchlit-dungeon-disguise-token.png',
        initiativePortrait: '/assets/portraits/gray-ooze-torchlit-dungeon-disguise-initiative.png',
      },
      {
        id: 'flooded-cistern-corrosion',
        label: '寒池蚀闸',
        tokenPortrait: '/assets/portraits/gray-ooze-flooded-cistern-corrosion-token.png',
        initiativePortrait: '/assets/portraits/gray-ooze-flooded-cistern-corrosion-initiative.png',
      },
    ],
  },
  'green-dragon-wyrmling': {
    emoji: '🐉',
    color: '#15803d',
    tokenPortrait: '/assets/portraits/green-dragon-wyrmling-rainforest-canopy-glide-token.png',
    initiativePortrait: '/assets/portraits/green-dragon-wyrmling-rainforest-canopy-glide-initiative.png',
    visualVariants: [
      {
        id: 'rainforest-canopy-glide',
        label: '雨冠潜翔',
        tokenPortrait: '/assets/portraits/green-dragon-wyrmling-rainforest-canopy-glide-token.png',
        initiativePortrait: '/assets/portraits/green-dragon-wyrmling-rainforest-canopy-glide-initiative.png',
      },
      {
        id: 'moonlit-mangrove-stalk',
        label: '月泽潜行',
        tokenPortrait: '/assets/portraits/green-dragon-wyrmling-moonlit-mangrove-stalk-token.png',
        initiativePortrait: '/assets/portraits/green-dragon-wyrmling-moonlit-mangrove-stalk-initiative.png',
      },
    ],
  },
  'green-hag': {
    emoji: '🧙‍♀️',
    color: '#3f6212',
    tokenPortrait: '/assets/portraits/green-hag-flooded-cypress-stalk-token.png',
    initiativePortrait: '/assets/portraits/green-hag-flooded-cypress-stalk-initiative.png',
    visualVariants: [
      {
        id: 'flooded-cypress-stalk',
        label: '泽林潜猎',
        tokenPortrait: '/assets/portraits/green-hag-flooded-cypress-stalk-token.png',
        initiativePortrait: '/assets/portraits/green-hag-flooded-cypress-stalk-initiative.png',
      },
      {
        id: 'moonlit-manor-illusion',
        label: '月馆幻容',
        tokenPortrait: '/assets/portraits/green-hag-moonlit-manor-illusion-token.png',
        initiativePortrait: '/assets/portraits/green-hag-moonlit-manor-illusion-initiative.png',
      },
    ],
  },
  grick: {
    emoji: '🪱',
    color: '#57534e',
    tokenPortrait: '/assets/portraits/grick-amber-crystal-ambush-token.png',
    initiativePortrait: '/assets/portraits/grick-amber-crystal-ambush-initiative.png',
    visualVariants: [
      {
        id: 'amber-crystal-ambush',
        label: '晶窟伏袭',
        tokenPortrait: '/assets/portraits/grick-amber-crystal-ambush-token.png',
        initiativePortrait: '/assets/portraits/grick-amber-crystal-ambush-initiative.png',
      },
      {
        id: 'blue-cistern-ceiling',
        label: '寒池倒伏',
        tokenPortrait: '/assets/portraits/grick-blue-cistern-ceiling-token.png',
        initiativePortrait: '/assets/portraits/grick-blue-cistern-ceiling-initiative.png',
      },
    ],
  },
  griffon: {
    emoji: '🦅',
    color: '#92400e',
    tokenPortrait: '/assets/portraits/griffon-alpine-sunrise-flight-token.png',
    initiativePortrait: '/assets/portraits/griffon-alpine-sunrise-flight-initiative.png',
    visualVariants: [
      {
        id: 'alpine-sunrise-flight',
        label: '雪岭晨翔',
        tokenPortrait: '/assets/portraits/griffon-alpine-sunrise-flight-token.png',
        initiativePortrait: '/assets/portraits/griffon-alpine-sunrise-flight-initiative.png',
      },
      {
        id: 'storm-amphitheater-guard',
        label: '雷场镇守',
        tokenPortrait: '/assets/portraits/griffon-storm-amphitheater-guard-token.png',
        initiativePortrait: '/assets/portraits/griffon-storm-amphitheater-guard-initiative.png',
      },
    ],
  },
  grimlock: {
    emoji: '👂',
    color: '#52525b',
    tokenPortrait: '/assets/portraits/grimlock-basalt-cave-charge-token.png',
    initiativePortrait: '/assets/portraits/grimlock-basalt-cave-charge-initiative.png',
    visualVariants: [
      {
        id: 'basalt-cave-charge',
        label: '岩窟骨棒',
        tokenPortrait: '/assets/portraits/grimlock-basalt-cave-charge-token.png',
        initiativePortrait: '/assets/portraits/grimlock-basalt-cave-charge-initiative.png',
      },
      {
        id: 'blue-grotto-tracker',
        label: '寒穴追迹',
        tokenPortrait: '/assets/portraits/grimlock-blue-grotto-tracker-token.png',
        initiativePortrait: '/assets/portraits/grimlock-blue-grotto-tracker-initiative.png',
      },
    ],
  },
  guard: {
    emoji: '🛡️',
    color: '#334155',
    tokenPortrait: '/assets/portraits/guard-rainy-city-gate-token.png',
    initiativePortrait: '/assets/portraits/guard-rainy-city-gate-initiative.png',
    visualVariants: [
      {
        id: 'rainy-city-gate',
        label: '雨门执勤',
        tokenPortrait: '/assets/portraits/guard-rainy-city-gate-token.png',
        initiativePortrait: '/assets/portraits/guard-rainy-city-gate-initiative.png',
      },
      {
        id: 'night-harbor-patrol',
        label: '夜港巡防',
        tokenPortrait: '/assets/portraits/guard-night-harbor-patrol-token.png',
        initiativePortrait: '/assets/portraits/guard-night-harbor-patrol-initiative.png',
      },
    ],
  },
  'guardian-naga': {
    emoji: '🐍',
    color: '#0f766e',
    tokenPortrait: '/assets/portraits/guardian-naga-sun-sanctuary-sentinel-token.png',
    initiativePortrait: '/assets/portraits/guardian-naga-sun-sanctuary-sentinel-initiative.png',
    visualVariants: [
      {
        id: 'sun-sanctuary-sentinel',
        label: '日殿镇守',
        tokenPortrait: '/assets/portraits/guardian-naga-sun-sanctuary-sentinel-token.png',
        initiativePortrait: '/assets/portraits/guardian-naga-sun-sanctuary-sentinel-initiative.png',
      },
      {
        id: 'moonlit-jungle-strike',
        label: '月林毒牙',
        tokenPortrait: '/assets/portraits/guardian-naga-moonlit-jungle-strike-token.png',
        initiativePortrait: '/assets/portraits/guardian-naga-moonlit-jungle-strike-initiative.png',
      },
    ],
  },
  gynosphinx: {
    emoji: '🦁',
    color: '#a16207',
    tokenPortrait: '/assets/portraits/gynosphinx-golden-archive-riddler-token.png',
    initiativePortrait: '/assets/portraits/gynosphinx-golden-archive-riddler-initiative.png',
    visualVariants: [
      {
        id: 'golden-archive-riddler',
        label: '金面秘库',
        tokenPortrait: '/assets/portraits/gynosphinx-golden-archive-riddler-token.png',
        initiativePortrait: '/assets/portraits/gynosphinx-golden-archive-riddler-initiative.png',
      },
      {
        id: 'desert-observatory-flight',
        label: '暮空星台',
        tokenPortrait: '/assets/portraits/gynosphinx-desert-observatory-flight-token.png',
        initiativePortrait: '/assets/portraits/gynosphinx-desert-observatory-flight-initiative.png',
      },
    ],
  },
  'half-red-dragon-veteran': {
    emoji: '🐲',
    color: '#991b1b',
    tokenPortrait: '/assets/portraits/half-red-dragon-veteran-volcanic-dual-blades-token.png',
    initiativePortrait: '/assets/portraits/half-red-dragon-veteran-volcanic-dual-blades-initiative.png',
    visualVariants: [
      {
        id: 'volcanic-dual-blades',
        label: '熔堡双刃',
        tokenPortrait: '/assets/portraits/half-red-dragon-veteran-volcanic-dual-blades-token.png',
        initiativePortrait: '/assets/portraits/half-red-dragon-veteran-volcanic-dual-blades-initiative.png',
      },
      {
        id: 'frozen-crossbow-watch',
        label: '霜垒重弩',
        tokenPortrait: '/assets/portraits/half-red-dragon-veteran-frozen-crossbow-watch-token.png',
        initiativePortrait: '/assets/portraits/half-red-dragon-veteran-frozen-crossbow-watch-initiative.png',
      },
    ],
  },
  harpy: {
    emoji: '🪶',
    color: '#44403c',
    tokenPortrait: '/assets/portraits/harpy-storm-coast-luring-song-token.png',
    initiativePortrait: '/assets/portraits/harpy-storm-coast-luring-song-initiative.png',
    visualVariants: [
      {
        id: 'storm-coast-luring-song',
        label: '风崖诱歌',
        tokenPortrait: '/assets/portraits/harpy-storm-coast-luring-song-token.png',
        initiativePortrait: '/assets/portraits/harpy-storm-coast-luring-song-initiative.png',
      },
      {
        id: 'moonlit-village-club-raid',
        label: '月村棍袭',
        tokenPortrait: '/assets/portraits/harpy-moonlit-village-club-raid-token.png',
        initiativePortrait: '/assets/portraits/harpy-moonlit-village-club-raid-initiative.png',
      },
    ],
  },
  hawk: {
    emoji: '🦅',
    color: '#92400e',
    tokenPortrait: '/assets/portraits/hawk-autumn-river-soar-token.png',
    initiativePortrait: '/assets/portraits/hawk-autumn-river-soar-initiative.png',
    visualVariants: [
      {
        id: 'autumn-river-soar',
        label: '秋河巡翔',
        tokenPortrait: '/assets/portraits/hawk-autumn-river-soar-token.png',
        initiativePortrait: '/assets/portraits/hawk-autumn-river-soar-initiative.png',
      },
      {
        id: 'snow-pine-watch',
        label: '雪松锐目',
        tokenPortrait: '/assets/portraits/hawk-snow-pine-watch-token.png',
        initiativePortrait: '/assets/portraits/hawk-snow-pine-watch-initiative.png',
      },
    ],
  },
  'hell-hound': {
    emoji: '🐕',
    color: '#b91c1c',
    tokenPortrait: '/assets/portraits/hell-hound-infernal-bridge-charge-token.png',
    initiativePortrait: '/assets/portraits/hell-hound-infernal-bridge-charge-initiative.png',
    visualVariants: [
      {
        id: 'infernal-bridge-charge',
        label: '狱桥奔袭',
        tokenPortrait: '/assets/portraits/hell-hound-infernal-bridge-charge-token.png',
        initiativePortrait: '/assets/portraits/hell-hound-infernal-bridge-charge-initiative.png',
      },
      {
        id: 'frozen-necropolis-firebreath',
        label: '霜墓炎息',
        tokenPortrait: '/assets/portraits/hell-hound-frozen-necropolis-firebreath-token.png',
        initiativePortrait: '/assets/portraits/hell-hound-frozen-necropolis-firebreath-initiative.png',
      },
    ],
  },
  hezrou: {
    emoji: '🐸',
    color: '#365314',
    tokenPortrait: '/assets/portraits/hezrou-fetid-swamp-emergence-token.png',
    initiativePortrait: '/assets/portraits/hezrou-fetid-swamp-emergence-initiative.png',
    visualVariants: [
      {
        id: 'fetid-swamp-emergence',
        label: '腐泽现身',
        tokenPortrait: '/assets/portraits/hezrou-fetid-swamp-emergence-token.png',
        initiativePortrait: '/assets/portraits/hezrou-fetid-swamp-emergence-initiative.png',
      },
      {
        id: 'blue-sewer-rampage',
        label: '寒渠破壁',
        tokenPortrait: '/assets/portraits/hezrou-blue-sewer-rampage-token.png',
        initiativePortrait: '/assets/portraits/hezrou-blue-sewer-rampage-initiative.png',
      },
    ],
  },
  'hill-giant': {
    emoji: '🪨',
    color: '#78350f',
    tokenPortrait: '/assets/portraits/hill-giant-storm-hamlet-greatclub-token.png',
    initiativePortrait: '/assets/portraits/hill-giant-storm-hamlet-greatclub-initiative.png',
    visualVariants: [
      {
        id: 'storm-hamlet-greatclub',
        label: '雨岭巨棒',
        tokenPortrait: '/assets/portraits/hill-giant-storm-hamlet-greatclub-token.png',
        initiativePortrait: '/assets/portraits/hill-giant-storm-hamlet-greatclub-initiative.png',
      },
      {
        id: 'sunlit-quarry-rockthrow',
        label: '晴矿投石',
        tokenPortrait: '/assets/portraits/hill-giant-sunlit-quarry-rockthrow-token.png',
        initiativePortrait: '/assets/portraits/hill-giant-sunlit-quarry-rockthrow-initiative.png',
      },
    ],
  },
  hippogriff: {
    emoji: '🪽',
    color: '#78716c',
    tokenPortrait: '/assets/portraits/hippogriff-alpine-sunrise-flight-token.png',
    initiativePortrait: '/assets/portraits/hippogriff-alpine-sunrise-flight-initiative.png',
    visualVariants: [
      {
        id: 'alpine-sunrise-flight',
        label: '晨岭腾飞',
        tokenPortrait: '/assets/portraits/hippogriff-alpine-sunrise-flight-token.png',
        initiativePortrait: '/assets/portraits/hippogriff-alpine-sunrise-flight-initiative.png',
      },
      {
        id: 'moonlit-sea-ruins',
        label: '月海遗迹',
        tokenPortrait: '/assets/portraits/hippogriff-moonlit-sea-ruins-token.png',
        initiativePortrait: '/assets/portraits/hippogriff-moonlit-sea-ruins-initiative.png',
      },
    ],
  },
  hobgoblin: {
    emoji: '⚔️',
    color: '#7f1d1d',
    tokenPortrait: '/assets/portraits/hobgoblin-mountain-fortress-blade-token.png',
    initiativePortrait: '/assets/portraits/hobgoblin-mountain-fortress-blade-initiative.png',
    visualVariants: [
      {
        id: 'mountain-fortress-blade',
        label: '山堡剑盾',
        tokenPortrait: '/assets/portraits/hobgoblin-mountain-fortress-blade-token.png',
        initiativePortrait: '/assets/portraits/hobgoblin-mountain-fortress-blade-initiative.png',
      },
      {
        id: 'rain-ravine-longbow',
        label: '雨峡长弓',
        tokenPortrait: '/assets/portraits/hobgoblin-rain-ravine-longbow-token.png',
        initiativePortrait: '/assets/portraits/hobgoblin-rain-ravine-longbow-initiative.png',
      },
    ],
  },
  homunculus: {
    emoji: '⚙️',
    color: '#92400e',
    tokenPortrait: '/assets/portraits/homunculus-alchemist-workshop-courier-token.png',
    initiativePortrait: '/assets/portraits/homunculus-alchemist-workshop-courier-initiative.png',
    visualVariants: [
      {
        id: 'alchemist-workshop-courier',
        label: '炼坊信使',
        tokenPortrait: '/assets/portraits/homunculus-alchemist-workshop-courier-token.png',
        initiativePortrait: '/assets/portraits/homunculus-alchemist-workshop-courier-initiative.png',
      },
      {
        id: 'rainy-gothic-rooftop',
        label: '雨夜檐哨',
        tokenPortrait: '/assets/portraits/homunculus-rainy-gothic-rooftop-token.png',
        initiativePortrait: '/assets/portraits/homunculus-rainy-gothic-rooftop-initiative.png',
      },
    ],
  },
  'horned-devil': {
    emoji: '😈',
    color: '#991b1b',
    tokenPortrait: '/assets/portraits/horned-devil-infernal-battlement-fork-token.png',
    initiativePortrait: '/assets/portraits/horned-devil-infernal-battlement-fork-initiative.png',
    visualVariants: [
      {
        id: 'infernal-battlement-fork',
        label: '狱垒钢叉',
        tokenPortrait: '/assets/portraits/horned-devil-infernal-battlement-fork-token.png',
        initiativePortrait: '/assets/portraits/horned-devil-infernal-battlement-fork-initiative.png',
      },
      {
        id: 'moonlit-cathedral-hurl-flame',
        label: '月堂掷焰',
        tokenPortrait: '/assets/portraits/horned-devil-moonlit-cathedral-hurl-flame-token.png',
        initiativePortrait: '/assets/portraits/horned-devil-moonlit-cathedral-hurl-flame-initiative.png',
      },
    ],
  },
  'hunter-shark': {
    emoji: '🦈',
    color: '#0369a1',
    tokenPortrait: '/assets/portraits/hunter-shark-sunken-merchant-patrol-token.png',
    initiativePortrait: '/assets/portraits/hunter-shark-sunken-merchant-patrol-initiative.png',
    visualVariants: [
      {
        id: 'sunken-merchant-patrol',
        label: '沉船巡猎',
        tokenPortrait: '/assets/portraits/hunter-shark-sunken-merchant-patrol-token.png',
        initiativePortrait: '/assets/portraits/hunter-shark-sunken-merchant-patrol-initiative.png',
      },
      {
        id: 'kelp-canyon-charge',
        label: '藻峡冲噬',
        tokenPortrait: '/assets/portraits/hunter-shark-kelp-canyon-charge-token.png',
        initiativePortrait: '/assets/portraits/hunter-shark-kelp-canyon-charge-initiative.png',
      },
    ],
  },
  hydra: {
    emoji: '🐉',
    color: '#14532d',
    tokenPortrait: '/assets/portraits/hydra-drowned-swamp-five-heads-token.png',
    initiativePortrait: '/assets/portraits/hydra-drowned-swamp-five-heads-initiative.png',
    visualVariants: [
      {
        id: 'drowned-swamp-five-heads',
        label: '沉泽五首',
        tokenPortrait: '/assets/portraits/hydra-drowned-swamp-five-heads-token.png',
        initiativePortrait: '/assets/portraits/hydra-drowned-swamp-five-heads-initiative.png',
      },
      {
        id: 'moonlit-sea-temple',
        label: '月海神殿',
        tokenPortrait: '/assets/portraits/hydra-moonlit-sea-temple-token.png',
        initiativePortrait: '/assets/portraits/hydra-moonlit-sea-temple-initiative.png',
      },
    ],
  },
  hyena: {
    emoji: '🐾',
    color: '#854d0e',
    tokenPortrait: '/assets/portraits/hyena-sunlit-savanna-run-token.png',
    initiativePortrait: '/assets/portraits/hyena-sunlit-savanna-run-initiative.png',
    visualVariants: [
      {
        id: 'sunlit-savanna-run',
        label: '旷野疾奔',
        tokenPortrait: '/assets/portraits/hyena-sunlit-savanna-run-token.png',
        initiativePortrait: '/assets/portraits/hyena-sunlit-savanna-run-initiative.png',
      },
      {
        id: 'moonlit-caravanserai',
        label: '月驿警戒',
        tokenPortrait: '/assets/portraits/hyena-moonlit-caravanserai-token.png',
        initiativePortrait: '/assets/portraits/hyena-moonlit-caravanserai-initiative.png',
      },
    ],
  },
  'ice-devil': {
    emoji: '🦂',
    color: '#0e7490',
    tokenPortrait: '/assets/portraits/ice-devil-glacial-canyon-stalker-token.png',
    initiativePortrait: '/assets/portraits/ice-devil-glacial-canyon-stalker-initiative.png',
    visualVariants: [
      {
        id: 'glacial-canyon-stalker',
        label: '冰峡潜猎',
        tokenPortrait: '/assets/portraits/ice-devil-glacial-canyon-stalker-token.png',
        initiativePortrait: '/assets/portraits/ice-devil-glacial-canyon-stalker-initiative.png',
      },
      {
        id: 'frozen-city-ice-wall',
        label: '冻城冰墙',
        tokenPortrait: '/assets/portraits/ice-devil-frozen-city-ice-wall-token.png',
        initiativePortrait: '/assets/portraits/ice-devil-frozen-city-ice-wall-initiative.png',
      },
    ],
  },
  'ice-mephit': {
    emoji: '❄️',
    color: '#38bdf8',
    tokenPortrait: '/assets/portraits/ice-mephit-glacial-cavern-frost-breath-token.png',
    initiativePortrait: '/assets/portraits/ice-mephit-glacial-cavern-frost-breath-initiative.png',
    visualVariants: [
      {
        id: 'glacial-cavern-frost-breath',
        label: '冰窟寒息',
        tokenPortrait: '/assets/portraits/ice-mephit-glacial-cavern-frost-breath-token.png',
        initiativePortrait: '/assets/portraits/ice-mephit-glacial-cavern-frost-breath-initiative.png',
      },
      {
        id: 'alpine-temple-ambush',
        label: '雪山神殿伏击',
        tokenPortrait: '/assets/portraits/ice-mephit-alpine-temple-ambush-token.png',
        initiativePortrait: '/assets/portraits/ice-mephit-alpine-temple-ambush-initiative.png',
      },
    ],
  },
  imp: {
    emoji: '😈',
    color: '#991b1b',
    tokenPortrait: '/assets/portraits/imp-infernal-archive-key-thief-token.png',
    initiativePortrait: '/assets/portraits/imp-infernal-archive-key-thief-initiative.png',
    visualVariants: [
      {
        id: 'infernal-archive-key-thief',
        label: '地狱档案室窃贼',
        tokenPortrait: '/assets/portraits/imp-infernal-archive-key-thief-token.png',
        initiativePortrait: '/assets/portraits/imp-infernal-archive-key-thief-initiative.png',
      },
      {
        id: 'moonlit-alley-flight',
        label: '月夜巷道飞行',
        tokenPortrait: '/assets/portraits/imp-moonlit-alley-flight-token.png',
        initiativePortrait: '/assets/portraits/imp-moonlit-alley-flight-initiative.png',
      },
    ],
  },
  'invisible-stalker': {
    emoji: '🌪️',
    color: '#64748b',
    tokenPortrait: '/assets/portraits/invisible-stalker-desert-temple-slam-token.png',
    initiativePortrait: '/assets/portraits/invisible-stalker-desert-temple-slam-initiative.png',
    visualVariants: [
      {
        id: 'desert-temple-slam',
        label: '沙漠神殿猛击',
        tokenPortrait: '/assets/portraits/invisible-stalker-desert-temple-slam-token.png',
        initiativePortrait: '/assets/portraits/invisible-stalker-desert-temple-slam-initiative.png',
      },
      {
        id: 'storm-harbor-pursuit',
        label: '暴雨港城追猎',
        tokenPortrait: '/assets/portraits/invisible-stalker-storm-harbor-pursuit-token.png',
        initiativePortrait: '/assets/portraits/invisible-stalker-storm-harbor-pursuit-initiative.png',
      },
    ],
  },
  'iron-golem': {
    emoji: '⚙️',
    color: '#475569',
    tokenPortrait: '/assets/portraits/iron-golem-royal-foundry-advance-token.png',
    initiativePortrait: '/assets/portraits/iron-golem-royal-foundry-advance-initiative.png',
    visualVariants: [
      {
        id: 'royal-foundry-advance',
        label: '王家铸造厂进击',
        tokenPortrait: '/assets/portraits/iron-golem-royal-foundry-advance-token.png',
        initiativePortrait: '/assets/portraits/iron-golem-royal-foundry-advance-initiative.png',
      },
      {
        id: 'storm-citadel-poison-breath',
        label: '风暴堡垒毒息',
        tokenPortrait: '/assets/portraits/iron-golem-storm-citadel-poison-breath-token.png',
        initiativePortrait: '/assets/portraits/iron-golem-storm-citadel-poison-breath-initiative.png',
      },
    ],
  },
  jackal: {
    emoji: '🐕',
    color: '#a16207',
    tokenPortrait: '/assets/portraits/jackal-sunlit-savanna-sprint-token.png',
    initiativePortrait: '/assets/portraits/jackal-sunlit-savanna-sprint-initiative.png',
    visualVariants: [
      {
        id: 'sunlit-savanna-sprint',
        label: '日照草原疾奔',
        tokenPortrait: '/assets/portraits/jackal-sunlit-savanna-sprint-token.png',
        initiativePortrait: '/assets/portraits/jackal-sunlit-savanna-sprint-initiative.png',
      },
      {
        id: 'moonlit-necropolis-howl',
        label: '月夜墓城长嚎',
        tokenPortrait: '/assets/portraits/jackal-moonlit-necropolis-howl-token.png',
        initiativePortrait: '/assets/portraits/jackal-moonlit-necropolis-howl-initiative.png',
      },
    ],
  },
  'killer-whale': {
    emoji: '🐋',
    color: '#0f172a',
    tokenPortrait: '/assets/portraits/killer-whale-polar-canyon-charge-token.png',
    initiativePortrait: '/assets/portraits/killer-whale-polar-canyon-charge-initiative.png',
    visualVariants: [
      {
        id: 'polar-canyon-charge',
        label: '极地冰峡冲锋',
        tokenPortrait: '/assets/portraits/killer-whale-polar-canyon-charge-token.png',
        initiativePortrait: '/assets/portraits/killer-whale-polar-canyon-charge-initiative.png',
      },
      {
        id: 'storm-sea-breach',
        label: '风暴海跃浪',
        tokenPortrait: '/assets/portraits/killer-whale-storm-sea-breach-token.png',
        initiativePortrait: '/assets/portraits/killer-whale-storm-sea-breach-initiative.png',
      },
    ],
  },
  knight: {
    emoji: '⚔️',
    color: '#334155',
    tokenPortrait: '/assets/portraits/knight-battered-castle-greatsword-token.png',
    initiativePortrait: '/assets/portraits/knight-battered-castle-greatsword-initiative.png',
    visualVariants: [
      {
        id: 'battered-castle-greatsword',
        label: '破城巨剑',
        tokenPortrait: '/assets/portraits/knight-battered-castle-greatsword-token.png',
        initiativePortrait: '/assets/portraits/knight-battered-castle-greatsword-initiative.png',
      },
      {
        id: 'snow-watchtower-crossbow',
        label: '雪塔重弩',
        tokenPortrait: '/assets/portraits/knight-snow-watchtower-crossbow-token.png',
        initiativePortrait: '/assets/portraits/knight-snow-watchtower-crossbow-initiative.png',
      },
    ],
  },
  kraken: {
    emoji: '🐙',
    color: '#0f766e',
    tokenPortrait: '/assets/portraits/kraken-storm-fortress-siege-token.png',
    initiativePortrait: '/assets/portraits/kraken-storm-fortress-siege-initiative.png',
    visualVariants: [
      {
        id: 'storm-fortress-siege',
        label: '风暴海堡围攻',
        tokenPortrait: '/assets/portraits/kraken-storm-fortress-siege-token.png',
        initiativePortrait: '/assets/portraits/kraken-storm-fortress-siege-initiative.png',
      },
      {
        id: 'drowned-city-lightning',
        label: '沉城雷暴',
        tokenPortrait: '/assets/portraits/kraken-drowned-city-lightning-token.png',
        initiativePortrait: '/assets/portraits/kraken-drowned-city-lightning-initiative.png',
      },
    ],
  },
  lamia: {
    emoji: '🦁',
    color: '#a16207',
    tokenPortrait: '/assets/portraits/lamia-sunset-palace-prowl-token.png',
    initiativePortrait: '/assets/portraits/lamia-sunset-palace-prowl-initiative.png',
    visualVariants: [
      {
        id: 'sunset-palace-prowl',
        label: '夕照王宫潜行',
        tokenPortrait: '/assets/portraits/lamia-sunset-palace-prowl-token.png',
        initiativePortrait: '/assets/portraits/lamia-sunset-palace-prowl-initiative.png',
      },
      {
        id: 'moonlit-canyon-touch',
        label: '月峡迷醉之触',
        tokenPortrait: '/assets/portraits/lamia-moonlit-canyon-touch-token.png',
        initiativePortrait: '/assets/portraits/lamia-moonlit-canyon-touch-initiative.png',
      },
    ],
  },
  lemure: {
    emoji: '🫠',
    color: '#78350f',
    tokenPortrait: '/assets/portraits/lemure-hellish-mudflat-lurch-token.png',
    initiativePortrait: '/assets/portraits/lemure-hellish-mudflat-lurch-initiative.png',
    visualVariants: [
      {
        id: 'hellish-mudflat-lurch',
        label: '地狱泥滩蹒跚',
        tokenPortrait: '/assets/portraits/lemure-hellish-mudflat-lurch-token.png',
        initiativePortrait: '/assets/portraits/lemure-hellish-mudflat-lurch-initiative.png',
      },
      {
        id: 'infernal-foundry-crawl',
        label: '炼狱铸厂爬行',
        tokenPortrait: '/assets/portraits/lemure-infernal-foundry-crawl-token.png',
        initiativePortrait: '/assets/portraits/lemure-infernal-foundry-crawl-initiative.png',
      },
    ],
  },
  lich: {
    emoji: '💀',
    color: '#312e81',
    tokenPortrait: '/assets/portraits/lich-royal-crypt-paralyzing-touch-token.png',
    initiativePortrait: '/assets/portraits/lich-royal-crypt-paralyzing-touch-initiative.png',
    visualVariants: [
      {
        id: 'royal-crypt-paralyzing-touch',
        label: '王陵麻痹之触',
        tokenPortrait: '/assets/portraits/lich-royal-crypt-paralyzing-touch-token.png',
        initiativePortrait: '/assets/portraits/lich-royal-crypt-paralyzing-touch-initiative.png',
      },
      {
        id: 'mountaintop-observatory-ray',
        label: '山巅星台射线',
        tokenPortrait: '/assets/portraits/lich-mountaintop-observatory-ray-token.png',
        initiativePortrait: '/assets/portraits/lich-mountaintop-observatory-ray-initiative.png',
      },
    ],
  },
  lion: {
    emoji: '🦁',
    color: '#ca8a04',
    tokenPortrait: '/assets/portraits/lion-sunlit-savanna-pounce-token.png',
    initiativePortrait: '/assets/portraits/lion-sunlit-savanna-pounce-initiative.png',
    visualVariants: [
      {
        id: 'sunlit-savanna-pounce',
        label: '日照草原扑跃',
        tokenPortrait: '/assets/portraits/lion-sunlit-savanna-pounce-token.png',
        initiativePortrait: '/assets/portraits/lion-sunlit-savanna-pounce-initiative.png',
      },
      {
        id: 'moonlit-amphitheater-guard',
        label: '月夜剧场守望',
        tokenPortrait: '/assets/portraits/lion-moonlit-amphitheater-guard-token.png',
        initiativePortrait: '/assets/portraits/lion-moonlit-amphitheater-guard-initiative.png',
      },
    ],
  },
  lizard: {
    emoji: '🦎',
    color: '#65a30d',
    tokenPortrait: '/assets/portraits/lizard-desert-boulder-sprint-token.png',
    initiativePortrait: '/assets/portraits/lizard-desert-boulder-sprint-initiative.png',
    visualVariants: [
      {
        id: 'desert-boulder-sprint',
        label: '荒漠岩台疾行',
        tokenPortrait: '/assets/portraits/lizard-desert-boulder-sprint-token.png',
        initiativePortrait: '/assets/portraits/lizard-desert-boulder-sprint-initiative.png',
      },
      {
        id: 'jungle-temple-climb',
        label: '雨林神殿攀墙',
        tokenPortrait: '/assets/portraits/lizard-jungle-temple-climb-token.png',
        initiativePortrait: '/assets/portraits/lizard-jungle-temple-climb-initiative.png',
      },
    ],
  },
  lizardfolk: {
    emoji: '🐊',
    color: '#3f6212',
    tokenPortrait: '/assets/portraits/lizardfolk-cypress-swamp-warrior-token.png',
    initiativePortrait: '/assets/portraits/lizardfolk-cypress-swamp-warrior-initiative.png',
    visualVariants: [
      {
        id: 'cypress-swamp-warrior',
        label: '柏树沼泽战士',
        tokenPortrait: '/assets/portraits/lizardfolk-cypress-swamp-warrior-token.png',
        initiativePortrait: '/assets/portraits/lizardfolk-cypress-swamp-warrior-initiative.png',
      },
      {
        id: 'moonlit-river-javelin',
        label: '月夜河岸投枪',
        tokenPortrait: '/assets/portraits/lizardfolk-moonlit-river-javelin-token.png',
        initiativePortrait: '/assets/portraits/lizardfolk-moonlit-river-javelin-initiative.png',
      },
    ],
  },
  mage: {
    emoji: '🧙',
    color: '#4338ca',
    tokenPortrait: '/assets/portraits/mage-burning-library-fireball-token.png',
    initiativePortrait: '/assets/portraits/mage-burning-library-fireball-initiative.png',
    visualVariants: [
      {
        id: 'burning-library-fireball',
        label: '燃烧书库火球',
        tokenPortrait: '/assets/portraits/mage-burning-library-fireball-token.png',
        initiativePortrait: '/assets/portraits/mage-burning-library-fireball-initiative.png',
      },
      {
        id: 'alpine-observatory-cold',
        label: '雪山星台寒流',
        tokenPortrait: '/assets/portraits/mage-alpine-observatory-cold-token.png',
        initiativePortrait: '/assets/portraits/mage-alpine-observatory-cold-initiative.png',
      },
    ],
  },
  'magma-mephit': {
    emoji: '🌋',
    color: '#c2410c',
    tokenPortrait: '/assets/portraits/magma-mephit-volcanic-caldera-breath-token.png',
    initiativePortrait: '/assets/portraits/magma-mephit-volcanic-caldera-breath-initiative.png',
    visualVariants: [
      {
        id: 'volcanic-caldera-breath',
        label: '火山口吐息',
        tokenPortrait: '/assets/portraits/magma-mephit-volcanic-caldera-breath-token.png',
        initiativePortrait: '/assets/portraits/magma-mephit-volcanic-caldera-breath-initiative.png',
      },
      {
        id: 'dwarven-forge-ambush',
        label: '矮人铸厂伏击',
        tokenPortrait: '/assets/portraits/magma-mephit-dwarven-forge-ambush-token.png',
        initiativePortrait: '/assets/portraits/magma-mephit-dwarven-forge-ambush-initiative.png',
      },
    ],
  },
  magmin: {
    emoji: '🔥',
    color: '#ea580c',
    tokenPortrait: '/assets/portraits/magmin-lava-tube-ignition-token.png',
    initiativePortrait: '/assets/portraits/magmin-lava-tube-ignition-initiative.png',
    visualVariants: [
      {
        id: 'lava-tube-ignition',
        label: '熔岩洞点燃',
        tokenPortrait: '/assets/portraits/magmin-lava-tube-ignition-token.png',
        initiativePortrait: '/assets/portraits/magmin-lava-tube-ignition-initiative.png',
      },
      {
        id: 'snow-village-smolder',
        label: '雪村余烬',
        tokenPortrait: '/assets/portraits/magmin-snow-village-smolder-token.png',
        initiativePortrait: '/assets/portraits/magmin-snow-village-smolder-initiative.png',
      },
    ],
  },
  mammoth: {
    emoji: '🦣',
    color: '#78350f',
    tokenPortrait: '/assets/portraits/mammoth-glacial-tundra-charge-token.png',
    initiativePortrait: '/assets/portraits/mammoth-glacial-tundra-charge-initiative.png',
    visualVariants: [
      {
        id: 'glacial-tundra-charge',
        label: '冰原冲锋',
        tokenPortrait: '/assets/portraits/mammoth-glacial-tundra-charge-token.png',
        initiativePortrait: '/assets/portraits/mammoth-glacial-tundra-charge-initiative.png',
      },
      {
        id: 'aurora-forest-stomp',
        label: '极光雪林践踏',
        tokenPortrait: '/assets/portraits/mammoth-aurora-forest-stomp-token.png',
        initiativePortrait: '/assets/portraits/mammoth-aurora-forest-stomp-initiative.png',
      },
    ],
  },
  manticore: {
    emoji: '🦁',
    color: '#92400e',
    tokenPortrait: '/assets/portraits/manticore-sunset-canyon-volley-token.png',
    initiativePortrait: '/assets/portraits/manticore-sunset-canyon-volley-initiative.png',
    visualVariants: [
      {
        id: 'sunset-canyon-volley',
        label: '落日峡谷棘矢',
        tokenPortrait: '/assets/portraits/manticore-sunset-canyon-volley-token.png',
        initiativePortrait: '/assets/portraits/manticore-sunset-canyon-volley-initiative.png',
      },
      {
        id: 'storm-aqueduct-guard',
        label: '暴雨水道守望',
        tokenPortrait: '/assets/portraits/manticore-storm-aqueduct-guard-token.png',
        initiativePortrait: '/assets/portraits/manticore-storm-aqueduct-guard-initiative.png',
      },
    ],
  },
  marilith: {
    emoji: '🐍',
    color: '#7f1d1d',
    tokenPortrait: '/assets/portraits/marilith-infernal-courtyard-blades-token.png',
    initiativePortrait: '/assets/portraits/marilith-infernal-courtyard-blades-initiative.png',
    visualVariants: [
      {
        id: 'infernal-courtyard-blades',
        label: '炼狱庭院六剑',
        tokenPortrait: '/assets/portraits/marilith-infernal-courtyard-blades-token.png',
        initiativePortrait: '/assets/portraits/marilith-infernal-courtyard-blades-initiative.png',
      },
      {
        id: 'celestial-palace-teleport',
        label: '星宫传送格挡',
        tokenPortrait: '/assets/portraits/marilith-celestial-palace-teleport-token.png',
        initiativePortrait: '/assets/portraits/marilith-celestial-palace-teleport-initiative.png',
      },
    ],
  },
  mastiff: {
    emoji: '🐕',
    color: '#713f12',
    tokenPortrait: '/assets/portraits/mastiff-forest-camp-charge-token.png',
    initiativePortrait: '/assets/portraits/mastiff-forest-camp-charge-initiative.png',
    visualVariants: [
      {
        id: 'forest-camp-charge',
        label: '林间营地冲袭',
        tokenPortrait: '/assets/portraits/mastiff-forest-camp-charge-token.png',
        initiativePortrait: '/assets/portraits/mastiff-forest-camp-charge-initiative.png',
      },
      {
        id: 'snow-monastery-guard',
        label: '雪山寺院守卫',
        tokenPortrait: '/assets/portraits/mastiff-snow-monastery-guard-token.png',
        initiativePortrait: '/assets/portraits/mastiff-snow-monastery-guard-initiative.png',
      },
    ],
  },
  medusa: {
    emoji: '🐍',
    color: '#3f6212',
    tokenPortrait: '/assets/portraits/medusa-ruined-temple-gaze-token.png',
    initiativePortrait: '/assets/portraits/medusa-ruined-temple-gaze-initiative.png',
    visualVariants: [
      {
        id: 'ruined-temple-gaze',
        label: '废殿石化凝视',
        tokenPortrait: '/assets/portraits/medusa-ruined-temple-gaze-token.png',
        initiativePortrait: '/assets/portraits/medusa-ruined-temple-gaze-initiative.png',
      },
      {
        id: 'moonlit-rooftop-longbow',
        label: '月夜屋脊长弓',
        tokenPortrait: '/assets/portraits/medusa-moonlit-rooftop-longbow-token.png',
        initiativePortrait: '/assets/portraits/medusa-moonlit-rooftop-longbow-initiative.png',
      },
    ],
  },
  merfolk: {
    emoji: '🧜',
    color: '#0891b2',
    tokenPortrait: '/assets/portraits/merfolk-sunlit-coral-spear-token.png',
    initiativePortrait: '/assets/portraits/merfolk-sunlit-coral-spear-initiative.png',
    visualVariants: [
      {
        id: 'sunlit-coral-spear',
        label: '日照珊瑚枪兵',
        tokenPortrait: '/assets/portraits/merfolk-sunlit-coral-spear-token.png',
        initiativePortrait: '/assets/portraits/merfolk-sunlit-coral-spear-initiative.png',
      },
      {
        id: 'storm-tidal-scout',
        label: '风暴潮礁斥候',
        tokenPortrait: '/assets/portraits/merfolk-storm-tidal-scout-token.png',
        initiativePortrait: '/assets/portraits/merfolk-storm-tidal-scout-initiative.png',
      },
    ],
  },
  merrow: {
    emoji: '🐟',
    color: '#164e63',
    tokenPortrait: '/assets/portraits/merrow-abyssal-shipyard-harpoon-token.png',
    initiativePortrait: '/assets/portraits/merrow-abyssal-shipyard-harpoon-initiative.png',
    visualVariants: [
      {
        id: 'abyssal-shipyard-harpoon',
        label: '深渊沉船鱼叉',
        tokenPortrait: '/assets/portraits/merrow-abyssal-shipyard-harpoon-token.png',
        initiativePortrait: '/assets/portraits/merrow-abyssal-shipyard-harpoon-initiative.png',
      },
      {
        id: 'storm-tidal-cave-bite',
        label: '风暴潮穴撕咬',
        tokenPortrait: '/assets/portraits/merrow-storm-tidal-cave-bite-token.png',
        initiativePortrait: '/assets/portraits/merrow-storm-tidal-cave-bite-initiative.png',
      },
    ],
  },
  mimic: {
    emoji: '🧰',
    color: '#701a75',
    tokenPortrait: '/assets/portraits/mimic-dungeon-treasure-chest-token.png',
    initiativePortrait: '/assets/portraits/mimic-dungeon-treasure-chest-initiative.png',
    visualVariants: [
      {
        id: 'dungeon-treasure-chest',
        label: '地牢宝箱伏击',
        tokenPortrait: '/assets/portraits/mimic-dungeon-treasure-chest-token.png',
        initiativePortrait: '/assets/portraits/mimic-dungeon-treasure-chest-initiative.png',
      },
      {
        id: 'moonlit-manor-wardrobe',
        label: '月夜庄园衣柜',
        tokenPortrait: '/assets/portraits/mimic-moonlit-manor-wardrobe-token.png',
        initiativePortrait: '/assets/portraits/mimic-moonlit-manor-wardrobe-initiative.png',
      },
    ],
  },
  minotaur: {
    emoji: '🐂',
    color: '#78350f',
    tokenPortrait: '/assets/portraits/minotaur-torch-labyrinth-charge-token.png',
    initiativePortrait: '/assets/portraits/minotaur-torch-labyrinth-charge-initiative.png',
    visualVariants: [
      {
        id: 'torch-labyrinth-charge',
        label: '火炬迷宫冲锋',
        tokenPortrait: '/assets/portraits/minotaur-torch-labyrinth-charge-token.png',
        initiativePortrait: '/assets/portraits/minotaur-torch-labyrinth-charge-initiative.png',
      },
      {
        id: 'aurora-mountain-guard',
        label: '极光山门守卫',
        tokenPortrait: '/assets/portraits/minotaur-aurora-mountain-guard-token.png',
        initiativePortrait: '/assets/portraits/minotaur-aurora-mountain-guard-initiative.png',
      },
    ],
  },
  'minotaur-skeleton': {
    emoji: '💀',
    color: '#57534e',
    tokenPortrait: '/assets/portraits/minotaur-skeleton-ossuary-charge-token.png',
    initiativePortrait: '/assets/portraits/minotaur-skeleton-ossuary-charge-initiative.png',
    visualVariants: [
      {
        id: 'ossuary-charge',
        label: '藏骨迷宫冲锋',
        tokenPortrait: '/assets/portraits/minotaur-skeleton-ossuary-charge-token.png',
        initiativePortrait: '/assets/portraits/minotaur-skeleton-ossuary-charge-initiative.png',
      },
      {
        id: 'moonlit-desert-maze',
        label: '月夜荒漠迷阵',
        tokenPortrait: '/assets/portraits/minotaur-skeleton-moonlit-desert-maze-token.png',
        initiativePortrait: '/assets/portraits/minotaur-skeleton-moonlit-desert-maze-initiative.png',
      },
    ],
  },
  mule: {
    emoji: '🐴',
    color: '#57534e',
    tokenPortrait: '/assets/portraits/mule-alpine-pass-pack-token.png',
    initiativePortrait: '/assets/portraits/mule-alpine-pass-pack-initiative.png',
    visualVariants: [
      {
        id: 'alpine-pass-pack',
        label: '高山驮行',
        tokenPortrait: '/assets/portraits/mule-alpine-pass-pack-token.png',
        initiativePortrait: '/assets/portraits/mule-alpine-pass-pack-initiative.png',
      },
      {
        id: 'snow-stable-kick',
        label: '雪厩后踢',
        tokenPortrait: '/assets/portraits/mule-snow-stable-kick-token.png',
        initiativePortrait: '/assets/portraits/mule-snow-stable-kick-initiative.png',
      },
    ],
  },
  mummy: {
    emoji: '🧟',
    color: '#78716c',
    tokenPortrait: '/assets/portraits/mummy-desert-tomb-rotting-fist-token.png',
    initiativePortrait: '/assets/portraits/mummy-desert-tomb-rotting-fist-initiative.png',
    visualVariants: [
      {
        id: 'desert-tomb-rotting-fist',
        label: '古墓腐朽之拳',
        tokenPortrait: '/assets/portraits/mummy-desert-tomb-rotting-fist-token.png',
        initiativePortrait: '/assets/portraits/mummy-desert-tomb-rotting-fist-initiative.png',
      },
      {
        id: 'flooded-necropolis-glare',
        label: '水淹墓城凝视',
        tokenPortrait: '/assets/portraits/mummy-flooded-necropolis-glare-token.png',
        initiativePortrait: '/assets/portraits/mummy-flooded-necropolis-glare-initiative.png',
      },
    ],
  },
  'mummy-lord': {
    emoji: '👑',
    color: '#854d0e',
    tokenPortrait: '/assets/portraits/mummy-lord-royal-pyramid-scarabs-token.png',
    initiativePortrait: '/assets/portraits/mummy-lord-royal-pyramid-scarabs-initiative.png',
    visualVariants: [
      {
        id: 'royal-pyramid-scarabs',
        label: '王陵圣甲虫',
        tokenPortrait: '/assets/portraits/mummy-lord-royal-pyramid-scarabs-token.png',
        initiativePortrait: '/assets/portraits/mummy-lord-royal-pyramid-scarabs-initiative.png',
      },
      {
        id: 'moonlit-sandstorm-word',
        label: '月夜沙暴邪言',
        tokenPortrait: '/assets/portraits/mummy-lord-moonlit-sandstorm-word-token.png',
        initiativePortrait: '/assets/portraits/mummy-lord-moonlit-sandstorm-word-initiative.png',
      },
    ],
  },
  nalfeshnee: {
    emoji: '👹',
    color: '#7f1d1d',
    tokenPortrait: '/assets/portraits/nalfeshnee-abyssal-fortress-charge-token.png',
    initiativePortrait: '/assets/portraits/nalfeshnee-abyssal-fortress-charge-initiative.png',
    visualVariants: [
      {
        id: 'abyssal-fortress-charge',
        label: '深渊要塞破门',
        tokenPortrait: '/assets/portraits/nalfeshnee-abyssal-fortress-charge-token.png',
        initiativePortrait: '/assets/portraits/nalfeshnee-abyssal-fortress-charge-initiative.png',
      },
      {
        id: 'moonlit-fungal-teleport',
        label: '月夜菌林传送',
        tokenPortrait: '/assets/portraits/nalfeshnee-moonlit-fungal-teleport-token.png',
        initiativePortrait: '/assets/portraits/nalfeshnee-moonlit-fungal-teleport-initiative.png',
      },
    ],
  },
  'night-hag': {
    emoji: '🧙',
    color: '#4c1d95',
    tokenPortrait: '/assets/portraits/night-hag-bedchamber-nightmare-haunting-token.png',
    initiativePortrait: '/assets/portraits/night-hag-bedchamber-nightmare-haunting-initiative.png',
    visualVariants: [
      {
        id: 'bedchamber-nightmare-haunting',
        label: '寝宫梦魇侵扰',
        tokenPortrait: '/assets/portraits/night-hag-bedchamber-nightmare-haunting-token.png',
        initiativePortrait: '/assets/portraits/night-hag-bedchamber-nightmare-haunting-initiative.png',
      },
      {
        id: 'dead-marsh-ethereal',
        label: '死沼以太现身',
        tokenPortrait: '/assets/portraits/night-hag-dead-marsh-ethereal-token.png',
        initiativePortrait: '/assets/portraits/night-hag-dead-marsh-ethereal-initiative.png',
      },
    ],
  },
  nightmare: {
    emoji: '🐎',
    color: '#9a3412',
    tokenPortrait: '/assets/portraits/nightmare-infernal-causeway-gallop-token.png',
    initiativePortrait: '/assets/portraits/nightmare-infernal-causeway-gallop-initiative.png',
    visualVariants: [
      {
        id: 'infernal-causeway-gallop',
        label: '炼狱长桥驰骋',
        tokenPortrait: '/assets/portraits/nightmare-infernal-causeway-gallop-token.png',
        initiativePortrait: '/assets/portraits/nightmare-infernal-causeway-gallop-initiative.png',
      },
      {
        id: 'moonlit-cathedral-ethereal',
        label: '月夜圣堂以太',
        tokenPortrait: '/assets/portraits/nightmare-moonlit-cathedral-ethereal-token.png',
        initiativePortrait: '/assets/portraits/nightmare-moonlit-cathedral-ethereal-initiative.png',
      },
    ],
  },
  noble: {
    emoji: '👑',
    color: '#7c2d12',
    tokenPortrait: '/assets/portraits/noble-sunlit-palace-challenge-token.png',
    initiativePortrait: '/assets/portraits/noble-sunlit-palace-challenge-initiative.png',
    visualVariants: [
      {
        id: 'sunlit-palace-challenge',
        label: '日耀宫廷决斗',
        tokenPortrait: '/assets/portraits/noble-sunlit-palace-challenge-token.png',
        initiativePortrait: '/assets/portraits/noble-sunlit-palace-challenge-initiative.png',
      },
      {
        id: 'storm-battlement-defense',
        label: '风暴城垛守备',
        tokenPortrait: '/assets/portraits/noble-storm-battlement-defense-token.png',
        initiativePortrait: '/assets/portraits/noble-storm-battlement-defense-initiative.png',
      },
    ],
  },
  'ochre-jelly': {
    emoji: '🟡',
    color: '#a16207',
    tokenPortrait: '/assets/portraits/ochre-jelly-mine-wall-pseudopod-token.png',
    initiativePortrait: '/assets/portraits/ochre-jelly-mine-wall-pseudopod-initiative.png',
    visualVariants: [
      {
        id: 'mine-wall-pseudopod',
        label: '矿坑攀壁伪足',
        tokenPortrait: '/assets/portraits/ochre-jelly-mine-wall-pseudopod-token.png',
        initiativePortrait: '/assets/portraits/ochre-jelly-mine-wall-pseudopod-initiative.png',
      },
      {
        id: 'flooded-aqueduct-surge',
        label: '水渠破栏涌动',
        tokenPortrait: '/assets/portraits/ochre-jelly-flooded-aqueduct-surge-token.png',
        initiativePortrait: '/assets/portraits/ochre-jelly-flooded-aqueduct-surge-initiative.png',
      },
    ],
  },
  octopus: {
    emoji: '🐙',
    color: '#9f1239',
    tokenPortrait: '/assets/portraits/octopus-coral-wreck-camouflage-token.png',
    initiativePortrait: '/assets/portraits/octopus-coral-wreck-camouflage-initiative.png',
    visualVariants: [
      {
        id: 'coral-wreck-camouflage',
        label: '珊瑚沉船伪装',
        tokenPortrait: '/assets/portraits/octopus-coral-wreck-camouflage-token.png',
        initiativePortrait: '/assets/portraits/octopus-coral-wreck-camouflage-initiative.png',
      },
      {
        id: 'moonlit-kelp-ink-cloud',
        label: '月夜海藻墨云',
        tokenPortrait: '/assets/portraits/octopus-moonlit-kelp-ink-cloud-token.png',
        initiativePortrait: '/assets/portraits/octopus-moonlit-kelp-ink-cloud-initiative.png',
      },
    ],
  },
  ogre: {
    emoji: '👹',
    color: '#57534e',
    tokenPortrait: '/assets/portraits/ogre-rainy-toll-bridge-greatclub-token.png',
    initiativePortrait: '/assets/portraits/ogre-rainy-toll-bridge-greatclub-initiative.png',
    visualVariants: [
      {
        id: 'rainy-toll-bridge-greatclub',
        label: '雨林桥头巨棒',
        tokenPortrait: '/assets/portraits/ogre-rainy-toll-bridge-greatclub-token.png',
        initiativePortrait: '/assets/portraits/ogre-rainy-toll-bridge-greatclub-initiative.png',
      },
      {
        id: 'snow-quarry-javelin',
        label: '雪岭石场标枪',
        tokenPortrait: '/assets/portraits/ogre-snow-quarry-javelin-token.png',
        initiativePortrait: '/assets/portraits/ogre-snow-quarry-javelin-initiative.png',
      },
    ],
  },
  'ogre-zombie': {
    emoji: '🧟',
    color: '#3f6212',
    tokenPortrait: '/assets/portraits/ogre-zombie-moonlit-ossuary-morningstar-token.png',
    initiativePortrait: '/assets/portraits/ogre-zombie-moonlit-ossuary-morningstar-initiative.png',
    visualVariants: [
      {
        id: 'moonlit-ossuary-morningstar',
        label: '月夜墓场晨星',
        tokenPortrait: '/assets/portraits/ogre-zombie-moonlit-ossuary-morningstar-token.png',
        initiativePortrait: '/assets/portraits/ogre-zombie-moonlit-ossuary-morningstar-initiative.png',
      },
      {
        id: 'dawn-swamp-drag',
        label: '黎明沼泽拖行',
        tokenPortrait: '/assets/portraits/ogre-zombie-dawn-swamp-drag-token.png',
        initiativePortrait: '/assets/portraits/ogre-zombie-dawn-swamp-drag-initiative.png',
      },
    ],
  },
  oni: {
    emoji: '👺',
    color: '#1e3a8a',
    tokenPortrait: '/assets/portraits/oni-storm-shrine-glaive-token.png',
    initiativePortrait: '/assets/portraits/oni-storm-shrine-glaive-initiative.png',
    visualVariants: [
      {
        id: 'storm-shrine-glaive',
        label: '雷雨神社薙刀',
        tokenPortrait: '/assets/portraits/oni-storm-shrine-glaive-token.png',
        initiativePortrait: '/assets/portraits/oni-storm-shrine-glaive-initiative.png',
      },
      {
        id: 'snow-city-cone-of-cold',
        label: '雪城飞行冰锥',
        tokenPortrait: '/assets/portraits/oni-snow-city-cone-of-cold-token.png',
        initiativePortrait: '/assets/portraits/oni-snow-city-cone-of-cold-initiative.png',
      },
    ],
  },
  'axe-beak': {
    emoji: '🐦',
    color: '#713f12',
    tokenPortrait: '/assets/portraits/axe-beak-dawn-runner-token.png',
    initiativePortrait: '/assets/portraits/axe-beak-dawn-runner-initiative.png',
    visualVariants: [
      {
        id: 'dawn-runner',
        label: '曙野疾行',
        tokenPortrait: '/assets/portraits/axe-beak-dawn-runner-token.png',
        initiativePortrait: '/assets/portraits/axe-beak-dawn-runner-initiative.png',
      },
      {
        id: 'mist-forest',
        label: '雾林猎影',
        tokenPortrait: '/assets/portraits/axe-beak-mist-forest-token.png',
        initiativePortrait: '/assets/portraits/axe-beak-mist-forest-initiative.png',
      },
    ],
  },
  bandit: {
    emoji: '🗡️',
    color: '#78716c',
    tokenPortrait: '/assets/portraits/bandit-storm-road-token.png',
    initiativePortrait: '/assets/portraits/bandit-storm-road-initiative.png',
    visualVariants: [
      {
        id: 'storm-road',
        label: '暴雨路匪',
        tokenPortrait: '/assets/portraits/bandit-storm-road-token.png',
        initiativePortrait: '/assets/portraits/bandit-storm-road-initiative.png',
      },
      {
        id: 'forest-crossbow',
        label: '森墟弩手',
        tokenPortrait: '/assets/portraits/bandit-forest-crossbow-token.png',
        initiativePortrait: '/assets/portraits/bandit-forest-crossbow-initiative.png',
      },
      {
        id: 'desert-ambush',
        label: '沙路伏匪',
        tokenPortrait: '/assets/portraits/bandit-desert-ambush-token.png',
        initiativePortrait: '/assets/portraits/bandit-desert-ambush-initiative.png',
      },
      {
        id: 'moon-harbor',
        label: '月港劫影',
        tokenPortrait: '/assets/portraits/bandit-moon-harbor-token.png',
        initiativePortrait: '/assets/portraits/bandit-moon-harbor-initiative.png',
      },
    ],
  },
  bugbear: {
    emoji: '👹',
    color: '#92400e',
    tokenPortrait: '/assets/portraits/bugbear-forest-raider-token.png',
    initiativePortrait: '/assets/portraits/bugbear-forest-raider-initiative.png',
    visualVariants: [
      {
        id: 'forest-raider',
        label: '森林劫掠者',
        tokenPortrait: '/assets/portraits/bugbear-forest-raider-token.png',
        initiativePortrait: '/assets/portraits/bugbear-forest-raider-initiative.png',
      },
      {
        id: 'cavern-brute',
        label: '地窟蛮兵',
        tokenPortrait: '/assets/portraits/bugbear-cavern-brute-token.png',
        initiativePortrait: '/assets/portraits/bugbear-cavern-brute-initiative.png',
      },
    ],
  },
  kobold: {
    emoji: '🐲',
    color: '#f59e0b',
    tokenPortrait: '/assets/portraits/kobold-mine-trapper-token.png',
    initiativePortrait: '/assets/portraits/kobold-mine-trapper-initiative.png',
    visualVariants: [
      {
        id: 'mine-trapper',
        label: '矿道陷阱手',
        tokenPortrait: '/assets/portraits/kobold-mine-trapper-token.png',
        initiativePortrait: '/assets/portraits/kobold-mine-trapper-initiative.png',
      },
      {
        id: 'canyon-slinger',
        label: '峡谷投石手',
        tokenPortrait: '/assets/portraits/kobold-canyon-slinger-token.png',
        initiativePortrait: '/assets/portraits/kobold-canyon-slinger-initiative.png',
      },
      {
        id: 'sewer-knifeguard',
        label: '污渠刀卫',
        tokenPortrait: '/assets/portraits/kobold-sewer-knifeguard-token.png',
        initiativePortrait: '/assets/portraits/kobold-sewer-knifeguard-initiative.png',
      },
      {
        id: 'snow-raider',
        label: '雪岭窃匪',
        tokenPortrait: '/assets/portraits/kobold-snow-raider-token.png',
        initiativePortrait: '/assets/portraits/kobold-snow-raider-initiative.png',
      },
    ],
  },
  goblin: {
    emoji: '👺',
    color: '#4ade80',
    tokenPortrait: '/assets/portraits/goblin-forest-scout-token.png',
    initiativePortrait: '/assets/portraits/goblin-forest-scout-initiative.png',
    visualVariants: [
      {
        id: 'forest-scout',
        label: '森林斥候',
        tokenPortrait: '/assets/portraits/goblin-forest-scout-token.png',
        initiativePortrait: '/assets/portraits/goblin-forest-scout-initiative.png',
      },
      {
        id: 'woodland-archer',
        label: '黄兜弓手',
        tokenPortrait: '/assets/portraits/goblin-woodland-archer-token.png',
        initiativePortrait: '/assets/portraits/goblin-woodland-archer-initiative.png',
      },
      {
        id: 'ruin-raider',
        label: '遗迹掠夺者',
        tokenPortrait: '/assets/portraits/goblin-ruin-raider-token.png',
        initiativePortrait: '/assets/portraits/goblin-ruin-raider-initiative.png',
      },
      {
        id: 'cave-skulk',
        label: '洞穴潜伏者',
        tokenPortrait: '/assets/portraits/goblin-cave-skulk-token.png',
        initiativePortrait: '/assets/portraits/goblin-cave-skulk-initiative.png',
      },
    ],
  },
  skeleton: {
    emoji: '💀',
    color: '#e2e8f0',
    tokenPortrait: '/assets/portraits/skeleton-crypt-riser-token.png',
    initiativePortrait: '/assets/portraits/skeleton-crypt-riser-initiative.png',
    visualVariants: [
      {
        id: 'crypt-riser',
        label: '墓穴剑骸',
        tokenPortrait: '/assets/portraits/skeleton-crypt-riser-token.png',
        initiativePortrait: '/assets/portraits/skeleton-crypt-riser-initiative.png',
      },
      {
        id: 'moon-archer',
        label: '月野骸弓',
        tokenPortrait: '/assets/portraits/skeleton-moon-archer-token.png',
        initiativePortrait: '/assets/portraits/skeleton-moon-archer-initiative.png',
      },
    ],
  },
  zombie: {
    emoji: '🧟',
    color: '#84cc16',
    tokenPortrait: '/assets/portraits/zombie-plague-villager-token.png',
    initiativePortrait: '/assets/portraits/zombie-plague-villager-initiative.png',
    visualVariants: [
      {
        id: 'plague-villager',
        label: '荒村行尸',
        tokenPortrait: '/assets/portraits/zombie-plague-villager-token.png',
        initiativePortrait: '/assets/portraits/zombie-plague-villager-initiative.png',
      },
      {
        id: 'drowned-sailor',
        label: '沉船水尸',
        tokenPortrait: '/assets/portraits/zombie-drowned-sailor-token.png',
        initiativePortrait: '/assets/portraits/zombie-drowned-sailor-initiative.png',
      },
      {
        id: 'mine-laborer',
        label: '矿坑尸工',
        tokenPortrait: '/assets/portraits/zombie-mine-laborer-token.png',
        initiativePortrait: '/assets/portraits/zombie-mine-laborer-initiative.png',
      },
      {
        id: 'snow-soldier',
        label: '雪堡尸兵',
        tokenPortrait: '/assets/portraits/zombie-snow-soldier-token.png',
        initiativePortrait: '/assets/portraits/zombie-snow-soldier-initiative.png',
      },
    ],
  },
  wolf: {
    emoji: '🐺',
    color: '#94a3b8',
    tokenPortrait: '/assets/portraits/wolf-rain-stalker-token.png',
    initiativePortrait: '/assets/portraits/wolf-rain-stalker-initiative.png',
    visualVariants: [
      {
        id: 'rain-stalker',
        label: '雨林潜狼',
        tokenPortrait: '/assets/portraits/wolf-rain-stalker-token.png',
        initiativePortrait: '/assets/portraits/wolf-rain-stalker-initiative.png',
      },
      {
        id: 'snow-howler',
        label: '雪岭长嚎',
        tokenPortrait: '/assets/portraits/wolf-snow-howler-token.png',
        initiativePortrait: '/assets/portraits/wolf-snow-howler-initiative.png',
      },
    ],
  },
  orc: { emoji: '👹', color: '#ef4444' },
  owlbear: { emoji: '🦉', color: '#78350f' },
}

const SRD_MONSTER_SEARCH_ALIASES: Readonly<Record<string, readonly string[]>> = {
  goblin: ['哥布林'],
}

export function getEnemyVisualVariants(id: string): readonly EnemyVisualVariant[] {
  const monster = getDnd5eSrdMonster(id) ?? getDnd5eSrdMonsterBySlug(id)
  if (!monster) return []
  if (monster.tokenPortrait && monster.initiativePortrait) return [{
    id: 'custom',
    label: '自定义形象',
    tokenPortrait: monster.tokenPortrait,
    initiativePortrait: monster.initiativePortrait,
  }]
  const presentation = SRD_MONSTER_PRESENTATION[monster.slug]
  if (presentation?.visualVariants?.length) return presentation.visualVariants
  if (!presentation?.tokenPortrait || !presentation.initiativePortrait) return []
  return [{
    id: 'default',
    label: '默认形象',
    tokenPortrait: monster.tokenPortrait ?? monster.initiativePortrait ?? presentation.tokenPortrait,
    initiativePortrait: monster.initiativePortrait ?? monster.tokenPortrait ?? presentation.initiativePortrait,
  }]
}

export function getEnemyVisualPresentation(
  id: string,
  visualVariantId?: string,
): EnemyVisualPresentation | undefined {
  const variants = getEnemyVisualVariants(id)
  const selected = visualVariantId
    ? variants.find((variant) => variant.id === visualVariantId)
    : variants[0]
  if (selected) {
    return {
      tokenPortrait: selected.tokenPortrait,
      initiativePortrait: selected.initiativePortrait,
    }
  }
  const monster = getDnd5eSrdMonster(id) ?? getDnd5eSrdMonsterBySlug(id)
  if (!monster) return undefined
  if (monster.tokenPortrait || monster.initiativePortrait) {
    return {
      tokenPortrait: monster.tokenPortrait ?? monster.initiativePortrait!,
      initiativePortrait: monster.initiativePortrait ?? monster.tokenPortrait!,
    }
  }
  const presentation = SRD_MONSTER_PRESENTATION[monster.slug]
  if (!presentation?.tokenPortrait || !presentation.initiativePortrait) return undefined
  return {
    tokenPortrait: presentation.tokenPortrait,
    initiativePortrait: presentation.initiativePortrait,
  }
}

function srdCreatureTypes(type: string): CreatureType[] {
  if (type === '野兽') return ['动物']
  if (type === '龙') return ['龙']
  if (type === '精类') return ['精类']
  if (type === '元素生物') return ['元素']
  if (type === '构装体') return ['机械']
  if (type === '植物') return ['植物']
  if (type === '类人生物' || type === '巨人') return ['人类']
  return ['魔物']
}

export function dnd5eMonsterToEnemyTemplate(monster: Dnd5eMonsterStatBlock): EnemyTemplate {
  const presentation = SRD_MONSTER_PRESENTATION[monster.slug] ?? { emoji: '👾', color: '#f87171' }
  const capabilityTags = [
    monster.capabilities?.spellcaster ? '施法者' : null,
    monster.capabilities?.legendary ? '传奇动作' : null,
    monster.capabilities?.swarm ? '群集' : null,
    monster.capabilities?.shapechanger ? '变形生物' : null,
    monster.capabilities?.regeneration ? '再生' : null,
    monster.speed.fly != null ? '飞行' : null,
    monster.speed.swim != null ? '游泳' : null,
  ].filter((value): value is string => !!value)
  return {
    id: monster.id,
    name: monster.name,
    emoji: presentation.emoji,
    color: presentation.color,
    maxHp: monster.hitPoints.average,
    creatureTypes: srdCreatureTypes(monster.creatureType),
    creatureSize: monster.size,
    tags: [...new Set([
      monster.source,
      `CR ${monster.challenge.rating}`,
      monster.creatureType,
      monster.size,
      ...(monster.subtypes ?? []),
      ...capabilityTags,
    ])],
    description: monster.name === monster.englishName
      ? monster.description
      : `${monster.englishName} · ${monster.description}`,
    armorClass: monster.armorClass.value,
    challengeRating: monster.challenge.rating,
    experiencePoints: monster.challenge.xp,
    hitDice: monster.hitPoints.dice,
    source: monster.source,
    tokenPortrait: presentation.tokenPortrait,
    initiativePortrait: presentation.initiativePortrait,
    visualVariants: getEnemyVisualVariants(monster.id),
    searchAliases: [...(SRD_MONSTER_SEARCH_ALIASES[monster.slug] ?? [])],
  }
}

/** D&D 5e 2014 地图唯一内置怪物池，只包含 SRD 5.1 目录。 */
export const DND5E_SRD_ENEMY_POOL: EnemyTemplate[] = DND5E_SRD_MONSTERS.map(dnd5eMonsterToEnemyTemplate)

/** @deprecated 使用 DND5E_SRD_ENEMY_POOL；保留导出名只为兼容旧调用方。 */
export const ENEMY_POOL: EnemyTemplate[] = DND5E_SRD_ENEMY_POOL

export function getEnemyTemplate(id: string): EnemyTemplate | undefined {
  const monster = getDnd5eSrdMonster(id) ?? getDnd5eSrdMonsterBySlug(id)
  return monster ? dnd5eMonsterToEnemyTemplate(monster) : undefined
}

export function searchEnemyPool(query: string, pool: readonly EnemyTemplate[] = DND5E_SRD_ENEMY_POOL): EnemyTemplate[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...pool]
  return pool.filter(
    (enemy) =>
      enemy.name.toLowerCase().includes(q) ||
      enemy.tags.some((tag) => tag.toLowerCase().includes(q)) ||
      enemy.creatureTypes?.some((type) => type.toLowerCase().includes(q)) ||
      enemy.creatureSize?.toLowerCase().includes(q) ||
      enemy.searchAliases?.some((alias) => alias.toLowerCase().includes(q)) ||
      enemy.description?.toLowerCase().includes(q),
  )
}

export function enemyTemplateToTokenPatch(template: EnemyTemplate): Partial<TokenFields> {
  const maxHp = enemyHasDerivedCombat(template.id)
    ? getEnemyMaxHp(template.id)
    : template.maxHp
  const hp = template.hp ?? maxHp
  const creatureTypes = template.creatureTypes ?? inferCreatureTypesFromTags(template.tags)
  const creatureSize = template.creatureSize ?? inferCreatureSizeFromTags(template.tags)
  return {
    label: template.name,
    emoji: template.emoji,
    color: template.color,
    maxHp,
    hp,
    size: creatureSizeToTokenSize(creatureSize),
    poolId: template.id,
    visualVariantId: template.visualVariantId,
    creatureTypes,
    creatureSize,
    type: 'enemy' as const,
    showHpOnToken: true,
    showDetailOnToken: true,
  }
}

/** 写入 Token 的字段（避免循环依赖 maps.ts）。 */
export interface TokenFields {
  label: string
  emoji: string
  color: string
  maxHp?: number
  hp?: number
  size?: number
  poolId?: string
  visualVariantId?: string
  creatureTypes?: CreatureType[]
  creatureSize?: CreatureSize
  type: 'enemy'
  showHpOnToken?: boolean
  showDetailOnToken?: boolean
}
