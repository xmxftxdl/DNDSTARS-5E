export const MOBILE_PLAYER_PROTOCOL_VERSION = 1 as const

export type MobileRenderQuality = 'lite' | 'standard' | 'high'

export interface WorldPoint {
  x: number
  y: number
}

export interface CameraState extends WorldPoint {
  scale: number
}

export interface MapAssetManifest {
  schemaVersion: 1
  assetId: string
  assetHash: string
  revision: number
  worldWidth: number
  worldHeight: number
  tileSize: 256 | 512
  imageFormat: 'png' | 'webp' | 'jpeg' | 'avif'
  zoomLevels: Array<{
    level: number
    scale: number
    pixelWidth: number
    pixelHeight: number
    columns: number
    rows: number
  }>
  preview: { url: string; width: number; height: number }
  tileUrlTemplate: string
  /** Existing desktop rooms currently expose one authenticated map image. */
  delivery?: 'tiles' | 'single-image'
  singleImage?: {
    url: string
    headers?: Record<string, string>
  }
  grid?: {
    type: 'square' | 'hex-flat' | 'hex-pointy' | 'none'
    sizeWorldUnits: number
    offsetX: number
    offsetY: number
  }
}

export interface MobileAccountSession {
  accountId: string
  displayName: string
  avatar?: string
  username?: string
  contactChannel?: 'email' | 'phone'
  contactLabel?: string
  sessionToken: string
  createdAt: number
}

export interface MobileCampaignSummary {
  campaignId: string
  name: string
  description: string
  rulesetId: 'dnd5e-2014-srd-5.1'
  archived: boolean
  roomCount: number
  latestRoom?: {
    roomId: string
    roomName: string
    hostOnline: boolean
    status: 'online' | 'grace' | 'offline' | 'closed'
  }
}

export interface MobileRoomSession {
  roomId: string
  campaignId?: string
  roomName: string
  rulesetId: 'dnd5e-2014-srd-5.1'
  memberId: string
  roomToken: string
  accountId?: string
  clientId: string
  role: 'player' | 'spectator'
  slot?: `player${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`
  displayName: string
  createdAt: number
}

export interface MobileRoomRules {
  schemaVersion: 1
  roomId: string
  rulesetId: 'dnd5e-2014-srd-5.1'
  revision: number
  hash: string
  updatedAt: number
  requiredPlugins: Array<{ id: string; version: string; integrity: string; stateSchemaVersion: number }>
  plugins: Array<{
    id: string
    version: string
    integrity: string
    stateSchemaVersion: number
    name: string
    publisher: string
    license: string
  }>
  member: {
    ready: boolean
    missing: Array<{ id: string; version: string; integrity: string; stateSchemaVersion: number }>
    mismatched: Array<{ id: string; version: string; integrity: string; stateSchemaVersion: number }>
  }
}

export interface MobileInventoryEntry {
  instanceId: string
  templateId: string
  quantity: number
  equippedSlot?: string
  attuned?: boolean
  attunementPending?: boolean
  identified?: boolean
  containerInstanceId?: string
  resources?: Record<string, { id: string; label: string; current: number; maximum: number; resetOn: string }>
  item: {
    id: string
    name: string
    englishName?: string
    category: string
    icon: string
    description: string
    rulesText: string
    weightLb?: number
    containerCapacityWeightLb?: number
    equipment?: { slot?: string; name?: string; [key: string]: unknown }
    use?: Record<string, unknown>
    useActions?: Array<Record<string, unknown> & { id: string; label: string }>
    magicItem?: { kind: string; rarity: string; automation: string; attunement: string; attunementRequirement?: string }
  }
}

export interface MobileImageSource {
  uri: string
  headers?: Record<string, string>
}

