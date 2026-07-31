import { DND5E_CLASS_ICON_PALETTES } from '../../lib/dnd5eActionIcons'
import { getEnemyTemplate } from '../../lib/enemyPool'
import { resolveMapTokenPortrait } from '../../lib/portraitPresentation'
import { dnd5eClassDefinition } from '../../rulesets/dnd5e/classes'
import type { Token } from '../../store/maps'
import type { Character } from '../../types/character'
import type { CombatLogEntry } from '../../lib/sharedCombatTypes'

const FALLBACK_PRESENTATION = {
  accentColor: '#94a3b8',
  glowColor: '#e2e8f0',
  statusBackgroundHighlightColor: '#334155',
  statusBackgroundColor: '#111827',
  statusBorderColor: '#e2e8f0',
  classId: undefined,
} as const

export function dnd5eCharacterPresentationColors(
  character: Character | undefined,
) {
  const levelClassId = Object.entries(character?.dnd5eClassLevels ?? {})
    .filter(([, level]) => Number(level ?? 0) > 0)
    .sort(([, left], [, right]) => Number(right ?? 0) - Number(left ?? 0))[0]?.[0]
  const legacyClassId = character
    ? dnd5eClassDefinition(character.charClass)?.id ??
      (
        DND5E_CLASS_ICON_PALETTES[character.charClass.trim().toLowerCase()]
          ? character.charClass.trim().toLowerCase()
          : undefined
      )
    : undefined
  const classId = levelClassId ?? legacyClassId
  const palette = classId ? DND5E_CLASS_ICON_PALETTES[classId] : undefined
  if (!palette) return FALLBACK_PRESENTATION
  return {
    accentColor: palette[0],
    glowColor: palette[3],
    statusBackgroundHighlightColor: palette[0],
    statusBackgroundColor: palette[1],
    statusBorderColor: palette[2],
    classId,
  }
}

export type CombatLogSubjectResolution =
  | 'actor-token-id'
  | 'text'
  | 'details'
  | 'current-turn'
  | 'neutral'

export interface CombatLogSubjectPresentation {
  token?: Token
  character?: Character
  label: string
  emoji: string
  portrait?: string
  portraitImageId?: string
  borderColor: string
  classId?: string
  side: 'player' | 'monster' | 'neutral'
  resolution: CombatLogSubjectResolution
}

interface SubjectCandidate {
  token: Token
  character?: Character
  aliases: readonly string[]
}

function normalizedAlias(value: string | undefined): string | undefined {
  const normalized = value?.trim()
  return normalized ? normalized : undefined
}

function subjectCandidates(
  tokens: readonly Token[],
  characters: readonly Character[],
): readonly SubjectCandidate[] {
  const charactersById = new Map(characters.map((character) => [character.id, character]))
  return tokens
    .filter((token) => token.type !== 'obstacle')
    .map((token) => {
      const character = token.characterId
        ? charactersById.get(token.characterId)
        : undefined
      const aliases = [...new Set([
        normalizedAlias(token.label),
        normalizedAlias(character?.name),
      ].filter((alias): alias is string => alias != null))]
      return { token, character, aliases }
    })
}

function candidateMention(
  candidates: readonly SubjectCandidate[],
  source: string,
  preferredTokenId: string | undefined,
): SubjectCandidate | undefined {
  const normalizedSource = source.toLocaleLowerCase()
  return candidates
    .flatMap((candidate, candidateIndex) =>
      candidate.aliases.flatMap((alias) => {
        const index = normalizedSource.indexOf(alias.toLocaleLowerCase())
        return index < 0
          ? []
          : [{
              candidate,
              index,
              aliasLength: alias.length,
              preferred: candidate.token.id === preferredTokenId,
              candidateIndex,
            }]
      }))
    .sort((left, right) =>
      left.index - right.index ||
      right.aliasLength - left.aliasLength ||
      Number(right.preferred) - Number(left.preferred) ||
      left.candidateIndex - right.candidateIndex)[0]
    ?.candidate
}

