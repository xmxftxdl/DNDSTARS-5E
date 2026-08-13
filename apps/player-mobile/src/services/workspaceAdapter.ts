import { DND5E_SRD_SPELL_CATALOG } from '../../../../src/rulesets/dnd5e/spellCatalog'
import { DND5E_SRD_COMBAT_SPELLS } from '../../../../src/rulesets/dnd5e/spells'
import { dnd5eRacialRulesForCharacter } from '../../../../src/rulesets/dnd5e/racialAutomation'
import type {
  MobileCharacterView,
  MobileCombatView,
  MobilePlayerWorkspace,
  MobileRoomRules,
  MobileRestAdvance,
  MobileSceneInteractionPoint,
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

function activeEffectConditions(state: unknown): string[] {
  const combat = object(state)
  const active = list(combat.activeEffects).map(object)
  const effectConditions = active.flatMap((effect) => {
    const id = text(effect.conditionId) || text(effect.rulesId)
    return id ? [id] : []
  })
  return [...new Set([...list(combat.conditions).map(String), ...effectConditions])]
}

function adaptCharacter(raw: unknown): MobileCharacterView {
  const value = object(raw)
  const abilities = object(value.abilities)
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
    classLevels: object(value.dnd5eClassLevels) as Record<string, number>,
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
  const portrait = text(value.tokenPortrait) || text(value.portrait) || character?.tokenPortrait || character?.portrait
  const portraitImageId = text(value.tokenPortraitImageId) || text(value.portraitImageId)
  return {
    id: text(value.id),
    characterId: text(value.characterId) || undefined,
    x: num(value.x),
    y: num(value.y),
    name: text(value.label, character?.name ?? 'Token'),
    portraitColor: text(value.color, side === 'enemy' ? '#ef4444' : '#22c55e'),
    portrait: portrait || undefined,
    portraitImageId: portraitImageId || undefined,
    portraitSource: portrait
      ? { uri: portrait }
      : portraitImageId
        ? { uri: sharedImageUrl(credentials, portraitImageId), headers: roomHeaders(credentials) }
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
      portraitSource: portrait
        ? { uri: portrait }
        : portraitImageId
          ? { uri: sharedImageUrl(credentials, portraitImageId), headers: roomHeaders(credentials) }
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

function adaptSpells(character: MobileCharacterView | null, importedRaw: unknown): MobileSpellView[] {
  if (!character) return []
  const selected = selectedSpellIds(character)
  const imported = new Map(list(object(importedRaw).spells).map((spell) => [text(object(spell).id), object(spell)]))
  const combatIds = new Set(DND5E_SRD_COMBAT_SPELLS.map((spell) => spell.id))
  return [...selected.entries()].map(([id, flags]): MobileSpellView => {
    const catalog = DND5E_SRD_SPELL_CATALOG.find((spell) => spell.id === id)
    const custom = imported.get(id)
    const automation = text(object(custom?.automation).mode)
    const combat = DND5E_SRD_COMBAT_SPELLS.find((spell) => spell.id === id)
    const headless = combatIds.has(id) || automation === 'headless-action'
    const school = text(custom?.school) || combat?.school
    const components = object(custom?.components)
    const duration = object(custom?.duration)
    return {
      id,
      name: catalog?.name ?? text(custom?.name, id),
      englishName: catalog?.englishName ?? (text(custom?.englishName) || undefined),
      level: catalog?.level ?? num(custom?.level),
      classes: [...(catalog?.classes ?? list(custom?.classes).map(String))],
      headless,
      automationLevel: headless ? 'full' : 'manual',
      catalogOnly: !custom && !combatIds.has(id),
      ...flags,
      castingTime: combat?.castingTime,
      school: school || undefined,
      ritual: custom?.ritual === true,
      description: text(custom?.description) || combat?.description || undefined,
      higherLevels: text(custom?.higherLevels) || undefined,
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
      rangeFeet: combat?.rangeFeet,
      target: combat?.target,
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
      } : undefined,
      maximumTargets: combat?.maximumTargets,
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
    voice: { enabled: input.voice?.enabled === true, reason: text(input.voice?.reason) || undefined },
  }
}