export interface MobileCharacterView {
  id: string
  name: string
  player: string
  avatar: string
  portrait?: string
  tokenPortrait?: string
  race: string
  dnd5eRaceId?: string
  dnd5eRacialChoices?: { dragonbornAncestry?: string }
  racialRules?: {
    dragonbornAncestry?: {
      id: string
      name: string
      damageType: string
      saveAbility: 'dex' | 'con'
      area: { shape: 'line' | 'cone'; lengthFeet: number; widthFeet?: number }
    }
    innateSpells: Array<{
      spellId: string
      minimumLevel: number
      ability: string
      castAtLevel: number
      resetOn: 'at-will' | 'long-rest'
    }>
  }
  charClass: string
  level: number
  classLevels?: Record<string, number>
  background: string
  alignment?: string
  experience: number
  abilities: Record<'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha', number>
  savingThrows: string[]
  skills: string[]
  maxHp: number
  currentHp: number
  tempHp: number
  ac: number
  speed: number
  initiativeBonus: number
  saveDC: number
  passivePerception: number
  conditions: string[]
  concentrating?: boolean
  classResources?: Record<string, { current: number; max: number }>
  hitPointDice?: Array<{ sides: number; current: number; max: number }>
  dnd5eClassChoices?: {
    fighter?: {
      subclass?: string
      fightingStyles?: string[]
      extensionChoices?: Record<string, string[]>
    }
    classes?: Record<string, {
      subclass?: string
      selections?: Record<string, string[]>
    }>
  }
  /** Flattened, read-only class selections used to expose Host-supported actions. */
  classSelections?: Record<string, string[]>
  dnd5ePluginFeatureIds?: string[]
  dnd5eFeatIds?: string[]
  dnd5eInventory?: {
    schemaVersion: number
    revision?: number
    entries: MobileInventoryEntry[]
    currency?: Record<string, number>
  }
  backstory?: string
  notes?: string
}

export interface MobileSpellView {
  id: string
  name: string
  englishName?: string
  level: number
  classes: string[]
  headless: boolean
  automationLevel: 'full' | 'partial' | 'manual'
  automationReason?: string
  catalogOnly: boolean
  prepared: boolean
  known: boolean
  inSpellbook: boolean
  castingClassId?: string
  racialInnate?: boolean
  racialCastAtLevel?: number
  /** Exact persisted selection path used when the owner prepares/unprepares this spell. */
  preparationSelection?: {
    owner: 'classes' | 'fighter'
    classId: string
    key: string
  }
  castingTime?: 'action' | 'bonus-action' | 'reaction'
  school?: string
  ritual?: boolean
  description?: string
  higherLevels?: string
  components?: {
    verbal: boolean
    somatic: boolean
    material: boolean
    materialText?: string
  }
  duration?: {
    type: string
    value?: number
    unit?: string
    concentration: boolean
  }
  rangeFeet?: number
  target?: 'hostile' | 'ally' | 'creature' | 'area'
  requiresVisibleTarget?: boolean | 'primary' | 'placement'
  area?: {
    shape: 'circle' | 'rect' | 'cone' | 'line'
    origin: 'self' | 'point'
    radiusFeet?: number
    widthFeet?: number
    heightFeet?: number
    lengthFeet?: number
    placeRangeFeet?: number
    aimRangeFeet?: number
  }
  /** Host-authored targeting limits used by the mobile picker. The Host still revalidates them. */
  maximumTargets?: number
  additionalTargetsPerHigherSlot?: number
  baseProjectiles?: number
  additionalProjectilesPerHigherSlot?: number
  allowDuplicateTargets?: boolean
  areaTargetCount?: number
  minimumAreaTargetCount?: number
}

export interface MobileSceneInteractionPoint {
  id: string
  mapId: string
  name: string
  icon: string
  x: number
  y: number
  interactionRadiusFeet: number
  prompt: string
}

export interface MobileRestRecoveryEntry {
  category: 'hit-points' | 'hit-dice' | 'feature-resource' | 'item-resource' | 'state'
  label: string
  outcome: 'restored' | 'cleared' | 'available' | 'unchanged' | 'blocked'
  before?: number
  after?: number
  maximum?: number
  detail?: string
}

export interface MobileRestAdvance {
  id: string
  kind: 'short-rest' | 'long-rest'
  toWorldMinute: number
  reason: string
  createdAt: number
  beneficiaryCharacterIds?: string[]
  recoveryReports: Array<{
    characterId: string
    characterName: string
    entries: MobileRestRecoveryEntry[]
  }>
}

export interface MobileCombatView {
  mapId: string
  combatId?: string
  active: boolean
  round: number
  initiativeIndex: number
  settlementMode?: string
  initiativeOrder: Array<{
    tokenId: string
    label: string
    roll: number
    color?: string
    portrait?: string
    portraitImageId?: string
    portraitSource?: MobileImageSource
  }>
  currentTokenId?: string
  turnEconomy?: Record<string, {
    action?: number
    bonusAction?: number
    reaction?: number
    movementFeet?: number
    [key: string]: unknown
  }>
}

export interface MobileChatMessage {
  id: string
  channel: 'ic' | 'ooc' | 'dm-private'
  createdAt: number
  senderMemberId: string
  senderRole: 'dm' | 'player'
  senderDisplayName: string
  recipientMemberId?: string
  persona: { kind: 'dm' | 'player' | 'character' | 'npc'; name: string; avatar: string; sourceId?: string }
  text: string
  roll?: { expression: string; values: number[]; total: number; label?: string }
}

