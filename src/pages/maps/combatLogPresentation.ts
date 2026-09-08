import { DND5E_CLASS_ICON_PALETTES } from '../../lib/dnd5eActionIcons'
import { getEnemyTemplate } from '../../lib/enemyPool'
import { resolveMapTokenPortrait } from '../../lib/portraitPresentation'
import type { Token } from '../../store/maps'
import type { Character } from '../../types/character'
import type { CombatLogEntry } from '../../lib/sharedCombatTypes'
import { dnd5eCharacterPresentationColors } from '../../presentation/dnd5e/characterPresentation'
import { dnd5eSpellAttackDelivery, getDnd5eSrdCombatSpell, type Dnd5eSrdSpellDefinition } from '../../rulesets/dnd5e/spells'
import { DND5E_DAMAGE_TYPE_LABELS } from '../../rulesets/dnd5e/damageTypes'
import type { Dnd5ePersistentAreaTriggerSnapshot } from '../../rulesets/dnd5e/persistentAreaTypes'
export { dnd5eCharacterPresentationColors } from '../../presentation/dnd5e/characterPresentation'

const FALLBACK_PRESENTATION = {
  accentColor: '#94a3b8',
  glowColor: '#e2e8f0',
  statusBackgroundHighlightColor: '#334155',
  statusBackgroundColor: '#111827',
  statusBorderColor: '#94a3b8',
  classId: undefined,
} as const

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

export function dnd5eSpellAttackAuditPresentation(
  spell: Dnd5eSrdSpellDefinition,
  sustained: boolean,
): { deliveryLabel: '近战' | '远程'; rangeFeet: number } {
  const sustainedAttack = sustained ? spell.sustainedAttack : undefined
  return {
    deliveryLabel: dnd5eSpellAttackDelivery(spell, sustainedAttack) === 'ranged' ? '远程' : '近战',
    rangeFeet: sustainedAttack?.rangeFeet ?? spell.rangeFeet,
  }
}

export function dnd5eDamageDiceAuditPresentation(input: {
  rolls: readonly number[]
  sides: number
  bonus?: number
}): string | undefined {
  if (input.rolls.length < 1) return undefined
  const diceTotal = input.rolls.reduce((total, roll) => total + roll, 0)
  const bonus = input.bonus ?? 0
  const signedBonus = bonus === 0 ? '' : bonus > 0 ? ` + ${bonus}` : ` - ${Math.abs(bonus)}`
  return `伤害掷骰：${input.rolls.length}d${input.sides} [${input.rolls.join(', ')}] = ${diceTotal}${signedBonus}${bonus === 0 ? '' : ` = ${diceTotal + bonus}`}`
}

/**
 * The Headless result is authoritative for damage components: a spell can
 * apply more than one type after riders or transformations. Keep the log
 * summary aligned with those events instead of inventing a generic type.
 */
export function dnd5eSpellDamageTypeLabel(events: readonly unknown[]): string {
  const types = new Set<keyof typeof DND5E_DAMAGE_TYPE_LABELS>()
  for (const event of events) {
    if (event == null || typeof event !== 'object') continue
    const candidate = event as { type?: unknown; damageTypes?: unknown }
    if (candidate.type !== 'damage-applied' || !Array.isArray(candidate.damageTypes)) continue
    for (const damageType of candidate.damageTypes) {
      if (typeof damageType === 'string' && damageType in DND5E_DAMAGE_TYPE_LABELS) {
        types.add(damageType as keyof typeof DND5E_DAMAGE_TYPE_LABELS)
      }
    }
  }
  return [...types].map((damageType) => DND5E_DAMAGE_TYPE_LABELS[damageType]).join('、')
}

