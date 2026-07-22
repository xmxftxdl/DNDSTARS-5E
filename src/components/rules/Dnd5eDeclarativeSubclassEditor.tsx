import { useMemo, useState } from 'react'
import {
  DND5E_DAMAGE_TYPES,
  DND5E_STANDARD_CONDITION_IDS,
  declarativeSubclassCompatibilityReportV1,
  validateDeclarativeSubclassDefinitionV1,
  type DeclarativeSubclassAbilityV1,
  type DeclarativeSubclassDefinitionV1,
  type DeclarativeSubclassEffectV1,
  type DeclarativeSubclassResourceV1,
  type Dnd5eClassId,
  type Dnd5eDamageType,
  type Dnd5eStandardConditionId,
} from '../../rulesets/dnd5e'

const CLASSES: readonly [Dnd5eClassId, string][] = [
  ['barbarian', '野蛮人'], ['bard', '吟游诗人'], ['cleric', '牧师'], ['druid', '德鲁伊'],
  ['fighter', '战士'], ['monk', '武僧'], ['paladin', '圣武士'], ['ranger', '游侠'],
  ['rogue', '游荡者'], ['sorcerer', '术士'], ['warlock', '邪术师'], ['wizard', '法师'],
]
const TRIGGERS: readonly [DeclarativeSubclassAbilityV1['trigger']['kind'], string][] = [
  ['active-use', '主动使用'], ['after-attack-hit', '攻击命中后'], ['before-damage-taken', '受到伤害前'],
  ['after-damage-taken', '受到伤害后'], ['turn-start', '回合开始'], ['turn-end', '回合结束'],
  ['short-rest-complete', '短休完成'], ['long-rest-complete', '长休完成'],
]

function newDeclarativeSubclass(index: number): DeclarativeSubclassDefinitionV1 {
  return {
    schemaVersion: 1,
    id: `custom-subclass-${index}`,
    classId: 'fighter',
    name: `自定义子职 ${index}`,
    summary: '由房间 DM 创建的声明式子职。',
    resources: [],
    abilities: [newDeclarativeAbility(1)],
  }
}

function newDeclarativeAbility(index: number): DeclarativeSubclassAbilityV1 {
  const rollId = `damage-${index}`
  return {
    schemaVersion: 1,
    id: `ability-${index}`,
    name: `子职能力 ${index}`,
    description: '通过 Host 白名单事务结算的子职能力。',
    level: 3,
    trigger: { kind: 'active-use' },
    cost: { economy: 'action' },
    targeting: { kind: 'single-creature', relation: 'enemy', rangeFeet: 30 },
    rolls: [{ id: rollId, kind: 'damage', label: '能力伤害', dice: { count: 1, sides: 6 }, damageType: 'force' }],
    effects: [{ kind: 'damage', target: 'target', rollId }],
    limits: { oncePerTurn: true },
    duration: { kind: 'instantaneous' },
    automation: 'full',
  }
}

function newResource(index: number): DeclarativeSubclassResourceV1 {
  return {
    id: `resource-${index}`,
    label: `子职资源 ${index}`,
    minimumLevel: 3,
    maximum: { kind: 'fixed', value: 3 },
    resetOn: 'short-rest',
  }
}

function fieldClass(): string {
  return 'w-full rounded-lg border border-white/10 bg-void-950/80 px-2.5 py-2 text-xs text-slate-100'
}