export interface MobileCombatLogEntry {
  id: number
  round: number
  text: string
  kind: 'system' | 'turn' | 'attack' | 'damage'
  time: string
  actorTokenId?: string
  details?: string[]
}

export interface MobileInterruptView {
  id: string
  mapId: string
  kind: string
  status: string
  actorCharId?: string
  targetCharId?: string
  payload: Record<string, unknown>
  contributions?: Array<Record<string, unknown> & { id: string; characterId: string; kind: string }>
  createdAt?: number
  expiresAt?: number
  updatedAt: number
}

export interface MobilePlayerActionAck {
  id: string
  actionId: string
  status: 'accepted' | 'rejected'
  reason?: string
  result?: Record<string, unknown>
  updatedAt: number
}

export type MobileActionGroupV1 = 'actions' | 'spells' | 'items' | 'features' | 'checks'
export type MobileActionEconomyV1 = 'action' | 'bonusAction' | 'reaction' | 'movement' | 'none'

/** Pure-data UI contract. It can request only an existing Host command; it is never executable code. */
export interface MobileActionDescriptorV1 {
  schemaVersion: 1
  id: string
  group: MobileActionGroupV1
  source: 'core' | 'spell' | 'item' | 'class-feature' | 'plugin'
  label: string
  description?: string
  icon?: string
  economy: MobileActionEconomyV1
  automation: 'full' | 'partial' | 'manual'
  targeting: {
    kind: 'none' | 'self' | 'single-creature' | 'area'
    relation?: 'any' | 'ally' | 'enemy'
    rangeFeet?: number
    includeSelf?: boolean
    maximumTargets?: number
    template?: Record<string, unknown>
  }
  execution:
    | { kind: 'host-command'; command: Record<string, unknown> }
    | { kind: 'spell'; spellId: string }
    | { kind: 'item'; instanceId: string; useActionId: string }
  ownerPluginId?: string
}

export interface MobileActionRegistryV1 {
  schemaVersion: 1
  generatedAt: number
  actions: MobileActionDescriptorV1[]
  rejectedPluginEntries: Array<{ pluginId: string; reason: string }>
}

export type MobileInterruptPresentationModeV1 =
  | 'boolean'
  | 'option-list'
  | 'target-list'
  | 'empowered-spell'
  | 'roll-confirmation'
  | 'host-only'

/**
 * Pure-data interrupt presentation. The mobile client can only submit the
 * declared response field; the Host still owns eligibility and settlement.
 */
export interface MobileInterruptDescriptorV1 {
  schemaVersion: 1
  id: string
  interruptKind: string
  mode: MobileInterruptPresentationModeV1
  title?: string
  useLabel?: string
  declineLabel?: string
  responseKey?: string
  optionIdKey?: string
  optionsPayloadKey?: string
}

export interface MobileInterruptRegistryV1 {
  schemaVersion: 1
  generatedAt: number
  entries: MobileInterruptDescriptorV1[]
}

export interface MobileHandoutView {
  id: string
  title: string
  body: string
  imageId?: string
  imageName?: string
  imageMimeType?: string
  imageSource?: MobileImageSource
  createdAt: number
}

/** One safe, player-only aggregate consumed by every mobile page. */
export interface MobilePlayerWorkspace {
  schemaVersion: 1
  fetchedAt: number
  room: MobileRoomSession
  rules: MobileRoomRules | null
  scene: PlayerSceneSnapshot | null
  maps: Array<{ id: string; name: string; width: number; height: number }>
  selectedMapId: string | null
  characters: MobileCharacterView[]
  activeCharacterId: string | null
  spells: MobileSpellView[]
  combat: MobileCombatView | null
  chat: MobileChatMessage[]
  combatLog: MobileCombatLogEntry[]
  interrupts: MobileInterruptView[]
  actionAck: MobilePlayerActionAck | null
  actionRegistry: MobileActionRegistryV1
  interruptRegistry: MobileInterruptRegistryV1
  handouts: MobileHandoutView[]
  campaignJournal: Array<{
    id: string
    title: string
    body: string
    source: 'dm' | 'combat-summary'
    authorName?: string
    createdAt: number
    updatedAt: number
  }>
  sharedNotes: Array<{
    id: string
    kind: 'task' | 'clue' | 'note'
    status: 'open' | 'done'
    title: string
    body: string
    authorMemberId?: string
    authorName?: string
    updatedAt?: number
  }>
  interactionPoints: MobileSceneInteractionPoint[]
  restAdvances: MobileRestAdvance[]
  voice: { enabled: boolean; reason?: string }
}