export function dnd5eCounterspelledSpellOutcome(
  events: readonly unknown[],
  spellName: string,
): string | undefined {
  const counterspelled = events.some((event) =>
    event != null &&
    typeof event === 'object' &&
    (event as { type?: unknown }).type === 'counterspell-resolved' &&
    (event as { success?: unknown }).success === true,
  )
  return counterspelled ? `${spellName}被法术反制，未产生效果` : undefined
}

export function dnd5eStabilizationSpellOutcome(
  spell: Pick<Dnd5eSrdSpellDefinition, 'effect'>,
  targetLabel: string,
): string | undefined {
  return spell.effect === 'stabilize'
    ? `${targetLabel} 伤势稳定；死亡豁免成功与失败均重置为 0`
    : undefined
}

export function dnd5eDelayedSpellDamageLogMessages(
  events: readonly unknown[],
  tokens: readonly Token[],
): string[] {
  const labels = new Map(tokens.map((token) => [token.id, token.label]))
  return events.flatMap((event) => {
    if (
      event == null || typeof event !== 'object' ||
      (event as { type?: unknown }).type !== 'delayed-spell-damage-triggered'
    ) return []
    const delayed = event as {
      sourceId?: string
      targetId?: string
      spellId?: string
      amount?: number
    }
    if (!delayed.targetId || !delayed.spellId || !Number.isFinite(delayed.amount)) return []
    const spell = getDnd5eSrdCombatSpell(delayed.spellId)
    const sourceName = delayed.sourceId ? labels.get(delayed.sourceId) ?? '法术来源' : '法术来源'
    const targetName = labels.get(delayed.targetId) ?? '目标'
    const spellName = spell?.name ?? delayed.spellId
    const damageType = spell?.delayedDamage?.damageType ?? spell?.damageType
    const damageLabel = damageType ? DND5E_DAMAGE_TYPE_LABELS[damageType] : ''
    return [`${sourceName} 的${spellName}在 ${targetName} 的回合结束时触发，造成 ${delayed.amount} 点${damageLabel}伤害。`]
  })
}

export function dnd5ePersistentAreaNotificationLogSuffix(
  notification: Dnd5ePersistentAreaTriggerSnapshot['notification'] | undefined,
): string {
  if (!notification) return ''
  if (notification.delivery === 'mental-to-source') {
    return notification.message
      ? `；向施法者发出心灵警报：“${notification.message}”`
      : '；向施法者发出心灵警报'
  }
  return notification.message
    ? `；发出声音（${notification.audibleRadiusFeet} 尺内可听）：“${notification.message}”`
    : `；发出声音警报（${notification.audibleRadiusFeet} 尺内可听）`
}

interface SubjectCandidate {
  token: Token
  character?: Character
  aliases: readonly string[]
}

export function combatLogEntryIsRoundBoundary(entry: Pick<CombatLogEntry, 'kind' | 'text'>): boolean {
  if (entry.kind !== 'turn') return false
  const text = entry.text.trim()
  return /^进入第\s*\d+\s*回合$/u.test(text) ||
    /^round\s+\d+\s*(?:begins|starts)?$/iu.test(text)
}

export function combatLogEntryIsInitiativeResult(entry: Pick<CombatLogEntry, 'kind' | 'text'>): boolean {
  return entry.kind === 'system' &&
    /^先攻结果(?:（由高到低）)?$/u.test(entry.text.trim())
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
      ? playerColors?.accentColor ?? token.color ?? FALLBACK_PRESENTATION.accentColor
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
  if (combatLogEntryIsRoundBoundary(input) || combatLogEntryIsInitiativeResult(input)) return undefined
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
  const isRoundBoundary = combatLogEntryIsRoundBoundary(input.entry)
  const isInitiativeResult = combatLogEntryIsInitiativeResult(input.entry)
  if (isRoundBoundary || isInitiativeResult) {
    return {
      label: isInitiativeResult ? '先攻结果' : '回合推进',
      emoji: '',
      borderColor: '#64748b',
      side: 'neutral',
      resolution: 'neutral',
    }
  }
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