function errorFor(subclass: DeclarativeSubclassDefinitionV1): string | null {
  try {
    validateDeclarativeSubclassDefinitionV1(subclass)
    return null
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

export default function Dnd5eDeclarativeSubclassEditor({
  value,
  onChange,
}: {
  value: DeclarativeSubclassDefinitionV1[]
  onChange(value: DeclarativeSubclassDefinitionV1[]): void
}) {
  const report = useMemo(() => declarativeSubclassCompatibilityReportV1(value), [value])
  const patchSubclass = (index: number, patch: Partial<DeclarativeSubclassDefinitionV1>) => onChange(
    value.map((subclass, itemIndex) => itemIndex === index ? { ...subclass, ...patch } : subclass),
  )
  return <div className="space-y-4">
    <section className="rounded-xl border border-cyan-400/20 bg-cyan-500/[0.04] p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <strong className="text-cyan-100">自动化兼容报告</strong>
        <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-200">完整 {report.full}</span>
        <span className="rounded-full bg-amber-500/10 px-2 py-1 text-amber-200">半自动 {report.partial}</span>
        <span className="rounded-full bg-slate-500/10 px-2 py-1 text-slate-300">手动 {report.manual}</span>
      </div>
      {report.abilities.some((entry) => entry.reasons.length > 0) && <ul className="mt-3 space-y-1 text-[11px] text-amber-200/80">
        {report.abilities.filter((entry) => entry.reasons.length > 0).map((entry) => <li key={entry.abilityId}>
          {entry.abilityId}：{entry.reasons.join('；')}
        </li>)}
      </ul>}
    </section>

    <button type="button" onClick={() => onChange([...value, newDeclarativeSubclass(value.length + 1)])} className="rounded-xl bg-cyan-500/15 px-3 py-2 text-xs font-semibold text-cyan-100">
      添加声明式子职
    </button>
    {value.length === 0 && <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-xs text-slate-600">尚未添加子职。</p>}
    {value.map((subclass, subclassIndex) => <SubclassCard
      key={`${subclass.id}:${subclassIndex}`}
      subclass={subclass}
      onChange={(next) => patchSubclass(subclassIndex, next)}
      onDelete={() => onChange(value.filter((_, index) => index !== subclassIndex))}
    />)}
  </div>
}

function SubclassCard({
  subclass,
  onChange,
  onDelete,
}: {
  subclass: DeclarativeSubclassDefinitionV1
  onChange(value: DeclarativeSubclassDefinitionV1): void
  onDelete(): void
}) {
  const [advanced, setAdvanced] = useState(false)
  const [json, setJson] = useState(() => JSON.stringify(subclass, null, 2))
  const [jsonError, setJsonError] = useState<string | null>(null)
  const validationError = errorFor(subclass)
  const patchAbility = (index: number, patch: Partial<DeclarativeSubclassAbilityV1>) => onChange({
    ...subclass,
    abilities: subclass.abilities.map((ability, itemIndex) => itemIndex === index ? { ...ability, ...patch } : ability),
  })
  const applyJson = () => {
    try {
      const parsed = JSON.parse(json) as unknown
      validateDeclarativeSubclassDefinitionV1(parsed)
      onChange(parsed)
      setJsonError(null)
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : String(error))
    }
  }
  return <article className="rounded-2xl border border-white/10 bg-black/15 p-4">
    <div className="grid gap-3 md:grid-cols-4">
      <EditorField label="子职 ID" value={subclass.id} onChange={(id) => onChange({ ...subclass, id })} />
      <EditorField label="子职名称" value={subclass.name} onChange={(name) => onChange({ ...subclass, name })} />
      <label><span className="mb-1 block text-[11px] font-semibold text-slate-500">所属职业</span><select className={fieldClass()} value={subclass.classId} onChange={(event) => onChange({ ...subclass, classId: event.target.value as Dnd5eClassId })}>{CLASSES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <div className="flex items-end justify-end gap-2"><button type="button" onClick={() => { setJson(JSON.stringify(subclass, null, 2)); setAdvanced((current) => !current) }} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300">{advanced ? '关闭 JSON' : '高级 JSON'}</button><button type="button" onClick={onDelete} className="rounded-lg border border-rose-400/20 px-3 py-2 text-xs text-rose-300">删除子职</button></div>
    </div>
    <div className="mt-3"><EditorField label="子职摘要" value={subclass.summary} onChange={(summary) => onChange({ ...subclass, summary })} /></div>
    {(validationError || jsonError) && <p className="mt-3 rounded-lg bg-rose-500/8 px-3 py-2 text-xs text-rose-200">{jsonError ?? validationError}</p>}
    {advanced ? <div className="mt-4"><textarea aria-label="子职高级 JSON" className="min-h-96 w-full rounded-xl border border-white/10 bg-black/30 p-3 font-mono text-xs text-slate-200" value={json} onChange={(event) => setJson(event.target.value)} /><button type="button" onClick={applyJson} className="mt-2 rounded-lg bg-cyan-500/15 px-3 py-2 text-xs font-semibold text-cyan-100">校验并应用 JSON</button></div> : <>
      <section className="mt-4 rounded-xl border border-white/8 p-3">
        <div className="flex items-center justify-between"><div><h4 className="text-xs font-semibold text-slate-200">子职资源</h4><p className="mt-1 text-[11px] text-slate-600">资源上限与短休／长休恢复由 Host 重新计算。</p></div><button type="button" onClick={() => onChange({ ...subclass, resources: [...(subclass.resources ?? []), newResource((subclass.resources?.length ?? 0) + 1)] })} className="rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-slate-300">添加资源</button></div>
        <div className="mt-3 space-y-2">{(subclass.resources ?? []).map((resource, index) => <ResourceRow key={`${resource.id}:${index}`} resource={resource} onChange={(next) => onChange({ ...subclass, resources: subclass.resources!.map((item, itemIndex) => itemIndex === index ? next : item) })} onDelete={() => onChange({ ...subclass, resources: subclass.resources!.filter((_, itemIndex) => itemIndex !== index) })} />)}</div>
      </section>
      <section className="mt-4">
        <div className="flex items-center justify-between"><div><h4 className="text-xs font-semibold text-slate-200">等级特性与能力</h4><p className="mt-1 text-[11px] text-slate-600">达到等级并选择本子职后自动授予，无需编写 React 或 Headless 分支。</p></div><button type="button" onClick={() => onChange({ ...subclass, abilities: [...subclass.abilities, newDeclarativeAbility(subclass.abilities.length + 1)] })} className="rounded-lg bg-cyan-500/10 px-2.5 py-1.5 text-xs text-cyan-200">添加能力</button></div>
        <div className="mt-3 space-y-3">{subclass.abilities.map((ability, index) => <AbilityCard key={`${ability.id}:${index}`} ability={ability} onChange={(next) => patchAbility(index, next)} onDelete={() => onChange({ ...subclass, abilities: subclass.abilities.filter((_, itemIndex) => itemIndex !== index) })} />)}</div>
      </section>
    </>}
  </article>
}

function ResourceRow({ resource, onChange, onDelete }: { resource: DeclarativeSubclassResourceV1; onChange(value: DeclarativeSubclassResourceV1): void; onDelete(): void }) {
  const maximum = resource.maximum.kind === 'fixed' ? resource.maximum.value : 1
  return <div className="grid gap-2 rounded-lg bg-white/[0.025] p-2 md:grid-cols-5">
    <EditorField label="资源 ID" value={resource.id} onChange={(id) => onChange({ ...resource, id })} />
    <EditorField label="名称" value={resource.label} onChange={(label) => onChange({ ...resource, label })} />
    <EditorNumber label="最低等级" value={resource.minimumLevel ?? 1} min={1} max={20} onChange={(minimumLevel) => onChange({ ...resource, minimumLevel })} />
    <EditorNumber label="固定上限" value={maximum} min={0} max={1_000_000} onChange={(value) => onChange({ ...resource, maximum: { kind: 'fixed', value } })} />
    <div className="flex items-end gap-2"><select aria-label="资源恢复" className={fieldClass()} value={resource.resetOn} onChange={(event) => onChange({ ...resource, resetOn: event.target.value as DeclarativeSubclassResourceV1['resetOn'] })}><option value="combat">每场战斗</option><option value="short-rest">短休</option><option value="long-rest">长休</option></select><button type="button" onClick={onDelete} className="rounded-lg border border-rose-400/20 px-2.5 py-2 text-xs text-rose-300">删除</button></div>
  </div>
}

type BasicEffectKind = DeclarativeSubclassEffectV1['kind']

function AbilityCard({ ability, onChange, onDelete }: { ability: DeclarativeSubclassAbilityV1; onChange(value: DeclarativeSubclassAbilityV1): void; onDelete(): void }) {
  const target = ability.targeting
  const primaryEffect = ability.effects[0]
  const primaryRoll = ability.rolls?.find((roll) => roll.kind === 'damage' || roll.kind === 'healing')
  const resourceCost = ability.cost?.resources?.[0]
  const uses = ability.limits?.uses?.kind === 'fixed' ? ability.limits.uses.value : 0

  const patchRoll = (patch: { count?: number; sides?: number; damageType?: Dnd5eDamageType }) => {
    if (!primaryRoll || (primaryRoll.kind !== 'damage' && primaryRoll.kind !== 'healing')) return
    onChange({
      ...ability,
      rolls: ability.rolls!.map((roll) => roll.id === primaryRoll.id ? {
        ...primaryRoll,
        dice: { ...primaryRoll.dice, count: patch.count ?? primaryRoll.dice.count, sides: patch.sides ?? primaryRoll.dice.sides },
        ...(primaryRoll.kind === 'damage' ? { damageType: patch.damageType ?? primaryRoll.damageType } : {}),
      } : roll),
    })
  }
  const setPrimaryEffect = (kind: BasicEffectKind) => {
    const rollId = `${ability.id || 'ability'}-main`
    if (kind === 'damage' || kind === 'healing') {
      const roll = kind === 'damage'
        ? { id: rollId, kind, label: '能力伤害', dice: { count: 1, sides: 6 }, damageType: 'force' as const }
        : { id: rollId, kind, label: '能力治疗', dice: { count: 1, sides: 6 } }
      onChange({ ...ability, rolls: [roll], effects: [{ kind, target: kind === 'healing' ? 'actor' : 'target', rollId }] })
    } else if (kind === 'temporary-hit-points') {
      onChange({ ...ability, rolls: [], effects: [{ kind, target: 'actor', amount: { kind: 'fixed', value: 1 } }] })
    } else if (kind === 'standard-condition') {
      onChange({ ...ability, rolls: [], effects: [{ kind, target: 'target', condition: 'blinded', duration: { kind: 'fixed-rounds', rounds: 1 } }] })
    } else if (kind === 'move') {
      onChange({ ...ability, rolls: [], effects: [{ kind, target: 'target', distanceFeet: 5, mode: 'push' }] })
    } else {
      onChange({ ...ability, rolls: [], effects: [{ kind, resourceId: resourceCost?.resourceId ?? 'resource-1', amount: { kind: 'fixed', value: 1 } }] })
    }
  }
  const setTargetKind = (kind: DeclarativeSubclassAbilityV1['targeting']['kind']) => {
    const targeting = kind === 'self'
      ? { kind: 'self' as const }
      : kind === 'single-creature'
        ? { kind: 'single-creature' as const, relation: 'enemy' as const, rangeFeet: 30 }
        : kind === 'multiple-creatures'
          ? { kind: 'multiple-creatures' as const, relation: 'enemy' as const, rangeFeet: 30, maximumTargets: 2 }
          : { kind: 'area' as const, relation: 'enemy' as const, shape: 'circle' as const, rangeFeet: 60, radiusFeet: 10, maximumTargets: 16 }
    onChange({ ...ability, targeting })
  }
  const setResourceCost = (resourceId: string) => onChange({
    ...ability,
    cost: {
      ...ability.cost,
      resources: resourceId.trim() ? [{ resourceId: resourceId.trim(), amount: resourceCost?.amount ?? 1 }] : undefined,
    },
  })
  const setUses = (value: number) => onChange({
    ...ability,
    cost: { ...ability.cost, uses: value > 0 ? Math.max(1, ability.cost?.uses ?? 1) : undefined },
    limits: value > 0
      ? { ...ability.limits, uses: { kind: 'fixed', value }, reset: ability.limits?.reset && ability.limits.reset !== 'none' ? ability.limits.reset : 'long-rest' }
      : { ...ability.limits, uses: undefined, reset: undefined },
  })
  return <article className="rounded-xl border border-violet-400/15 bg-violet-500/[0.035] p-3">
    <div className="grid gap-2 md:grid-cols-4">
      <EditorField label="能力 ID" value={ability.id} onChange={(id) => onChange({ ...ability, id })} />
      <EditorField label="能力名称" value={ability.name} onChange={(name) => onChange({ ...ability, name })} />
      <EditorNumber label="获得等级" value={ability.level} min={1} max={20} onChange={(level) => onChange({ ...ability, level })} />
      <label><span className="mb-1 block text-[11px] text-slate-500">自动化</span><select className={fieldClass()} value={ability.automation} onChange={(event) => onChange({ ...ability, automation: event.target.value as DeclarativeSubclassAbilityV1['automation'] })}><option value="full">完全自动</option><option value="partial">半自动</option><option value="manual">DM 裁定</option></select></label>
    </div>
    <div className="mt-2"><EditorField label="规则说明" value={ability.description} onChange={(description) => onChange({ ...ability, description })} /></div>

    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      <label><span className="mb-1 block text-[11px] text-slate-500">触发时点</span><select className={fieldClass()} value={ability.trigger.kind} onChange={(event) => onChange({ ...ability, trigger: { kind: event.target.value as DeclarativeSubclassAbilityV1['trigger']['kind'] } })}>{TRIGGERS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <label><span className="mb-1 block text-[11px] text-slate-500">行动消耗</span><select className={fieldClass()} value={ability.cost?.economy ?? 'none'} onChange={(event) => onChange({ ...ability, cost: { ...ability.cost, economy: event.target.value as NonNullable<DeclarativeSubclassAbilityV1['cost']>['economy'] } })}><option value="action">动作</option><option value="bonusAction">附赠动作</option><option value="reaction">反应</option><option value="none">无行动</option></select></label>
      <EditorNumber label="移动消耗（尺）" value={ability.cost?.movementFeet ?? 0} min={0} max={1_000} onChange={(movementFeet) => onChange({ ...ability, cost: { ...ability.cost, movementFeet } })} />
      <label><span className="mb-1 block text-[11px] text-slate-500">目标类型</span><select className={fieldClass()} value={target.kind} onChange={(event) => setTargetKind(event.target.value as DeclarativeSubclassAbilityV1['targeting']['kind'])}><option value="self">自身</option><option value="single-creature">单体</option><option value="multiple-creatures">多个目标</option><option value="area">范围</option></select></label>
      {target.kind !== 'self' ? <label><span className="mb-1 block text-[11px] text-slate-500">目标关系</span><select className={fieldClass()} value={target.relation ?? 'any'} onChange={(event) => onChange({ ...ability, targeting: { ...target, relation: event.target.value as 'ally' | 'enemy' | 'any' } })}><option value="enemy">敌方</option><option value="ally">友方</option><option value="any">任意</option></select></label> : <div />}
    </div>
    {target.kind !== 'self' && <div className="mt-2 grid gap-2 sm:grid-cols-4">
      <EditorNumber label="距离（尺）" value={target.rangeFeet ?? 0} min={0} max={10_000} onChange={(rangeFeet) => onChange({ ...ability, targeting: { ...target, rangeFeet } })} />
      {(target.kind === 'multiple-creatures' || target.kind === 'area') && <EditorNumber label="最多目标" value={target.maximumTargets ?? 1} min={1} max={256} onChange={(maximumTargets) => onChange({ ...ability, targeting: { ...target, maximumTargets } })} />}
      {target.kind === 'area' && <><label><span className="mb-1 block text-[11px] text-slate-500">范围形状</span><select className={fieldClass()} value={target.shape} onChange={(event) => onChange({ ...ability, targeting: { ...target, shape: event.target.value as typeof target.shape } })}><option value="circle">圆形</option><option value="cone">锥形</option><option value="line">线形</option><option value="rect">矩形</option></select></label><EditorNumber label="半径／长度（尺）" value={target.radiusFeet ?? target.lengthFeet ?? 10} min={1} max={10_000} onChange={(size) => onChange({ ...ability, targeting: target.shape === 'circle' ? { ...target, radiusFeet: size } : { ...target, lengthFeet: size } })} /></>}
    </div>}

    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <EditorField label="消耗资源 ID（可空）" value={resourceCost?.resourceId ?? ''} onChange={setResourceCost} />
      <EditorNumber label="资源消耗" value={resourceCost?.amount ?? 1} min={1} max={1_000_000} onChange={(amount) => resourceCost && onChange({ ...ability, cost: { ...ability.cost, resources: [{ ...resourceCost, amount }] } })} />
      <EditorNumber label="可用次数（0=不限）" value={uses} min={0} max={1_000_000} onChange={setUses} />
      {uses > 0 && <label><span className="mb-1 block text-[11px] text-slate-500">次数恢复</span><select className={fieldClass()} value={ability.limits?.reset ?? 'long-rest'} onChange={(event) => onChange({ ...ability, limits: { ...ability.limits, reset: event.target.value as 'combat' | 'short-rest' | 'long-rest', uses: ability.limits!.uses } })}><option value="combat">每场战斗</option><option value="short-rest">短休</option><option value="long-rest">长休</option></select></label>}
    </div>
    <div className="mt-2 grid gap-2 sm:grid-cols-3">
      <label><span className="mb-1 block text-[11px] text-slate-500">自身必须具有状态</span><select className={fieldClass()} value={ability.predicates?.actorHasConditions?.[0] ?? ''} onChange={(event) => onChange({ ...ability, predicates: { ...ability.predicates, actorHasConditions: event.target.value ? [event.target.value as Dnd5eStandardConditionId] : undefined } })}><option value="">无</option>{DND5E_STANDARD_CONDITION_IDS.map((condition) => <option key={condition} value={condition}>{condition}</option>)}</select></label>
      <label><span className="mb-1 block text-[11px] text-slate-500">目标不得具有状态</span><select className={fieldClass()} value={ability.predicates?.targetLacksConditions?.[0] ?? ''} onChange={(event) => onChange({ ...ability, predicates: { ...ability.predicates, targetLacksConditions: event.target.value ? [event.target.value as Dnd5eStandardConditionId] : undefined } })}><option value="">无</option>{DND5E_STANDARD_CONDITION_IDS.map((condition) => <option key={condition} value={condition}>{condition}</option>)}</select></label>
      <label className="flex items-end gap-2 pb-2 text-xs text-slate-300"><input type="checkbox" checked={ability.limits?.oncePerTurn === true} onChange={(event) => onChange({ ...ability, limits: { ...ability.limits, oncePerTurn: event.target.checked } })} />每回合一次</label>
    </div>

    <section className="mt-3 rounded-lg border border-white/8 p-2">
      <div className="grid gap-2 sm:grid-cols-4">
        <label><span className="mb-1 block text-[11px] text-slate-500">主要效果</span><select className={fieldClass()} value={primaryEffect?.kind ?? 'damage'} onChange={(event) => setPrimaryEffect(event.target.value as BasicEffectKind)}><option value="damage">伤害</option><option value="healing">治疗</option><option value="temporary-hit-points">临时生命</option><option value="standard-condition">标准状态</option><option value="move">强制移动</option><option value="spend-resource">消耗资源</option><option value="restore-resource">恢复资源</option></select></label>
        {(primaryEffect?.kind === 'damage' || primaryEffect?.kind === 'healing') && primaryRoll && (primaryRoll.kind === 'damage' || primaryRoll.kind === 'healing') && <><EditorNumber label="骰子数量" value={primaryRoll.dice.count} min={0} max={40} onChange={(count) => patchRoll({ count })} /><EditorNumber label="骰面" value={primaryRoll.dice.sides} min={2} max={100} onChange={(sides) => patchRoll({ sides })} />{primaryRoll.kind === 'damage' ? <label><span className="mb-1 block text-[11px] text-slate-500">伤害类型</span><select className={fieldClass()} value={primaryRoll.damageType} onChange={(event) => patchRoll({ damageType: event.target.value as Dnd5eDamageType })}>{DND5E_DAMAGE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></label> : <div />}</>}
        {primaryEffect?.kind === 'temporary-hit-points' && primaryEffect.amount.kind === 'fixed' && <EditorNumber label="临时生命值" value={primaryEffect.amount.value} min={0} max={1_000_000} onChange={(value) => onChange({ ...ability, effects: [{ ...primaryEffect, amount: { kind: 'fixed', value } }] })} />}
        {primaryEffect?.kind === 'standard-condition' && <><label><span className="mb-1 block text-[11px] text-slate-500">状态</span><select className={fieldClass()} value={primaryEffect.condition} onChange={(event) => onChange({ ...ability, effects: [{ ...primaryEffect, condition: event.target.value as Dnd5eStandardConditionId }] })}>{DND5E_STANDARD_CONDITION_IDS.map((condition) => <option key={condition} value={condition}>{condition}</option>)}</select></label><EditorNumber label="持续轮数" value={primaryEffect.duration.kind === 'fixed-rounds' ? primaryEffect.duration.rounds : 1} min={1} max={14_400} onChange={(rounds) => onChange({ ...ability, effects: [{ ...primaryEffect, duration: { kind: 'fixed-rounds', rounds } }] })} /></>}
        {primaryEffect?.kind === 'move' && <EditorNumber label="移动距离（尺）" value={primaryEffect.distanceFeet} min={0} max={10_000} onChange={(distanceFeet) => onChange({ ...ability, effects: [{ ...primaryEffect, distanceFeet }] })} />}
        {(primaryEffect?.kind === 'spend-resource' || primaryEffect?.kind === 'restore-resource') && <><EditorField label="效果资源 ID" value={primaryEffect.resourceId} onChange={(resourceId) => onChange({ ...ability, effects: [{ ...primaryEffect, resourceId }] })} />{primaryEffect.amount.kind === 'fixed' && <EditorNumber label="效果数量" value={primaryEffect.amount.value} min={1} max={1_000_000} onChange={(value) => onChange({ ...ability, effects: [{ ...primaryEffect, amount: { kind: 'fixed', value } }] })} />}</>}
      </div>
      <p className="mt-2 text-[10px] text-slate-600">基础模式编辑一个主要效果；组合效果、数值公式、升阶骰、重复豁免和高级持续时间请使用上方高级 JSON，并会经过相同严格校验。</p>
    </section>
    <div className="mt-3 flex justify-end"><button type="button" onClick={onDelete} className="rounded-lg border border-rose-400/20 px-3 py-1.5 text-xs text-rose-300">删除能力</button></div>
  </article>
}

function EditorField({ label, value, onChange }: { label: string; value: string; onChange(value: string): void }) {
  return <label><span className="mb-1 block text-[11px] font-semibold text-slate-500">{label}</span><input aria-label={label} className={fieldClass()} value={value} onChange={(event) => onChange(event.target.value)} /></label>
}

function EditorNumber({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange(value: number): void }) {
  return <label><span className="mb-1 block text-[11px] font-semibold text-slate-500">{label}</span><input aria-label={label} type="number" className={fieldClass()} value={value} min={min} max={max} onChange={(event) => onChange(Math.max(min, Math.min(max, Number(event.target.value) || 0)))} /></label>
}
