import { modeFromPort } from './appMode'
import { publishSharedEvent, subscribeSharedEvent } from './sharedApi'
import { getRoomSession } from './roomSession'
import { normalizeDnd5eInventory, rollDnd5eInventoryHealing } from '../rulesets/dnd5e/items'
import { useCharacterStore } from '../store/characters'
import type { Dnd5eInventoryMutation, Dnd5eInventoryMutationResult } from '../types/inventory'

export const DND5E_INVENTORY_PLAYER_TO_DM_CHANNEL = 'dnd5e-inventory-player-to-dm'
export const DND5E_INVENTORY_DM_TO_PLAYER_CHANNEL = 'dnd5e-inventory-dm-to-player'

export interface Dnd5eInventoryAuthorityRequest {
  id: string
  roomId?: string
  memberId?: string
  sourceMode: 'player'
  mutation: Exclude<Dnd5eInventoryMutation, { type: 'grant' }>
  updatedAt: number
}

export interface Dnd5eInventorySubmitResult {
  status: 'applied' | 'submitted' | 'rejected'
  requestId?: string
  result?: Dnd5eInventoryMutationResult
  message: string
}

export interface Dnd5eInventoryAuthorityAck {
  requestId: string
  recipientMemberId: string
  status: 'applied' | 'rejected'
  message: string
  updatedAt: number
}

const INVENTORY_REQUEST_MAX_AGE_MS = 5 * 60 * 1000
const INVENTORY_ACK_TIMEOUT_MS = 20_000
const seenRequestIds = new Set<string>()
let activeAuthorityStop: (() => void) | null = null
let inventoryAuthorityQueue: Promise<void> = Promise.resolve()

export async function submitDnd5eInventoryMutation(
  mutation: Exclude<Dnd5eInventoryMutation, { type: 'grant' }>,
): Promise<Dnd5eInventorySubmitResult> {
  const session = getRoomSession()
  const mode = session?.role ?? modeFromPort()
  if (mode !== 'player') {
    const authoritativeMutation = mutation.type === 'use'
      ? withAuthorityUseContext(mutation, inventoryRequestId())
      : mutation
    const result = useCharacterStore.getState().applyInventoryMutation(authoritativeMutation)
    return {
      status: result.ok ? 'applied' : 'rejected',
      result,
      message: result.ok ? (result.message ?? '物品变更已完成。') : inventoryFailureMessage(result.reason),
    }
  }

  if (!dnd5ePlayerInventoryMutationAllowed(mutation)) {
    return {
      status: 'rejected',
      message: '玩家不能直接增加角色货币；请由 DM 通过权威奖励或分发事务发放。',
    }
  }

  const request: Dnd5eInventoryAuthorityRequest = {
    id: inventoryRequestId(),
    roomId: session?.roomId,
    memberId: session?.memberId,
    sourceMode: 'player',
    mutation: sanitizeDnd5ePlayerInventoryMutation(mutation),
    updatedAt: Date.now(),
  }
  return new Promise((resolve) => {
    let settled = false
    let unsubscribe = () => {}
    let timeout: ReturnType<typeof globalThis.setTimeout> | undefined
    const finish = (result: Dnd5eInventorySubmitResult) => {
      if (settled) return
      settled = true
      if (timeout != null) globalThis.clearTimeout(timeout)
      unsubscribe()
      void (async () => {
        if (result.status === 'applied') {
          try {
            // The targeted receipt may arrive before the ordinary shared-state
            // invalidation refresh has painted the player UI. Join an explicit
            // post-commit hydration so a success notice and the visible slots
            // can never disagree.
            await useCharacterStore.getState().loadShared({ force: true })
          } catch (error) {
            console.error('[inventory-authority] post-ack inventory refresh failed', error)
          }
        }
        resolve(result)
      })()
    }
    unsubscribe = subscribeSharedEvent<Dnd5eInventoryAuthorityAck>(
      DND5E_INVENTORY_DM_TO_PLAYER_CHANNEL,
      (ack) => {
        if (!dnd5eInventoryAuthorityAckMatches(ack, request.id, request.memberId)) return
        finish({ status: ack.status, requestId: request.id, message: ack.message })
      },
    )
    timeout = globalThis.setTimeout(() => finish({
      status: 'rejected',
      requestId: request.id,
      message: '库存请求等待 DM 权威端超时；请确认 DM 在线后重试。',
    }), INVENTORY_ACK_TIMEOUT_MS)
    void publishSharedEvent(DND5E_INVENTORY_PLAYER_TO_DM_CHANNEL, request).catch((error) => {
      console.error('[inventory-authority] request event publication failed', error)
      finish({
        status: 'rejected',
        requestId: request.id,
        message: '库存请求发送失败，请检查房间连接后重试。',
      })
    })
  })
}

