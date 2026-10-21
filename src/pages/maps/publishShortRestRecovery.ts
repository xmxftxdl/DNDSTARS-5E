import { SHORT_REST_RECOVERY_RESOURCE, validShortRestRecoveryJournal } from '../../../shared/short-rest-recovery.mjs'
import { settleDnd5eShortRestRecovery } from '../../rulesets/dnd5e/shortRestRecoveryAuthority'
import type { SharedRoomGatewayPort } from '../../ports/sharedRoomGateway'
import type { BattleMap } from '../../store/maps'

const writes = ['characters', 'maps', SHORT_REST_RECOVERY_RESOURCE] as const
const reads = ['campaign-time', 'combat', 'map-geometry'] as const
/** A single Host transaction persists HP, dice, map tokens and the replay receipt.
 * A conflict needs fresh planning. Lost acknowledgements are recovered only from
 * the exact receipt; recovery never reapplies stale character or map snapshots. */
export async function publishDnd5eShortRestRecovery(input: {
  authority: Parameters<typeof settleDnd5eShortRestRecovery>[0]
  maps: readonly BattleMap[]
  characterSelectedId?: string | null
  mapSelectedId?: string | null
  updatedAt: number
  expectedRevisions: Readonly<Record<typeof writes[number], number>>
  readRevisions: Readonly<Record<typeof reads[number], number>>
  gateway: Pick<SharedRoomGatewayPort, 'saveResourcesAtomically'> & { loadResource(name: typeof SHORT_REST_RECOVERY_RESOURCE): Promise<unknown> }
}) {
  for (const [names, revisions] of [[writes, input.expectedRevisions], [reads, input.readRevisions]] as const) {
    for (const name of names) {
      const revision = (revisions as Readonly<Record<string, number>>)?.[name]
      if (!Number.isSafeInteger(revision) || revision < 0) throw Error(`rest-snapshot-revision-required:${name}`)
    }
  }
  if (input.maps.find(map => map.id === input.authority.command.mapId) !== input.authority.map) throw Error('rest-map-snapshot-mismatch')
  const settled = settleDnd5eShortRestRecovery(input.authority)
  if (!settled.ok || settled.deduplicated) return { settled, recovered: false }
  const character = settled.character
  const data = {
    characters: { characters: input.authority.characters.map(row => row.id === character.id ? character : row),
      selectedId: input.characterSelectedId ?? null, updatedAt: input.updatedAt },
    maps: { maps: input.maps.map(map => ({ ...map, tokens: map.tokens.map(token => token.characterId === character.id
      ? { ...token, hp: character.currentHp, maxHp: character.maxHp } : token) })),
      selectedId: input.mapSelectedId ?? null, updatedAt: input.updatedAt },
    [SHORT_REST_RECOVERY_RESOURCE]: { ...settled.journal, updatedAt: input.updatedAt },
  }
  const transactionId = `short-rest:${settled.receipt.command.id}`
  try {
    await input.gateway.saveResourcesAtomically(writes.map(name => ({ name, data: data[name], expectedRevision: input.expectedRevisions[name] })), {
      transactionId, undoGroupId: transactionId, undoLabel: '短休生命骰恢复', readRevisions: input.readRevisions,
    })
    return { settled, recovered: false }
  } catch (error) {
    if (!/failed to fetch|fetch failed|networkerror|network request failed|load failed|(?:shared-)?state-transaction-(?:conflict|unavailable|502|503|504)/i.test(String(error))) throw error
    try {
      const journal = await input.gateway.loadResource(SHORT_REST_RECOVERY_RESOURCE)
      const saved = validShortRestRecoveryJournal(journal) ? journal.receipts.find(row => row.command.id === settled.receipt.command.id) : undefined
      if (saved && JSON.stringify(saved) === JSON.stringify(settled.receipt)) return { settled, recovered: true }
    } catch { /* A failed recovery read cannot establish successful settlement. */ }
    throw error
  }
}
