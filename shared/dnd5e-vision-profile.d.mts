export function isDnd5eInvisibleVisionSensor(token: unknown): boolean
export interface Dnd5eProjectedCharacterVision {
  darkvisionRangeFeet: number
  racialDarkvisionRangeFeet: number
  darkvisionRacialFallbackFeet: number
  darkvisionRacialBonusFeet: number
  darkvisionIfAbsentFeet: number
  darkvisionExistingBonusFeet: number
  classState: { activeEffects: Array<{ id?: string; source: { actorId?: string; magical?: true }; modifiers: {
    sightRangeLimitFeet?: number;
    darkvisionRangeFeet: number; darkvisionIfAbsentFeet: number; darkvisionExistingBonusFeet: number
    darkvisionRacialFallbackFeet: number; darkvisionRacialBonusFeet: number
  } }> }
}

export function dnd5eHasDarkvisionConcealment(input?: { token?: unknown; character?: unknown }): boolean
export function dnd5eConcealedFromDarkvision(input: {
  concealment: boolean; illumination: string; hasDarkvision: boolean;
  alternativeSight?: boolean; seeInvisible?: boolean; outlined?: boolean
}): boolean

export interface Dnd5eEffectiveVisionProfileV1 {
  blindBeyondBlindsight?: true
  schemaVersion: 1
  normalRangeFeet: number
  darkvisionRangeFeet: number
  /** Original token input retained when projecting conditional senses. */
  tokenBaseDarkvisionRangeFeet?: number
  intrinsicDarkvisionRangeFeet?: number
  projectedCharacterVision?: Dnd5eProjectedCharacterVision
  formDarkvisionRangeFeet?: number
  formRetainsDarkvision?: boolean
  /** Sees normally in nonmagical darkness, such as Devil's Sight. */
  darknessSightRangeFeet: number
  /** Sees normally through magical darkness, such as Devil's Sight. */
  magicalDarknessSightRangeFeet: number
  blindsightRangeFeet: number
  tremorsenseRangeFeet: number
  truesightRangeFeet: number
  sightRangeLimitFeet?: number
}

export const DND5E_EFFECTIVE_VISION_PROFILE_SCHEMA_VERSION: 1
export function resolveDnd5eVisionSensorSource<T extends object>(token: unknown, tokens?: readonly T[]): T | undefined
export function projectDnd5eSourceVisionSensor<T extends object>(token: T, input?: {
  sourceToken?: unknown; character?: unknown; fallbackRangeFeet?: number
}): T
export function normalizeDnd5eProjectedCharacterVision(value: unknown): Dnd5eProjectedCharacterVision | undefined

export function dnd5eCharacterHasDevilsSight(character: unknown): boolean
export function dnd5eCharacterDarkvisionRangeFeet(character: unknown): number
export function compileDnd5eEffectiveVisionProfile(input?: {
  token?: unknown
  character?: unknown
  monster?: unknown
  fallbackRangeFeet?: number
}): Dnd5eEffectiveVisionProfileV1
export function applyDnd5eEffectiveVisionProfile<T extends object>(
  token: T,
  profile: Dnd5eEffectiveVisionProfileV1,
): T & {
  blindBeyondBlindsight?: true
  darkvisionRangeFeet?: number
  dnd5eBaseDarkvisionRangeFeet?: number
  dnd5eProjectedDarkvisionRangeFeet?: number
  dnd5eProjectedCharacterVision?: Dnd5eProjectedCharacterVision
  dnd5eFormDarkvisionRangeFeet?: number
  dnd5eFormRetainsDarkvision?: boolean
  darknessSightRangeFeet?: number
  magicalDarknessSightRangeFeet?: number
  blindsightRangeFeet?: number
  tremorsenseRangeFeet?: number
  truesightRangeFeet?: number
}
