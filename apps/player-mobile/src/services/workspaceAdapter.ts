import { DND5E_SRD_SPELL_CATALOG } from '../../../../src/rulesets/dnd5e/spellCatalog'
import { DND5E_SRD_COMBAT_SPELLS } from '../../../../src/rulesets/dnd5e/spells'
import { dnd5eRacialRulesForCharacter } from '../../../../src/rulesets/dnd5e/racialAutomation'
import { dnd5eCoreRaceMechanics } from '../../../../src/rulesets/dnd5e/coreRaceMechanics'
import {
  availableDnd5eClassDefinitions,
  buildDnd5eLevelAdvancementPlan,
  dnd5eClassDefinition,
  dnd5eLevelAdvancementGrantedFeatures,
  dnd5ePluginBackgroundDefinition,
  dnd5ePluginFeatDefinition,
  dnd5ePluginFeatureDefinition,
  dnd5ePluginRaceDefinition,
  dnd5ePluginSpellDefinition,
  dnd5ePluginSubclassDefinition,
  dnd5eSrdFeatDefinition,
  fighterProgression,
  fighterFightingStyleSelectionLimit,
  FIGHTER_FIGHTING_STYLE_OPTIONS,
  validateDnd5eMulticlassLevelGain,
  normalizeDnd5eClassLevels,
  type Dnd5eClassId,
} from '../../../../src/rulesets/dnd5e'
import { dnd5eAdvancementFeatOptions } from '../../../../src/components/character/featAdvancementOptions'
import type { Character } from '../../../../src/types/character'
import type {
  MobileCharacterView,
  MobileCharacterFeatureView,
  MobileLevelUpPlan,
  MobileCombatView,
  MobilePlayerWorkspace,
  MobileRoomRules,
  MobileRestAdvance,
  MobileSceneInteractionPoint,
  MobilePersistentAreaView,
  MobileTerrainElevationView,
  MobileMapLightView,
  MobileSpellView,
  OpaqueSegment,
  PlayerSceneSnapshot,
  PlayerTokenView,
  WorldPoint,
} from '../../../../packages/mobile-protocol/src'
import { emptyMobileActionRegistry } from './actionRegistry'
import { buildMobileInterruptRegistry } from './interruptRegistry'
import { mapImageUrl, roomHeaders, sharedImageUrl, type MobileCredentials } from './mobileApi'

type Obj = Record<string, unknown>

const damageTypeLabels: Readonly<Record<string, string>> = {
  acid: '强酸', bludgeoning: '钝击', cold: '寒冷', fire: '火焰', force: '力场', lightning: '闪电',
  necrotic: '黯蚀', piercing: '穿刺', poison: '毒素', psychic: '心灵', radiant: '光耀', slashing: '挥砍', thunder: '雷鸣',
}

