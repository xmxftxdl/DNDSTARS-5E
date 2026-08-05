import {
  combatPresentationServerNow,
  publishCounterspellPresentation,
  publishShieldPresentation,
} from '../../lib/combatPresentation'
import type { BattleMap } from '../../store/maps'

async function waitForSchedule(schedule: { completesAt: number }): Promise<void> {
  await new Promise<void>((resolve) => window.setTimeout(
    resolve,
    Math.max(0, schedule.completesAt - combatPresentationServerNow()),
  ))
}

export async function playShieldReactionPresentation(
  enabled: boolean,
  map: BattleMap,
  transactionId: string,
  characterId: string,
): Promise<void> {
  if (!enabled) return
  const token = map.tokens.find((candidate) => candidate.characterId === characterId)
  if (!token) return
  await waitForSchedule(await publishShieldPresentation({
    id: `${transactionId}:shield:${token.id}`,
    mapId: map.id,
    transactionId,
    sourceTokenId: token.id,
    targetTokenId: token.id,
  }))
}

export async function playCounterspellReactionPresentation(
  enabled: boolean,
  map: BattleMap,
  transactionId: string,
  sourceTokenId: string,
  targetTokenId: string,
): Promise<void> {
  if (!enabled) return
  await waitForSchedule(await publishCounterspellPresentation({
    id: `${transactionId}:counterspell:${sourceTokenId}:${targetTokenId}`,
    mapId: map.id,
    transactionId,
    sourceTokenId,
    targetTokenId,
  }))
}
