import type { AiProviderSelectionV1 } from '../../shared/ai-provider.mjs'
import {
  CHARACTER_EXCEL_AI_OUTPUT_SCHEMA,
  CHARACTER_EXCEL_AI_SYSTEM_PROMPT,
  CHARACTER_EXCEL_AI_USER_PROMPT,
  validateCharacterExcelAiPatch,
  type CharacterExcelAiPatchV1,
} from '../../shared/character-excel-ai-contract.mjs'
import {
  AiProviderRegistryV1,
  executeStructuredAiTask,
  type JsonSchemaV1,
} from './aiProvider'
import { SKILLS } from './dnd'
import { dnd5eClassDefinition } from '../rulesets/dnd5e/classes'
import { dnd5eSpellbookEntries } from '../rulesets/dnd5e/spellbook'
import type { Abilities, Character } from '../types/character'
import {
  compactCharacterExcelWorkbookText,
  type CharacterExcelImportDraft,
  type CharacterExcelWorkbook,
} from './characterExcelImport'
import { requestPlayerCharacterExcelAi } from './playerAiApi'

export interface CharacterExcelAiEnhancement {
  draft: CharacterExcelImportDraft
  providerName: string
  modelName?: string
  addedFields: string[]
}

function boundedString(value: unknown, maximum: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const text = value.trim()
  return text ? text.slice(0, maximum) : undefined
}

function boundedInteger(value: unknown, minimum: number, maximum: number): number | undefined {
  return Number.isInteger(value) && Number(value) >= minimum && Number(value) <= maximum ? Number(value) : undefined
}

