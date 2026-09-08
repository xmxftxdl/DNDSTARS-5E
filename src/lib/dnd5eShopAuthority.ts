import { modeFromPort } from './appMode'
import {
  publishSharedEvent,
  saveSharedResourcesAtomically,
  subscribeSharedEvent,
} from './sharedApi'
import { getRoomSession } from './roomSession'
import { useCharacterStore, serializeDnd5eCharacterSnapshot } from '../store/characters'
import { useMapStore } from '../store/maps'
import { useDnd5eShopStore } from '../store/dnd5eShops'
import { validateDnd5eMerchantInteraction } from './dnd5eMerchantInteraction'
import {
  DND5E_SHOPS_RESOURCE,
  settleDnd5eShopPurchase,
  type Dnd5eShopPurchaseRequest,
  type Dnd5eShopPurchaseResult,
} from '../rulesets/dnd5e/shops'

export const DND5E_SHOP_PLAYER_TO_DM_CHANNEL = 'dnd5e-shop-player-to-dm'
export const DND5E_SHOP_DM_TO_PLAYER_CHANNEL = 'dnd5e-shop-dm-to-player'

interface Dnd5eShopAuthorityRequest extends Dnd5eShopPurchaseRequest {
  roomId?: string
  memberId?: string
  sourceMode: 'player'
  updatedAt: number
}

export interface Dnd5eShopAuthorityReceipt {
  requestId: string
  memberId?: string
  status: 'applied' | 'rejected'
  message: string
  totalPriceCopper?: number
  updatedAt: number
}

export interface Dnd5eShopSubmitResult {
  status: 'applied' | 'submitted' | 'rejected'
  message: string
  totalPriceCopper?: number
  requestId: string
}

const REQUEST_MAX_AGE_MS = 5 * 60 * 1_000
const seenRequestIds = new Set<string>()
let started = false
let stopAuthority: (() => void) | null = null