function presentationForCandidate(
  candidate: SubjectCandidate,
  resolution: Exclude<CombatLogSubjectResolution, 'neutral'>,
): CombatLogSubjectPresentation {
  const { token, character } = candidate
  const playerColors = character
    ? dnd5eCharacterPresentationColors(character)
    : undefined
  const monsterTemplate = token.type === 'enemy' && token.poolId
    ? getEnemyTemplate(token.poolId)
    : undefined
  const monsterPalette = DND5E_CLASS_ICON_PALETTES.monster
  const isPlayer = token.type === 'player' || character != null
  return {
    token,
    character,
    label: character?.name ?? token.label,
    emoji:
      character?.avatar ??
      token.emoji ??
      monsterTemplate?.emoji ??
      (isPlayer ? '🧙' : '👾'),
    portrait:
      resolveMapTokenPortrait(character, token) ??
      monsterTemplate?.tokenPortrait,
    portraitImageId: token.portraitImageId,
    borderColor: isPlayer
      ? playerColors?.glowColor ?? token.color ?? FALLBACK_PRESENTATION.glowColor
      : token.type === 'enemy'
        ? monsterPalette[3]
        : token.color ?? monsterPalette[3],
    classId: isPlayer ? playerColors?.classId : 'monster',
    side: isPlayer ? 'player' : 'monster',
    resolution,
  }
}

function candidateForEntityId(
  candidates: readonly SubjectCandidate[],
  entityId: string | undefined,
): SubjectCandidate | undefined {
  if (!entityId) return undefined
  return candidates.find((candidate) =>
    candidate.token.id === entityId ||
    candidate.character?.id === entityId)
}

export function inferCombatLogActorTokenId(input: {
  text: string
  kind: CombatLogEntry['kind']
  tokens: readonly Token[]
  characters: readonly Character[]
  currentTurnTokenId?: string
}): string | undefined {
  const candidates = subjectCandidates(input.tokens, input.characters)
  const named = candidateMention(candidates, input.text, input.currentTurnTokenId)
  if (named) return named.token.id
  if (input.kind === 'system') return undefined
  return candidateForEntityId(candidates, input.currentTurnTokenId)?.token.id
}

export function resolveHeadlessCombatLogActorTokenId(
  events: readonly unknown[],
  tokens: readonly Token[],
): string | undefined {
  const tokenForEntityId = (entityId: unknown) => {
    if (typeof entityId !== 'string' || !entityId.trim()) return undefined
    return tokens.find((token) =>
      token.id === entityId || token.characterId === entityId)?.id
  }
  for (const event of events) {
    if (!event || typeof event !== 'object') continue
    const actorTokenId = tokenForEntityId(
      (event as { actorId?: unknown }).actorId,
    )
    if (actorTokenId) return actorTokenId
  }
  for (const event of events) {
    if (!event || typeof event !== 'object') continue
    const sourceTokenId = tokenForEntityId(
      (event as { sourceId?: unknown }).sourceId,
    )
    if (sourceTokenId) return sourceTokenId
  }
  return undefined
}

/**
 * Old shared log rows intentionally contain only readable text. Resolve their
 * visual subject without changing the wire format: primary text wins, then
 * Headless details, then the current turn for actionable rows. Rule/system
 * rows with no named creature stay neutral instead of borrowing an unrelated
 * historical turn.
 */
export function resolveCombatLogSubject(input: {
  entry: CombatLogEntry
  tokens: readonly Token[]
  characters: readonly Character[]
  currentTurnTokenId?: string
}): CombatLogSubjectPresentation {
  const candidates = subjectCandidates(input.tokens, input.characters)
  const explicit = candidateForEntityId(candidates, input.entry.actorTokenId)
  if (explicit) return presentationForCandidate(explicit, 'actor-token-id')

  const fromText = candidateMention(
    candidates,
    input.entry.text,
    input.currentTurnTokenId,
  )
  if (fromText) return presentationForCandidate(fromText, 'text')

  for (const detail of input.entry.details ?? []) {
    const fromDetail = candidateMention(
      candidates,
      detail,
      input.currentTurnTokenId,
    )
    if (fromDetail) return presentationForCandidate(fromDetail, 'details')
  }

  if (input.entry.kind !== 'system' && input.currentTurnTokenId) {
    const currentTurn = candidates.find(
      (candidate) => candidate.token.id === input.currentTurnTokenId,
    )
    if (currentTurn) return presentationForCandidate(currentTurn, 'current-turn')
  }

  return {
    label: '战斗事件',
    emoji: '⚔️',
    borderColor: '#64748b',
    side: 'neutral',
    resolution: 'neutral',
  }
}
