import { useEffect, useRef, useState } from 'react'
import type { Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { ABILITIES, abilityMod, formatMod } from '../../lib/dnd'
import { getEnemyTemplate, type EnemyTemplate } from '../../lib/enemyPool'
import { getEnemyStatBlock, type EnemyStatBlock } from '../../lib/enemyStatBlocks'
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
import { X, Shield, Footprints, Sparkles, Swords, Backpack, ImagePlus } from 'lucide-react'
import Dnd5eConditionEditor, { Dnd5eConditionTags } from './Dnd5eConditionEditor'
import type { Dnd5eActiveEffectInstance } from '../../rulesets/dnd5e/activeEffects'
import { createCharacterPortraitDataUrl } from '../../lib/characterPortrait'
import { deleteImage, getImage, putImage } from '../../lib/imageStore'
import { areOpposedCombatTokens } from '../../lib/opportunityAttacks'
import {
  getDnd5eSrdMonster,
  type Dnd5eMonsterBehaviorStyle,
  type Dnd5eMonsterTargetPriority,
} from '../../rulesets/dnd5e/monsters'
import {
  DND5E_MONSTER_BEHAVIOR_STYLE_OPTIONS,
  DND5E_MONSTER_TARGET_PRIORITY_OPTIONS,
} from '../../rulesets/dnd5e/monsterAutomation'
import { parseLiveHitPointDraft, resolveHitPointDisplay } from './characterHitPoints'

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
  const stats = token.poolId ? getEnemyStatBlock(token.poolId) : undefined
  return { template, stats }
}

export default function EnemyDetailPanel({
  token,
  onClose,
  isDM = false,
  mapId,
  characters = [],
  tokens = [],
  updateToken,
  onSetHitPoints,
  removeToken,
  canManageConditions = false,
  onConditionsChange,
  conditionSourceOptions = [],
  canUseMonsterActions = false,
  monsterActionUsed = false,
  onSelectMonsterAction,
}: {
  token: Token
  onClose: () => void
  closable?: boolean
  isDM?: boolean
  mapId?: string
  characters?: Character[]
  tokens?: readonly Token[]
  updateToken?: (mapId: string, tokenId: string, patch: Partial<Token>) => void
  onSetHitPoints?: (input: {
    currentHp: number
    maxHp: number
    manuallySetMaximum: boolean
  }) => void | Promise<unknown>
  removeToken?: (mapId: string, tokenId: string) => void
  canManageConditions?: boolean
  onConditionsChange?: (conditions: string[], activeEffects: Dnd5eActiveEffectInstance[]) => void
  conditionSourceOptions?: readonly { id: string; label: string }[]
  canUseMonsterActions?: boolean
  monsterActionUsed?: boolean
  onSelectMonsterAction?: (actionIndex: number, actionName: string) => void
}) {
  const portraitInputRef = useRef<HTMLInputElement>(null)
  const [portraitBusy, setPortraitBusy] = useState(false)
  const [portraitError, setPortraitError] = useState('')
  const { template, stats } = resolveEnemyDetail(token)
  const derived = token.poolId ? getEnemyDerivedCombatStats(token.poolId) : undefined
  const isStructured5eMonster = stats?.source === 'SRD 5.1' || stats?.source === 'DM 自定义'
  const maxHp = token.maxHp ?? derived?.maxHp ?? template?.maxHp ?? 20
  const curHp = token.hp ?? maxHp

  const name = token.label || template?.name || '敌人'
  const emoji = token.emoji || template?.emoji || '👹'
  const tokenThumbnail = token.tokenPortrait || template?.tokenPortrait
  const color = token.color || template?.color || '#f87171'
  const templateTags = template?.tags ?? []
  const creatureTypes = token.creatureTypes?.length
    ? token.creatureTypes
    : template?.creatureTypes ?? inferCreatureTypesFromTags(templateTags)
  const creatureSize = token.creatureSize ?? template?.creatureSize ?? inferCreatureSizeFromTags(templateTags)
  const tags = [
    ...creatureTypes,
    creatureSize,
    ...templateTags.filter((tag) => !creatureTypes.includes(tag as CreatureType) && tag !== creatureSize),
  ]
  const description = template?.description
  const linked = token.characterId ? characters.find((c) => c.id === token.characterId) : undefined
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
      const previousId = token.portraitImageId
      updateToken!(mapId!, token.id, { portraitImageId: nextId })
      if (previousId) void deleteImage(previousId)
    } catch (cause) {
      setPortraitError(cause instanceof Error ? cause.message : '怪物立绘上传失败。')
    } finally {
      setPortraitBusy(false)
    }
  }

  return (
    <div data-testid="enemy-detail-panel" className="glass absolute bottom-3 right-3 z-40 flex max-h-[min(720px,calc(100%-6rem))] w-[min(340px,calc(100%-1.5rem))] flex-col overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
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
              {token.portraitImageId && (
                <button
                  type="button"
                  onClick={() => {
                    const imageId = token.portraitImageId
                    updateToken!(mapId!, token.id, { portraitImageId: undefined })
                    if (imageId) void deleteImage(imageId)
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
                  onChange={(e) => updateToken!(mapId!, token.id, { showDetailOnToken: e.target.checked })}
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
        {canManageConditions && onConditionsChange ? (
          <div className="mb-4">
            <Dnd5eConditionEditor
              conditions={standardConditions}
              activeEffects={linked?.dnd5eCombatState?.activeEffects ?? token.dnd5eCombatState?.activeEffects}
              targetId={token.id}
              sourceOptions={conditionSourceOptions}
              conditionImmunities={stats?.conditionImmunities}
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
                      <div className="flex items-center justify-between gap-2"><p className="text-sm font-medium text-violet-200">{t.name}</p>{t.automation === 'dm-adjudication' && <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-amber-200">DM 裁定</span>}</div>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{t.description}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

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
  )
}
