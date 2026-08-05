import { useEffect } from 'react'
import { deleteImage } from '../../lib/imageStore'
import { getEnemyTemplate } from '../../lib/enemyPool'
import {
  persistEnemyTokenPortraitAssets,
  planEnemyTokenPortraitAssets,
} from '../../lib/enemyTokenPortraitAssets'
import {
  buildEnemyPlayerVisibleDetail,
  enemyPlayerVisibleDetailEquals,
} from '../../lib/enemyPlayerVisibleDetail'
import { useCustomMonsterStore } from '../../store/customMonsters'
import { useMapStore, type BattleMap, type Token } from '../../store/maps'

interface EnemyTokenPortraitSyncOptions {
  enabled: boolean
  maps: readonly BattleMap[]
  requireSharedImages: boolean
  updateToken: (mapId: string, tokenId: string, patch: Partial<Token>) => void
  showNotice: (title: string, message: string, tone: 'amber') => unknown
}

/**
 * Publishes workshop-only artwork and DM-approved detail snapshots onto
 * already placed monster tokens. Players receive only room image ids and the
 * explicitly visible snapshot, never the DM-only custom-monster catalogue.
 */
export function useEnemyTokenPortraitSync({
  enabled,
  maps,
  requireSharedImages,
  updateToken,
  showNotice,
}: EnemyTokenPortraitSyncOptions): void {
  const customMonsters = useCustomMonsterStore((state) => state.monsters)

  useEffect(() => {
    if (!enabled) return

    for (const map of maps) {
      for (const token of map.tokens) {
        if (token.type !== 'enemy' || !token.poolId) continue
        const template = getEnemyTemplate(token.poolId)
        if (!template) continue
        const playerVisibleEnemyDetail = token.showDetailOnToken !== false
          ? buildEnemyPlayerVisibleDetail(token.poolId)
          : undefined
        if (!enemyPlayerVisibleDetailEquals(
          token.playerVisibleEnemyDetail,
          playerVisibleEnemyDetail,
        )) {
          updateToken(map.id, token.id, { playerVisibleEnemyDetail })
        }

        const plan = planEnemyTokenPortraitAssets(token.id, template)
        if (!plan) continue
        if (
          token.tokenPortraitImageId === plan.tokenPortraitImageId
          && token.portraitImageId === plan.portraitImageId
        ) continue

        const previousImageIds = [token.portraitImageId, token.tokenPortraitImageId]
          .filter((candidate): candidate is string => !!candidate)
        void persistEnemyTokenPortraitAssets(token.id, template).then((assets) => {
          if (!assets) return
          if (requireSharedImages && !assets.shared) {
            void showNotice(
              '怪物立绘仅在本机可见',
              '图片未能上传到当前房间，因此没有向玩家发布不可用的图片 ID。',
              'amber',
            )
            return
          }

          // Artwork can be regenerated while an upload is in flight. Only the
          // newest content-addressed plan is allowed to update the live token.
          const latestTemplate = getEnemyTemplate(token.poolId!)
          const latestPlan = latestTemplate
            ? planEnemyTokenPortraitAssets(token.id, latestTemplate)
            : undefined
          if (
            latestPlan?.tokenPortraitImageId !== assets.tokenPortraitImageId
            || latestPlan.portraitImageId !== assets.portraitImageId
          ) return

          const currentMap = useMapStore.getState().maps.find((entry) => entry.id === map.id)
          const currentToken = currentMap?.tokens.find((entry) => entry.id === token.id)
          if (!currentToken || currentToken.poolId !== token.poolId) return
          if (
            currentToken.tokenPortraitImageId === assets.tokenPortraitImageId
            && currentToken.portraitImageId === assets.portraitImageId
          ) return

          updateToken(map.id, token.id, {
            portraitImageId: assets.portraitImageId,
            tokenPortraitImageId: assets.tokenPortraitImageId,
          })
          const currentImageIds = new Set(assets.imageIds)
          for (const imageId of previousImageIds) {
            if (!currentImageIds.has(imageId)) void deleteImage(imageId)
          }
        }).catch((cause) => {
          void showNotice(
            '怪物立绘同步失败',
            cause instanceof Error ? cause.message : '怪物立绘未能写入房间图片通道。',
            'amber',
          )
        })
      }
    }
  }, [customMonsters, enabled, maps, requireSharedImages, showNotice, updateToken])
}