function object(value: unknown): Obj {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Obj : {}
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function num(value: unknown, fallback = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function publicImageUrl(credentials: MobileCredentials, value: string): string | undefined {
  const source = value.trim()
  if (!source) return undefined
  if (/^(?:https?:\/\/|data:image\/|file:\/\/)/i.test(source)) return source
  if (/^(?:blob:|javascript:)/i.test(source)) return undefined
  const base = credentials.serverUrl.replace(/\/+$/, '')
  return `${base}${source.startsWith('/') ? source : `/${source}`}`
}

function activeEffectConditions(state: unknown): string[] {
  const combat = object(state)
  const active = list(combat.activeEffects).map(object)
  const effectConditions = active.flatMap((effect) => {
    const id = text(effect.conditionId) || text(effect.rulesId)
    return id ? [id] : []
  })
  return [...new Set([...list(combat.conditions).map(String), ...effectConditions])]
}

function selectedSubclassId(character: Character, classId: string): string | undefined {
  return classId === 'fighter'
    ? character.dnd5eClassChoices?.fighter?.subclass
    : character.dnd5eClassChoices?.classes?.[classId]?.subclass
}

function automationLabel(value: unknown): 'full' | 'partial' | 'manual' | undefined {
  return value === 'full' || value === 'partial' || value === 'manual' ? value : undefined
}

function adaptCharacterFeatures(character: Character): MobileCharacterFeatureView[] {
  const features: MobileCharacterFeatureView[] = []
  const push = (feature: MobileCharacterFeatureView) => {
    if (!feature.id || features.some((candidate) => candidate.id === feature.id)) return
    features.push(feature)
  }
  for (const [classId, rawLevel] of Object.entries(normalizeDnd5eClassLevels(character))) {
    const level = Math.max(0, Math.floor(Number(rawLevel) || 0))
    if (level < 1) continue
    const definition = dnd5eClassDefinition(classId)
    const subclassId = selectedSubclassId(character, classId)
    const pluginSubclass = subclassId ? dnd5ePluginSubclassDefinition(subclassId) : undefined
    const classFeatures = classId === 'fighter'
      ? fighterProgression(subclassId).flatMap((entry) => entry.level <= level ? entry.features : [])
      : [
          ...(definition?.features.filter((feature) => feature.level <= level) ?? []),
          ...(definition && subclassId === definition.subclass.id
            ? definition.subclass.features.filter((feature) => feature.level <= level)
            : []),
        ]
    for (const feature of classFeatures) {
      if (feature.id.startsWith('asi-') || feature.id.startsWith('archetype-')) continue
      const source = feature.source === 'class' || feature.source === 'fighter' ? 'class' : 'subclass'
      push({
        id: `${classId}:${feature.id}`,
        name: feature.name,
        description: feature.description,
        source,
        sourceLabel: source === 'class'
          ? (definition?.name ?? classId)
          : (pluginSubclass?.name ?? (definition?.subclass.id === subclassId ? definition?.subclass.name : subclassId) ?? '子职'),
        level: feature.level,
      })
    }
    if (classId !== 'fighter' && pluginSubclass?.classId === classId) {
      for (const feature of pluginSubclass.features.filter((candidate) => candidate.level <= level)) push({
        id: feature.featureId,
        name: feature.name,
        description: feature.description,
        source: 'subclass',
        sourceLabel: pluginSubclass.name,
        level: feature.level,
        automation: automationLabel(feature.automation ?? (feature.action ? 'full' : 'manual')),
        automationReasons: feature.automationReasons ? [...feature.automationReasons] : undefined,
      })
    }
  }
  const race = dnd5ePluginRaceDefinition(character.dnd5eRaceId ?? character.race)
  for (const [traitIndex, trait] of (race?.traits ?? []).entries()) push({
    id: `${race!.id}:trait:${traitIndex}:${trait.name}`,
    name: trait.name,
    description: trait.description,
    source: 'race',
    sourceLabel: race!.name,
  })
  if (!race) {
    const mechanics = dnd5eCoreRaceMechanics(character.race, character.dnd5eRaceId)
    const racialRules = dnd5eRacialRulesForCharacter(character)
    const sourceLabel = character.race || '种族'
    if (mechanics?.staticModifiers?.darkvisionRangeFeet) push({
      id: `race:${mechanics.id}:darkvision`, name: '黑暗视觉', source: 'race', sourceLabel,
      description: `在 ${mechanics.staticModifiers.darkvisionRangeFeet} 尺范围内按 D&D 5e 2014 黑暗视觉规则处理昏暗与黑暗；视野和目标可见性由 Host 计算。`, automation: 'full',
    })
    for (const resistance of mechanics?.staticModifiers?.damageResistances ?? []) push({
      id: `race:${mechanics!.id}:resistance:${resistance}`, name: `${damageTypeLabels[resistance] ?? resistance}伤害抗性`, source: 'race', sourceLabel,
      description: `受到${damageTypeLabels[resistance] ?? resistance}伤害时由 Headless 自动应用抗性。`, automation: 'full',
    })
    if (racialRules.halflingLucky) push({
      id: 'race:halfling:lucky', name: '幸运', source: 'race', sourceLabel,
      description: '攻击检定、属性检定或豁免检定的 d20 掷出天然 1 时，由投骰事务执行重掷。', automation: 'full',
    })
    if (racialRules.halfOrcRelentlessEndurance) push({
      id: 'race:half-orc:relentless-endurance', name: '顽强', source: 'race', sourceLabel,
      description: '受到伤害降至 0 生命值但未被直接杀死时，可改为保留 1 生命值；长休后恢复。', automation: 'full', resourceId: 'dnd5e-racial-half-orc-relentless-endurance',
    })
    if (racialRules.halfOrcSavageAttacks) push({
      id: 'race:half-orc:savage-attacks', name: '凶蛮攻击', source: 'race', sourceLabel,
      description: '近战武器攻击造成重击时，额外加入一枚该武器伤害骰。', automation: 'full',
    })
    if (racialRules.dragonbornAncestry) push({
      id: 'race:dragonborn:breath-weapon', name: '吐息武器', source: 'race', sourceLabel,
      description: `${racialRules.dragonbornAncestry.name}血统的${racialRules.dragonbornAncestry.damageType}吐息；范围、豁免与伤害骰由 Headless 按角色等级结算。`, automation: 'full', resourceId: 'dnd5e-racial-dragonborn-breath',
    })
    if (racialRules.innateSpells.length) push({
      id: `race:${mechanics?.id ?? character.dnd5eRaceId ?? character.race}:innate-spells`, name: '先天施法', source: 'race', sourceLabel,
      description: racialRules.innateSpells.map((grant) => `${DND5E_SRD_SPELL_CATALOG.find((spell) => spell.id === grant.spellId)?.name ?? grant.spellId}（${grant.castAtLevel === 0 ? '戏法' : `${grant.castAtLevel}环`}，${grant.resetOn === 'at-will' ? '随意施放' : '长休恢复'}）`).join('、'), automation: 'full',
    })
  }
  const background = dnd5ePluginBackgroundDefinition(character.dnd5eBackgroundId ?? character.background)
  if (background?.feature) push({
    id: `${background.id}:feature`,
    name: background.feature.name,
    description: background.feature.description,
    source: 'background',
    sourceLabel: background.name,
  })
  for (const featId of character.dnd5eFeatIds ?? []) {
    const feat = dnd5eSrdFeatDefinition(featId) ?? dnd5ePluginFeatDefinition(featId)
    if (!feat) {
      push({ id: featId, name: featId, description: '对应专长规则包当前未载入。', source: 'feat', sourceLabel: '规则包未载入', automation: 'manual' })
      continue
    }
    push({
      id: feat.id,
      name: feat.name,
      description: feat.description,
      source: 'feat',
      sourceLabel: 'ownerPluginName' in feat && typeof feat.ownerPluginName === 'string' ? feat.ownerPluginName : 'SRD 5.1',
      automation: automationLabel(feat.automation),
    })
  }
  for (const featureId of character.dnd5ePluginFeatureIds ?? []) {
    const feature = dnd5ePluginFeatureDefinition(featureId)
    push(feature ? {
      id: feature.id,
      name: feature.name,
      description: feature.description,
      source: 'plugin',
      sourceLabel: feature.sourceLabel || feature.ownerPluginName,
      automation: automationLabel(feature.automation),
      automationReasons: feature.automationReasons ? [...feature.automationReasons] : undefined,
    } : {
      id: featureId,
      name: featureId,
      description: '对应扩展规则包当前未载入；该能力不会被静默自动结算。',
      source: 'plugin',
      sourceLabel: '规则包未载入',
      automation: 'manual',
    })
  }
  return features.sort((left, right) => (left.level ?? 0) - (right.level ?? 0) || left.name.localeCompare(right.name, 'zh-CN'))
}

function adaptLevelUpPlan(character: Character, classId: Dnd5eClassId, proposedSubclassId?: string): MobileLevelUpPlan | undefined {
  const plan = buildDnd5eLevelAdvancementPlan(character, classId, 1, proposedSubclassId)
  if (!plan) return undefined
  const validation = validateDnd5eMulticlassLevelGain(character, classId)
  const targetFighter = classId === 'fighter' ? {
    ...character,
    level: plan.toLevel,
    dnd5eClassLevels: { ...character.dnd5eClassLevels, fighter: plan.toClassLevel },
    dnd5eClassChoices: {
      ...character.dnd5eClassChoices,
      fighter: {
        ...character.dnd5eClassChoices?.fighter,
        subclass: proposedSubclassId ?? character.dnd5eClassChoices?.fighter?.subclass,
      },
    },
  } : undefined
  return {
    classId: plan.classId,
    className: plan.className,
    proposedSubclassId,
    hitDie: plan.hitDie,
    fromLevel: plan.fromLevel,
    toLevel: plan.toLevel,
    fromClassLevel: plan.fromClassLevel,
    toClassLevel: plan.toClassLevel,
    grantedFeatures: plan.grantedFeatures.map((feature) => ({ ...feature })),
    asiLevels: [...plan.asiLevels],
    subclassChoiceUnlocked: plan.subclassChoiceUnlocked,
    subclassRequired: plan.subclassRequired,
    subclassOptions: plan.subclassOptions.map((option) => ({ ...option })),
    choiceRequirements: plan.choiceRequirements.map((requirement) => ({
      ...requirement,
      options: requirement.options.map((option) => ({ ...option })),
      currentSelections: [...requirement.currentSelections],
    })),
    spellAdvancement: plan.spellAdvancement ? {
      previousCantrips: [...plan.spellAdvancement.previousCantrips],
      previousKnownSpells: [...plan.spellAdvancement.previousKnownSpells],
      previousWizardSpellbook: [...plan.spellAdvancement.previousWizardSpellbook],
      targetCantripCount: plan.spellAdvancement.targetCantripCount,
      targetKnownSpellCount: plan.spellAdvancement.targetKnownSpellCount,
      targetWizardSpellbookCount: plan.spellAdvancement.targetWizardSpellbookCount,
      canReplaceCantrip: plan.spellAdvancement.canReplaceCantrip,
      canReplaceKnownSpell: plan.spellAdvancement.canReplaceKnownSpell,
      highestSpellLevel: plan.spellAdvancement.highestSpellLevel,
      newlyUnlockedSpellLevels: [...plan.spellAdvancement.newlyUnlockedSpellLevels],
      cantripOptions: plan.spellAdvancement.cantripOptions.map((spell) => ({ id: spell.id, name: spell.name, level: spell.level })),
      spellOptions: plan.spellAdvancement.spellOptions.map((spell) => ({ id: spell.id, name: spell.name, level: spell.level })),
      defaultSelections: structuredClone(plan.spellAdvancement.defaultSelections),
      selectionRequired: plan.spellAdvancement.selectionRequired,
    } : undefined,
    multiclass: plan.multiclass,
    rolledHitPointsAllowed: plan.rolledHitPointsAllowed,
    featOptions: dnd5eAdvancementFeatOptions({ ...character, level: plan.toLevel }).map((feat) => ({ ...feat })),
    fighterStyleOptions: classId === 'fighter' ? FIGHTER_FIGHTING_STYLE_OPTIONS.map((style) => ({ ...style })) : undefined,
    fighterStyleTargetLimit: targetFighter ? fighterFightingStyleSelectionLimit(targetFighter) : undefined,
    fighterCurrentStyles: classId === 'fighter' ? [...(character.dnd5eClassChoices?.fighter?.fightingStyles ?? [])] : undefined,
    eligible: validation.ok,
    disabledReason: validation.ok ? undefined : ({
      'maximum-level': '角色总等级已达到 20 级。',
      'current-class-prerequisite': '当前已有职业不满足兼职离职属性前提。',
      'target-class-prerequisite': '不满足该兼职职业的属性前提。',
    } as const)[validation.reason],
  }
}

function adaptLevelUpPlans(character: Character): MobileLevelUpPlan[] {
  if (character.level >= 20) return []
  return availableDnd5eClassDefinitions().flatMap((definition) => {
    // Building a spell advancement plan walks the spell catalog.  Room event
    // refreshes can be frequent on mobile, so reject illegal multiclass
    // candidates before doing that work.  The current class always remains
    // available; other classes are exposed only when the Host prerequisites
    // are actually satisfied.
    if (!validateDnd5eMulticlassLevelGain(character, definition.id).ok) return []
    const base = buildDnd5eLevelAdvancementPlan(character, definition.id, 1)
    if (!base) return []
    if (base.subclassChoiceUnlocked && base.subclassOptions.length > 0) {
      return base.subclassOptions.flatMap((subclass) => {
        const plan = adaptLevelUpPlan(character, definition.id, subclass.id)
        return plan ? [plan] : []
      })
    }
    const plan = adaptLevelUpPlan(character, definition.id)
    return plan ? [plan] : []
  })
}

function adaptCharacter(raw: unknown): MobileCharacterView {
  const value = object(raw)
  const abilities = object(value.abilities)
  const character = {
    ...value,
    id: text(value.id),
    name: text(value.name, '未命名角色'),
    charClass: text(value.charClass),
    race: text(value.race),
    background: text(value.background),
    level: Math.max(1, num(value.level, 1)),
    abilities: {
      str: num(abilities.str, 10), dex: num(abilities.dex, 10), con: num(abilities.con, 10),
      int: num(abilities.int, 10), wis: num(abilities.wis, 10), cha: num(abilities.cha, 10),
    },
    skills: list(value.skills).map(String),
    savingThrows: list(value.savingThrows).map(String),
    dnd5eClassLevels: object(value.dnd5eClassLevels),
    dnd5eClassChoices: object(value.dnd5eClassChoices),
    dnd5eFeatIds: list(value.dnd5eFeatIds).map(String),
    dnd5ePluginFeatureIds: list(value.dnd5ePluginFeatureIds).map(String),
  } as unknown as Character
  const inventory = object(value.dnd5eInventory)
  const racialRules = dnd5eRacialRulesForCharacter(value as never)
  return {
    id: text(value.id),
    name: text(value.name, '未命名角色'),
    player: text(value.player),
    avatar: text(value.avatar, '🧙'),
    portrait: text(value.portrait) || undefined,
    tokenPortrait: text(value.tokenPortrait) || undefined,
    race: text(value.race),
    dnd5eRaceId: text(value.dnd5eRaceId) || undefined,
    dnd5eRacialChoices: object(value.dnd5eRacialChoices) as MobileCharacterView['dnd5eRacialChoices'],
    racialRules: {
      dragonbornAncestry: racialRules.dragonbornAncestry
        ? { ...racialRules.dragonbornAncestry, area: { ...racialRules.dragonbornAncestry.area } }
        : undefined,
      innateSpells: racialRules.innateSpells.map((spell) => ({ ...spell })),
    },
    charClass: text(value.charClass),
    level: Math.max(1, num(value.level, 1)),
    creationTargetLevel: num(value.dnd5eCreationTargetLevel) || undefined,
    classLevels: Object.fromEntries(
      Object.entries(normalizeDnd5eClassLevels(character))
        .filter((entry): entry is [string, number] => Number.isFinite(entry[1])),
    ),
    background: text(value.background),
    alignment: text(value.alignment) || undefined,
    experience: num(value.experience),
    abilities: {
      str: num(abilities.str, 10), dex: num(abilities.dex, 10), con: num(abilities.con, 10),
      int: num(abilities.int, 10), wis: num(abilities.wis, 10), cha: num(abilities.cha, 10),
    },
    savingThrows: list(value.savingThrows).map(String),
    skills: list(value.skills).map(String),
    maxHp: Math.max(0, num(value.maxHp)),
    currentHp: Math.max(0, num(value.currentHp)),
    tempHp: Math.max(0, num(value.tempHp)),
    ac: num(value.ac, 10),
    speed: num(value.speed, 30),
    initiativeBonus: num(value.initiativeBonus),
    saveDC: num(value.saveDC, 10),
    passivePerception: num(value.passivePerception, 10),
    conditions: [...new Set([...list(value.conditions).map(String), ...activeEffectConditions(value.dnd5eCombatState)])],
    concentrating: value.concentrating === true || !!text(object(value.dnd5eCombatState).concentrationSpellId),
    classResources: object(value.classResources) as MobileCharacterView['classResources'],
    hitPointDice: list(value.hitPointDice).map((pool) => ({
      sides: Math.max(2, num(object(pool).sides, 6)),
      current: Math.max(0, num(object(pool).current)),
      max: Math.max(0, num(object(pool).max)),
    })),
    dnd5eClassChoices: object(value.dnd5eClassChoices) as MobileCharacterView['dnd5eClassChoices'],
    classSelections: Object.values(object(object(value.dnd5eClassChoices).classes)).reduce<Record<string, string[]>>((all, rawClass) => {
      for (const [key, values] of Object.entries(object(object(rawClass).selections))) {
        all[key] = [...new Set([...(all[key] ?? []), ...list(values).map(String)])]
      }
      return all
    }, Object.fromEntries(Object.entries(object(object(value.dnd5eClassChoices).fighter).extensionChoices ?? {}).map(([key, values]) => [key, list(values).map(String)]))),
    dnd5ePluginFeatureIds: list(value.dnd5ePluginFeatureIds).map(String),
    dnd5eFeatIds: list(value.dnd5eFeatIds).map(String),
    features: adaptCharacterFeatures(character),
    levelUpPlans: adaptLevelUpPlans(character),
    levelAdvancements: list(value.dnd5eLevelAdvancements).map((rawRecord) => {
      const record = object(rawRecord) as unknown as NonNullable<Character['dnd5eLevelAdvancements']>[number]
      return {
        id: String(record.id ?? ''),
        fromLevel: Number(record.fromLevel) || 0,
        toLevel: Number(record.toLevel) || 0,
        classId: String(record.classId ?? ''),
        className: dnd5eClassDefinition(record.classId)?.name ?? String(record.classId ?? ''),
        fromClassLevel: Number(record.fromClassLevel) || 0,
        toClassLevel: Number(record.toClassLevel) || 0,
        completedAt: Number(record.completedAt) || 0,
        completedBy: record.completedBy === 'dm' ? 'dm' as const : 'player' as const,
        grantedFeatures: dnd5eLevelAdvancementGrantedFeatures(record).map((feature) => ({
          id: feature.id,
          name: feature.name,
          description: feature.description,
          source: 'class' as const,
          sourceLabel: dnd5eClassDefinition(record.classId)?.name ?? record.classId,
          level: feature.level,
        })),
      }
    }).filter((record) => !!record.id),
    dnd5eInventory: value.dnd5eInventory && typeof value.dnd5eInventory === 'object' ? {
      schemaVersion: num(inventory.schemaVersion, 2),
      revision: num(inventory.revision) || undefined,
      entries: list(inventory.entries) as NonNullable<MobileCharacterView['dnd5eInventory']>['entries'],
      currency: object(inventory.currency) as Record<string, number>,
    } : undefined,
    backstory: text(value.backstory) || undefined,
    notes: text(value.notes) || undefined,
  }
}

function characterOwned(raw: unknown, credentials: MobileCredentials): boolean {
  const value = object(raw)
  return value.ownerAccountId === credentials.account.accountId || value.roomMemberId === credentials.room.memberId
}

function adaptToken(raw: unknown, characterById: Map<string, MobileCharacterView>, credentials: MobileCredentials): PlayerTokenView {
  const value = object(raw)
  const character = characterById.get(text(value.characterId))
  const combatState = object(value.dnd5eCombatState)
  const maxHp = Math.max(1, character?.maxHp ?? num(value.maxHp, 1))
  const side = text(value.dnd5eSide) || (value.type === 'enemy' ? 'enemy' : 'player')
  const portrait = text(value.tokenPortrait) || character?.tokenPortrait || text(value.portrait) || character?.portrait
  const portraitImageId = text(value.tokenPortraitImageId) || text(value.portraitImageId)
  return {
    id: text(value.id),
    characterId: text(value.characterId) || undefined,
    x: num(value.x),
    y: num(value.y),
    name: text(value.label, character?.name ?? 'Token'),
    avatar: text(value.emoji) || character?.avatar || character?.name?.slice(0, 1) || undefined,
    portraitColor: text(value.color, side === 'enemy' ? '#ef4444' : '#22c55e'),
    portrait: portrait || undefined,
    portraitImageId: portraitImageId || undefined,
    portraitSource: portraitImageId
      ? { uri: sharedImageUrl(credentials, portraitImageId), headers: roomHeaders(credentials) }
      : portrait
        ? (publicImageUrl(credentials, portrait) ? { uri: publicImageUrl(credentials, portrait)! } : undefined)
        : undefined,
    radius: Math.max(20, num(value.size, 1) * 35),
    footprintCells: Math.max(1, Math.round(num(value.size, 1))),
    hp: Math.max(0, character?.currentHp ?? num(value.hp, maxHp)),
    maxHp,
    elevation: num(value.elevationFeet),
    controlled: value.viewerControlled === true,
    friendly: side === 'player' || value.type === 'player' || value.type === 'npc',
    conditions: [...new Set([...character?.conditions ?? [], ...activeEffectConditions(combatState)])],
  }
}

function segmentsForGeometry(raw: unknown, selectedMapId: string): OpaqueSegment[] {
  const state = list(object(raw).maps).map(object).find((map) => map.mapId === selectedMapId)
  if (!state) return []
  const segments: OpaqueSegment[] = []
  for (const wall of list(state.walls).map(object)) {
    if (wall.blocksVision === false) continue
    const points = list(wall.points).map(object)
    for (let index = 0; index + 1 < points.length; index += 1) {
      segments.push({ id: `${text(wall.id)}:${index}`, ax: num(points[index].x), ay: num(points[index].y), bx: num(points[index + 1].x), by: num(points[index + 1].y), open: false })
    }
  }
  for (const entity of [...list(state.doors), ...list(state.windows)].map(object)) {
    if (entity.blocksVision === false) continue
    const points = list(entity.points).map(object)
    if (points.length < 2) continue
    const open = entity.openState === 'open' || entity.state === 'open' || entity.windowState === 'open' || entity.windowState === 'broken' || entity.physicalState === 'destroyed'
    segments.push({ id: text(entity.id), ax: num(points[0].x), ay: num(points[0].y), bx: num(points[1].x), by: num(points[1].y), open })
  }
  return segments
}

function geometryStateForMap(raw: unknown, selectedMapId: string): Obj | undefined {
  return list(object(raw).maps).map(object).find((map) => map.mapId === selectedMapId)
}

function terrainElevationsForGeometry(raw: unknown, selectedMapId: string): MobileTerrainElevationView[] {
  const state = geometryStateForMap(raw, selectedMapId)
  if (!state) return []
  return list(state.obstacles).map(object).flatMap((obstacle) => {
    const points = list(obstacle.points).map(object).map((point) => ({ x: num(point.x), y: num(point.y) }))
    if (points.length < 3) return []
    const elevation = Number.isFinite(Number(obstacle.terrainElevationFeet))
      ? num(obstacle.terrainElevationFeet)
      : obstacle.terrainRegion === true
        ? num(obstacle.baseHeightFeet)
        : undefined
    if (elevation == null && obstacle.magicalDarkness !== true) return []
    return [{
      id: text(obstacle.id),
      label: text(obstacle.label, elevation != null ? `${elevation} 尺地形` : '魔法黑暗'),
      points,
      elevationFeet: elevation ?? 0,
      magicalDarkness: obstacle.magicalDarkness === true || undefined,
    }]
  }).filter((entry) => entry.id)
}

function lightsForGeometry(raw: unknown, selectedMapId: string): MobileMapLightView[] {
  const state = geometryStateForMap(raw, selectedMapId)
  if (!state) return []
  return list(state.lights).map(object).flatMap((light) => {
    if (light.enabled === false) return []
    const point = object(list(light.points)[0])
    if (!Object.keys(point).length) return []
    return [{
      id: text(light.id), label: text(light.label, '光源'), x: num(point.x), y: num(point.y),
      brightRadiusFeet: Math.max(0, num(light.brightRadiusFeet)),
      dimRadiusFeet: Math.max(0, num(light.dimRadiusFeet)),
      color: text(light.color, '#ffd166'), elevationFeet: num(light.elevationFeet),
    }]
  }).filter((entry) => entry.id)
}

function persistentAreasForMap(raw: unknown, activeCharacterId?: string): MobilePersistentAreaView[] {
  const map = object(raw)
  const pluginAreas = list(map.dnd5ePluginAreas).map(object).flatMap((area) => {
    if (area.hiddenFromPlayers === true && text(area.sourceCharacterId) !== activeCharacterId) return []
    const cells = list(area.cells).map(object).map((cell) => ({ col: Math.floor(num(cell.col)), row: Math.floor(num(cell.row)) }))
    if (!text(area.id) || cells.length === 0) return []
    const movement = object(area.movement)
    const visual = object(area.visual)
    const lighting = object(area.lighting)
    const anchorCell = object(area.anchorCell)
    const grants = list(area.grantedActivities).map(object).flatMap((grant) => text(grant.activityId) ? [{
      activityId: text(grant.activityId),
      label: text(grant.label) || undefined,
      activateOnCreate: grant.activateOnCreate === true || undefined,
    }] : [])
    const projected: MobilePersistentAreaView = {
      id: text(area.id), label: text(area.label, '持续区域'), color: text(area.color, '#8b5cf6'),
      ownerPluginId: text(area.pluginId) || undefined,
      sourceCharacterId: text(area.sourceCharacterId) || undefined,
      sourceTokenId: text(area.sourceTokenId) || undefined,
      coreSpellId: text(area.coreSpellId) || undefined,
      cells,
      anchorCell: Object.keys(anchorCell).length ? { col: Math.floor(num(anchorCell.col)), row: Math.floor(num(anchorCell.row)) } : undefined,
      movement: Object.keys(movement).length && (movement.economy === 'action' || movement.economy === 'bonus-action')
        ? { economy: movement.economy, maximumFeet: Math.max(0, num(movement.maximumFeet)) }
        : undefined,
      grantedActivities: grants.length ? grants : undefined,
      grantedActivityUseReceipts: list(area.grantedActivityUseReceipts).map(String),
      visual: text(visual.preset) ? { preset: text(visual.preset), intensity: ['subtle', 'normal', 'strong'].includes(text(visual.intensity)) ? text(visual.intensity) as 'subtle' | 'normal' | 'strong' : undefined } : undefined,
      lighting: lighting.kind === 'light'
        ? { kind: 'light', brightRadiusFeet: Math.max(0, num(lighting.brightRadiusFeet)), dimRadiusFeet: Math.max(0, num(lighting.dimRadiusFeet)), color: text(lighting.color, '#ffd166') }
        : lighting.kind === 'magical-darkness'
          ? { kind: 'magical-darkness', radiusFeet: Math.max(0, num(lighting.radiusFeet)) }
          : undefined,
      obscuration: ['light', 'heavy'].includes(text(object(area.obscuration).kind)) ? text(object(area.obscuration).kind) as 'light' | 'heavy' : undefined,
      movementCostMultiplier: Number.isFinite(Number(area.movementCostMultiplier)) ? Math.max(1, num(area.movementCostMultiplier, 1)) : undefined,
    }
    return [projected]
  })
  const itemAreas = list(map.dnd5eItemAreas).map(object).flatMap((area) => {
    const cells = list(area.cells).map(object).map((cell) => ({ col: Math.floor(num(cell.col)), row: Math.floor(num(cell.row)) }))
    if (!text(area.id) || cells.length === 0) return []
    const labels: Record<string, string> = { 'ball-bearings': '滚珠', caltrops: '铁蒺藜', 'hunting-trap': '捕猎陷阱' }
    return [{ id: text(area.id), label: text(area.sourceItemName, labels[text(area.kind)] ?? '道具区域'), color: '#fbbf24', sourceCharacterId: text(area.sourceCharacterId) || undefined, sourceTokenId: text(area.sourceTokenId) || undefined, cells } satisfies MobilePersistentAreaView]
  })
  return [...pluginAreas, ...itemAreas]
}

function explorationPolygons(raw: unknown, selectedMapId: string): WorldPoint[][] {
  const map = list(object(raw).maps).map(object).find((entry) => entry.mapId === selectedMapId)
  if (!map) return []
  return Object.values(object(map.byMemberId)).flatMap((member) =>
    list(object(member).polygons).map((polygon) => list(polygon).map((point) => ({ x: num(object(point).x), y: num(object(point).y) }))))
}

function adaptCombat(raw: unknown, selectedMapId: string, credentials: MobileCredentials): MobileCombatView | null {
  const state = object(raw)
  if (!Object.keys(state).length) return null
  const order = list(state.initiativeOrder).map((entry) => {
    const value = object(entry)
    const portrait = text(value.portrait)
    const portraitImageId = text(value.portraitImageId)
    return {
      tokenId: text(value.tokenId), label: text(value.label), roll: num(value.roll),
      color: text(value.color) || undefined, portrait: portrait || undefined,
      portraitImageId: portraitImageId || undefined,
      portraitSource: portraitImageId
        ? { uri: sharedImageUrl(credentials, portraitImageId), headers: roomHeaders(credentials) }
        : portrait
          ? (publicImageUrl(credentials, portrait) ? { uri: publicImageUrl(credentials, portrait)! } : undefined)
          : undefined,
    }
  })
  const index = Math.max(0, num(state.initiativeIndex))
  return {
    mapId: text(state.mapId, selectedMapId), combatId: text(state.combatId) || undefined,
    active: bool(state.active), round: Math.max(1, num(state.round, 1)), initiativeIndex: index,
    settlementMode: text(state.settlementMode) || undefined, initiativeOrder: order,
    currentTokenId: order[index]?.tokenId,
    turnEconomy: object(state.dnd5eTurnEconomyByToken) as MobileCombatView['turnEconomy'],
  }
}

type SelectedSpellFlags = Pick<MobileSpellView, 'prepared' | 'known' | 'inSpellbook' | 'castingClassId' | 'preparationSelection' | 'racialInnate' | 'racialCastAtLevel'>

function selectedSpellIds(character: MobileCharacterView): Map<string, SelectedSpellFlags> {
  const selected = new Map<string, SelectedSpellFlags>()
  const classes = character.dnd5eClassChoices?.classes ?? {}
  for (const [classId, definition] of Object.entries(classes)) {
    for (const [key, ids] of Object.entries(definition.selections ?? {})) {
      for (const id of ids ?? []) {
        const current = selected.get(id) ?? { prepared: false, known: false, inSpellbook: false, castingClassId: classId }
        if (key.includes('prepared')) {
          current.prepared = true
          current.preparationSelection = { owner: 'classes', classId, key }
        }
        if (key.includes('known') || key.includes('cantrip')) current.known = true
        if (key.includes('spellbook')) current.inSpellbook = true
        selected.set(id, current)
      }
    }
    if (classId === 'wizard') {
      for (const id of definition.selections?.['wizard-spellbook'] ?? []) {
        const current = selected.get(id)
        if (current) current.preparationSelection = { owner: 'classes', classId, key: 'spell-prepared' }
      }
    }
  }
  const fighterSelections = character.dnd5eClassChoices?.fighter?.extensionChoices ?? {}
  for (const [key, ids] of Object.entries(fighterSelections)) {
    for (const id of ids ?? []) {
      const current = selected.get(id) ?? { prepared: false, known: false, inSpellbook: false, castingClassId: 'fighter' }
      if (key.includes('prepared')) {
        current.prepared = true
        current.preparationSelection = { owner: 'fighter', classId: 'fighter', key }
      }
      if (key.includes('known') || key.includes('cantrip')) current.known = true
      if (key.includes('spellbook')) current.inSpellbook = true
      selected.set(id, current)
    }
  }
  for (const grant of character.racialRules?.innateSpells ?? []) {
    selected.set(grant.spellId, {
      prepared: true,
      known: true,
      inSpellbook: false,
      racialInnate: true,
      racialCastAtLevel: grant.castAtLevel,
    })
  }
  return selected
}

function adaptRestAdvances(raw: unknown, ownedCharacterIds: ReadonlySet<string>): MobileRestAdvance[] {
  return list(object(raw).advances).map(object)
    .filter((advance) => advance.kind === 'short-rest' || advance.kind === 'long-rest')
    .map((advance): MobileRestAdvance => ({
      id: text(advance.id),
      kind: advance.kind as MobileRestAdvance['kind'],
      toWorldMinute: num(advance.toWorldMinute),
      reason: text(advance.reason),
      createdAt: num(advance.createdAt),
      beneficiaryCharacterIds: list(advance.beneficiaryCharacterIds).map(String),
      recoveryReports: list(advance.restRecoveryReports).map(object)
        .filter((report) => ownedCharacterIds.has(text(report.characterId)))
        .map((report) => ({
          characterId: text(report.characterId),
          characterName: text(report.characterName, '角色'),
          entries: list(report.entries).map(object).map((entry) => ({
            category: text(entry.category) as MobileRestAdvance['recoveryReports'][number]['entries'][number]['category'],
            label: text(entry.label),
            outcome: text(entry.outcome) as MobileRestAdvance['recoveryReports'][number]['entries'][number]['outcome'],
            before: Number.isFinite(Number(entry.before)) ? num(entry.before) : undefined,
            after: Number.isFinite(Number(entry.after)) ? num(entry.after) : undefined,
            maximum: Number.isFinite(Number(entry.maximum)) ? num(entry.maximum) : undefined,
            detail: text(entry.detail) || undefined,
          })),
        })),
    }))
    .filter((advance) => advance.id && advance.recoveryReports.length > 0)
    .sort((left, right) => right.createdAt - left.createdAt)
}

function campaignTimeLabel(raw: Record<string, unknown>): string {
  const worldMinute = Math.max(0, Math.floor(num(raw.worldMinute)))
  const displayMinute = Math.max(0, Math.floor(worldMinute + num(raw.displayMinuteOffset)))
  const minuteOfDay = displayMinute % 1_440
  const hour = Math.floor(minuteOfDay / 60).toString().padStart(2, '0')
  const minute = (minuteOfDay % 60).toString().padStart(2, '0')
  if (raw.displayMode === 'gregorian' && /^\d{4}-\d{2}-\d{2}$/.test(text(raw.calendarEpochDate))) {
    const epoch = new Date(`${text(raw.calendarEpochDate)}T00:00:00Z`)
    if (!Number.isNaN(epoch.getTime())) {
      epoch.setUTCDate(epoch.getUTCDate() + Math.floor(displayMinute / 1_440))
      return `${epoch.getUTCFullYear()}年${epoch.getUTCMonth() + 1}月${epoch.getUTCDate()}日 ${hour}:${minute}`
    }
  }
  return `第 ${Math.floor(displayMinute / 1_440) + 1} 日 ${hour}:${minute}`
}

function adaptCampaignTime(raw: unknown): MobilePlayerWorkspace['campaignTime'] {
  const clock = object(raw)
  const worldMinute = Math.max(0, Math.floor(num(clock.worldMinute)))
  return {
    schemaVersion: 1,
    worldMinute,
    displayMode: clock.displayMode === 'gregorian' ? 'gregorian' : 'campaign-day',
    displayMinuteOffset: Math.floor(num(clock.displayMinuteOffset)),
    calendarEpochDate: text(clock.calendarEpochDate) || undefined,
    formatted: campaignTimeLabel(clock),
    updatedAt: num(clock.updatedAt),
    activeTimers: list(clock.timers).map(object)
      .filter((timer) => timer.status === 'active' && num(timer.expiresAtWorldMinute) > worldMinute)
      .map((timer) => ({
        id: text(timer.id),
        kind: timer.kind === 'concentration' ? 'concentration' as const : 'reminder' as const,
        label: text(timer.label, '计时提醒'),
        expiresAtWorldMinute: num(timer.expiresAtWorldMinute),
        remainingMinutes: Math.max(0, num(timer.expiresAtWorldMinute) - worldMinute),
        characterName: text(timer.characterName) || undefined,
      }))
      .filter((timer) => timer.id),
  }
}

function adaptSpells(character: MobileCharacterView | null, importedRaw: unknown): MobileSpellView[] {
  if (!character) return []
  const selected = selectedSpellIds(character)
  const imported = new Map(list(object(importedRaw).spells).map((spell) => [text(object(spell).id), object(spell)]))
  const combatIds = new Set(DND5E_SRD_COMBAT_SPELLS.map((spell) => spell.id))
  return [...selected.entries()].map(([id, flags]): MobileSpellView => {
    const catalog = DND5E_SRD_SPELL_CATALOG.find((spell) => spell.id === id)
    const plugin = dnd5ePluginSpellDefinition(id)
    const custom = imported.get(id)
    const automation = plugin?.automation.mode ?? text(object(custom?.automation).mode)
    const combat = DND5E_SRD_COMBAT_SPELLS.find((spell) => spell.id === id)
    const headless = combatIds.has(id) || automation === 'headless-action'
    const school = plugin?.school ?? (text(custom?.school) || combat?.school)
    const components = plugin?.components ?? object(custom?.components)
    const duration = plugin?.duration ?? object(custom?.duration)
    const range = plugin?.range
    const pluginShape = range?.shape
    const pluginArea = pluginShape ? {
      shape: pluginShape === 'cone' || pluginShape === 'line' || pluginShape === 'rect'
        ? pluginShape
        : pluginShape === 'cube'
          ? 'rect' as const
          : 'circle' as const,
      origin: range?.type === 'self' ? 'self' as const : 'point' as const,
      ...(pluginShape === 'radius' || pluginShape === 'sphere' || pluginShape === 'cylinder'
        ? { radiusFeet: range.sizeFeet }
        : {}),
      ...(pluginShape === 'cone' || pluginShape === 'line'
        ? { lengthFeet: range.sizeFeet }
        : {}),
      ...(pluginShape === 'cube' || pluginShape === 'rect'
        ? { widthFeet: range.widthFeet ?? range.sizeFeet, heightFeet: range.heightFeet ?? range.sizeFeet }
        : {}),
      ...(range.type === 'distance' && range.feet != null ? { placeRangeFeet: range.feet } : {}),
    } : undefined
    const pluginTarget = pluginArea
      ? 'area' as const
      : plugin?.targeting?.relation === 'ally'
        ? 'ally' as const
        : plugin?.targeting?.relation === 'enemy'
          ? 'hostile' as const
          : plugin
            ? 'creature' as const
            : undefined
    return {
      id,
      name: catalog?.name ?? plugin?.name ?? text(custom?.name, id),
      englishName: catalog?.englishName ?? plugin?.englishName ?? (text(custom?.englishName) || undefined),
      level: catalog?.level ?? plugin?.level ?? num(custom?.level),
      classes: [...(catalog?.classes ?? plugin?.classes ?? list(custom?.classes).map(String))],
      headless,
      automationLevel: headless ? 'full' : 'manual',
      automationReason: plugin && !headless ? '该工坊法术仅声明规则资料，尚未声明可执行的 Headless action。' : undefined,
      catalogOnly: !custom && !plugin && !combatIds.has(id),
      ...flags,
      castingTime: combat?.castingTime ?? (plugin?.castingTime.unit === 'bonus-action'
        ? 'bonus-action'
        : plugin?.castingTime.unit === 'reaction'
          ? 'reaction'
          : plugin
            ? 'action'
            : undefined),
      school: school || undefined,
      ritual: plugin?.ritual ?? custom?.ritual === true,
      description: plugin?.description ?? (text(custom?.description) || combat?.description || undefined),
      higherLevels: plugin?.higherLevels ?? (text(custom?.higherLevels) || undefined),
      components: Object.keys(components).length ? {
        verbal: bool(components.verbal),
        somatic: bool(components.somatic),
        material: bool(components.material),
        materialText: text(components.materialText) || undefined,
      } : undefined,
      duration: Object.keys(duration).length ? {
        type: text(duration.type, 'instantaneous'),
        value: Number.isFinite(Number(duration.value)) ? num(duration.value) : undefined,
        unit: text(duration.unit) || undefined,
        concentration: bool(duration.concentration),
      } : combat ? {
        type: combat.concentration ? 'timed' : 'instantaneous',
        value: combat.concentrationDurationRounds,
        unit: combat.concentrationDurationRounds ? 'round' : undefined,
        concentration: combat.concentration === true,
      } : undefined,
      rangeFeet: combat?.rangeFeet ?? range?.feet ?? (range?.type === 'touch' ? 5 : range?.type === 'self' ? 0 : undefined),
      target: combat?.target ?? pluginTarget,
      requiresVisibleTarget: combat?.requiresVisibleTarget,
      area: combat?.area ? {
        shape: combat.area.shape,
        origin: combat.area.origin,
        ...('radiusFeet' in combat.area ? { radiusFeet: combat.area.radiusFeet } : {}),
        ...('widthFeet' in combat.area ? { widthFeet: combat.area.widthFeet } : {}),
        ...('heightFeet' in combat.area ? { heightFeet: combat.area.heightFeet } : {}),
        ...('lengthFeet' in combat.area ? { lengthFeet: combat.area.lengthFeet } : {}),
        ...('placeRangeFeet' in combat.area ? { placeRangeFeet: combat.area.placeRangeFeet } : {}),
        ...('aimRangeFeet' in combat.area ? { aimRangeFeet: combat.area.aimRangeFeet } : {}),
      } : pluginArea,
      maximumTargets: combat?.maximumTargets ?? plugin?.targeting?.maximumTargets,
      additionalTargetsPerHigherSlot: combat?.additionalTargetsPerHigherSlot,
      baseProjectiles: combat?.baseProjectiles,
      additionalProjectilesPerHigherSlot: combat?.additionalProjectilesPerHigherSlot,
      allowDuplicateTargets: combat?.id === 'magic-missile' || combat?.id === 'eldritch-blast' || combat?.baseProjectiles != null,
      areaTargetCount: combat?.areaTargetCount,
      minimumAreaTargetCount: combat?.minimumAreaTargetCount,
    }
  }).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, 'zh-CN'))
}

