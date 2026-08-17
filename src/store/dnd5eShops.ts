import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { canWriteSharedState } from '../lib/appMode'
import { loadSharedResource, saveSharedResourceWithResult } from '../composition/browserSharedRoomResources'
import {
  DND5E_SHOPS_RESOURCE,
  createDnd5eShop,
  dnd5eRestockedSpellScrollNames,
  dnd5eShopSpellScrollNames,
  emptySharedDnd5eShops,
  normalizeSharedDnd5eShops,
  restockDnd5eShop,
  setDnd5eShopOfferPrice,
  type Dnd5eShopDefinition,
  type Dnd5eShopKind,
  type SharedDnd5eShopsState,
} from '../rulesets/dnd5e/shops'

export interface Dnd5eShopStoreResult {
  ok: boolean
  message: string
  shopId?: string
}

interface Dnd5eShopStore {
  shared: SharedDnd5eShopsState
  loadShared: () => Promise<void>
  replaceAuthoritative: (shared: SharedDnd5eShopsState) => void
  createShop: (kind: Dnd5eShopKind, initialStockCount?: number) => Promise<Dnd5eShopStoreResult>
  updateShop: (
    shopId: string,
    patch: Partial<Pick<
      Dnd5eShopDefinition,
      'name' | 'description' | 'open' | 'visibleToPlayers' | 'priceMultiplier'
    >>,
  ) => Promise<Dnd5eShopStoreResult>
  updateOfferPrice: (
    shopId: string,
    offerId: string,
    priceOverrideCopper?: number,
  ) => Promise<Dnd5eShopStoreResult>
  restockShop: (shopId: string, count: number) => Promise<Dnd5eShopStoreResult>
  clearShop: (shopId: string) => Promise<Dnd5eShopStoreResult>
  removeShop: (shopId: string) => Promise<Dnd5eShopStoreResult>
}

function nextShared(
  current: SharedDnd5eShopsState,
  shops: Dnd5eShopDefinition[],
  now = Date.now(),
): SharedDnd5eShopsState {
  return {
    ...current,
    schemaVersion: 1,
    shops,
    revision: current.revision + 1,
    updatedAt: now,
    _sync: undefined,
  }
}

async function publish(shared: SharedDnd5eShopsState): Promise<boolean> {
  if (!canWriteSharedState()) return false
  const result = await saveSharedResourceWithResult(DND5E_SHOPS_RESOURCE, shared)
  return result.status === 'saved'
}

export const useDnd5eShopStore = create<Dnd5eShopStore>()(
  persist((set, get) => {
    const commit = async (
      update: (current: SharedDnd5eShopsState) => SharedDnd5eShopsState | null,
      successMessage: string | ((current: SharedDnd5eShopsState, updated: SharedDnd5eShopsState) => string),
    ): Promise<Dnd5eShopStoreResult> => {
      if (!canWriteSharedState()) return { ok: false, message: '只有 DM 可以管理商店。' }
      const current = get().shared
      const updated = update(current)
      if (!updated) return { ok: false, message: '找不到目标商店。' }
      try {
        if (!await publish(updated)) return { ok: false, message: '商店状态没有被权威端接受。' }
        set({ shared: updated })
        return {
          ok: true,
          message: typeof successMessage === 'function'
            ? successMessage(current, updated)
            : successMessage,
        }
      } catch (error) {
        console.error('[dnd5e-shops] authoritative save failed', error)
        await get().loadShared().catch(() => {})
        return { ok: false, message: '商店刚刚在另一端发生变化，请重试。' }
      }
    }

    return {
      shared: emptySharedDnd5eShops(),
      loadShared: async () => {
        const loaded = await loadSharedResource<SharedDnd5eShopsState>(DND5E_SHOPS_RESOURCE)
        const normalized = normalizeSharedDnd5eShops(loaded)
        if (normalized.updatedAt < get().shared.updatedAt) return
        set({ shared: normalized })
      },
      replaceAuthoritative: (shared) => set({ shared: normalizeSharedDnd5eShops(shared) }),
      createShop: async (kind, initialStockCount = 10) => {
        const shop = restockDnd5eShop(createDnd5eShop(kind), initialStockCount)
        const scrollNames = dnd5eShopSpellScrollNames(shop)
        const result = await commit(
          (current) => nextShared(current, [...current.shops, shop]),
          `已创建${shop.name}并随机加入 ${shop.offers.length} 类商品${scrollNames.length > 0
            ? `；本次卷轴：${scrollNames.join('、')}`
            : ''}；当前仅 DM 可见。`,
        )
        return { ...result, ...(result.ok ? { shopId: shop.id } : {}) }
      },
      updateShop: (shopId, patch) => commit((current) => {
        const target = current.shops.find((shop) => shop.id === shopId)
        if (!target) return null
        const now = Date.now()
        const priceMultiplier = patch.priceMultiplier == null
          ? target.priceMultiplier
          : Math.max(0.25, Math.min(5, Number(patch.priceMultiplier) || 1))
        const updated: Dnd5eShopDefinition = {
          ...target,
          ...patch,
          id: target.id,
          kind: target.kind,
          offers: target.offers,
          name: patch.name?.trim().slice(0, 120) || target.name,
          description: patch.description?.trim().slice(0, 500) || target.description,
          priceMultiplier,
          revision: target.revision + 1,
          updatedAt: now,
        }
        return nextShared(current, current.shops.map((shop) => shop.id === shopId ? updated : shop), now)
      }, '商店设置已更新。'),
      updateOfferPrice: (shopId, offerId, priceOverrideCopper) => commit((current) => {
        const target = current.shops.find((shop) => shop.id === shopId)
        if (!target) return null
        const now = Date.now()
        const updated = setDnd5eShopOfferPrice(target, offerId, priceOverrideCopper, now)
        if (!updated) return null
        return nextShared(current, current.shops.map((shop) => shop.id === shopId ? updated : shop), now)
      }, priceOverrideCopper == null ? '商品已恢复店铺标准售价。' : '商品售价已更新。'),
      restockShop: (shopId, count) => commit((current) => {
        if (!current.shops.some((shop) => shop.id === shopId)) return null
        const shops = current.shops.map((shop) => shop.id === shopId
          ? restockDnd5eShop(shop, Math.max(1, Math.min(50, Math.floor(count))))
          : shop)
        return nextShared(current, shops)
      }, (current, updated) => {
        const before = current.shops.find((shop) => shop.id === shopId)
        const after = updated.shops.find((shop) => shop.id === shopId)
        if (!before || !after || after.kind !== 'arcane') return '已随机补充库存。'
        const scrollNames = dnd5eRestockedSpellScrollNames(before, after)
        return scrollNames.length > 0
          ? `已随机补充库存；本次卷轴：${scrollNames.join('、')}。`
          : '已随机补充库存；本次没有抽到法术卷轴。'
      }),
      clearShop: (shopId) => commit((current) => {
        const target = current.shops.find((shop) => shop.id === shopId)
        if (!target) return null
        const now = Date.now()
        const cleared = { ...target, offers: [], revision: target.revision + 1, updatedAt: now }
        return nextShared(current, current.shops.map((shop) => shop.id === shopId ? cleared : shop), now)
      }, '商店库存已清空。'),
      removeShop: (shopId) => commit((current) => {
        if (!current.shops.some((shop) => shop.id === shopId)) return null
        return nextShared(current, current.shops.filter((shop) => shop.id !== shopId))
      }, '商店已移除。'),
    }
  }, {
    name: 'dndstars-dnd5e-shops-v1',
    partialize: (state) => ({ shared: state.shared }),
  }),
)
