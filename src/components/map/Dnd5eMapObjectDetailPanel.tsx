import { Package, Trash2, X } from 'lucide-react'
import type { Token } from '../../store/maps'
import {
  normalizeDnd5eMapObjectStateV1,
  type Dnd5eMapObjectStateV1,
} from '../../rulesets/dnd5e/mapObjectState'
import {
  DND5E_CREATION_MATERIAL_LABELS,
  dnd5eCreationDurationMinutes,
} from '../../rulesets/dnd5e/creation'

interface Dnd5eMapObjectDetailPanelProps {
  token: Token
  onUpdate: (patch: Partial<Token>) => void
  onDelete: () => void
  onClose: () => void
}

const KIND_LABELS: Record<NonNullable<Dnd5eMapObjectStateV1['consumable']>['kind'], string> = {
  food: '非魔法食物',
  drink: '非魔法饮品',
  'food-and-drink': '食物与饮品',
}

const ANIMATE_OBJECT_SIZE_LABELS: Record<NonNullable<Dnd5eMapObjectStateV1['animateObjects']>['size'], string> = {
  tiny: '微型（计 1 个）',
  small: '小型（计 1 个）',
  medium: '中型（计 2 个）',
  large: '大型（计 4 个）',
  huge: '超大型（计 8 个）',
  gargantuan: '巨型（不能被活化）',
}

