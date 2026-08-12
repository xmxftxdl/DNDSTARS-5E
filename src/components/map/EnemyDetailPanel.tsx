import { useEffect, useRef, useState } from 'react'
import type { Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { ABILITIES, abilityMod, formatMod } from '../../lib/dnd'
import { getEnemyTemplate, type EnemyTemplate } from '../../lib/enemyPool'
import { getEnemyStatBlock, type EnemyStatBlock } from '../../lib/enemyStatBlocks'
import { buildEnemyPlayerVisibleDetail } from '../../lib/enemyPlayerVisibleDetail'
import {
  getEnemyDerivedCombatStats,
  getEnemyEquipmentSlots,
} from '../../lib/enemyCombatStats'
import {
  CREATURE_SIZES,
  CREATURE_TYPES,
  creatureSizeToTokenSize,
  inferCreatureSizeFromTags,
  inferCreatureTypesFromTags,
  type CreatureSize,
  type CreatureType,
} from '../../lib/monsterTypes'
import { X, Shield, Footprints, Sparkles, Swords, Backpack, ImagePlus, Wrench } from 'lucide-react'
import Dnd5eConditionEditor, { Dnd5eConditionTags } from './Dnd5eConditionEditor'
import Dnd5eTokenStatusMarkerEditor from './Dnd5eTokenStatusMarkerEditor'
import { dnd5eTokenStatusMarkerOptionsForTarget } from '../../rulesets/dnd5e/tokenStatusMarkers'
import type { Dnd5eActiveEffectInstance } from '../../rulesets/dnd5e/activeEffects'
import { createCharacterPortraitDataUrl } from '../../lib/characterPortrait'
import { generatedImageDataUrlToFile } from '../../lib/generatedImage'
import { deleteImage, getImage, putImage } from '../../lib/imageStore'
import AiImageGenerationButton from '../AiImageGenerationButton'
import { areOpposedCombatTokens, dnd5eCombatTokenSide } from '../../lib/opportunityAttacks'
import {
  getDnd5eSrdMonster,
  type Dnd5eMonsterBehaviorStyle,
  type Dnd5eMonsterStatBlock,
  type Dnd5eMonsterTargetPriority,
} from '../../rulesets/dnd5e/monsters'
import {
  DND5E_MONSTER_BEHAVIOR_STYLE_OPTIONS,
  DND5E_MONSTER_TARGET_PRIORITY_OPTIONS,
} from '../../rulesets/dnd5e/monsterAutomation'
import { parseLiveHitPointDraft, resolveHitPointDisplay } from './characterHitPoints'
import {
  dnd5eManualMonsterMultiattackContinuation,
  type Dnd5eManualMonsterMultiattackContinuation,
} from '../../lib/monsterManualControl'
import Dnd5eMonsterWorkshopDialog, {
  type Dnd5eMonsterWorkshopEditRequest,
} from './Dnd5eMonsterWorkshopDialog'
import {
  createDnd5eMonsterInstanceOverride,
  dnd5eMonsterOverrideTokenPatch,
  dnd5eMonsterOverrideTargets,
  isDnd5eMonsterInstanceOverride,
  type Dnd5eMonsterOverrideScope,
} from '../../rulesets/dnd5e/monsterInstanceOverride'

function SharedMonsterPortrait({
  imageId,
  name,
  fallbackSrc,
  fallbackEmoji,
}: {
  imageId: string
  name: string
  fallbackSrc?: string
  fallbackEmoji: string
}) {
  const [loaded, setLoaded] = useState<{ imageId: string; src: string }>()
  useEffect(() => {
    let disposed = false
    let objectUrl: string | undefined
    void getImage(imageId).then((blob) => {
      if (!blob || disposed) return
      objectUrl = URL.createObjectURL(blob)
      setLoaded({ imageId, src: objectUrl })
    })
    return () => {
      disposed = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [imageId])
  const src = loaded?.imageId === imageId ? loaded.src : undefined
  if (src) return <img src={src} alt={`${name}的地图缩略图`} className="h-full w-full object-cover" />
  if (fallbackSrc) {
    return <img src={fallbackSrc} alt={`${name}的地图缩略图`} className="h-full w-full object-cover" />
  }
  return <span aria-hidden="true">{fallbackEmoji}</span>
}

function resolveEnemyDetail(token: Token): {
  template: EnemyTemplate | undefined
  stats: EnemyStatBlock | undefined
} {
  const template = token.poolId ? getEnemyTemplate(token.poolId) : undefined
  const stats = (token.poolId ? getEnemyStatBlock(token.poolId) : undefined)
    ?? token.playerVisibleEnemyDetail?.statBlock
  return { template, stats }
}

export default function EnemyDetailPanel({
  token,
  onClose,
  isDM = false,
  mapId,
  characters = [],
  tokens = [],
  encounterParticipantTokenIds,
  updateToken,
  onSetHitPoints,
  removeToken,
  canManageConditions = false,
  onConditionsChange,
  onMonsterBerserkChange,
  conditionSourceOptions = [],
  canUseMonsterActions = false,
  monsterActionUsed = false,
  monsterActionPending = false,
  onSelectMonsterAction,
  onSelectMonsterContinuation,
}: {
  token: Token
  onClose: () => void
  closable?: boolean
  isDM?: boolean
  mapId?: string
  characters?: Character[]
  tokens?: readonly Token[]
  /** Current initiative roster. Omit outside combat to use every creature on the map. */
  encounterParticipantTokenIds?: readonly string[]
  updateToken?: (mapId: string, tokenId: string, patch: Partial<Token>) => void
  onSetHitPoints?: (input: {
    currentHp: number
    maxHp: number
    manuallySetMaximum: boolean
  }) => void | Promise<unknown>
  removeToken?: (mapId: string, tokenId: string) => void
  canManageConditions?: boolean
  onConditionsChange?: (conditions: string[], activeEffects: Dnd5eActiveEffectInstance[]) => void
  onMonsterBerserkChange?: (active: boolean) => void
  conditionSourceOptions?: readonly { id: string; label: string }[]
  canUseMonsterActions?: boolean
  monsterActionUsed?: boolean
  monsterActionPending?: boolean
  onSelectMonsterAction?: (actionIndex: number, actionName: string) => void
  onSelectMonsterContinuation?: (
    continuation: Dnd5eManualMonsterMultiattackContinuation,
  ) => void
}) {
  const portraitInputRef = useRef<HTMLInputElement>(null)
  const [portraitBusy, setPortraitBusy] = useState(false)
  const [portraitError, setPortraitError] = useState('')
  const [overrideScope, setOverrideScope] = useState<Dnd5eMonsterOverrideScope>('instance')
  const [overrideMessage, setOverrideMessage] = useState('')
  const [overrideEditor, setOverrideEditor] = useState<{
    sourceMonsterId: string
    scope: Dnd5eMonsterOverrideScope
    editRequest: Dnd5eMonsterWorkshopEditRequest
  }>()
  const { template, stats } = resolveEnemyDetail(token)
  const multiattackContinuation = canUseMonsterActions
    ? dnd5eManualMonsterMultiattackContinuation(token)
    : undefined
  const derived = token.poolId ? getEnemyDerivedCombatStats(token.poolId) : undefined
  const isStructured5eMonster = stats?.source === 'SRD 5.1' || stats?.source === 'DM 自定义'
  const maxHp = token.maxHp ?? derived?.maxHp ?? template?.maxHp ?? 20
  const curHp = token.hp ?? maxHp

  const name = token.label || template?.name || '敌人'
  const emoji = token.emoji || template?.emoji || '👹'
  const tokenThumbnail = token.tokenPortrait || template?.tokenPortrait
  const color = token.color || template?.color || '#f87171'
  const templateTags = template?.tags ?? token.playerVisibleEnemyDetail?.tags ?? []
  const creatureTypes = token.creatureTypes?.length
    ? token.creatureTypes
    : template?.creatureTypes ?? inferCreatureTypesFromTags(templateTags)
  const creatureSize = token.creatureSize ?? template?.creatureSize ?? inferCreatureSizeFromTags(templateTags)
  const tags = [
    ...creatureTypes,
    creatureSize,
    ...templateTags.filter((tag) => !creatureTypes.includes(tag as CreatureType) && tag !== creatureSize),
  ]
  const description = template?.description ?? token.playerVisibleEnemyDetail?.description
  const linked = token.characterId ? characters.find((c) => c.id === token.characterId) : undefined
  const monsterCombatState = linked?.dnd5eCombatState ?? token.dnd5eCombatState
  const supportsBerserk = monsterCombatState?.monsterBerserk === true ||
    token.poolId?.endsWith(':flesh-golem') === true ||
    stats?.traits.some((trait) => /狂暴|berserk/i.test(trait.name)) === true
  const authoritativeCurrentHp = linked?.currentHp ?? curHp
  const authoritativeMaxHp = linked?.maxHp ?? maxHp
  const [currentHpDraft, setCurrentHpDraft] = useState(String(authoritativeCurrentHp))
  const [maxHpDraft, setMaxHpDraft] = useState(String(authoritativeMaxHp))
  const [editingCurrentHp, setEditingCurrentHp] = useState(false)
  const [editingMaxHp, setEditingMaxHp] = useState(false)
  const [pendingHitPoints, setPendingHitPoints] = useState<{
    currentHp: number
    maxHp: number
  } | null>(null)
  const hitPointRequestIdRef = useRef(0)
  const displayedHitPoints = resolveHitPointDisplay({
    currentHp: authoritativeCurrentHp,
    maxHp: authoritativeMaxHp,
    currentHpDraft,
    maxHpDraft,
    editingCurrentHp,
    editingMaxHp,
    pending: pendingHitPoints,
  })

  const setHitPoints = (currentHp: number, maximumHp: number, manuallySetMaximum: boolean) => {
    if (!onSetHitPoints) return
    const nextMaxHp = Math.max(1, Math.floor(maximumHp))
    const nextCurrentHp = Math.max(0, Math.min(nextMaxHp, Math.floor(currentHp)))
    const requestId = ++hitPointRequestIdRef.current
    setPendingHitPoints({ currentHp: nextCurrentHp, maxHp: nextMaxHp })
    const result = onSetHitPoints({
      currentHp: nextCurrentHp,
      maxHp: nextMaxHp,
      manuallySetMaximum,
    })
    if (!result || typeof (result as PromiseLike<unknown>).then !== 'function') {
      if (hitPointRequestIdRef.current === requestId) setPendingHitPoints(null)
      return
    }
    const clearPendingRequest = () => {
      if (hitPointRequestIdRef.current === requestId) setPendingHitPoints(null)
    }
    void Promise.resolve(result).then(clearPendingRequest, clearPendingRequest)
  }
  const canEdit = isDM && !!mapId && !!updateToken
  const standardConditions = linked?.conditions ?? token.dnd5eCombatState?.conditions ?? []
  const monsterDefinition = token.poolId ? getDnd5eSrdMonster(token.poolId) : undefined
  const defaultTargetPriority = monsterDefinition?.targetingPreference?.priority ?? 'nearest'
  const targetPriority = token.dnd5eTargetingPreference?.priority ?? defaultTargetPriority
  const hostileTargets = tokens.filter((candidate) =>
    candidate.id !== token.id && candidate.type !== 'obstacle' && areOpposedCombatTokens(token, candidate),
  )
  const encounterParticipantIds = encounterParticipantTokenIds
    ? new Set(encounterParticipantTokenIds)
    : undefined
  const markerParticipants = (tokens.some((candidate) => candidate.id === token.id)
    ? tokens
    : [...tokens, token])
    .filter((candidate) => candidate.type !== 'obstacle' && (
      !encounterParticipantIds || encounterParticipantIds.has(candidate.id)))
    .map((candidate) => ({
      tokenId: candidate.id,
      label: candidate.characterId
        ? characters.find((character) => character.id === candidate.characterId)?.name ?? candidate.label
        : candidate.label,
      monster: candidate.poolId ? getDnd5eSrdMonster(candidate.poolId) : undefined,
    }))
  const tokenStatusMarkerOptions = dnd5eTokenStatusMarkerOptionsForTarget({
    targetTokenId: token.id,
    participants: markerParticipants,
  })

  const openMonsterOverrideEditor = () => {
    if (!canEdit || !token.poolId || !monsterDefinition) {
      setOverrideMessage('该 Token 尚未关联可编辑的 D&D 5e 怪物属性块。')
      return
    }
    const editable = createDnd5eMonsterInstanceOverride({
      monster: monsterDefinition,
      tokenId: token.id,
      scope: overrideScope,
    })
    setOverrideEditor({
      sourceMonsterId: token.poolId,
      scope: overrideScope,
      editRequest: { requestId: Date.now(), monster: editable },
    })
    setOverrideMessage('')
  }

  const applySavedMonsterOverride = async (monster: Dnd5eMonsterStatBlock) => {
    if (!overrideEditor || !mapId || !updateToken) return
    const targets = dnd5eMonsterOverrideTargets({
      tokens,
      selectedTokenId: token.id,
      sourceMonsterId: overrideEditor.sourceMonsterId,
      scope: overrideEditor.scope,
    })
    for (const target of targets) {
      const tokenPatch = dnd5eMonsterOverrideTokenPatch({
        monster,
        currentHp: target.id === token.id
          ? authoritativeCurrentHp
          : target.hp ?? monster.hitPoints.average,
      })
      updateToken(mapId, target.id, {
        ...tokenPatch,
        playerVisibleEnemyDetail: target.showDetailOnToken !== false
          ? buildEnemyPlayerVisibleDetail(monster.id)
          : undefined,
      })
      if (target.id === token.id && onSetHitPoints) {
        await onSetHitPoints({
          currentHp: tokenPatch.hp,
          maxHp: tokenPatch.maxHp,
          manuallySetMaximum: true,
        })
      }
    }
    setOverrideEditor((current) => current ? { ...current, sourceMonsterId: monster.id } : current)
    setOverrideMessage(overrideEditor.scope === 'instance'
      ? `已将“${monster.name}”应用到当前怪物实例；Headless 将立即读取新属性。`
      : `已将“${monster.name}”应用到当前地图的 ${targets.length} 个同类怪物。`)
  }

  const uploadPortrait = async (file: File) => {
    if (!canEdit) return
    setPortraitBusy(true)
    setPortraitError('')
    try {
      const dataUrl = await createCharacterPortraitDataUrl(file)
      const blob = await (await fetch(dataUrl)).blob()
      const safeTokenId = token.id.replace(/[^a-z0-9_-]/gi, '_').slice(0, 80)
      const nextId = `token_portrait_${safeTokenId}_${Date.now()}`
      const shared = await putImage(nextId, blob)
      if (!shared) {
        await deleteImage(nextId)
        throw new Error('怪物立绘未能上传到房间，请确认 DM 主机在线后重试。')
      }
      const previousIds = new Set([token.portraitImageId, token.tokenPortraitImageId].filter(
        (candidate): candidate is string => !!candidate,
      ))
      updateToken!(mapId!, token.id, {
        portraitImageId: nextId,
        tokenPortraitImageId: nextId,
      })
      for (const previousId of previousIds) {
        if (previousId !== nextId) void deleteImage(previousId)
      }
    } catch (cause) {
      setPortraitError(cause instanceof Error ? cause.message : '怪物立绘上传失败。')
    } finally {
      setPortraitBusy(false)
    }
  }

  return (<>
    <div data-testid="enemy-detail-panel" className="glass absolute bottom-3 right-3 z-[90] flex max-h-[min(720px,calc(100%-6rem))] w-[min(340px,calc(100%-1.5rem))] flex-col overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
      <div className="flex items-start gap-3 border-b border-white/10 px-4 py-3">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 bg-void-900 text-2xl"
          style={{ borderColor: color }}
        >
          {token.portraitImageId ? (
            <SharedMonsterPortrait
              imageId={token.portraitImageId}
              name={name}
              fallbackSrc={tokenThumbnail}
              fallbackEmoji={emoji}
            />
          ) : tokenThumbnail ? (
            <img src={tokenThumbnail} alt={`${name}的地图缩略图`} className="h-full w-full object-cover" />
          ) : (
            emoji
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold text-slate-100">{name}</h2>
            {stats && (
              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200">
                CR {stats.cr}
              </span>
            )}
            {dnd5eCombatTokenSide(token) === 'player' && (
              <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-200">
                玩家友方
              </span>
            )}
          </div>
          {tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {tags.map((tag) => (
                <span key={tag} className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        {(
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-slate-200"
            title="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {canEdit && (
          <section className="mb-4 rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <input
              ref={portraitInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              aria-label="上传怪物立绘"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0]
                if (file) void uploadPortrait(file)
                event.currentTarget.value = ''
              }}
            />
            <div className="grid grid-cols-[auto,1fr] items-center gap-2">
              <span className="text-xs text-slate-500">名称</span>
              <input
                value={token.label}
                onChange={(e) => updateToken!(mapId!, token.id, { label: e.target.value })}
                className="rounded-lg border border-white/10 bg-void-950/70 px-2 py-1 text-xs text-slate-100 outline-none focus:border-arcane-500"
              />
              <span className="text-xs text-slate-500">体型</span>
              <select
                value={creatureSize}
                onChange={(e) => {
                  const next = e.target.value as CreatureSize
                  updateToken!(mapId!, token.id, {
                    creatureSize: next,
                    size: creatureSizeToTokenSize(next),
                  })
                }}
                className="rounded-lg border border-white/10 bg-void-950/70 px-2 py-1 text-xs text-slate-100 outline-none focus:border-arcane-500"
              >
                {CREATURE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              <span className="text-xs text-slate-500">种类</span>
              <div className="flex flex-wrap gap-1">
                {CREATURE_TYPES.map((type) => {
                  const checked = creatureTypes.includes(type)
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        const next = checked
                          ? creatureTypes.filter((item) => item !== type)
                          : [...creatureTypes, type]
                        updateToken!(mapId!, token.id, { creatureTypes: next })
                      }}
                      className={`rounded px-1.5 py-0.5 text-[10px] ${
                        checked
                          ? 'bg-arcane-500/30 text-arcane-100'
                          : 'bg-white/5 text-slate-500 hover:bg-white/10 hover:text-slate-300'
                      }`}
                    >
                      {type}
                    </button>
                  )
                })}
              </div>
              <span className="text-xs text-slate-500">HP</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  aria-label="怪物当前生命值"
                  min={0}
                  max={displayedHitPoints.maxHp}
                  value={editingCurrentHp ? currentHpDraft : displayedHitPoints.currentHp}
                  onFocus={(event) => {
                    setCurrentHpDraft(String(displayedHitPoints.currentHp))
                    setEditingCurrentHp(true)
                    event.currentTarget.select()
                  }}
                  onChange={(event) => {
                    const draft = event.target.value
                    setCurrentHpDraft(draft)
                    const nextHp = parseLiveHitPointDraft(draft, displayedHitPoints.maxHp)
                    if (nextHp == null) return
                    setHitPoints(nextHp, displayedHitPoints.maxHp, false)
                  }}
                  onBlur={() => setEditingCurrentHp(false)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur()
                  }}
                  className="w-16 rounded border border-white/10 bg-void-950/70 px-1 py-0.5 text-center text-xs text-slate-100 outline-none focus:border-arcane-500"
                />
                <span className="text-xs text-slate-500">/</span>
                <input
                  type="number"
                  aria-label="怪物最大生命值"
                  min={1}
                  value={editingMaxHp ? maxHpDraft : displayedHitPoints.maxHp}
                  onFocus={(event) => {
                    setMaxHpDraft(String(displayedHitPoints.maxHp))
                    setEditingMaxHp(true)
                    event.currentTarget.select()
                  }}
                  onChange={(event) => {
                    const draft = event.target.value
                    setMaxHpDraft(draft)
                    if (draft.trim() === '') return
                    const parsed = Number(draft)
                    if (!Number.isFinite(parsed)) return
                    const nextMaxHp = Math.max(1, Math.floor(parsed))
                    setHitPoints(Math.min(displayedHitPoints.currentHp, nextMaxHp), nextMaxHp, true)
                  }}
                  onBlur={() => setEditingMaxHp(false)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur()
                  }}
                  className="w-16 rounded border border-white/10 bg-void-950/70 px-1 py-0.5 text-center text-xs text-slate-100 outline-none focus:border-arcane-500"
                />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={portraitBusy}
                onClick={() => portraitInputRef.current?.click()}
                className="flex items-center gap-1.5 rounded-lg bg-violet-500/15 px-2 py-1 text-xs font-semibold text-violet-200 hover:bg-violet-500/25 disabled:opacity-40"
              >
                <ImagePlus className="h-3.5 w-3.5" />
                {portraitBusy ? '处理中…' : token.portraitImageId ? '替换怪物立绘' : '上传怪物立绘'}
              </button>
              <AiImageGenerationButton
                label="AI 生成"
                title="AI 生成怪物立绘"
                disabled={portraitBusy}
                className="rounded-lg px-2 py-1"
                defaultPrompt={`为 D&D 5E 怪物“${name}”绘制原创奇幻立绘。设定：${[creatureSize, ...creatureTypes, ...templateTags].filter(Boolean).join('、') || '未知怪物'}。${description ? `资料：${description}。` : ''}竖版 3:4，单体，全身或四分之三身，主体居中，轮廓清晰，适合裁切为圆形地图 Token；简洁背景，不要出现文字、标志、水印或边框。`}
                onGenerated={async ({ dataUrl, mimeType }) => {
                  const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType.split('/')[1]
                  await uploadPortrait(await generatedImageDataUrlToFile(dataUrl, `monster-ai-portrait.${extension}`))
                }}
              />
              {(token.portraitImageId || token.tokenPortraitImageId) && (
                <button
                  type="button"
                  onClick={() => {
                    const imageIds = new Set([token.portraitImageId, token.tokenPortraitImageId].filter(
                      (candidate): candidate is string => !!candidate,
                    ))
                    updateToken!(mapId!, token.id, {
                      portraitImageId: undefined,
                      tokenPortraitImageId: undefined,
                    })
                    for (const imageId of imageIds) void deleteImage(imageId)
                  }}
                  className="rounded-lg bg-white/5 px-2 py-1 text-xs text-slate-400 hover:bg-white/10 hover:text-slate-200"
                >
                  移除立绘
                </button>
              )}
              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-white/5 px-2 py-1 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={token.showHpOnToken !== false}
                  onChange={(e) => updateToken!(mapId!, token.id, { showHpOnToken: e.target.checked })}
                  className="accent-arcane-500"
                />
                玩家可见血条
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-white/5 px-2 py-1 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={token.showDetailOnToken !== false}
                  onChange={(event) => {
                    const visible = event.target.checked
                    updateToken!(mapId!, token.id, {
                      showDetailOnToken: visible,
                      playerVisibleEnemyDetail: visible && token.poolId
                        ? buildEnemyPlayerVisibleDetail(token.poolId)
                        : undefined,
                    })
                  }}
                  className="accent-arcane-500"
                />
                玩家可见详情
              </label>
              {removeToken && (
                <button
                  type="button"
                  onClick={() => {
                    removeToken(mapId!, token.id)
                    onClose()
                  }}
                  className="rounded-lg bg-rose-500/15 px-2 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-500/25"
                >
                  删除
                </button>
              )}
            </div>
            {monsterDefinition && (
              <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-500/[0.06] p-3">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-amber-200" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-amber-100">DM 自由编辑属性块{isDnd5eMonsterInstanceOverride(token.poolId) ? ' · 已覆盖' : ''}</p>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-amber-100/60">可修改属性、豁免、技能、特性、攻击骰、附加伤害、传奇及巢穴动作；保存后由 Headless 重新校验。</p>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                  <select
                    aria-label="怪物编辑作用范围"
                    value={overrideScope}
                    onChange={(event) => setOverrideScope(event.target.value as Dnd5eMonsterOverrideScope)}
                    className="rounded-lg border border-white/10 bg-void-950/70 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-amber-400"
                  >
                    <option value="instance">仅当前怪物实例</option>
                    <option value="same-template">当前地图全部同类</option>
                  </select>
                  <button type="button" disabled={monsterActionPending} onClick={openMonsterOverrideEditor} className="rounded-lg bg-amber-400/20 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-400/30 disabled:cursor-wait disabled:opacity-40">{isDnd5eMonsterInstanceOverride(token.poolId) ? '继续编辑' : '打开编辑器'}</button>
                </div>
                {overrideMessage && <p className="mt-2 text-[10px] leading-relaxed text-emerald-200">{overrideMessage}</p>}
              </div>
            )}
            {isStructured5eMonster && token.type === 'enemy' && (
              <div className="mt-3 border-t border-white/10 pt-3">
                <label className="block text-xs text-slate-500">
                  自动攻击偏好
                  <select
                    value={token.dnd5eTargetingPreference ? targetPriority : 'template-default'}
                    onChange={(event) => updateToken!(mapId!, token.id, {
                      dnd5eTargetingPreference: event.target.value === 'template-default'
                        ? undefined
                        : { schemaVersion: 1, priority: event.target.value as Dnd5eMonsterTargetPriority },
                    })}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-void-950/70 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-arcane-500"
                  >
                    <option value="template-default">使用模板默认（{DND5E_MONSTER_TARGET_PRIORITY_OPTIONS.find((entry) => entry.value === defaultTargetPriority)?.label}）</option>
                    {DND5E_MONSTER_TARGET_PRIORITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <p className="mt-1 text-[10px] leading-relaxed text-slate-500">{DND5E_MONSTER_TARGET_PRIORITY_OPTIONS.find((entry) => entry.value === targetPriority)?.description}</p>
                <label className="mt-3 block text-xs text-slate-500">
                  自动行为风格
                  <select
                    value={token.dnd5eBehaviorPreference?.style ?? 'auto'}
                    onChange={(event) => updateToken!(mapId!, token.id, {
                      dnd5eBehaviorPreference: event.target.value === 'auto'
                        ? undefined
                        : { schemaVersion: 1, style: event.target.value as Dnd5eMonsterBehaviorStyle },
                    })}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-void-950/70 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-arcane-500"
                  >
                    <option value="auto">自动判断（按武器与能力）</option>
                    {DND5E_MONSTER_BEHAVIOR_STYLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
                  {token.dnd5eBehaviorPreference
                    ? DND5E_MONSTER_BEHAVIOR_STYLE_OPTIONS.find((entry) => entry.value === token.dnd5eBehaviorPreference?.style)?.description
                    : '近战怪物默认强攻、纯远程怪物默认守势，同时拥有近战与远程武器的怪物默认游击。'}
                </p>
                {targetPriority === 'highest-threat' && hostileTargets.length > 0 && (
                  <div className="mt-2 space-y-1.5 rounded-lg border border-white/10 bg-black/15 p-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">仇恨值调整</p>
                    {hostileTargets.map((target) => <label key={target.id} className="flex items-center gap-2 text-xs text-slate-400"><span className="min-w-0 flex-1 truncate">{target.label}</span><input type="number" min={0} max={1_000_000_000} value={token.dnd5eCombatState?.monsterThreatByTargetId?.[target.id] ?? 0} onChange={(event) => {
                      const value = Math.max(0, Math.min(1_000_000_000, Math.floor(Number(event.target.value) || 0)))
                      updateToken!(mapId!, token.id, {
                        dnd5eCombatState: {
                          ...token.dnd5eCombatState,
                          monsterThreatByTargetId: {
                            ...token.dnd5eCombatState?.monsterThreatByTargetId,
                            [target.id]: value,
                          },
                        },
                      })
                    }} className="w-20 rounded border border-white/10 bg-void-950/70 px-1.5 py-1 text-right tabular-nums text-slate-100 outline-none focus:border-arcane-500" /></label>)}
                  </div>
                )}
              </div>
            )}
            {portraitError && <p className="mt-2 text-xs text-rose-300">{portraitError}</p>}
          </section>
        )}
        {canEdit ? (
          <div className="mb-4">
            <Dnd5eTokenStatusMarkerEditor
              markers={token.dnd5eTokenStatusMarkers ?? []}
              options={tokenStatusMarkerOptions}
              onChange={(markers) => updateToken!(mapId!, token.id, {
                dnd5eTokenStatusMarkers: markers.length > 0 ? markers : undefined,
              })}
            />
          </div>
        ) : null}
        {canManageConditions && onConditionsChange ? (
          <div className="mb-4">
            <Dnd5eConditionEditor
              conditions={standardConditions}
              activeEffects={linked?.dnd5eCombatState?.activeEffects ?? token.dnd5eCombatState?.activeEffects}
              targetId={token.id}
              sourceOptions={conditionSourceOptions}
              conditionImmunities={stats?.conditionImmunities}
              runtimeStatuses={supportsBerserk ? [{
                id: 'monster-berserk',
                label: '狂暴',
                description: '按狂暴规则攻击最近的可见生物，直到规则效果或 DM 将其解除。',
                glyph: '怒',
                active: monsterCombatState?.monsterBerserk === true,
              }] : []}
              onRuntimeStatusChange={(statusId, active) => {
                if (statusId === 'monster-berserk') onMonsterBerserkChange?.(active)
              }}
              onChange={onConditionsChange}
            />
          </div>
        ) : standardConditions.length > 0 ? (
          <section className="mb-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">D&D 5e 状态</h3>
            <Dnd5eConditionTags conditions={standardConditions} />
          </section>
        ) : null}
        {/* 生命值 */}
        <div className="mb-4">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-medium text-rose-300">生命值</span>
            <span className="tabular-nums text-slate-300">
              {displayedHitPoints.currentHp} / {displayedHitPoints.maxHp}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-void-900/80">
            <div
              className="h-full rounded-full bg-gradient-to-r from-rose-600 to-rose-400 transition-all"
              style={{ width: `${displayedHitPoints.percentage}%` }}
            />
          </div>
        </div>

        {description && (
          <p className="mb-4 text-sm leading-relaxed text-slate-400">{description}</p>
        )}

        {!stats ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/5 px-3 py-6 text-center">
            <p className="text-sm text-slate-400">该敌人尚未关联怪物种类</p>
            <p className="mt-1 text-xs text-slate-500">DM 可通过「添加怪物」为其指定种类</p>
          </div>
        ) : (
          <>
            {/* 基础数据 */}
            <div className="mb-4 grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
                <Shield className="h-4 w-4 text-sky-400" />
                <div>
                  <p className="text-[10px] text-slate-500">AC</p>
                  <p className="text-sm font-semibold text-slate-100">{isStructured5eMonster ? stats.ac : derived?.ac ?? stats.ac}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
                <Footprints className="h-4 w-4 text-emerald-400" />
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-500">速度</p>
                  <p className="truncate text-sm font-semibold text-slate-100">{stats.speed}</p>
                </div>
              </div>
            </div>

            {isStructured5eMonster && (
              <section className="mb-4 space-y-1.5 rounded-xl border border-amber-500/15 bg-amber-500/[0.06] px-3 py-2 text-xs text-slate-300">
                {stats.hitDice && <p><span className="text-slate-500">生命骰 · </span>{stats.hitDice}</p>}
                {stats.alignment && <p><span className="text-slate-500">阵营 · </span>{stats.alignment}</p>}
                <p><span className="text-slate-500">来源 · </span>{stats.source}{stats.sourcePage ? `，第 ${stats.sourcePage} 页` : ''}</p>
                {stats.damageVulnerabilities?.length ? <p><span className="text-slate-500">伤害易伤 · </span>{stats.damageVulnerabilities.join('、')}</p> : null}
                {stats.damageResistances?.length ? <p><span className="text-slate-500">伤害抗性 · </span>{stats.damageResistances.join('、')}</p> : null}
                {stats.damageImmunities?.length ? <p><span className="text-slate-500">伤害免疫 · </span>{stats.damageImmunities.join('、')}</p> : null}
                {stats.conditionImmunities?.length ? <p><span className="text-slate-500">状态免疫 · </span>{stats.conditionImmunities.join('、')}</p> : null}
              </section>
            )}

            {/* 主攻击命中 + 伤害：对所有怪物渲染（含 ogre/owlbear 等无装备怪）。 */}
            {derived?.damageDice && (
              <section className="mb-4">
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <Swords className="h-3.5 w-3.5" />
                  主攻击
                </h3>
                <div className="flex flex-wrap items-center gap-2 rounded-xl bg-rose-500/10 px-3 py-2">
                  {derived.attackName && (
                    <span className="text-sm font-medium text-rose-200">{derived.attackName}</span>
                  )}
                  {derived.toHit != null && (
                    <span className="rounded bg-white/5 px-1.5 py-0.5 text-xs tabular-nums text-slate-200">
                      命中 {derived.toHit >= 0 ? `+${derived.toHit}` : derived.toHit}
                    </span>
                  )}
                  <span className="rounded bg-white/5 px-1.5 py-0.5 text-xs tabular-nums text-slate-200">
                    伤害 {derived.damageDice}
                  </span>
                </div>
              </section>
            )}

            {token.poolId && getEnemyEquipmentSlots(token.poolId).some((s) => s.name) && (
              <section className="mb-4">
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <Backpack className="h-3.5 w-3.5" />
                  装备
                </h3>
                <ul className="space-y-1.5">
                  {getEnemyEquipmentSlots(token.poolId)
                    .filter((s) => s.name)
                    .map((s) => (
                      <li key={s.slot} className="rounded-xl bg-amber-500/10 px-3 py-2">
                        <p className="text-[10px] text-slate-500">{s.label}</p>
                        <p className="text-sm font-medium text-amber-100">{s.name}</p>
                        {s.stats ? <p className="mt-0.5 text-[11px] text-slate-500">{s.stats}</p> : null}
                      </li>
                    ))}
                </ul>
              </section>
            )}

            {/* 六维属性 */}
            <section className="mb-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">属性</h3>
              <div className="grid grid-cols-3 gap-2">
                {ABILITIES.map(({ key, label }) => {
                  const score = stats.abilities[key]
                  const mod = abilityMod(score)
                  return (
                    <div
                      key={key}
                      className="flex flex-col items-center rounded-xl border border-white/5 bg-void-900/40 px-2 py-2"
                    >
                      <span className="text-[10px] font-medium text-slate-500">{label}</span>
                      <span className="text-lg font-bold text-arcane-200">{formatMod(mod)}</span>
                      <span className="text-[10px] tabular-nums text-slate-500">{score}</span>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* 技能 / 感官 / 语言 */}
            {(stats.skills?.length || stats.senses || stats.languages) && (
              <section className="mb-4 space-y-1.5 text-xs text-slate-400">
                {stats.skills?.map((s) => (
                  <p key={s.name}>
                    <span className="text-slate-500">技能 · </span>
                    {s.name} {s.bonus}
                  </p>
                ))}
                {stats.senses && (
                  <p>
                    <span className="text-slate-500">感官 · </span>
                    {stats.senses}
                  </p>
                )}
                {stats.languages && (
                  <p>
                    <span className="text-slate-500">语言 · </span>
                    {stats.languages}
                  </p>
                )}
              </section>
            )}

            {/* 特性 */}
            {stats.traits.length > 0 && (
              <section className="mb-4">
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <Sparkles className="h-3.5 w-3.5" />
                  特性
                </h3>
                <ul className="space-y-2">
                  {stats.traits.map((t) => (
                    <li key={t.name} className="rounded-xl bg-violet-500/10 px-3 py-2">
                      <div className="flex items-center justify-between gap-2"><p className="text-sm font-medium text-violet-200">{t.name}</p>{t.automation && <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${t.automation === 'headless' ? 'bg-emerald-500/15 text-emerald-200' : 'bg-amber-500/15 text-amber-200'}`}>{t.automation === 'headless' ? 'HEADLESS' : 'DM 裁定'}</span>}</div>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{t.description}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {multiattackContinuation ? (
              <section
                data-testid="enemy-detail-multiattack-continuation"
                className="mb-4 rounded-xl border border-amber-300/25 bg-amber-500/10 px-3 py-3"
              >
                <p className="text-xs font-bold text-amber-100">继续多重攻击</p>
                <p className="mt-1 text-[11px] text-amber-100/70">
                  {multiattackContinuation.parentActionName} · 第 {multiattackContinuation.occurrenceNumber}/{multiattackContinuation.occurrenceCount} 击：
                  {multiattackContinuation.actionName}
                </p>
                <button
                  type="button"
                  disabled={monsterActionPending}
                  onClick={() => onSelectMonsterContinuation?.(multiattackContinuation)}
                  className="mt-2 w-full rounded-lg bg-amber-400/20 px-2 py-1.5 text-xs font-semibold text-amber-50 hover:bg-amber-400/30 disabled:cursor-wait disabled:opacity-40"
                >
                  {monsterActionPending
                    ? '正在结算当前攻击…'
                    : `选择目标 · ${multiattackContinuation.actionName}`}
                </button>
              </section>
            ) : null}

            {/* 动作 */}
            {stats.actions.length > 0 && (
              <section className="mb-2">
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <Swords className="h-3.5 w-3.5" />
                  动作
                </h3>
                <ul className="space-y-2">
                  {stats.actions.map((a, actionIndex) => (
                    <li key={`${a.name}:${actionIndex}`} className="rounded-xl bg-rose-500/10 px-3 py-2">
                      <div className="flex items-center justify-between gap-2"><p className="text-sm font-medium text-rose-200">{a.name}</p>{a.automation && <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${a.automation === 'headless' ? 'bg-emerald-500/15 text-emerald-200' : 'bg-amber-500/15 text-amber-200'}`}>{a.automation === 'headless' ? 'Headless' : 'DM 裁定'}</span>}</div>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{a.description}</p>
                      {canUseMonsterActions && a.automation === 'headless' && (
                        a.kind === 'melee' ||
                        a.kind === 'ranged' ||
                        a.kind === 'multiattack'
                      ) ? (
                        <button
                          type="button"
                          disabled={monsterActionUsed}
                          onClick={() => onSelectMonsterAction?.(actionIndex, a.name)}
                          className="mt-2 w-full rounded-lg bg-rose-500/20 px-2 py-1.5 text-xs font-semibold text-rose-100 hover:bg-rose-500/30 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {monsterActionUsed ? '本回合动作已使用' : `选择目标 · ${a.name}`}
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {stats.spellcasting && (
              <section className="mb-4 rounded-xl bg-sky-500/10 px-3 py-2">
                <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-medium text-sky-200">施法</h3><span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-amber-200">DM 裁定</span></div>
                <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-slate-400">{stats.spellcasting}</p>
              </section>
            )}
            {([
              ['附赠动作', stats.bonusActions, 'bg-emerald-500/10', 'text-emerald-200'],
              ['反应', stats.reactions, 'bg-cyan-500/10', 'text-cyan-200'],
              ['传奇动作', stats.legendaryActions, 'bg-amber-500/10', 'text-amber-200'],
              ['巢穴动作', stats.lairActions, 'bg-fuchsia-500/10', 'text-fuchsia-200'],
            ] as const).map(([label, actions, background, text]) => actions?.length ? (
              <section key={label} className="mb-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</h3>
                <ul className="space-y-2">{actions.map((action) => <li key={action.name} className={`rounded-xl ${background} px-3 py-2`}><div className="flex items-center justify-between gap-2"><p className={`text-sm font-medium ${text}`}>{action.name}</p><span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${action.automation === 'headless' ? 'bg-emerald-500/15 text-emerald-200' : 'bg-amber-500/15 text-amber-200'}`}>{action.automation === 'headless' ? 'Headless' : 'DM 裁定'}</span></div><p className="mt-0.5 text-xs leading-relaxed text-slate-400">{action.description}</p></li>)}</ul>
              </section>
            ) : null)}
          </>
        )}

      </div>
    </div>
    {overrideEditor && (
      <Dnd5eMonsterWorkshopDialog
        key={overrideEditor.editRequest.requestId}
        open
        context="room"
        editRequest={overrideEditor.editRequest}
        draftStorageScope={`map-token:${token.id}`}
        onMonsterSaved={applySavedMonsterOverride}
        onClose={() => setOverrideEditor(undefined)}
      />
    )}
    </>
  )
}