function requestId(): string {
  return globalThis.crypto?.randomUUID?.() ??
    `shop-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function validPlayerRequest(request: Dnd5eShopAuthorityRequest, roomId?: string): boolean {
  return !!request && request.sourceMode === 'player' &&
    typeof request.id === 'string' && !!request.id && request.id.length <= 140 &&
    /^[a-zA-Z0-9:._-]+$/.test(request.id) &&
    !seenRequestIds.has(request.id) &&
    typeof request.shopId === 'string' && !!request.shopId &&
    typeof request.offerId === 'string' && !!request.offerId &&
    typeof request.characterId === 'string' && !!request.characterId &&
    !!request.merchant &&
    typeof request.merchant.mapId === 'string' && !!request.merchant.mapId && request.merchant.mapId.length <= 180 &&
    typeof request.merchant.merchantTokenId === 'string' && !!request.merchant.merchantTokenId && request.merchant.merchantTokenId.length <= 180 &&
    typeof request.merchant.buyerTokenId === 'string' && !!request.merchant.buyerTokenId && request.merchant.buyerTokenId.length <= 180 &&
    Number.isSafeInteger(request.quantity) && request.quantity >= 1 && request.quantity <= 99 &&
    Number.isFinite(request.updatedAt) && Date.now() - request.updatedAt <= REQUEST_MAX_AGE_MS &&
    (!roomId || (request.roomId === roomId && typeof request.memberId === 'string'))
}

async function executeAuthoritativePurchase(
  request: Dnd5eShopPurchaseRequest,
  options: { requireMerchantInteraction?: boolean } = {},
): Promise<Dnd5eShopSubmitResult> {
  if (options.requireMerchantInteraction) {
    const interaction = validateDnd5eMerchantInteraction({
      maps: useMapStore.getState().maps,
      context: request.merchant,
      shopId: request.shopId,
      characterId: request.characterId,
    })
    if (!interaction.ok) {
      return { status: 'rejected', requestId: request.id, message: interaction.message }
    }
  }
  const characterStore = useCharacterStore.getState()
  const shopStore = useDnd5eShopStore.getState()
  const settled: Dnd5eShopPurchaseResult = settleDnd5eShopPurchase(
    shopStore.shared,
    characterStore.characters,
    request,
  )
  if (!settled.ok) {
    return { status: 'rejected', requestId: request.id, message: settled.message }
  }
  if (settled.deduplicated) {
    return {
      status: 'applied',
      requestId: request.id,
      message: settled.message,
      totalPriceCopper: settled.totalPriceCopper,
    }
  }
  const selectedId = settled.characters.some((character) => character.id === characterStore.selectedId)
    ? characterStore.selectedId
    : (settled.characters[0]?.id ?? null)
  try {
    await saveSharedResourcesAtomically([
      {
        name: 'characters',
        data: {
          characters: settled.characters.map(serializeDnd5eCharacterSnapshot),
          selectedId,
          updatedAt: settled.state.updatedAt,
        },
      },
      { name: DND5E_SHOPS_RESOURCE, data: settled.state },
    ], {
      transactionId: `shop-purchase:${request.id}`,
      undoGroupId: `shop-purchase:${request.id}`,
      undoLabel: `商店购买：${settled.message}`.slice(0, 120),
    })
  } catch (error) {
    console.error('[dnd5e-shops] atomic purchase failed', error)
    await Promise.all([
      useCharacterStore.getState().loadShared(),
      useDnd5eShopStore.getState().loadShared(),
    ]).catch(() => {})
    return {
      status: 'rejected',
      requestId: request.id,
      message: '商店或角色库存刚刚发生变化，本次没有扣款；请重试。',
    }
  }
  const purchasedCharacter = settled.characters.find((character) => character.id === request.characterId)
  if (purchasedCharacter) {
    useCharacterStore.getState().applyAuthorityUpdate(purchasedCharacter.id, purchasedCharacter)
  }
  useDnd5eShopStore.getState().replaceAuthoritative(settled.state)
  return {
    status: 'applied',
    requestId: request.id,
    message: settled.message,
    totalPriceCopper: settled.totalPriceCopper,
  }
}

export async function submitDnd5eShopPurchase(
  input: Omit<Dnd5eShopPurchaseRequest, 'id'> & { id?: string },
): Promise<Dnd5eShopSubmitResult> {
  const id = input.id ?? requestId()
  const request: Dnd5eShopPurchaseRequest = { ...input, id }
  const session = getRoomSession()
  const mode = session?.role ?? modeFromPort()
  if (mode !== 'player') return executeAuthoritativePurchase(request)
  if (session?.role !== 'player') {
    return { status: 'rejected', requestId: id, message: '当前玩家尚未加入可购买商品的房间。' }
  }
  if (!request.merchant) {
    return { status: 'rejected', requestId: id, message: '请在地图上靠近商人 NPC 后点击发起交易。' }
  }
  const envelope: Dnd5eShopAuthorityRequest = {
    ...request,
    roomId: session.roomId,
    memberId: session.memberId,
    sourceMode: 'player',
    updatedAt: Date.now(),
  }
  try {
    await publishSharedEvent(DND5E_SHOP_PLAYER_TO_DM_CHANNEL, envelope)
    return { status: 'submitted', requestId: id, message: '购买请求已提交给 DM 权威端。' }
  } catch (error) {
    console.error('[dnd5e-shops] purchase request publication failed', error)
    return { status: 'rejected', requestId: id, message: '购买请求发送失败，请检查房间连接。' }
  }
}

export function subscribeDnd5eShopPurchaseReceipts(
  listener: (receipt: Dnd5eShopAuthorityReceipt) => void,
): () => void {
  const memberId = getRoomSession()?.memberId
  return subscribeSharedEvent<Dnd5eShopAuthorityReceipt>(
    DND5E_SHOP_DM_TO_PLAYER_CHANNEL,
    (receipt) => {
      if (!receipt || receipt.memberId !== memberId || typeof receipt.requestId !== 'string') return
      listener(receipt)
    },
  )
}

export function startDnd5eShopAuthoritySync(): () => void {
  if (started) return () => {}
  const session = getRoomSession()
  if ((session?.role ?? modeFromPort()) !== 'dm') return () => {}
  started = true
  stopAuthority = subscribeSharedEvent<Dnd5eShopAuthorityRequest>(
    DND5E_SHOP_PLAYER_TO_DM_CHANNEL,
    (request) => {
      if (!validPlayerRequest(request, session?.roomId)) return
      seenRequestIds.add(request.id)
      if (seenRequestIds.size > 500) seenRequestIds.clear()
      const character = useCharacterStore.getState().characters.find(
        (candidate) => candidate.id === request.characterId,
      )
      if (!character || !request.memberId || character.roomMemberId !== request.memberId) return
      if (request.roomId && character.roomId && character.roomId !== request.roomId) return
      void executeAuthoritativePurchase(request, { requireMerchantInteraction: true }).then((result) =>
        publishSharedEvent(DND5E_SHOP_DM_TO_PLAYER_CHANNEL, {
          requestId: request.id,
          memberId: request.memberId,
          status: result.status === 'applied' ? 'applied' : 'rejected',
          message: result.message,
          ...(result.totalPriceCopper != null ? { totalPriceCopper: result.totalPriceCopper } : {}),
          updatedAt: Date.now(),
        } satisfies Dnd5eShopAuthorityReceipt),
      ).catch((error) => {
        console.error('[dnd5e-shops] purchase receipt publication failed', error)
      })
    },
  )
  return () => {
    stopAuthority?.()
    stopAuthority = null
    started = false
  }
}