function normalizedName(value: string): string {
  return value.trim().toLowerCase()
    .replace(/[\s·•・.。,:：;；'"“”‘’()（）【】_-]+/g, '')
    .replaceAll('[', '')
    .replaceAll(']', '')
}

function skillIds(names: readonly string[]): string[] {
  return [...new Set(names.flatMap((name) => {
    const normalized = normalizedName(name)
    const skill = SKILLS.find((candidate) =>
      normalizedName(candidate.key) === normalized || normalizedName(candidate.label) === normalized)
    return skill?.key ?? []
  }))]
}

function spellIds(names: readonly string[]): { ids: string[]; recognizedNames: string[]; unrecognizedNames: string[] } {
  const lookup = new Map<string, { id: string; name: string }>()
  for (const spell of dnd5eSpellbookEntries([])) {
    lookup.set(normalizedName(spell.name), { id: spell.id, name: spell.name })
    if (spell.englishName) lookup.set(normalizedName(spell.englishName), { id: spell.id, name: spell.name })
  }
  const ids = new Set<string>()
  const recognizedNames = new Set<string>()
  const unrecognizedNames = new Set<string>()
  for (const name of names) {
    const spell = lookup.get(normalizedName(name))
    if (spell) {
      ids.add(spell.id)
      recognizedNames.add(spell.name)
    } else if (name.trim()) unrecognizedNames.add(name.trim())
  }
  return { ids: [...ids], recognizedNames: [...recognizedNames], unrecognizedNames: [...unrecognizedNames] }
}

export function mergeCharacterExcelAiPatch(draft: CharacterExcelImportDraft, patch: CharacterExcelAiPatchV1): {
  draft: CharacterExcelImportDraft
  addedFields: string[]
} {
  const character: Partial<Character> = structuredClone(draft.character)
  const trusted = new Set(draft.fieldSources.map((source) => source.field))
  const addedFields: string[] = []
  const assignMissing = <K extends keyof Character>(key: K, value: Character[K] | undefined) => {
    if (value == null || trusted.has(String(key))) return
    character[key] = value
    addedFields.push(String(key))
  }
  assignMissing('name', boundedString(patch.name, 160))
  assignMissing('player', boundedString(patch.player, 160))
  assignMissing('race', boundedString(patch.race, 160))
  const aiClass = boundedString(patch.charClass, 160)
  const classDefinition = aiClass ? dnd5eClassDefinition(aiClass) : undefined
  if (!trusted.has('charClass') && classDefinition) {
    character.charClass = classDefinition.name
    character.dnd5eClassLevels = { [classDefinition.id]: boundedInteger(patch.level, 1, 20) ?? character.level ?? 1 }
    addedFields.push('charClass')
  }
  assignMissing('level', boundedInteger(patch.level, 1, 20))
  assignMissing('background', boundedString(patch.background, 160))
  assignMissing('alignment', boundedString(patch.alignment, 80))
  assignMissing('experience', boundedInteger(patch.experience, 0, 99_999_999))
  assignMissing('currentHp', boundedInteger(patch.currentHp, 0, 9_999))
  assignMissing('maxHp', boundedInteger(patch.maxHp, 1, 9_999))
  assignMissing('tempHp', boundedInteger(patch.tempHp, 0, 9_999))
  assignMissing('speed', boundedInteger(patch.speed, 0, 300))
  assignMissing('saveDC', boundedInteger(patch.saveDC, 1, 40))
  assignMissing('passivePerception', boundedInteger(patch.passivePerception, 1, 50))
  if (patch.backstory && !character.backstory?.trim()) {
    character.backstory = patch.backstory.trim().slice(0, 40_000)
    addedFields.push('backstory')
  }
  if (patch.abilities && character.abilities) {
    const abilities = { ...character.abilities } as Abilities
    for (const key of ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const) {
      if (trusted.has(`abilities.${key}`)) continue
      const score = boundedInteger(patch.abilities[key], 1, 30)
      if (score != null) {
        abilities[key] = score
        addedFields.push(`abilities.${key}`)
      }
    }
    character.abilities = abilities
  }
  const aiSkills = skillIds(patch.skills ?? [])
  if (aiSkills.length) {
    character.skills = [...new Set([...(character.skills ?? []), ...aiSkills])]
    addedFields.push('skills')
  }
  const aiSpells = spellIds(patch.spellNames ?? [])
  const classId = dnd5eClassDefinition(character.charClass ?? '')?.id
  if (classId && aiSpells.ids.length) {
    const choices = structuredClone(character.dnd5eClassChoices ?? { classes: {} })
    choices.classes ??= {}
    const current = choices.classes[classId] ?? { selections: {} }
    current.selections ??= {}
    const selectionKey = classId === 'wizard' ? 'wizard-spellbook' : 'spell-prepared'
    current.selections[selectionKey] = [...new Set([...(current.selections[selectionKey] ?? []), ...aiSpells.ids])]
    choices.classes[classId] = current
    character.dnd5eClassChoices = choices
    addedFields.push('spells')
  }
  if (patch.notes?.length) {
    const addition = patch.notes.map((note) => note.trim()).filter(Boolean).join('\n')
    if (addition) character.notes = [character.notes?.trim(), `AI 补充：\n${addition}`].filter(Boolean).join('\n\n')
  }
  const warnings = [...draft.warnings, ...(patch.uncertain ?? []).map((note) => `AI 未确认：${note.trim()}`).filter((note) => note !== 'AI 未确认：')]
  return {
    addedFields: [...new Set(addedFields)],
    draft: {
      ...draft,
      character,
      importedSpellNames: [...new Set([...draft.importedSpellNames, ...aiSpells.recognizedNames])],
      unrecognizedSpellNames: [...new Set([...draft.unrecognizedSpellNames, ...aiSpells.unrecognizedNames])],
      warnings,
    },
  }
}

export async function enhanceCharacterExcelImportWithAi(input: {
  workbook: CharacterExcelWorkbook
  draft: CharacterExcelImportDraft
  registry: AiProviderRegistryV1
  selection: AiProviderSelectionV1
}): Promise<CharacterExcelAiEnhancement> {
  const workbookText = compactCharacterExcelWorkbookText(input.workbook)
  const result = await executeStructuredAiTask({
    registry: input.registry,
    selection: input.selection,
    request: {
      schemaVersion: 1,
      jobId: `character-excel-import-${crypto.randomUUID()}`,
      task: 'resource-structuring',
      systemPrompt: CHARACTER_EXCEL_AI_SYSTEM_PROMPT,
      userPrompt: CHARACTER_EXCEL_AI_USER_PROMPT,
      outputSchema: CHARACTER_EXCEL_AI_OUTPUT_SCHEMA as JsonSchemaV1,
      maxOutputTokens: 4_096,
      documents: [{
        id: 'character-workbook-values',
        documentName: input.workbook.fileName,
        mimeType: 'text/plain',
        text: workbookText,
      }],
    },
    validateOutput: validateCharacterExcelAiPatch,
    estimatedInputTokens: Math.ceil(workbookText.length / 2),
    estimatedOutputTokens: 1_500,
  })
  if (!result.ok) throw new Error(`${result.error}${result.detail ? `：${result.detail}` : ''}`)
  const merged = mergeCharacterExcelAiPatch(input.draft, result.output)
  return {
    draft: merged.draft,
    addedFields: merged.addedFields,
    providerName: result.provider.displayName,
    modelName: result.model?.displayName,
  }
}

export async function enhanceCharacterExcelImportWithPlayerAi(input: {
  workbook: CharacterExcelWorkbook
  draft: CharacterExcelImportDraft
}): Promise<CharacterExcelAiEnhancement> {
  const result = await requestPlayerCharacterExcelAi({
    workbookText: compactCharacterExcelWorkbookText(input.workbook),
    fileName: input.workbook.fileName,
  })
  const merged = mergeCharacterExcelAiPatch(input.draft, result.patch)
  return {
    draft: merged.draft,
    addedFields: merged.addedFields,
    providerName: result.providerId,
    modelName: result.modelId,
  }
}