function adaptInteractionPoints(raw: unknown, selectedMapId: string | null): MobileSceneInteractionPoint[] {
  if (!selectedMapId) return []
  return list(object(raw).scenes).map(object)
    .filter((scene) => scene.mapId === selectedMapId)
    .flatMap((scene) => list(scene.interactionPoints).map(object))
    .filter((point) => point.enabled !== false && point.visibleToPlayers === true)
    .map((point) => ({
      id: text(point.id), mapId: selectedMapId, name: text(point.name, '互动点'),
      icon: text(point.icon, 'search'), x: num(point.x), y: num(point.y),
      interactionRadiusFeet: Math.max(0, num(point.interactionRadiusFeet, 5)),
      prompt: text(point.prompt, '点击互动'),
    }))
    .filter((point) => point.id)
}

export function buildMobileWorkspace(input: {
  credentials: MobileCredentials
  rules: MobileRoomRules | null
  activeCharacterId: string | null
  resources: Record<string, unknown>
  voice?: Record<string, unknown> | null
}): MobilePlayerWorkspace {
  const mapsState = object(input.resources.maps)
  const maps = list(mapsState.maps).map(object)
  const selectedMapId = text(mapsState.selectedId) || text(maps[0]?.id) || null
  const selectedMap = maps.find((map) => map.id === selectedMapId)
  const rawCharacters = list(object(input.resources.characters).characters)
  const ownedRaw = rawCharacters.filter((character) => characterOwned(character, input.credentials))
  const characters = ownedRaw.map(adaptCharacter)
  const ownedCharacterIds = new Set(characters.map((character) => character.id))
  const activeCharacter = characters.find((character) => character.id === input.activeCharacterId) ?? characters[0] ?? null
  const characterById = new Map(characters.map((character) => [character.id, character]))
  const visibleTokens = list(selectedMap?.tokens).map((token) => adaptToken(token, characterById, input.credentials)).filter((token) => token.id)
  const controlledTokens = visibleTokens.filter((token) => token.controlled || characterById.has(text(object(list(selectedMap?.tokens).find((raw) => object(raw).id === token.id)).characterId)))
  const combat = selectedMapId ? adaptCombat(input.resources.combat, selectedMapId, input.credentials) : null
  const visibilityPolygons = selectedMapId ? explorationPolygons(input.resources['map-exploration'], selectedMapId) : []
  const scene: PlayerSceneSnapshot | null = selectedMap && selectedMapId ? {
    schemaVersion: 1,
    protocolVersion: 1,
    sceneId: selectedMapId,
    revision: num(object(mapsState._sync).revision, num(mapsState.updatedAt)),
    mapManifest: {
      schemaVersion: 1, assetId: selectedMapId, assetHash: `${selectedMapId}:${num(mapsState.updatedAt)}`,
      revision: num(object(mapsState._sync).revision, num(mapsState.updatedAt)),
      worldWidth: Math.max(1, num(selectedMap.width)), worldHeight: Math.max(1, num(selectedMap.height)),
      tileSize: 512, imageFormat: 'png', zoomLevels: [{ level: 0, scale: 1, pixelWidth: num(selectedMap.width), pixelHeight: num(selectedMap.height), columns: 1, rows: 1 }],
      preview: { url: mapImageUrl(input.credentials, selectedMapId), width: num(selectedMap.width), height: num(selectedMap.height) },
      tileUrlTemplate: '', delivery: 'single-image',
      singleImage: { url: mapImageUrl(input.credentials, selectedMapId), headers: roomHeaders(input.credentials) },
      grid: { type: selectedMap.showGrid === false ? 'none' : 'square', sizeWorldUnits: Math.max(1, num(selectedMap.gridSize, 70)), offsetX: num(selectedMap.gridOffsetX), offsetY: num(selectedMap.gridOffsetY) },
    },
    controlledTokens, visibleTokens,
    opaqueSegments: segmentsForGeometry(input.resources['map-geometry'], selectedMapId),
    persistentAreas: persistentAreasForMap(selectedMap, activeCharacter?.id),
    terrainElevations: terrainElevationsForGeometry(input.resources['map-geometry'], selectedMapId),
    lights: lightsForGeometry(input.resources['map-geometry'], selectedMapId),
    fogChunks: [],
    visibilityPolygons,
    visionMaskEnabled: visibilityPolygons.length > 0,
    initiative: combat?.active && combat.currentTokenId ? { round: combat.round, currentTokenId: combat.currentTokenId, orderedTokenIds: combat.initiativeOrder.map((entry) => entry.tokenId) } : undefined,
  } : null
  const chat = list(object(input.resources['room-chat']).messages) as MobilePlayerWorkspace['chat']
  const journal = object(input.resources['room-journal'])
  const interrupts = list(object(input.resources['combat-interrupts']).interrupts).map((raw) => {
    const value = object(raw)
    return { id: text(value.id), mapId: text(value.mapId), kind: text(value.kind), status: text(value.status), actorCharId: text(value.actorCharId) || undefined, targetCharId: text(value.targetCharId) || undefined, payload: object(value.payload), contributions: list(value.contributions) as MobilePlayerWorkspace['interrupts'][number]['contributions'], createdAt: num(value.createdAt) || undefined, expiresAt: num(value.expiresAt) || undefined, updatedAt: num(value.updatedAt) }
  })
  return {
    schemaVersion: 1, fetchedAt: Date.now(), room: input.credentials.room, rules: input.rules,
    scene, maps: maps.map((map) => ({ id: text(map.id), name: text(map.name), width: num(map.width), height: num(map.height) })), selectedMapId,
    characters, activeCharacterId: activeCharacter?.id ?? null,
    spells: adaptSpells(activeCharacter, input.resources.spellbook), combat,
    chat, combatLog: list(object(input.resources['combat-log']).entries) as MobilePlayerWorkspace['combatLog'],
    interrupts, actionAck: Object.keys(object(input.resources['player-action-ack'])).length ? input.resources['player-action-ack'] as MobilePlayerWorkspace['actionAck'] : null,
    actionRegistry: emptyMobileActionRegistry(),
    interruptRegistry: buildMobileInterruptRegistry(),
    handouts: list(journal.handouts).map((entry) => {
      const handout = object(entry)
      const imageId = text(handout.imageId)
      return {
        id: text(handout.id), title: text(handout.title, '未命名讲义'), body: text(handout.body),
        imageId: imageId || undefined,
        imageName: text(handout.imageName) || undefined,
        imageMimeType: text(handout.imageMimeType) || undefined,
        imageSource: imageId ? { uri: sharedImageUrl(input.credentials, imageId), headers: roomHeaders(input.credentials) } : undefined,
        createdAt: num(handout.createdAt),
      }
    }).filter((entry) => entry.id),
    campaignJournal: list(journal.campaignEntries).map((entry) => {
      const campaignEntry = object(entry)
      return {
        id: text(campaignEntry.id),
        title: text(campaignEntry.title, '未命名篇章'),
        body: text(campaignEntry.body),
        source: (campaignEntry.source === 'combat-summary' ? 'combat-summary' : 'dm') as 'dm' | 'combat-summary',
        authorName: text(campaignEntry.authorName) || undefined,
        createdAt: num(campaignEntry.createdAt),
        updatedAt: num(campaignEntry.updatedAt),
      }
    }).filter((entry) => entry.id).sort((left, right) => right.createdAt - left.createdAt),
    sharedNotes: list(journal.sharedNotes).map((entry) => {
      const note = object(entry)
      return {
        id: text(note.id),
        kind: (note.kind === 'task' || note.kind === 'clue' ? note.kind : 'note') as 'task' | 'clue' | 'note',
        status: (note.status === 'done' ? 'done' : 'open') as 'open' | 'done',
        title: text(note.title, '未命名笔记'),
        body: text(note.body),
        authorMemberId: text(note.authorMemberId) || undefined,
        authorName: text(note.authorName) || undefined,
        updatedAt: num(note.updatedAt) || undefined,
      }
    }).filter((entry) => entry.id),
    interactionPoints: adaptInteractionPoints(input.resources['scene-orchestration'], selectedMapId),
    restAdvances: adaptRestAdvances(input.resources['campaign-time'], ownedCharacterIds),
    campaignTime: adaptCampaignTime(input.resources['campaign-time']),
    voice: { enabled: input.voice?.enabled === true, reason: text(input.voice?.reason) || undefined },
  }
}