export function startDnd5eInventoryAuthoritySync(): () => void {
  const session = getRoomSession()
  if ((session?.role ?? modeFromPort()) !== 'dm') return () => {}
  // App effects can be restarted by StrictMode, room-session refreshes and HMR.
  // Always replace the previous DM subscription and make each cleanup own only
  // the subscription it created; an older cleanup must never stop a newer one.
  activeAuthorityStop?.()
  const localStop = subscribeSharedEvent<Dnd5eInventoryAuthorityRequest>(
    DND5E_INVENTORY_PLAYER_TO_DM_CHANNEL,
    (request) => {
      if (!validRequest(request, session?.roomId)) return
      seenRequestIds.add(request.id)
      if (seenRequestIds.size > 500) seenRequestIds.clear()
      inventoryAuthorityQueue = inventoryAuthorityQueue
        .then(() => settleDnd5eInventoryAuthorityRequest(request))
        .catch((error) => {
          console.error('[inventory-authority] request settlement failed', error)
        })
    },
  )
  activeAuthorityStop = localStop
  return () => {
    if (activeAuthorityStop !== localStop) return
    localStop()
    activeAuthorityStop = null
  }
}

async function settleDnd5eInventoryAuthorityRequest(
  request: Dnd5eInventoryAuthorityRequest,
): Promise<void> {
  const acknowledge = async (status: Dnd5eInventoryAuthorityAck['status'], message: string) => {
    if (!request.memberId) return
    try {
      await publishSharedEvent(DND5E_INVENTORY_DM_TO_PLAYER_CHANNEL, {
        requestId: request.id,
        recipientMemberId: request.memberId,
        status,
        message,
        updatedAt: Date.now(),
      } satisfies Dnd5eInventoryAuthorityAck)
    } catch (error) {
      console.error('[inventory-authority] acknowledgement publication failed', error)
    }
  }
  const state = useCharacterStore.getState()
  const mutation = sanitizeDnd5ePlayerInventoryMutation(request.mutation)
  const source = state.characters.find((character) => character.id === mutation.characterId)
  if (!source || (request.memberId && source.roomMemberId !== request.memberId)) {
    await acknowledge('rejected', inventoryFailureMessage('unauthorized'))
    return
  }
  if (request.roomId && source.roomId && source.roomId !== request.roomId) {
    await acknowledge('rejected', inventoryFailureMessage('unauthorized'))
    return
  }
  if (mutation.type === 'transfer') {
    const target = state.characters.find((character) => character.id === mutation.targetCharacterId)
    if (!target || (source.roomId && target.roomId && source.roomId !== target.roomId)) {
      await acknowledge('rejected', inventoryFailureMessage(target ? 'invalid-target' : 'target-not-found'))
      return
    }
  }
  const previousCharacters = structuredClone(state.characters)
  const result = state.applyInventoryMutation(
    mutation.type === 'use' ? withAuthorityUseContext(mutation, request.id) : mutation,
  )
  if (!result.ok) {
    await acknowledge('rejected', inventoryFailureMessage(result.reason))
    return
  }
  try {
    // The ACK is a commit receipt: never report success until the authoritative
    // shared character snapshot (including the inventory revision) is durable.
    await useCharacterStore.getState().saveSharedNow()
  } catch (error) {
    useCharacterStore.setState({ characters: previousCharacters })
    console.error('[inventory-authority] authoritative character save failed', error)
    await acknowledge('rejected', '库存权威快照保存失败；本次操作已回滚，请重试。')
    return
  }
  await acknowledge('applied', result.message ?? '物品变更已完成。')
}

export function dnd5eInventoryAuthorityAckMatches(
  ack: Dnd5eInventoryAuthorityAck | null | undefined,
  requestId: string,
  recipientMemberId?: string,
): boolean {
  return !!ack && typeof recipientMemberId === 'string' &&
    ack.requestId === requestId && ack.recipientMemberId === recipientMemberId &&
    (ack.status === 'applied' || ack.status === 'rejected')
}

