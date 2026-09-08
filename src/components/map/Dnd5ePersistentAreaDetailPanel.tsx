import { Crosshair, Flame, Sparkles, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { showAppConfirm } from '../../lib/appDialog'
import { dnd5eSpellAreaAtSlot, getDnd5eSrdCombatSpell } from '../../rulesets/dnd5e/spells'
import type { Dnd5ePluginArea } from '../../store/maps'

export interface Dnd5ePersistentAreaEntityAttackResult {
  outcome: 'miss' | 'hit' | 'destroyed'
  attackTotal: number
  armorClass: number
  damage: number
  hitPointsBefore: number
  hitPointsAfter: number
}

const MAGIC_CIRCLE_CREATURE_TYPE_LABELS: Readonly<Record<string, string>> = {
  celestial: '天界生物',
  '天界生物': '天界生物',
  elemental: '元素生物',
  '元素生物': '元素生物',
  fey: '精类',
  '精类': '精类',
  fiend: '邪魔',
  '邪魔': '邪魔',
  undead: '亡灵',
  '亡灵': '亡灵',
}

const HALLOW_EFFECT_LABELS: Readonly<Record<string, string>> = {
  courage: '勇气',
  darkness: '黑暗',
  daylight: '昼明',
  'energy-protection': '能量防护',
  'energy-vulnerability': '能量易伤',
  'everlasting-rest': '永恒安息',
  'extradimensional-interference': '异维干涉',
  fear: '恐惧',
  silence: '静默',
  tongues: '巧言',
}

const HALLOW_DAMAGE_TYPE_LABELS: Readonly<Record<string, string>> = {
  acid: '强酸',
  cold: '寒冷',
  fire: '火焰',
  force: '力场',
  lightning: '闪电',
  necrotic: '黯蚀',
  poison: '毒素',
  psychic: '心灵',
  radiant: '光耀',
  thunder: '雷鸣',
}

const HALLUCINATORY_TERRAIN_APPEARANCE_LABELS: Readonly<Record<string, string>> = {
  swamp: '沼泽',
  hill: '山丘',
  crevasse: '裂谷',
  meadow: '草地',
  'gentle-slope': '缓坡',
  road: '道路',
  'other-natural-terrain': '其他自然地形（通过房间语音说明）',
}

const PROGRAMMED_ILLUSION_FORM_LABELS: Readonly<Record<string, string>> = {
  object: '物体',
  creature: '生物',
  'visible-phenomenon': '其他可见现象',
}

const PROGRAMMED_ILLUSION_TRIGGER_SENSE_LABELS: Readonly<Record<string, string>> = {
  visual: '区域 30 尺内的视觉状况',
  auditory: '区域 30 尺内的听觉状况',
  'visual-or-auditory': '区域 30 尺内的视觉或听觉状况',
}

const DECLARED_LINE_DIMENSIONS_BY_SPELL: Readonly<Record<string, {
  lengthFeet: number
  widthFeet: number
}>> = {
  'gust-of-wind': { lengthFeet: 60, widthFeet: 10 },
}

function magicCircleProtectionPresentation(area: Dnd5ePluginArea): {
  creatureTypes: string
  boundaryMode: string
  effectSummary: string
} | undefined {
  if (area.coreSpellId !== 'magic-circle') return undefined
  const declaredTypes = area.occupantModifiers?.attacksAgainstOccupantDisadvantageCreatureTypes
    ?? area.blocking?.includedCreatureTypes
    ?? []
  const labels = [...new Set(declaredTypes.map((type) => MAGIC_CIRCLE_CREATURE_TYPE_LABELS[type.trim().toLowerCase()] ?? type.trim()).filter(Boolean))]
  const creatureTypes = labels.length > 0 ? labels.join('、') : '未记录'
  const reversed = area.blocking?.movementMode === 'exit'
  const protectedTargets = reversed ? '法阵外目标' : '法阵内目标'
  return {
    creatureTypes,
    boundaryMode: reversed ? '反向法阵 · 禁止离开' : '正向法阵 · 禁止进入',
    effectSummary: `${creatureTypes}攻击${protectedTargets}时具有劣势；${protectedTargets}免疫被其魅惑、恐慌或附身。`,
  }
}

function hallowProtectionPresentation(area: Dnd5ePluginArea): {
  wardedCreatureTypes: string
  additionalEffect: string
  effectScope: string
  savingThrow?: string
} | undefined {
  if (area.coreSpellId !== 'hallow' || !area.hallow) return undefined
  const wardedCreatureTypes = area.hallow.wardedCreatureTypes
    .map((type) => MAGIC_CIRCLE_CREATURE_TYPE_LABELS[type] ?? type)
    .join('、') || '无（全部列为豁免）'
  const effectLabel = HALLOW_EFFECT_LABELS[area.hallow.additionalEffect] ?? area.hallow.additionalEffect
  const damageTypeLabel = area.hallow.damageType
    ? HALLOW_DAMAGE_TYPE_LABELS[area.hallow.damageType] ?? area.hallow.damageType
    : undefined
  const creatureTypeLabel = area.hallow.affectedCreatureType
    ? MAGIC_CIRCLE_CREATURE_TYPE_LABELS[area.hallow.affectedCreatureType] ?? area.hallow.affectedCreatureType
    : undefined
  const scopeLabel = area.hallow.effectScope === 'all'
    ? '区域内全部生物'
    : area.hallow.effectScope === 'allies'
      ? '施法者同阵营'
      : area.hallow.effectScope === 'enemies'
        ? '施法者敌对阵营'
        : `指定种类：${creatureTypeLabel ?? '未记录'}`
  const savingThrowDc = area.triggers?.find((trigger) => trigger.savingThrow?.ability === 'cha')?.savingThrow?.dc
  return {
    wardedCreatureTypes,
    additionalEffect: damageTypeLabel ? `${effectLabel}（${damageTypeLabel}）` : effectLabel,
    effectScope: scopeLabel,
    savingThrow: savingThrowDc == null
      ? undefined
      : `魅力 DC ${savingThrowDc}；成功后忽略附加效果直至离开区域`,
  }
}

export default function Dnd5ePersistentAreaDetailPanel({ area, sourceName, excludedTargetNames, feetPerCell, currentRound, onResolveEntityAttack, onSetWebUnsupported, onIgniteWebCell, onDelete, onClose }: {
  area?: Dnd5ePluginArea
  sourceName?: string
  /** DM-facing labels for Host-captured cast-time trigger exemptions. */
  excludedTargetNames?: readonly string[]
  feetPerCell?: number
  currentRound?: number
  onResolveEntityAttack?: (input: {
    areaId: string
    attackTotal: number
    damage: number
  }) => Dnd5ePersistentAreaEntityAttackResult | undefined | Promise<Dnd5ePersistentAreaEntityAttackResult | undefined>
  onSetWebUnsupported?: (areaId: string, unsupported: boolean) => void | Promise<void>
  onIgniteWebCell?: (areaId: string, cell: { col: number; row: number }) => void | Promise<void>
  onDelete: (areaId: string) => void | Promise<void>
  onClose: () => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string>()
  const [attackRollA, setAttackRollA] = useState(10)
  const [attackRollB, setAttackRollB] = useState(10)
  const [attackBonus, setAttackBonus] = useState(0)
  const [damage, setDamage] = useState(1)
  const [settlingAttack, setSettlingAttack] = useState(false)
  const [attackResult, setAttackResult] = useState<string>()
  const [strengthRoll, setStrengthRoll] = useState(10)
  const [strengthResult, setStrengthResult] = useState<string>()
  const [settlingWeb, setSettlingWeb] = useState(false)
  const [webResult, setWebResult] = useState<string>()
  if (!area) return null
  const columns = area.cells.map((cell) => cell.col)
  const rows = area.cells.map((cell) => cell.row)
  const cellFeet = Math.max(1, feetPerCell ?? 5)
  const widthFeet = columns.length > 0
    ? (Math.max(...columns) - Math.min(...columns) + 1) * cellFeet
    : 0
  const depthFeet = rows.length > 0
    ? (Math.max(...rows) - Math.min(...rows) + 1) * cellFeet
    : 0
  // Core spell areas store the round boundary *after* the declared duration
  // (`createdRound + durationRounds`). Other persisted area producers use an
  // inclusive final round. Keep their existing display convention while
  // avoiding an extra displayed round for core spells such as Fog Cloud.
  const inclusiveRoundOffset = area.sourceKind === 'core-spell' ? 0 : 1
  const totalRounds = Math.max(0, area.expiresAfterRound - area.createdRound + inclusiveRoundOffset)
  const remainingRounds = currentRound == null
    ? undefined
    : Math.min(totalRounds, Math.max(0, area.expiresAfterRound - currentRound + inclusiveRoundOffset))
  const isWeb = area.sourceKind === 'core-spell' && area.coreSpellId === 'web'
  const isMoveEarth = area.sourceKind === 'core-spell' && area.coreSpellId === 'move-earth'
  const isHallow = area.sourceKind === 'core-spell' && area.coreSpellId === 'hallow'
  const isHallucinatoryTerrain = area.sourceKind === 'core-spell' &&
    area.coreSpellId === 'hallucinatory-terrain'
  const fogCloudSpell = area.coreSpellId === 'fog-cloud' ? getDnd5eSrdCombatSpell('fog-cloud') : undefined
  const fogCloudTemplate = fogCloudSpell
    ? dnd5eSpellAreaAtSlot(fogCloudSpell, area.slotLevel ?? fogCloudSpell.level)
    : undefined
  const fogCloudRadiusFeet = fogCloudTemplate?.shape === 'circle' ? fogCloudTemplate.radiusFeet : undefined
  const declaredLineDimensions = area.coreSpellId
    ? DECLARED_LINE_DIMENSIONS_BY_SPELL[area.coreSpellId]
    : undefined
  const lineRasterMatchesDeclaration = declaredLineDimensions != null && (
    (widthFeet === declaredLineDimensions.lengthFeet && depthFeet === declaredLineDimensions.widthFeet) ||
    (depthFeet === declaredLineDimensions.lengthFeet && widthFeet === declaredLineDimensions.widthFeet)
  )
  const coveragePresentation = isMoveEarth
    ? `${widthFeet}×${depthFeet} 尺`
    : isHallow
      ? `${area.cells.length} 格 · 半径 60 尺（网格包围 ${widthFeet}×${depthFeet} 尺）`
      : isHallucinatoryTerrain
        ? `${area.cells.length} 格 · 150×150 尺${widthFeet === 150 && depthFeet === 150 ? '' : `（网格包围 ${widthFeet}×${depthFeet} 尺）`}`
      : fogCloudRadiusFeet != null
      ? `${area.cells.length} 格 · 半径 ${fogCloudRadiusFeet} 尺（网格包围 ${widthFeet}×${depthFeet} 尺）`
      : declaredLineDimensions != null
        ? `${area.cells.length} 格 · ${declaredLineDimensions.lengthFeet}×${declaredLineDimensions.widthFeet} 尺${lineRasterMatchesDeclaration ? '' : `（网格包围 ${widthFeet}×${depthFeet} 尺）`}`
      : `${area.cells.length} 格 · ${widthFeet}×${depthFeet} 尺`
  const magicCircleProtection = magicCircleProtectionPresentation(area)
  const hallowProtection = hallowProtectionPresentation(area)
  const triggerNotification = area.triggers?.find((trigger) => trigger.notification)?.notification
  const triggerExemptionCount = new Set(area.triggers?.flatMap((trigger) => trigger.excludedTokenIds ?? [])).size
  const burningWebCellKeys = new Set((area.webState?.burningCells ?? []).map((cell) => `${cell.col}:${cell.row}`))
  const remove = async () => {
    if (deleting || !await showAppConfirm({ title: '删除持续法术', message: `从地图上删除「${area.label}」及其关联实体吗？若它对应施法者当前的专注，该专注也会结束。`, confirmLabel: '确认删除', tone: 'danger' })) return
    setDeleting(true); setError(undefined)
    try { await onDelete(area.id); onClose() } catch (cause) { setError(cause instanceof Error ? cause.message : '持续法术删除失败，请重试。') } finally { setDeleting(false) }
  }
  const resolveEntityAttack = async () => {
    if (!area.entityProfile || !onResolveEntityAttack || settlingAttack) return
    const d20 = area.entityProfile.invisible ? Math.min(attackRollA, attackRollB) : attackRollA
    const attackTotal = d20 + attackBonus
    setSettlingAttack(true); setError(undefined); setAttackResult(undefined)
    try {
      const result = await onResolveEntityAttack({ areaId: area.id, attackTotal, damage })
      if (!result) throw new Error('实体攻击结算失败，请检查输入后重试。')
      if (result.outcome === 'miss') {
        setAttackResult(`攻击总值 ${result.attackTotal} 未达到 AC ${result.armorClass}：未命中，HP ${result.hitPointsAfter}/${area.entityProfile.hitPoints}。`)
      } else if (result.outcome === 'destroyed') {
        setAttackResult(`攻击总值 ${result.attackTotal} 命中 AC ${result.armorClass}，造成 ${result.damage} 点伤害；HP ${result.hitPointsBefore}→0，法术结束。`)
        onClose()
      } else {
        setAttackResult(`攻击总值 ${result.attackTotal} 命中 AC ${result.armorClass}，造成 ${result.damage} 点伤害；HP ${result.hitPointsBefore}→${result.hitPointsAfter}。`)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '实体攻击结算失败，请重试。')
    } finally {
      setSettlingAttack(false)
    }
  }
  return <div data-testid="dnd5e-persistent-area-detail-panel" className="glass absolute bottom-3 right-3 z-[90] w-[min(320px,calc(100%-1.5rem))] overflow-hidden rounded-2xl border border-orange-300/20 shadow-2xl">
    <div className="flex items-start gap-3 border-b border-white/10 px-4 py-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-violet-300/35 bg-violet-500/15 text-violet-200"><Sparkles className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1"><h2 className="truncate text-base font-bold text-slate-100">{area.label}</h2><p className="mt-0.5 text-xs text-slate-400">{sourceName ? `施法者：${sourceName}` : '持续法术区域'}</p></div>
      <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-white/10 hover:text-slate-200" aria-label="关闭持续法术详情"><X className="h-4 w-4" /></button>
    </div>
    <div className="max-h-[calc(100vh-8rem)] overflow-y-auto px-4 py-3">
      <dl className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2"><dt className="text-slate-500">{isMoveEarth ? '区域尺寸' : '覆盖'}</dt><dd className="mt-0.5 font-semibold text-slate-200">{coveragePresentation}</dd></div>
        <div className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2"><dt className="text-slate-500">高度</dt><dd className="mt-0.5 font-semibold text-slate-200">{isHallow ? '全高度区域' : area.vertical?.mode === 'volume' ? `${area.vertical.heightFeet} 尺（底部 ${area.vertical.baseElevationFeet} 尺）` : '地面区域'}</dd></div>
        <div className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2"><dt className="text-slate-500">持续</dt><dd className="mt-0.5 font-semibold text-slate-200">{area.permanent ? '直到被解除' : `${totalRounds} 轮${remainingRounds == null ? '' : ` · 剩余 ${remainingRounds} 轮`}`}</dd></div>
        <div className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2"><dt className="text-slate-500">专注</dt><dd className="mt-0.5 truncate font-semibold text-slate-200">{area.concentrationId ?? '不需专注'}</dd></div>
        {area.obscuration ? <div className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2"><dt className="text-slate-500">遮蔽</dt><dd className="mt-0.5 font-semibold text-slate-200">{area.obscuration.kind === 'heavy' ? '重度遮蔽' : '轻度遮蔽'}</dd></div> : null}
        {area.coreSpellId === 'fog-cloud' ? <div className="col-span-2 rounded-lg border border-slate-300/15 bg-slate-500/[0.08] px-2.5 py-2"><dt className="text-slate-400">风力驱散</dt><dd className="mt-1 leading-relaxed text-slate-200">时速至少 10 里的中等或更强风会吹散云雾；由场景与 DM 通过语音处理。</dd></div> : null}
        {area.sourceFollower ? <>
          <div className="rounded-lg border border-cyan-300/20 bg-cyan-500/[0.08] px-2.5 py-2"><dt className="text-cyan-300/75">来源跟随</dt><dd className="mt-0.5 font-semibold text-cyan-100">{area.sourceFollower.stationaryWithinFeet} 尺内保持原位 · 超出后跟随</dd></div>
          <div className="rounded-lg border border-cyan-300/20 bg-cyan-500/[0.08] px-2.5 py-2"><dt className="text-cyan-300/75">最大分离</dt><dd className="mt-0.5 font-semibold text-cyan-100">超过 {area.sourceFollower.maximumSeparationFeet} 尺自动结束</dd></div>
          {area.sourceFollower.maximumStepHeightFeet != null ? <div className="rounded-lg border border-cyan-300/20 bg-cyan-500/[0.08] px-2.5 py-2"><dt className="text-cyan-300/75">高差限制</dt><dd className="mt-0.5 font-semibold text-cyan-100">不能跨越 {area.sourceFollower.maximumStepHeightFeet} 尺或更大高差</dd></div> : null}
          {area.sourceFollower.carryingCapacityPounds != null ? <div className="rounded-lg border border-cyan-300/20 bg-cyan-500/[0.08] px-2.5 py-2"><dt className="text-cyan-300/75">承载能力</dt><dd className="mt-0.5 font-semibold text-cyan-100">{area.sourceFollower.carryingCapacityPounds} 磅</dd></div> : null}
        </> : null}
        {magicCircleProtection ? <>
          <div className="rounded-lg border border-violet-300/20 bg-violet-500/[0.08] px-2.5 py-2"><dt className="text-violet-300/75">防护类型</dt><dd className="mt-0.5 font-semibold text-violet-100">{magicCircleProtection.creatureTypes}</dd></div>
          <div className="rounded-lg border border-violet-300/20 bg-violet-500/[0.08] px-2.5 py-2"><dt className="text-violet-300/75">边界方式</dt><dd className="mt-0.5 font-semibold text-violet-100">{magicCircleProtection.boundaryMode}</dd></div>
          <div className="col-span-2 rounded-lg border border-violet-300/20 bg-violet-500/[0.08] px-2.5 py-2"><dt className="text-violet-300/75">防护效果</dt><dd className="mt-1 leading-relaxed text-slate-200">{magicCircleProtection.effectSummary}</dd></div>
        </> : null}
        {hallowProtection ? <>
          <div className="col-span-2 rounded-lg border border-amber-300/20 bg-amber-500/[0.08] px-2.5 py-2"><dt className="text-amber-300/75">结界阻止</dt><dd className="mt-0.5 font-semibold text-amber-100">{hallowProtection.wardedCreatureTypes}</dd></div>
          <div className="rounded-lg border border-amber-300/20 bg-amber-500/[0.08] px-2.5 py-2"><dt className="text-amber-300/75">附加效果</dt><dd className="mt-0.5 font-semibold text-amber-100">{hallowProtection.additionalEffect}</dd></div>
          <div className="rounded-lg border border-amber-300/20 bg-amber-500/[0.08] px-2.5 py-2"><dt className="text-amber-300/75">作用对象</dt><dd className="mt-0.5 font-semibold text-amber-100">{hallowProtection.effectScope}</dd></div>
          {hallowProtection.savingThrow ? <div className="col-span-2 rounded-lg border border-amber-300/20 bg-amber-500/[0.08] px-2.5 py-2"><dt className="text-amber-300/75">附加效果豁免</dt><dd className="mt-0.5 font-semibold text-amber-100">{hallowProtection.savingThrow}</dd></div> : null}
        </> : null}
        {area.hallucinatoryTerrain ? <>
          <div className="col-span-2 rounded-lg border border-violet-300/20 bg-violet-500/[0.08] px-2.5 py-2"><dt className="text-violet-300/75">幻景外观</dt><dd className="mt-0.5 font-semibold text-violet-100">{HALLUCINATORY_TERRAIN_APPEARANCE_LABELS[area.hallucinatoryTerrain.appearance] ?? area.hallucinatoryTerrain.appearance}</dd></div>
          <div className="rounded-lg border border-violet-300/20 bg-violet-500/[0.08] px-2.5 py-2"><dt className="text-violet-300/75">幻景感官</dt><dd className="mt-0.5 font-semibold text-violet-100">视觉、声音与气味</dd></div>
          <div className="rounded-lg border border-violet-300/20 bg-violet-500/[0.08] px-2.5 py-2"><dt className="text-violet-300/75">保持不变</dt><dd className="mt-0.5 font-semibold text-violet-100">触觉、人工结构、装备与生物</dd></div>
          <div className="col-span-2 rounded-lg border border-violet-300/20 bg-violet-500/[0.08] px-2.5 py-2"><dt className="text-violet-300/75">调查识破</dt><dd className="mt-0.5 font-semibold text-violet-100">智力（调查）DC {area.sourceSpellSaveDc ?? '未记录'}；成功后看见覆盖在真实地形上的模糊幻景。物理互动可能直接暴露触觉差异。</dd></div>
        </> : null}
        {area.programmedIllusion ? <>
          <div className="rounded-lg border border-violet-300/20 bg-violet-500/[0.08] px-2.5 py-2"><dt className="text-violet-300/75">幻影形态</dt><dd className="mt-0.5 font-semibold text-violet-100">{PROGRAMMED_ILLUSION_FORM_LABELS[area.programmedIllusion.form] ?? area.programmedIllusion.form}</dd></div>
          <div className="rounded-lg border border-violet-300/20 bg-violet-500/[0.08] px-2.5 py-2"><dt className="text-violet-300/75">触发依据</dt><dd className="mt-0.5 font-semibold text-violet-100">{PROGRAMMED_ILLUSION_TRIGGER_SENSE_LABELS[area.programmedIllusion.triggerSense] ?? area.programmedIllusion.triggerSense}</dd></div>
        </> : null}
        {area.coreSpellId === 'programmed-illusion' ? <>
          <div className="col-span-2 rounded-lg border border-violet-300/20 bg-violet-500/[0.08] px-2.5 py-2"><dt className="text-violet-300/75">预设表演</dt><dd className="mt-1 leading-relaxed text-slate-200">具体外观、声音、行为和触发措辞由施法者通过房间语音声明。每次表演至多 5 分钟，完成后消失并休眠 10 分钟，之后可以再次触发。</dd></div>
          <div className="col-span-2 rounded-lg border border-violet-300/20 bg-violet-500/[0.08] px-2.5 py-2"><dt className="text-violet-300/75">调查识破</dt><dd className="mt-1 leading-relaxed text-slate-200">实体互动会揭露幻影；生物可用动作进行智力（调查）检定对抗法术豁免 DC {area.sourceSpellSaveDc ?? '未记录'}。</dd></div>
        </> : null}
        {area.coreSpellId === 'dancing-lights' ? <div className="col-span-2 rounded-lg border border-white/10 bg-black/20 px-2.5 py-2"><dt className="text-slate-500">舞光形态</dt><dd className="mt-0.5 font-semibold text-slate-200">{area.dancingLightsForm === 'humanoid' ? '四团合并 · 朦胧中型类人形态' : `分散光团 · ${area.lightingAnchorCells?.length ?? area.cells.length} 团`}</dd></div> : null}
        {triggerNotification ? <div className="col-span-2 rounded-lg border border-white/10 bg-black/20 px-2.5 py-2"><dt className="text-slate-500">触发通知</dt><dd className="mt-0.5 font-semibold text-slate-200">{triggerNotification.delivery === 'mental-to-source'
          ? area.coreSpellId === 'alarm' ? '心灵警报 · 仅通知施法者（1 里内可感知并可唤醒）' : '心灵通知 · 仅通知来源角色'
          : area.coreSpellId === 'alarm' ? `声音警报 · ${triggerNotification.audibleRadiusFeet} 尺内可听（手铃声持续 10 秒）` : `声音通知 · ${triggerNotification.audibleRadiusFeet} 尺内可听`}</dd></div> : null}
        {triggerExemptionCount > 0 ? <div className="col-span-2 rounded-lg border border-white/10 bg-black/20 px-2.5 py-2"><dt className="text-slate-500">不触发目标</dt><dd className="mt-0.5 font-semibold text-slate-200">{excludedTargetNames?.length ? excludedTargetNames.join('、') : `${triggerExemptionCount} 个已登记生物`}</dd></div> : null}
        {area.entityProfile ? <>
          <div className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2"><dt className="text-slate-500">实体防护</dt><dd className="mt-0.5 font-semibold text-slate-200">AC {area.entityProfile.armorClass} · HP {area.entityCurrentHitPoints ?? area.entityProfile.hitPoints}/{area.entityProfile.hitPoints}</dd></div>
          <div className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2"><dt className="text-slate-500">实体规则</dt><dd className="mt-0.5 font-semibold text-slate-200">力量 {area.entityProfile.strength}{area.entityProfile.dexterity != null ? ` · 敏捷 ${area.entityProfile.dexterity}` : ''} · {area.entityProfile.invisible ? '隐形' : '可见'} · {area.entityProfile.cannotAttack ? '不能独立攻击' : '可以攻击'}</dd></div>
        </> : null}
      </dl>
      {isWeb ? <div className="mt-3 rounded-xl border border-orange-300/20 bg-orange-500/[0.07] p-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-orange-100"><Flame className="h-4 w-4" />蛛网术环境规则</div>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-300">困难地形 ×2 · 轻度遮蔽 · 平面厚 5 尺。无支撑蛛网在施法者下一回合开始时坍塌；被火焰触及的 5 尺立方燃烧 1 轮，进入其中的生物在回合开始时受到 2d4 火焰伤害。</p>
        {onSetWebUnsupported ? <button
          type="button"
          disabled={settlingWeb}
          aria-label={area.webState?.unsupportedCollapseAtRound != null ? '标记蛛网已有支撑' : '标记蛛网无支撑'}
          onClick={() => {
            if (settlingWeb) return
            const unsupported = area.webState?.unsupportedCollapseAtRound == null
            setSettlingWeb(true); setError(undefined); setWebResult(undefined)
            void Promise.resolve(onSetWebUnsupported(area.id, unsupported)).then(() => {
              setWebResult(unsupported ? '已标记为无支撑：将在施法者下一回合开始时坍塌。' : '已恢复支撑：自动坍塌已取消。')
            }).catch((cause) => setError(cause instanceof Error ? cause.message : '蛛网支撑状态更新失败。'))
              .finally(() => setSettlingWeb(false))
          }}
          className="mt-3 w-full rounded-lg bg-orange-500/15 px-3 py-2 text-xs font-semibold text-orange-100 hover:bg-orange-500/25 disabled:cursor-wait disabled:opacity-50"
        >{area.webState?.unsupportedCollapseAtRound != null ? `恢复支撑（原定第 ${area.webState.unsupportedCollapseAtRound} 轮坍塌）` : '标记为无支撑'}</button> : null}
        {onIgniteWebCell ? <div className="mt-3">
          <div className="mb-1.5 text-[11px] text-slate-400">点燃一个 5 尺立方（X, Y）</div>
          <div className="grid grid-cols-4 gap-1">
            {[...area.cells].sort((left, right) => left.row - right.row || left.col - right.col).map((cell) => {
              const key = `${cell.col}:${cell.row}`
              const burning = burningWebCellKeys.has(key)
              return <button
                key={key}
                type="button"
                disabled={settlingWeb || burning}
                aria-label={burning ? `蛛网格 X=${cell.col}, Y=${cell.row} 正在燃烧` : `点燃蛛网格 X=${cell.col}, Y=${cell.row}`}
                onClick={() => {
                  if (settlingWeb || burning) return
                  setSettlingWeb(true); setError(undefined); setWebResult(undefined)
                  void Promise.resolve(onIgniteWebCell(area.id, cell)).then(() => {
                    setWebResult(`已点燃蛛网格 X=${cell.col}, Y=${cell.row}；将在当前生物下一回合开始结算 2d4 火焰伤害后燃尽。`)
                  }).catch((cause) => setError(cause instanceof Error ? cause.message : '点燃蛛网失败。'))
                    .finally(() => setSettlingWeb(false))
                }}
                className={`rounded-md border px-1 py-1 text-[10px] ${burning ? 'border-orange-300/50 bg-orange-500/30 text-orange-100' : 'border-white/10 bg-black/20 text-slate-300 hover:bg-orange-500/20'}`}
              >{burning ? '🔥 ' : ''}{cell.col},{cell.row}</button>
            })}
          </div>
        </div> : null}
        {webResult ? <p role="status" className="mt-2 text-xs text-orange-100">{webResult}</p> : null}
      </div> : null}
      {area.illuminationOverride ? <div className="mt-3 rounded-xl border border-violet-300/20 bg-violet-500/[0.07] p-3 text-xs">
        <span className="text-slate-500">内部光照</span>
        <strong className="ml-2 text-violet-100">{area.illuminationOverride === 'dim' ? '微光' : '黑暗'}</strong>
      </div> : null}
      {area.minorIllusion ? <div className="mt-3 rounded-xl border border-violet-300/20 bg-violet-500/[0.07] p-3">
        <div className="text-xs font-semibold text-violet-100">次级幻影声明</div>
        <dl className="mt-2 space-y-2 text-xs">
          <div><dt className="text-slate-500">形态</dt><dd className="mt-0.5 text-slate-200">{area.minorIllusion.mode === 'image' ? '物件影像（最多 5 尺立方）' : '声音'}</dd></div>
          <div><dt className="text-slate-500">内容</dt><dd className="mt-0.5 whitespace-pre-wrap text-violet-100">{area.minorIllusion.description}</dd></div>
          {area.minorIllusion.mode === 'sound' ? <>
            <div><dt className="text-slate-500">音量</dt><dd className="mt-0.5 text-slate-200">{{ whisper: '耳语', normal: '普通音量', scream: '尖叫' }[area.minorIllusion.soundVolume!]}</dd></div>
            <div><dt className="text-slate-500">方式</dt><dd className="mt-0.5 text-slate-200">{{ continuous: '连续', intermittent: '间歇', discrete: '若干离散声音' }[area.minorIllusion.soundPattern!]}</dd></div>
          </> : <div><dt className="text-slate-500">感官限制</dt><dd className="mt-0.5 text-slate-200">无声音、光、气味或其他感官效果；物理互动会直接揭示幻象。</dd></div>}
        </dl>
      </div> : null}
      {area.entityProfile && onResolveEntityAttack ? <div className="mt-3 rounded-xl border border-cyan-300/15 bg-cyan-500/[0.06] p-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-cyan-100"><Crosshair className="h-4 w-4" />对法术实体结算攻击</div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <label className="text-slate-400">d20 A<input aria-label="攻击 d20 A" type="number" min={1} max={20} value={attackRollA} onChange={(event) => setAttackRollA(Math.max(1, Math.min(20, Math.floor(Number(event.target.value) || 1))))} className="mt-1 w-full rounded-md border border-white/10 bg-black/25 px-2 py-1 text-slate-100" /></label>
          {area.entityProfile.invisible ? <label className="text-slate-400">d20 B（隐形劣势）<input aria-label="攻击 d20 B（隐形劣势）" type="number" min={1} max={20} value={attackRollB} onChange={(event) => setAttackRollB(Math.max(1, Math.min(20, Math.floor(Number(event.target.value) || 1))))} className="mt-1 w-full rounded-md border border-white/10 bg-black/25 px-2 py-1 text-slate-100" /></label> : null}
          <label className="text-slate-400">攻击加值<input aria-label="攻击加值" type="number" min={-20} max={40} value={attackBonus} onChange={(event) => setAttackBonus(Math.max(-20, Math.min(40, Math.floor(Number(event.target.value) || 0))))} className="mt-1 w-full rounded-md border border-white/10 bg-black/25 px-2 py-1 text-slate-100" /></label>
          <label className="text-slate-400">命中伤害<input aria-label="命中伤害" type="number" min={1} max={1000000} value={damage} onChange={(event) => setDamage(Math.max(1, Math.min(1_000_000, Math.floor(Number(event.target.value) || 1))))} className="mt-1 w-full rounded-md border border-white/10 bg-black/25 px-2 py-1 text-slate-100" /></label>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-400">{area.entityProfile.invisible ? '按隐形劣势取两个 d20 的较低值' : '使用单个 d20'}，再加攻击加值并对比 AC；只有命中才扣除 HP。</p>
        <button type="button" disabled={settlingAttack} onClick={() => void resolveEntityAttack()} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500/15 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/25 disabled:cursor-wait disabled:opacity-50">{settlingAttack ? '结算中…' : '结算对实体的攻击'}</button>
        {attackResult ? <p role="status" className="mt-2 text-xs leading-relaxed text-cyan-100">{attackResult}</p> : null}
      </div> : null}
      {area.entityProfile ? <div className="mt-3 rounded-xl border border-violet-300/15 bg-violet-500/[0.06] p-3">
        <div className="text-xs font-semibold text-violet-100">实体能力与动作限制</div>
        <div className="mt-2 flex items-end gap-2">
          <label className="min-w-0 flex-1 text-xs text-slate-400">力量检定 d20<input aria-label="力量检定 d20" type="number" min={1} max={20} value={strengthRoll} onChange={(event) => setStrengthRoll(Math.max(1, Math.min(20, Math.floor(Number(event.target.value) || 1))))} className="mt-1 w-full rounded-md border border-white/10 bg-black/25 px-2 py-1 text-slate-100" /></label>
          <button type="button" onClick={() => { const modifier = Math.floor((area.entityProfile!.strength - 10) / 2); const total = strengthRoll + modifier; setStrengthResult(`力量 ${area.entityProfile!.strength}（${modifier >= 0 ? '+' : ''}${modifier}），d20 ${strengthRoll}，检定结果 ${total}。`) }} className="rounded-lg bg-violet-500/15 px-3 py-1.5 text-xs font-semibold text-violet-100 hover:bg-violet-500/25">结算力量检定</button>
        </div>
        {strengthResult ? <p role="status" className="mt-2 text-xs text-violet-100">{strengthResult}</p> : null}
        {area.entityProfile.cannotAttack ? <button type="button" disabled aria-label="实体攻击（规则禁止）" className="mt-2 w-full cursor-not-allowed rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs font-semibold text-slate-500">实体攻击（规则禁止）</button> : null}
      </div> : null}
      <p className="mt-3 text-xs leading-relaxed text-slate-400">删除会同步移除地图上的持续动画、规则区域和关联法术实体；只会结束与该区域精确匹配的当前专注。</p>
      {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
      <button type="button" disabled={deleting} onClick={() => void remove()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-rose-500/15 px-3 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-500/25 disabled:cursor-wait disabled:opacity-50"><Trash2 className="h-4 w-4" />{deleting ? '删除中…' : '删除持续法术'}</button>
    </div>
  </div>
}
