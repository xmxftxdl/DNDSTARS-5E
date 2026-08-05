import { publishAttackBannerPresentation } from '../../lib/combatPresentation'
import type { IdGeneratorPort } from '../../ports/runtime'
import { dnd5eCharacterPresentationColors } from '../dnd5e/characterPresentation'
import type { Dnd5eDamageType } from '../../rulesets/dnd5e/damageTypes'
import type { Character } from '../../types/character'

export const dnd5eDamageTypeLabels: Readonly<Record<Dnd5eDamageType, string>> = {
  acid: '强酸',
  bludgeoning: '钝击',
  cold: '寒冷',
  fire: '火焰',
  force: '力场',
  lightning: '闪电',
  necrotic: '黯蚀',
  piercing: '穿刺',
  poison: '毒素',
  psychic: '心灵',
  radiant: '光耀',
  slashing: '挥砍',
  thunder: '雷鸣',
}

export async function publishSingleTargetAttackPresentation(input: {
  ids: IdGeneratorPort
  mapId: string
  transactionId?: string
  sourceTokenId: string
  targetTokenId?: string
  actorName: string
  attackName: string
  attackKind: 'melee' | 'ranged' | 'action'
  character?: Character
  classId?: string
}): Promise<void> {
  const eventId = input.ids.create('single-target-attack')
  await publishAttackBannerPresentation({
    id: `${eventId}:banner`,
    mapId: input.mapId,
    transactionId: input.transactionId ?? eventId,
    sourceTokenId: input.sourceTokenId,
    targetTokenId: input.targetTokenId,
    actorName: input.actorName,
    attackName: input.attackName,
    attackKind: input.attackKind,
    classId: input.classId ?? (
      input.character
        ? dnd5eCharacterPresentationColors(input.character).classId ?? 'fighter'
        : 'monster'
    ),
  })
}

export async function publishNamedActionPresentation(input: {
  ids: IdGeneratorPort
  mapId: string
  transactionId?: string
  sourceTokenId: string
  actorName: string
  actionName: string
  character?: Character
  classId?: string
}): Promise<void> {
  const eventId = input.ids.create('named-action')
  await publishAttackBannerPresentation({
    id: `${eventId}:banner`,
    mapId: input.mapId,
    transactionId: input.transactionId ?? eventId,
    sourceTokenId: input.sourceTokenId,
    actorName: input.actorName,
    attackName: input.actionName,
    attackKind: 'action',
    classId: input.classId ?? (
      input.character
        ? dnd5eCharacterPresentationColors(input.character).classId ?? 'fighter'
        : 'monster'
    ),
  })
}