export function inventoryFailureMessage(reason?: Dnd5eInventoryMutationResult['reason']): string {
  switch (reason) {
    case 'stale-inventory-revision': return '库存已经在另一端发生变化，本次操作未执行；请刷新后重试。'
    case 'character-not-found': return '找不到持有该物品的角色。'
    case 'target-not-found': return '找不到转交目标。'
    case 'invalid-target': return '该物品只能对规则允许的目标使用。'
    case 'item-not-found': return '物品已不存在，可能刚刚在另一端被使用或转交。'
    case 'template-not-found': return '规则包中找不到该物品模板。'
    case 'invalid-quantity': return '数量必须是正整数。'
    case 'insufficient-quantity': return '库存数量不足。'
    case 'not-equipment': return '该物品不能装备或卸下。'
    case 'invalid-equipment-slot': return '该物品不能放入指定的穿戴槽。'
    case 'not-usable': return '该物品没有可执行的使用规则。'
    case 'attunement-not-required': return '该物品不需要同调。'
    case 'attunement-limit': return '同调上限为三件魔法物品；请先结束一项同调。'
    case 'attunement-prerequisite': return '角色不满足该物品的同调先决条件，或尚未由 DM 确认环境条件。'
    case 'invalid-rolls': return '权威骰值无效。'
    case 'invalid-spell-slot': return '所选法术位环级无效。'
    case 'spell-slot-unavailable': return '所选法术位没有消耗，或当前角色没有该环级法术位。'
    case 'action-unavailable': return '本回合已经没有可用动作。'
    case 'bonus-action-unavailable': return '本回合已经没有可用附赠动作。'
    case 'same-character': return '不能把物品转交给自己。'
    case 'invalid-currency': return '货币变更必须是有效的非零整数。'
    case 'insufficient-currency': return '货币余额不足。'
    case 'not-container': return '目标不是有效容器。'
    case 'container-cycle': return '容器不能装入自身或自己的内容物。'
    case 'container-capacity': return '物品总重超过该容器的容量。'
    case 'item-unidentified': return '该魔法物品尚未鉴定，不能启用其规则效果。'
    case 'item-inactive': return '该魔法物品需要先完成同调，才能启用其规则效果。'
    case 'not-magic-item': return '该物品不需要鉴定。'
    case 'ammunition-unavailable': return '没有可供该武器使用的弹药。'
    case 'invalid-receipt': return '权威奖励收据无效，未写入库存。'
    case 'unauthorized': return '当前房间成员无权变更该角色的库存。'
    default: return '物品操作未能完成。'
  }
}

function withAuthorityUseContext(
  mutation: Extract<Dnd5eInventoryMutation, { type: 'use' }>,
  receiptId: string,
): Extract<Dnd5eInventoryMutation, { type: 'use' }> {
  const character = useCharacterStore.getState().characters.find((candidate) => candidate.id === mutation.characterId)
  const item = character
    ? normalizeDnd5eInventory(character).entries.find((entry) => entry.instanceId === mutation.instanceId)?.item
    : undefined
  return {
    ...mutation,
    targetCharacterId: mutation.targetCharacterId ?? mutation.characterId,
    healingRolls: item ? rollDnd5eInventoryHealing(item, mutation.useActionId) : [],
    receiptId,
    expectedInventoryRevision: character ? normalizeDnd5eInventory(character).revision : undefined,
  }
}

export function sanitizeDnd5ePlayerInventoryMutation(
  mutation: Exclude<Dnd5eInventoryMutation, { type: 'grant' }>,
): Exclude<Dnd5eInventoryMutation, { type: 'grant' }> {
  if (mutation.type === 'use') return {
    type: 'use',
    characterId: mutation.characterId,
    instanceId: mutation.instanceId,
    useActionId: mutation.useActionId,
    spellSlotLevel: mutation.spellSlotLevel,
    healingRolls: undefined,
  }
  if (mutation.type === 'prepare-attunement') return { ...mutation, dmPrerequisiteConfirmed: undefined }
  return mutation
}

export function dnd5ePlayerInventoryMutationAllowed(
  mutation: Exclude<Dnd5eInventoryMutation, { type: 'grant' }>,
): boolean {
  return mutation.type !== 'adjust-currency' ||
    (Number.isSafeInteger(mutation.delta) && mutation.delta < 0)
}

function validRequest(request: Dnd5eInventoryAuthorityRequest, dmRoomId?: string): boolean {
  if (!request || !request.mutation || typeof request.mutation !== 'object') return false
  if (!['discard', 'transfer', 'equip', 'unequip', 'prepare-attunement', 'cancel-attunement', 'end-attunement', 'set-container', 'adjust-currency', 'use'].includes(request.mutation.type)) return false
  if (!dnd5ePlayerInventoryMutationAllowed(request.mutation)) return false
  if (dmRoomId && (request.roomId !== dmRoomId || typeof request.memberId !== 'string')) return false
  return request.sourceMode === 'player' &&
    typeof request.id === 'string' && !seenRequestIds.has(request.id) &&
    Number.isFinite(request.updatedAt) && Date.now() - request.updatedAt <= INVENTORY_REQUEST_MAX_AGE_MS &&
    (!dmRoomId || request.roomId === dmRoomId)
}

function inventoryRequestId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `inventory-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
