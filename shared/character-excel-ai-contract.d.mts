export const CHARACTER_EXCEL_AI_SCHEMA_VERSION: 1

export interface CharacterExcelAiPatchV1 {
  schemaVersion: 1
  name?: string
  player?: string
  race?: string
  charClass?: string
  level?: number
  background?: string
  alignment?: string
  experience?: number
  abilities?: Partial<Record<'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha', number>>
  currentHp?: number
  maxHp?: number
  tempHp?: number
  speed?: number
  saveDC?: number
  passivePerception?: number
  skills: string[]
  spellNames: string[]
  backstory?: string
  notes: string[]
  uncertain: string[]
}

export const CHARACTER_EXCEL_AI_OUTPUT_SCHEMA: Readonly<Record<string, unknown>>
export const CHARACTER_EXCEL_AI_SYSTEM_PROMPT: string
export const CHARACTER_EXCEL_AI_USER_PROMPT: string
export function validateCharacterExcelAiPatch(value: unknown): value is CharacterExcelAiPatchV1