export interface MobilePlayerSession {
  schemaVersion: 1
  protocolVersion: typeof MOBILE_PLAYER_PROTOCOL_VERSION
  sessionType: 'mobile-player'
  sessionId: string
  roomId: string
  campaignId: string
  userId: string
  playerId: string
  controlledTokenIds: string[]
  permissions: {
    viewScene: true
    moveControlledTokens: true
    submitActions: true
    editScene: false
    controlMonsters: false
  }
  expiresAt: string
}

export interface PlayerTokenView extends WorldPoint {
  id: string
  characterId?: string
  name: string
  portraitColor: string
  portrait?: string
  portraitImageId?: string
  portraitSource?: MobileImageSource
  radius: number
  footprintCells?: number
  hp: number
  maxHp: number
  elevation?: number
  controlled: boolean
  friendly: boolean
  conditions: string[]
}

export interface FogChunk {
  chunkId: string
  revision: number
  bounds: { x: number; y: number; width: number; height: number }
  explored: boolean
}

export interface OpaqueSegment {
  id: string
  ax: number
  ay: number
  bx: number
  by: number
  open: boolean
}

export interface PlayerSceneSnapshot {
  schemaVersion: 1
  protocolVersion: typeof MOBILE_PLAYER_PROTOCOL_VERSION
  sceneId: string
  revision: number
  mapManifest: MapAssetManifest
  cameraHint?: CameraState
  controlledTokens: PlayerTokenView[]
  visibleTokens: PlayerTokenView[]
  opaqueSegments: OpaqueSegment[]
  fogChunks: FogChunk[]
  /** Player-projected explored/currently visible map polygons. No DM fog data is exposed. */
  visibilityPolygons?: WorldPoint[][]
  visionMaskEnabled?: boolean
  initiative?: {
    round: number
    currentTokenId: string
    orderedTokenIds: string[]
  }
}

export type PlayerSceneDelta =
  | { type: 'token-moved'; revision: number; tokenId: string; x: number; y: number; elevation?: number }
  | { type: 'token-updated'; revision: number; tokenId: string; patch: Partial<Pick<PlayerTokenView, 'hp' | 'maxHp' | 'conditions'>> }
  | { type: 'token-revealed'; revision: number; token: PlayerTokenView }
  | { type: 'token-hidden'; revision: number; tokenId: string }
  | { type: 'door-state'; revision: number; segmentId: string; open: boolean }
  | { type: 'fog-chunk-updated'; revision: number; chunk: FogChunk }
  | { type: 'scene-activated'; revision: number; sceneId: string }

export interface PlayerSceneDeltaBatch {
  schemaVersion: 1
  sceneId: string
  afterRevision: number
  currentRevision: number
  requiresSnapshot: boolean
  deltas: PlayerSceneDelta[]
}

export interface MobileMoveIntent {
  schemaVersion: 1
  transactionId: string
  sceneId: string
  tokenId: string
  expectedRevision: number
  destination: WorldPoint
}

export function applyPlayerSceneDelta(
  snapshot: PlayerSceneSnapshot,
  delta: PlayerSceneDelta,
): PlayerSceneSnapshot {
  if (delta.revision !== snapshot.revision + 1) {
    throw new Error(`revision-gap:${snapshot.revision}->${delta.revision}`)
  }
  const replaceToken = (token: PlayerTokenView): PlayerTokenView => {
    if (token.id !== ('tokenId' in delta ? delta.tokenId : '')) return token
    if (delta.type === 'token-moved') {
      return { ...token, x: delta.x, y: delta.y, elevation: delta.elevation ?? token.elevation }
    }
    if (delta.type === 'token-updated') return { ...token, ...delta.patch }
    return token
  }
  const next: PlayerSceneSnapshot = {
    ...snapshot,
    revision: delta.revision,
    controlledTokens: snapshot.controlledTokens.map(replaceToken),
    visibleTokens: snapshot.visibleTokens.map(replaceToken),
  }
  if (delta.type === 'token-revealed') {
    next.visibleTokens = [...next.visibleTokens.filter((token) => token.id !== delta.token.id), delta.token]
  } else if (delta.type === 'token-hidden') {
    next.visibleTokens = next.visibleTokens.filter((token) => token.id !== delta.tokenId)
  } else if (delta.type === 'door-state') {
    next.opaqueSegments = next.opaqueSegments.map((segment) => (
      segment.id === delta.segmentId ? { ...segment, open: delta.open } : segment
    ))
  } else if (delta.type === 'fog-chunk-updated') {
    next.fogChunks = [...next.fogChunks.filter((chunk) => chunk.chunkId !== delta.chunk.chunkId), delta.chunk]
  }
  return next
}