function formatWorldMinute(worldMinute: number): string {
  const day = Math.floor(worldMinute / (24 * 60)) + 1
  const minuteOfDay = worldMinute % (24 * 60)
  const hours = Math.floor(minuteOfDay / 60)
  const minutes = minuteOfDay % 60
  return `第 ${day} 日 ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export default function Dnd5eMapObjectDetailPanel({
  token,
  onUpdate,
  onDelete,
  onClose,
}: Dnd5eMapObjectDetailPanelProps) {
  const objectState = normalizeDnd5eMapObjectStateV1(token.dnd5eObjectState) ?? { schemaVersion: 1 as const }
  const consumable = objectState.consumable
  const remains = objectState.remains
  const sequester = objectState.sequester
  const creation = objectState.creation
  const waterContainer = objectState.waterContainer
  const animateObjects = objectState.animateObjects ?? {
    size: token.size >= 4 ? 'gargantuan' as const : token.size >= 3 ? 'huge' as const : token.size >= 2 ? 'large' as const : 'medium' as const,
    mobility: 'walk' as const,
    damageType: 'bludgeoning' as const,
  }

  const updateAnimateObjects = (patch: Partial<NonNullable<Dnd5eMapObjectStateV1['animateObjects']>>) => {
    const next = { ...animateObjects, ...patch }
    onUpdate({
      ...(patch.size ? { size: patch.size === 'large' ? 2 : patch.size === 'huge' ? 3 : patch.size === 'gargantuan' ? 4 : 1 } : {}),
      dnd5eObjectState: { ...objectState, schemaVersion: 1, animateObjects: next },
    })
  }

  const updateConsumable = (next: Dnd5eMapObjectStateV1['consumable']) => {
    onUpdate({
      dnd5eObjectState: {
        ...objectState,
        schemaVersion: 1,
        consumable: next,
        ...(next ? { remains: undefined } : {}),
      },
    })
  }

  const updateWaterContainer = (
    next: NonNullable<Dnd5eMapObjectStateV1['waterContainer']>,
  ) => {
    onUpdate({
      dnd5eObjectState: {
        ...objectState,
        schemaVersion: 1,
        waterContainer: next,
        consumable: next.waterGallons > 0
          ? { kind: 'drink', contaminants: objectState.consumable?.contaminants ?? [] }
          : undefined,
        remains: undefined,
      },
    })
  }

  const updatePurpose = (purpose: string) => {
    const nextConsumable = purpose === 'food' || purpose === 'drink' || purpose === 'food-and-drink'
      ? {
          kind: purpose,
          contaminants: consumable?.contaminants ?? [],
        } as NonNullable<Dnd5eMapObjectStateV1['consumable']>
      : undefined
    const nextRemains = purpose === 'bone-pile'
      ? { kind: 'bone-pile' as const }
      : purpose === 'small-humanoid-corpse' || purpose === 'medium-humanoid-corpse'
        ? {
            kind: 'humanoid-corpse' as const,
            creatureSize: purpose.startsWith('small') ? 'small' as const : 'medium' as const,
          }
        : undefined
    const nextWaterContainer = purpose === 'water-container'
      ? waterContainer ?? { schemaVersion: 1 as const, open: true, capacityGallons: 50, waterGallons: 0 }
      : undefined
    onUpdate({
      dnd5eObjectState: {
        ...objectState,
        schemaVersion: 1,
        consumable: nextWaterContainer?.waterGallons
          ? { kind: 'drink', contaminants: consumable?.contaminants ?? [] }
          : nextConsumable,
        remains: nextRemains,
        waterContainer: nextWaterContainer,
      },
    })
  }

  const toggleContaminant = (contaminant: 'poison' | 'disease', active: boolean) => {
    if (!consumable) return
    const next = active
      ? [...new Set([...consumable.contaminants, contaminant])]
      : consumable.contaminants.filter((entry) => entry !== contaminant)
    updateConsumable({ ...consumable, contaminants: next })
  }

  return (
    <aside
      data-testid="dnd5e-map-object-detail-panel"
      className="glass absolute bottom-3 right-3 z-[95] flex max-h-[calc(100%-1.5rem)] w-[min(340px,calc(100%-1.5rem))] flex-col overflow-hidden rounded-2xl border border-amber-300/25 shadow-2xl"
    >
      <header className="flex items-start gap-3 border-b border-white/10 px-4 py-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-amber-300/30 bg-amber-500/10 text-amber-200">
          <Package className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-slate-100">地图物件</h2>
          <p className="mt-0.5 text-xs text-slate-400">配置法术可识别的物件属性与耐久。</p>
        </div>
        <button type="button" onClick={onClose} aria-label="关闭地图物件详情" className="rounded-lg p-1.5 text-slate-500 hover:bg-white/10 hover:text-slate-200">
          <X className="h-4 w-4" />
        </button>
      </header>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        <label className="block text-xs text-slate-400">
          名称
          <input
            aria-label="地图物件名称"
            value={token.label}
            onChange={(event) => onUpdate({ label: event.target.value.slice(0, 80) })}
            className="mt-1 w-full rounded-lg border border-white/10 bg-void-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-300/40"
          />
        </label>
        <label className="block text-xs text-slate-400">
          物件体型 / 占地
          <select
            aria-label="地图物件体型"
            value={Math.max(1, Math.min(creation ? 5 : 4, Math.round(token.size || 1)))}
            onChange={(event) => onUpdate({ size: Number(event.target.value) })}
            className="mt-1 w-full rounded-lg border border-white/10 bg-void-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-300/40"
          >
            <option value={1}>普通（1×1 格；至多中型）</option>
            <option value={2}>大型（2×2 格）</option>
            <option value={3}>超大型（3×3 格）</option>
            <option value={4}>巨型（4×4 格）</option>
            {creation ? <option value={5}>造物术 9 环上限（5×5 格）</option> : null}
          </select>
        </label>
        {creation ? <section className="rounded-xl border border-fuchsia-300/20 bg-fuchsia-500/[0.06] p-3 text-xs text-fuchsia-100" data-testid="creation-object-state">
          <p className="font-semibold">造物术制造物</p>
          <p className="mt-1">施法环位：{creation.slotLevel} 环 · 立方边长：{creation.edgeFeet} 尺</p>
          <p className="mt-1">材质：{creation.materials.map((material) => DND5E_CREATION_MATERIAL_LABELS[material]).join('、')}</p>
          <p className="mt-1">持续：{dnd5eCreationDurationMinutes(creation.materials)} 分钟 · {formatWorldMinute(creation.createdWorldMinute)} → {formatWorldMinute(creation.expiresAtWorldMinute)}</p>
          <p className="mt-2 rounded-lg border border-amber-300/20 bg-amber-500/10 px-2 py-1.5 text-amber-100">不能作为其他法术的材料成分；到期时由战役时钟自动移除。</p>
        </section> : null}
        <section className="rounded-xl border border-sky-300/15 bg-sky-500/[0.05] p-3">
          <p className="text-xs font-semibold text-sky-100">物件耐久与法术属性</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="text-[11px] text-slate-400">
              当前耐久
              <input
                type="number"
                min={0}
                max={Math.max(1, token.maxHp ?? 10)}
                aria-label="地图物件当前耐久"
                value={Math.max(0, token.hp ?? token.maxHp ?? 10)}
                onChange={(event) => onUpdate({
                  hp: Math.max(0, Math.min(token.maxHp ?? 10, Number(event.target.value) || 0)),
                })}
                className="mt-1 w-full rounded-lg border border-white/10 bg-void-950/70 px-2 py-1.5 text-sm text-slate-100"
              />
            </label>
            <label className="text-[11px] text-slate-400">
              最大耐久
              <input
                type="number"
                min={1}
                max={10000}
                aria-label="地图物件最大耐久"
                value={Math.max(1, token.maxHp ?? 10)}
                onChange={(event) => {
                  const maxHp = Math.max(1, Math.min(10000, Number(event.target.value) || 1))
                  onUpdate({ maxHp, hp: Math.min(token.hp ?? maxHp, maxHp) })
                }}
                className="mt-1 w-full rounded-lg border border-white/10 bg-void-950/70 px-2 py-1.5 text-sm text-slate-100"
              />
            </label>
          </div>
          <label className="mt-2 flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              aria-label="魔法物件"
              checked={objectState.magical === true}
              onChange={(event) => onUpdate({
                dnd5eObjectState: { ...objectState, schemaVersion: 1, magical: event.target.checked },
              })}
            />
            魔法物件（不受粉碎音波的物件伤害）
          </label>
          <label className="mt-2 flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              aria-label="物件被穿戴或携带"
              checked={objectState.wornOrCarried === true}
              onChange={(event) => onUpdate({
                dnd5eObjectState: { ...objectState, schemaVersion: 1, wornOrCarried: event.target.checked },
              })}
            />
            被穿戴或携带（不属于无人持有物件）
          </label>
        </section>
        <section className="rounded-xl border border-violet-300/20 bg-violet-500/[0.06] p-3">
          <p className="text-xs font-semibold text-violet-100">活化物件配置</p>
          <p className="mt-1 text-[11px] leading-5 text-violet-100/65">体型决定容量、AC、HP、命中与伤害；移动方式和物件形状由 DM 依场景裁定。</p>
          <label className="mt-2 block text-[11px] text-slate-400">
            规则体型
            <select aria-label="活化物件规则体型" value={animateObjects.size} onChange={(event) => updateAnimateObjects({ size: event.target.value as typeof animateObjects.size })} className="mt-1 w-full rounded-lg border border-white/10 bg-void-950/70 px-2 py-1.5 text-sm text-slate-100">
              {Object.entries(ANIMATE_OBJECT_SIZE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="mt-2 block text-[11px] text-slate-400">
            移动方式
            <select aria-label="活化物件移动方式" value={animateObjects.mobility} onChange={(event) => updateAnimateObjects({ mobility: event.target.value as typeof animateObjects.mobility })} className="mt-1 w-full rounded-lg border border-white/10 bg-void-950/70 px-2 py-1.5 text-sm text-slate-100">
              <option value="walk">有可移动附肢：步行 30 尺</option>
              <option value="fly-hover">无附肢：飞行 30 尺并悬停</option>
              <option value="fixed">牢固连接：速度 0</option>
            </select>
          </label>
          <label className="mt-2 block text-[11px] text-slate-400">
            攻击伤害类型
            <select aria-label="活化物件伤害类型" value={animateObjects.damageType} onChange={(event) => updateAnimateObjects({ damageType: event.target.value as typeof animateObjects.damageType })} className="mt-1 w-full rounded-lg border border-white/10 bg-void-950/70 px-2 py-1.5 text-sm text-slate-100">
              <option value="bludgeoning">钝击（默认）</option>
              <option value="piercing">穿刺</option>
              <option value="slashing">挥砍</option>
            </select>
          </label>
          <p className={`mt-2 rounded-lg border px-3 py-2 text-[11px] ${objectState.magical || objectState.wornOrCarried || animateObjects.size === 'gargantuan' ? 'border-rose-300/20 bg-rose-500/10 text-rose-100' : 'border-emerald-300/20 bg-emerald-500/10 text-emerald-100'}`}>
            {objectState.magical ? '当前为魔法物件：不能被活化。' : objectState.wornOrCarried ? '当前被穿戴或携带：不能被活化。' : animateObjects.size === 'gargantuan' ? '巨型物件不能被活化。' : '当前满足活化物件的基础目标条件。'}
          </p>
        </section>
        <label className="block text-xs text-slate-400">
          物件用途
          <select
            aria-label="地图物件用途"
            value={remains?.kind === 'bone-pile'
              ? 'bone-pile'
              : remains?.kind === 'humanoid-corpse'
                ? `${remains.creatureSize}-humanoid-corpse`
                : waterContainer
                  ? 'water-container'
                  : consumable?.kind ?? 'none'}
            onChange={(event) => updatePurpose(event.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-void-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-300/40"
          >
            <option value="none">普通物件</option>
            {Object.entries(KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            <option value="water-container">敞开／封闭储水容器（造水／枯水术）</option>
            <option value="bone-pile">骨骸堆（操纵死尸 → 骷髅）</option>
            <option value="small-humanoid-corpse">小型类人生物尸体（操纵死尸 → 僵尸）</option>
            <option value="medium-humanoid-corpse">中型类人生物尸体（操纵死尸 → 僵尸）</option>
          </select>
        </label>
        {waterContainer ? <section className="rounded-xl border border-cyan-300/20 bg-cyan-500/[0.06] p-3 text-xs text-cyan-50" data-testid="water-container-state">
          <p className="font-semibold">储水容器</p>
          <label className="mt-2 flex items-center gap-2 text-xs text-slate-200">
            <input
              type="checkbox"
              aria-label="储水容器敞开"
              checked={waterContainer.open}
              onChange={(event) => updateWaterContainer({ ...waterContainer, open: event.target.checked })}
            />
            敞开（造水／枯水术要求）
          </label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="text-[11px] text-slate-400">
              容量（加仑）
              <input
                type="number"
                min={1}
                max={10000}
                aria-label="储水容器容量（加仑）"
                value={waterContainer.capacityGallons}
                onChange={(event) => {
                  const capacityGallons = Math.max(1, Math.min(10000, Math.floor(Number(event.target.value) || 1)))
                  updateWaterContainer({
                    ...waterContainer,
                    capacityGallons,
                    waterGallons: Math.min(waterContainer.waterGallons, capacityGallons),
                  })
                }}
                className="mt-1 w-full rounded-lg border border-white/10 bg-void-950/70 px-2 py-1.5 text-sm text-slate-100"
              />
            </label>
            <label className="text-[11px] text-slate-400">
              当前水量（加仑）
              <input
                type="number"
                min={0}
                max={waterContainer.capacityGallons}
                aria-label="储水容器当前水量（加仑）"
                value={waterContainer.waterGallons}
                onChange={(event) => updateWaterContainer({
                  ...waterContainer,
                  waterGallons: Math.max(0, Math.min(
                    waterContainer.capacityGallons,
                    Math.floor(Number(event.target.value) || 0),
                  )),
                })}
                className="mt-1 w-full rounded-lg border border-white/10 bg-void-950/70 px-2 py-1.5 text-sm text-slate-100"
              />
            </label>
          </div>
          <p className="mt-2 text-[11px] text-cyan-100/70">当前：{waterContainer.waterGallons}/{waterContainer.capacityGallons} 加仑 · {waterContainer.open ? '敞开' : '封闭'}</p>
        </section> : null}
        {remains ? <section className="rounded-xl border border-rose-300/20 bg-rose-500/[0.06] p-3 text-xs text-rose-100">
          <p className="font-semibold">操纵死尸遗骸目标</p>
          <p className="mt-1 text-[11px] leading-5 text-rose-100/75">
            {remains.kind === 'bone-pile'
              ? '被法术选中并成功结算后，此物件会被消耗并在原格生成一具骷髅。'
              : `${remains.creatureSize === 'small' ? '小型' : '中型'}类人生物尸体；被法术选中后会在原格生成一具僵尸。`}
          </p>
        </section> : null}
        {consumable ? <section className="rounded-xl border border-amber-300/15 bg-amber-500/[0.05] p-3">
          <p className="text-xs font-semibold text-amber-100">DM 场景污染</p>
          <label className="mt-2 flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={consumable.contaminants.includes('poison')}
              onChange={(event) => toggleContaminant('poison', event.target.checked)}
            />
            毒素污染
          </label>
          <label className="mt-2 flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={consumable.contaminants.includes('disease')}
              onChange={(event) => toggleContaminant('disease', event.target.checked)}
            />
            疾病污染
          </label>
          <p className="mt-2 text-[11px] text-amber-100/70">
            当前：{consumable.contaminants.length > 0
              ? consumable.contaminants.map((entry) => entry === 'poison' ? '毒素' : '疾病').join('、')
              : '无污染'}
          </p>
        </section> : null}
        {sequester ? <section className="rounded-xl border border-violet-300/20 bg-violet-500/[0.06] p-3">
          <p className="text-xs font-semibold text-violet-100">隔离术生效中</p>
          <p className="mt-1 text-[11px] leading-5 text-violet-100/75">
            物件不可见、不能成为预言法术的目标，也不能被魔法探知传感器感知。施法环位：{sequester.slotLevel} 环。
          </p>
          <p className="mt-1 text-[11px] leading-5 text-slate-400">
            提前结束条件：{sequester.endingCondition ?? '未设置；仅受伤或解除魔法等规则事件结束'}
          </p>
          <button
            type="button"
            onClick={() => onUpdate({
              dnd5eObjectState: {
                ...objectState,
                schemaVersion: 1,
                sequester: undefined,
              },
            })}
            className="mt-2 w-full rounded-lg border border-violet-300/20 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-100 hover:bg-violet-500/20"
          >
            结束隔离术（条件发生／物件受伤）
          </button>
        </section> : null}
        <button type="button" onClick={onDelete} className="flex w-full items-center justify-center gap-2 rounded-lg border border-rose-300/20 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-500/20">
          <Trash2 className="h-4 w-4" />
          删除地图物件
        </button>
      </div>
    </aside>
  )
}
