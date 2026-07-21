import { modeFromPort } from './appMode'
import { publishSharedEvent, subscribeSharedEvent } from './sharedApi'
import { getRoomSession } from './roomSession'
import { rollDnd5eInventoryHealing } from '../rulesets/dnd5e/items'
import { useCharacterStore } from '../store/characters'
import type { Dnd5eInventoryMutation, Dnd5eInventoryMutationResult } from '../types/inventory'

export const DND5E_INVENTORY_PLAYER_TO_DM_CHANNEL = 'dnd5e-inventory-player-to-dm'

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
  result?: Dnd5eInventoryMutationResult
  message: string
}

const INVENTORY_REQUEST_MAX_AGE_MS = 5 * 60 * 1000
const seenRequestIds = new Set<string>()
let started = false
let stop: (() => void) | null = null

export function submitDnd5eInventoryMutation(
  mutation: Exclude<Dnd5eInventoryMutation, { type: 'grant' }>,
): Dnd5eInventorySubmitResult {
  const session = getRoomSession()
  const mode = session?.role ?? modeFromPort()
  if (mode !== 'player') {
    const authoritativeMutation = mutation.type === 'use'
      ? withAuthorityHealingRolls(mutation)
      : mutation
    const result = useCharacterStore.getState().applyInventoryMutation(authoritativeMutation)
    return {
      status: result.ok ? 'applied' : 'rejected',
      result,
      message: result.ok ? (result.message ?? '物品变更已完成。') : inventoryFailureMessage(result.reason),
    }
  }

  const request: Dnd5eInventoryAuthorityRequest = {
    id: inventoryRequestId(),
    roomId: session?.roomId,
    memberId: session?.memberId,
    sourceMode: 'player',
    mutation: stripPlayerRolls(mutation),
    updatedAt: Date.now(),
  }
  void publishSharedEvent(DND5E_INVENTORY_PLAYER_TO_DM_CHANNEL, request)
  return { status: 'submitted', message: '已提交给 DM 权威端，完成后库存会自动同步。' }
}

export function startDnd5eInventoryAuthoritySync(): () => void {
  if (started) return () => {}
  const session = getRoomSession()
  if ((session?.role ?? modeFromPort()) !== 'dm') return () => {}
  started = true
  stop = subscribeSharedEvent<Dnd5eInventoryAuthorityRequest>(
    DND5E_INVENTORY_PLAYER_TO_DM_CHANNEL,
    (request) => {
      if (!validRequest(request, session?.roomId)) return
      seenRequestIds.add(request.id)
      if (seenRequestIds.size > 500) seenRequestIds.clear()
      const state = useCharacterStore.getState()
      const mutation = request.mutation
      const source = state.characters.find((character) => character.id === mutation.characterId)
      if (!source || (request.memberId && source.roomMemberId !== request.memberId)) return
      if (request.roomId && source.roomId && source.roomId !== request.roomId) return
      if (mutation.type === 'transfer') {
        const target = state.characters.find((character) => character.id === mutation.targetCharacterId)
        if (!target || (source.roomId && target.roomId && source.roomId !== target.roomId)) return
      }
      state.applyInventoryMutation(
        mutation.type === 'use' ? withAuthorityHealingRolls(mutation) : mutation,
      )
    },
  )
  return () => {
    stop?.()
    stop = null
    started = false
  }
}

export function inventoryFailureMessage(reason?: Dnd5eInventoryMutationResult['reason']): string {
  switch (reason) {
    case 'character-not-found': return '找不到持有该物品的角色。'
    case 'target-not-found': return '找不到转交目标。'
    case 'item-not-found': return '物品已不存在，可能刚刚在另一端被使用或转交。'
    case 'template-not-found': return '规则包中找不到该物品模板。'
    case 'invalid-quantity': return '数量必须是正整数。'
    case 'insufficient-quantity': return '库存数量不足。'
    case 'not-equipment': return '该物品不能装备或卸下。'
    case 'not-usable': return '该物品没有可执行的使用规则。'
    case 'attunement-not-required': return '该物品不需要同调。'
    case 'attunement-limit': return '同调上限为三件魔法物品；请先结束一项同调。'
    case 'attunement-prerequisite': return '角色不满足该物品的同调先决条件，或尚未由 DM 确认环境条件。'
    case 'invalid-rolls': return '权威骰值无效。'
    case 'action-unavailable': return '本回合已经没有可用动作。'
    case 'bonus-action-unavailable': return '本回合已经没有可用附赠动作。'
    case 'same-character': return '不能把物品转交给自己。'
    case 'invalid-currency': return '货币变更必须是有效的非零整数。'
    case 'insufficient-currency': return '货币余额不足。'
    case 'not-container': return '目标不是有效容器。'
    case 'container-cycle': return '容器不能装入自身或自己的内容物。'
    case 'container-capacity': return '物品总重超过该容器的容量。'
    case 'item-unidentified': return '该魔法物品尚未鉴定，不能启用其规则效果。'
    case 'not-magic-item': return '该物品不需要鉴定。'
    case 'ammunition-unavailable': return '没有可供该武器使用的弹药。'
    case 'unauthorized': return '当前房间成员无权变更该角色的库存。'
    default: return '物品操作未能完成。'
  }
}

function withAuthorityHealingRolls(
  mutation: Extract<Dnd5eInventoryMutation, { type: 'use' }>,
): Extract<Dnd5eInventoryMutation, { type: 'use' }> {
  const character = useCharacterStore.getState().characters.find((candidate) => candidate.id === mutation.characterId)
  const item = character?.dnd5eInventory?.entries.find((entry) => entry.instanceId === mutation.instanceId)?.item
  return { ...mutation, healingRolls: item ? rollDnd5eInventoryHealing(item) : [] }
}

function stripPlayerRolls(
  mutation: Exclude<Dnd5eInventoryMutation, { type: 'grant' }>,
): Exclude<Dnd5eInventoryMutation, { type: 'grant' }> {
  return mutation.type === 'use' ? { ...mutation, healingRolls: undefined } : mutation
}

function validRequest(request: Dnd5eInventoryAuthorityRequest, dmRoomId?: string): boolean {
  if (!request || !request.mutation || typeof request.mutation !== 'object') return false
  if (!['discard', 'transfer', 'equip', 'unequip', 'prepare-attunement', 'cancel-attunement', 'end-attunement', 'set-container', 'adjust-currency', 'use'].includes(request.mutation.type)) return false
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
