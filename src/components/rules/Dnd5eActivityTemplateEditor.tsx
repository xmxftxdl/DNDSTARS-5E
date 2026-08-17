import { useMemo, useState } from 'react'
import { ChevronDown, Plus, Trash2 } from 'lucide-react'
import {
  DND5E_DAMAGE_TYPES,
  DND5E_STANDARD_CONDITIONS,
  DND5E_ACTIVITY_LIFECYCLE_EVENTS_V1,
  defaultDnd5eMechanicOperationParametersV1,
  dnd5eActivityAutomationAnalysisV1,
  dnd5eActivityWithDerivedAutomationV1,
  listDnd5eMechanicOperationHandlersV1,
  listDnd5eTrackableDefinitionsV1,
  validateDnd5eActivityDefinitionV1,
  type Dnd5eActivityCheckV1,
  type Dnd5eActivityDefinitionV1,
  type Dnd5eActivityOperationV1,
  type Dnd5eEffectDefinitionV1,
  type Dnd5eEffectModifierV1,
  type Dnd5eFormulaV1,
  type Dnd5ePredicateV1,
  type Dnd5eTrackableDefinitionV1,
  type Dnd5eTriggerEventV1,
} from '../../rulesets/dnd5e'
import {
  DND5E_ACTIVITY_AUTHORING_PRESETS,
  dnd5eActivitiesFromAuthoringPresetV1,
  type Dnd5eActivityAuthoringPresetId,
} from './dnd5eActivityTemplateModel'

const control = 'w-full rounded-xl border border-white/10 bg-void-900 px-3 py-2 text-xs text-slate-200 outline-none focus:border-arcane-400/50'
const abilities = [['str', '力量'], ['dex', '敏捷'], ['con', '体质'], ['int', '智力'], ['wis', '感知'], ['cha', '魅力']] as const

function Input({ label, value, onChange }: { label: string; value: string; onChange(value: string): void }) {
  return <label className="block text-xs"><span className="mb-1.5 block font-semibold text-slate-400">{label}</span><input className={control} value={value} onChange={(event) => onChange(event.target.value)} /></label>
}

function NumberInput({ label, value, min = 0, onChange }: { label: string; value: number; min?: number; onChange(value: number): void }) {
  return <label className="block text-xs"><span className="mb-1.5 block font-semibold text-slate-400">{label}</span><input type="number" min={min} className={control} value={value} onChange={(event) => onChange(Number(event.target.value) || 0)} /></label>
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: readonly (readonly [string, string])[]; onChange(value: string): void }) {
  return <label className="block text-xs"><span className="mb-1.5 block font-semibold text-slate-400">{label}</span><select className={control} value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([id, text]) => <option key={id} value={id}>{text}</option>)}</select></label>
}

function Formula({ label, id, value, onChange }: { label: string; id: string; value: Dnd5eFormulaV1; onChange(value: Dnd5eFormulaV1): void }) {
  const kind = ['constant', 'dice', 'reference'].includes(value.kind) ? value.kind : 'complex'
  const setKind = (next: string) => {
    if (next === 'constant') onChange({ kind: 'constant', value: 1 })
    if (next === 'dice') onChange({ kind: 'dice', rollId: id, count: 1, sides: 6 })
    if (next === 'reference') onChange({ kind: 'reference', reference: { kind: 'actor-proficiency-bonus' } })
  }
  return <div className="rounded-xl border border-white/8 bg-black/10 p-2"><Select label={label} value={kind} options={[["constant", "固定值"], ["dice", "骰子"], ["reference", "角色引用"], ["complex", "复合公式（保留）"]]} onChange={setKind} />
    {value.kind === 'constant' && <div className="mt-2"><NumberInput label="数值" value={value.value} min={-1_000_000} onChange={(next) => onChange({ ...value, value: next })} /></div>}
    {value.kind === 'dice' && <div className="mt-2 grid grid-cols-3 gap-2"><Input label="Roll ID" value={value.rollId} onChange={(rollId) => onChange({ ...value, rollId })} /><NumberInput label="骰数" value={value.count} onChange={(count) => onChange({ ...value, count })} /><NumberInput label="面数" value={value.sides} min={2} onChange={(sides) => onChange({ ...value, sides })} /></div>}
    {value.kind === 'reference' && <div className="mt-2"><Select label="引用" value={value.reference.kind} options={[["actor-level", "角色等级"], ["actor-proficiency-bonus", "熟练加值"], ["actor-spell-save-dc", "法术豁免 DC"], ["actor-spell-attack-bonus", "法术攻击加值"], ["actor-spellcasting-ability-modifier", "施法属性调整值"], ["cast-level", "施法环阶"]]} onChange={(referenceKind) => onChange({ kind: 'reference', reference: { kind: referenceKind } as Extract<Dnd5eFormulaV1, { kind: 'reference' }>['reference'] })} /></div>}
    {kind === 'complex' && <p className="mt-2 text-[11px] text-slate-500">复合公式保持原样；切换类型才会重置。</p>}
  </div>
}

const predicateOptions: readonly (readonly [Dnd5ePredicateV1['kind'], string])[] = [
  ['minimum-level', '最低等级'], ['class-level', '职业等级'], ['event-source', '事件来源'],
  ['weapon-property', '本次武器属性'], ['attack-proficiency', '本次攻击熟练'],
  ['attack-weapon', '本次武器 ID'],
  ['attack-origin', '本次攻击来源'], ['attack-hands', '本次持用手数'], ['attack-mode', '攻击模式'],
  ['attack-result', '单一攻击结果'], ['attack-outcome', '攻击后续条件（重击/击倒）'], ['action-economy-available', '行动经济可用'], ['armor-equipped', '已装备护甲'],
  ['armor-proficiency', '护甲熟练资格'],
  ['held-item', '持用物品'], ['free-hands', '空闲手数'], ['spellcasting-capability', '具备施法能力'],
  ['movement-distance', '移动距离'], ['movement-property', '移动属性'], ['condition', '状态'], ['hp-value', '当前生命值'],
]

function newPredicate(kind: Dnd5ePredicateV1['kind']): Dnd5ePredicateV1 {
  if (kind === 'minimum-level') return { kind, level: 1 }
  if (kind === 'class-level') return { kind, classId: 'fighter', minimum: 1 }
  if (kind === 'event-source') return { kind, source: 'attack' }
  if (kind === 'weapon-property') return { kind, property: 'heavy', present: true }
  if (kind === 'attack-proficiency') return { kind, proficient: true }
  if (kind === 'attack-weapon') return { kind, weaponIds: ['srd-5.1:equipment:dnd5e-quarterstaff'] }
  if (kind === 'attack-origin') return { kind, origins: ['attack-action'] }
  if (kind === 'attack-hands') return { kind, hands: 1 }
  if (kind === 'attack-mode') return { kind, mode: 'melee' }
  if (kind === 'attack-result') return { kind, result: 'hit' }
  if (kind === 'attack-outcome') return { kind, outcomes: ['critical-hit', 'target-dropped-to-zero'], match: 'any' }
  if (kind === 'action-economy-available') return { kind, economy: 'reaction' }
  if (kind === 'armor-equipped') return { kind, subject: 'actor', categories: ['heavy'], proficient: true }
  if (kind === 'armor-proficiency') return { kind, subject: 'actor', categories: ['heavy'], match: 'all' }
  if (kind === 'held-item') return { kind, subject: 'actor', slot: 'either-hand', roles: ['weapon'] }
  if (kind === 'free-hands') return { kind, subject: 'actor', minimum: 1 }
  if (kind === 'spellcasting-capability') return { kind, subject: 'actor', capable: true }
  if (kind === 'movement-distance') return { kind, minimumFeet: 10 }
  if (kind === 'movement-property') return { kind, straightLine: true }
  if (kind === 'condition') return { kind, subject: 'actor', condition: 'prone', present: true }
  return { kind: 'hp-value', subject: 'actor', comparison: 'at-most', value: 10 }
}

function csv(value: readonly string[] | undefined): string { return value?.join(', ') ?? '' }
function csvIds(value: string): string[] { return [...new Set(value.split(',').map((entry) => entry.trim()).filter(Boolean))] }

function Predicate({ value, onChange, remove }: { value: Dnd5ePredicateV1; onChange(value: Dnd5ePredicateV1): void; remove(): void }) {
  const patch = (next: object) => onChange({ ...value, ...next } as Dnd5ePredicateV1)
  return <div className="rounded-xl border border-amber-400/15 bg-amber-500/[0.025] p-3">
    <div className="grid gap-2 md:grid-cols-[1fr_2fr_auto]"><Select label="检查类型" value={value.kind} options={predicateOptions} onChange={(kind) => onChange(newPredicate(kind as Dnd5ePredicateV1['kind']))} /><div className="grid gap-2 md:grid-cols-2">
      {value.kind === 'minimum-level' && <NumberInput label="最低等级" value={value.level} min={1} onChange={(level) => patch({ level })} />}
      {value.kind === 'class-level' && <><Input label="职业 ID" value={value.classId} onChange={(classId) => patch({ classId })} /><NumberInput label="最低职业等级" value={value.minimum} min={1} onChange={(minimum) => patch({ minimum })} /></>}
      {value.kind === 'event-source' && <Select label="来源" value={value.source} options={['attack', 'spell', 'skill', 'item', 'feature', 'movement', 'action', 'combat'].map((id) => [id, id] as const)} onChange={(source) => patch({ source })} />}
      {value.kind === 'weapon-property' && <><Input label="属性 ID" value={value.property} onChange={(property) => patch({ property })} /><Select label="必须存在" value={String(value.present)} options={[["true", "是"], ["false", "否"]]} onChange={(present) => patch({ present: present === 'true' })} /></>}
      {value.kind === 'attack-proficiency' && <Select label="攻击熟练" value={String(value.proficient)} options={[["true", "必须熟练"], ["false", "必须不熟练"]]} onChange={(proficient) => patch({ proficient: proficient === 'true' })} />}
      {value.kind === 'attack-weapon' && <Input label="武器 ID（逗号分隔）" value={csv(value.weaponIds)} onChange={(weaponIds) => patch({ weaponIds: csvIds(weaponIds) })} />}
      {value.kind === 'attack-origin' && <Input label="来源（逗号分隔）" value={csv(value.origins)} onChange={(origins) => patch({ origins: csvIds(origins) })} />}
      {value.kind === 'attack-hands' && <Select label="实际持用" value={String(value.hands)} options={[["1", "单手"], ["2", "双手"]]} onChange={(hands) => patch({ hands: Number(hands) as 1 | 2 })} />}
      {value.kind === 'attack-mode' && <Select label="攻击模式" value={value.mode ?? value.modes?.[0] ?? 'melee'} options={[['melee', '近战'], ['ranged', '远程'], ['spell', '法术'], ['unarmed', '徒手']]} onChange={(mode) => onChange({ kind: 'attack-mode', mode: mode as 'melee' | 'ranged' | 'spell' | 'unarmed' })} />}
      {value.kind === 'attack-result' && <Select label="攻击结果" value={value.result} options={[['hit', '命中'], ['miss', '未命中'], ['critical-hit', '重击'], ['critical-miss', '大失败']]} onChange={(result) => patch({ result })} />}
      {value.kind === 'attack-outcome' && <><Input label="条件（逗号分隔）" value={csv(value.outcomes)} onChange={(outcomes) => patch({ outcomes: csvIds(outcomes) })} /><Select label="匹配" value={value.match ?? 'any'} options={[['any', '满足任一'], ['all', '全部满足']]} onChange={(match) => patch({ match })} /></>}
      {value.kind === 'action-economy-available' && <Select label="需可用" value={value.economy} options={[['action', '动作'], ['bonus-action', '附赠动作'], ['reaction', '反应']]} onChange={(economy) => patch({ economy })} />}
      {value.kind === 'armor-equipped' && <><Input label="护甲类别（逗号分隔）" value={csv(value.categories)} onChange={(categories) => patch({ categories: csvIds(categories) })} /><Select label="熟练要求" value={value.proficient == null ? 'any' : String(value.proficient)} options={[["any", "不限"], ["true", "熟练"], ["false", "不熟练"]]} onChange={(proficient) => patch({ proficient: proficient === 'any' ? undefined : proficient === 'true' })} /></>}
      {value.kind === 'armor-proficiency' && <><Input label="熟练类别（逗号分隔）" value={csv(value.categories)} onChange={(categories) => patch({ categories: csvIds(categories) })} /><Select label="匹配方式" value={value.match ?? 'all'} options={[["all", "全部具备"], ["any", "任一具备"]]} onChange={(match) => patch({ match })} /></>}
      {value.kind === 'held-item' && <><Select label="槽位" value={value.slot} options={[['main-hand', '主手'], ['off-hand', '副手'], ['either-hand', '任一手']]} onChange={(slot) => patch({ slot })} /><Input label="角色（逗号分隔）" value={csv(value.roles)} onChange={(roles) => patch({ roles: csvIds(roles) })} /><Input label="物品 ID（可留空）" value={csv(value.itemIds)} onChange={(itemIds) => patch({ itemIds: csvIds(itemIds).length ? csvIds(itemIds) : undefined })} /><Input label="武器属性（可留空）" value={csv(value.requiredWeaponProperties)} onChange={(requiredWeaponProperties) => patch({ requiredWeaponProperties: csvIds(requiredWeaponProperties).length ? csvIds(requiredWeaponProperties) : undefined })} /></>}
      {value.kind === 'free-hands' && <NumberInput label="至少空闲手数" value={value.minimum} min={0} onChange={(minimum) => patch({ minimum: Math.min(2, minimum) })} />}
      {value.kind === 'spellcasting-capability' && <><Select label="施法能力" value={String(value.capable)} options={[["true", "必须具备"], ["false", "必须不具备"]]} onChange={(capable) => patch({ capable: capable === 'true' })} /><Input label="限定职业 ID（可留空）" value={csv(value.classIds)} onChange={(classIds) => patch({ classIds: csvIds(classIds).length ? csvIds(classIds) : undefined })} /></>}
      {value.kind === 'movement-distance' && <><NumberInput label="最少尺数" value={value.minimumFeet ?? 0} onChange={(minimumFeet) => patch({ minimumFeet })} /><NumberInput label="最多尺数（0=不限）" value={value.maximumFeet ?? 0} onChange={(maximumFeet) => patch({ maximumFeet: maximumFeet || undefined })} /></>}
      {value.kind === 'movement-property' && <><Select label="直线移动" value={value.straightLine == null ? 'any' : String(value.straightLine)} options={[["any", "不限"], ["true", "必须是"], ["false", "必须不是"]]} onChange={(straightLine) => patch({ straightLine: straightLine === 'any' ? undefined : straightLine === 'true' })} /><Select label="本回合已疾跑" value={value.dashedThisTurn == null ? 'any' : String(value.dashedThisTurn)} options={[["any", "不限"], ["true", "必须是"], ["false", "必须不是"]]} onChange={(dashedThisTurn) => patch({ dashedThisTurn: dashedThisTurn === 'any' ? undefined : dashedThisTurn === 'true' })} /></>}
      {value.kind === 'condition' && <><Select label="对象" value={value.subject} options={[['actor', '行动者'], ['target', '目标']]} onChange={(subject) => patch({ subject })} /><Select label="状态" value={value.condition} options={Object.entries(DND5E_STANDARD_CONDITIONS).map(([id, rule]) => [id, rule.label])} onChange={(condition) => patch({ condition })} /></>}
      {value.kind === 'hp-value' && <><Select label="对象" value={value.subject} options={[['actor', '行动者'], ['target', '目标']]} onChange={(subject) => patch({ subject })} /><Formula label="生命值阈值" id="hp-threshold" value={typeof value.value === 'number' ? { kind: 'constant', value: value.value } : value.value} onChange={(next) => patch({ value: next })} /></>}
    </div><button type="button" aria-label="删除 requirement" onClick={remove} className="mt-6 rounded-xl border border-rose-400/20 px-3 text-rose-200"><Trash2 className="h-4 w-4" /></button></div>
  </div>
}

const operationOptions: readonly (readonly [Dnd5eActivityOperationV1['kind'], string])[] = [
  ['damage', '伤害'], ['healing', '治疗'], ['temporary-hit-points', '临时生命'], ['stabilize', '稳定濒死目标'], ['stand-up', '反应起身'], ['apply-standard-condition', '施加状态'],
  ['apply-effect', '施加 Effect'], ['remove-standard-condition', '移除状态'], ['remove-effect', '移除 Effect'], ['resource', '资源增减'],
  ['move', '移动/传送'], ['summon', '召唤'], ['dispel-area', '驱散区域'], ['command-owned-companion', '命令伙伴'],
  ['grant-weapon-attack', '发放武器攻击资格'], ['grant-basic-action', '发放基础动作资格'], ['create-persistent-area', '持续区域'], ['invoke-activity', '调用 Activity'], ['mechanic', 'Host 机制处理器'], ['manual-adjudication', 'DM 裁定边界'],
]

function newOperation(kind: Dnd5eActivityOperationV1['kind'], id: string): Dnd5eActivityOperationV1 {
  const one: Dnd5eFormulaV1 = { kind: 'constant', value: 1 }
  if (kind === 'damage') return { id, kind, target: 'target', amount: one, damageType: 'force' }
  if (kind === 'healing' || kind === 'temporary-hit-points') return { id, kind, target: 'target', amount: one }
  if (kind === 'stabilize') return { id, kind, target: 'target' }
  if (kind === 'stand-up') return { id, kind, target: 'target', usesTargetReactionIfAvailable: true }
  if (kind === 'apply-standard-condition') return { id, kind, target: 'target', condition: 'prone', duration: { kind: 'rounds', rounds: 1, expiresAt: 'target-turn-end' } }
  if (kind === 'apply-effect') return { id, kind, target: 'target', effectId: 'effect-1' }
  if (kind === 'remove-standard-condition') return { id, kind, target: 'target', condition: 'prone' }
  if (kind === 'remove-effect') return { id, kind, target: 'target', effectId: 'effect-1', source: 'self' }
  if (kind === 'resource') return { id, kind, subject: 'actor', resourceId: 'resource', mode: 'spend', amount: one }
  if (kind === 'move') return { id, kind, target: 'target', mode: 'push', distanceFeet: { kind: 'constant', value: 5 } }
  if (kind === 'summon') return { id, kind, monsterId: 'srd-5.1:wolf', count: one, timing: 'immediate', durationRounds: 10, concentration: false, side: 'ally' }
  if (kind === 'dispel-area') return { id, kind, target: 'actor', areaKind: 'magical-darkness', radiusFeet: { kind: 'constant', value: 30 }, maximumSpellLevel: { kind: 'constant', value: 3 } }
  if (kind === 'command-owned-companion') return { id, kind, target: 'target', command: 'attack' }
  if (kind === 'grant-weapon-attack') return {
    id, kind, target: 'actor', grantId: 'follow-up-attack', label: '追加武器攻击',
    economy: 'bonus-action', expires: 'turn-end', weaponModes: ['melee'], proficient: true,
  }
  if (kind === 'grant-basic-action') return { id, kind, target: 'actor', grantId: 'bonus-basic-action', label: '附赠基础动作', economy: 'bonus-action', expires: 'turn-end', actions: ['shove'] }
  if (kind === 'create-persistent-area') return { id, kind, label: '持续区域', durationRounds: 10, concentration: true, color: '#8b5cf6' }
  if (kind === 'invoke-activity') return { id, kind, activityId: 'activity-id', target: 'actor', repeat: one }
  if (kind === 'mechanic') {
    const handlerId = listDnd5eMechanicOperationHandlersV1()[0]?.id ?? 'core.event-damage-reflection'
    return { id, kind, target: 'target', handlerId, parameters: defaultDnd5eMechanicOperationParametersV1(handlerId) }
  }
  return { id, kind, prompt: '请由 DM 裁定此效果。', reason: '尚未转换为白名单 operation。', requiresDmApproval: true }
}

function Operation({ value, onChange, remove }: { value: Dnd5eActivityOperationV1; onChange(value: Dnd5eActivityOperationV1): void; remove(): void }) {
  const patch = (next: object) => onChange({ ...value, ...next } as Dnd5eActivityOperationV1)
  const mechanicHandlers = listDnd5eMechanicOperationHandlersV1()
  return <div className="rounded-xl border border-cyan-400/15 bg-cyan-500/[0.035] p-3">
    <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]"><Input label="Operation ID" value={value.id} onChange={(id) => patch({ id })} /><Select label="类型" value={value.kind} options={operationOptions} onChange={(kind) => onChange(newOperation(kind as Dnd5eActivityOperationV1['kind'], value.id))} /><button type="button" aria-label="删除 operation" onClick={remove} className="mt-6 rounded-xl border border-rose-400/20 px-3 text-rose-200"><Trash2 className="h-4 w-4" /></button></div>
    {(value.kind === 'damage' || value.kind === 'healing' || value.kind === 'temporary-hit-points') && <div className="mt-2 grid gap-2 md:grid-cols-2"><Formula label="数值" id={`${value.id}.amount`} value={value.amount} onChange={(amount) => patch({ amount })} />{value.kind === 'damage' && <Select label="伤害类型" value={value.damageType} options={[...DND5E_DAMAGE_TYPES.map((type) => [type, type] as const), ['inherit-primary', '继承主伤害']]} onChange={(damageType) => patch({ damageType })} />}</div>}
    {(value.kind === 'apply-standard-condition' || value.kind === 'remove-standard-condition') && <div className="mt-2"><Select label="状态" value={value.condition} options={Object.entries(DND5E_STANDARD_CONDITIONS).map(([id, rule]) => [id, rule.label])} onChange={(condition) => patch({ condition })} /></div>}
    {(value.kind === 'apply-effect' || value.kind === 'remove-effect') && <div className="mt-2"><Input label="Effect ID" value={value.effectId} onChange={(effectId) => patch({ effectId })} /></div>}
    {value.kind === 'resource' && <div className="mt-2 grid gap-2 md:grid-cols-3"><Input label="资源 ID" value={value.resourceId} onChange={(resourceId) => patch({ resourceId })} /><Select label="方式" value={value.mode} options={[["spend", "消耗"], ["restore", "恢复"]]} onChange={(mode) => patch({ mode })} /><Formula label="数量" id={`${value.id}.amount`} value={value.amount} onChange={(amount) => patch({ amount })} /></div>}
    {value.kind === 'move' && <div className="mt-2 grid gap-2 md:grid-cols-2"><Select label="方式" value={value.mode} options={[["push", "推离"], ["pull", "拉近"], ["teleport", "传送"], ["swap", "交换"]]} onChange={(mode) => patch({ mode })} /><Formula label="距离" id={`${value.id}.distance`} value={value.distanceFeet} onChange={(distanceFeet) => patch({ distanceFeet })} /></div>}
    {value.kind === 'summon' && <div className="mt-2 grid gap-2 md:grid-cols-4"><Input label="怪物 ID" value={value.monsterId} onChange={(monsterId) => patch({ monsterId })} /><Formula label="数量" id={`${value.id}.count`} value={value.count} onChange={(count) => patch({ count })} /><NumberInput label="持续轮数" value={value.durationRounds} min={1} onChange={(durationRounds) => patch({ durationRounds })} /><Select label="出现时机" value={value.timing} options={[["immediate", "立即"], ["source-next-turn-start", "来源下回合开始"]]} onChange={(timing) => patch({ timing })} /></div>}
    {value.kind === 'grant-weapon-attack' && <div className="mt-2 grid gap-2 md:grid-cols-3"><Input label="资格 ID" value={value.grantId} onChange={(grantId) => patch({ grantId })} /><Input label="按钮名称" value={value.label} onChange={(label) => patch({ label })} /><Select label="武器模式" value={value.weaponModes?.[0] ?? 'any'} options={[["any", "近战或远程"], ["melee", "近战"], ["ranged", "远程"]]} onChange={(mode) => patch({ weaponModes: mode === 'any' ? undefined : [mode] })} /><Input label="限定武器 ID（可留空）" value={csv(value.weaponIds)} onChange={(weaponIds) => patch({ weaponIds: csvIds(weaponIds).length ? csvIds(weaponIds) : undefined })} /><Input label="允许槽位（main-hand/off-hand）" value={csv(value.weaponSlots)} onChange={(weaponSlots) => patch({ weaponSlots: csvIds(weaponSlots).length ? csvIds(weaponSlots) : undefined })} /><Input label="必须具备属性" value={csv(value.requiredWeaponProperties)} onChange={(requiredWeaponProperties) => patch({ requiredWeaponProperties: csvIds(requiredWeaponProperties).length ? csvIds(requiredWeaponProperties) : undefined })} /><Input label="禁止具备属性" value={csv(value.forbiddenWeaponProperties)} onChange={(forbiddenWeaponProperties) => patch({ forbiddenWeaponProperties: csvIds(forbiddenWeaponProperties).length ? csvIds(forbiddenWeaponProperties) : undefined })} /><NumberInput label="覆盖骰数（0=沿用）" value={value.damageDice?.count ?? 0} onChange={(count) => patch({ damageDice: count > 0 ? { count, sides: value.damageDice?.sides ?? 4 } : undefined })} /><NumberInput label="覆盖骰面" value={value.damageDice?.sides ?? 4} min={2} onChange={(sides) => patch({ damageDice: { count: value.damageDice?.count ?? 1, sides } })} /><NumberInput label="固定伤害加值" value={value.damageBonus ?? 0} min={-1000} onChange={(damageBonus) => patch({ damageBonus: damageBonus || undefined })} /><Select label="覆盖伤害类型" value={value.damageType ?? 'inherit'} options={[["inherit", "沿用武器"], ...DND5E_DAMAGE_TYPES.map((type) => [type, type] as const)]} onChange={(damageType) => patch({ damageType: damageType === 'inherit' ? undefined : damageType })} /></div>}
    {value.kind === 'grant-basic-action' && <div className="mt-2 grid gap-2 md:grid-cols-3"><Input label="资格 ID" value={value.grantId} onChange={(grantId) => patch({ grantId })} /><Input label="按钮名称" value={value.label} onChange={(label) => patch({ label })} /><Select label="允许动作" value={value.actions?.[0] ?? 'shove'} options={[["shove", "推撞"], ["grapple", "擒抱"]]} onChange={(action) => patch({ actions: [action] })} /><NumberInput label="推开额外距离（尺）" value={value.shovePushDistanceBonusFeet ?? 0} onChange={(shovePushDistanceBonusFeet) => patch({ shovePushDistanceBonusFeet: shovePushDistanceBonusFeet || undefined })} /></div>}
    {value.kind === 'create-persistent-area' && <div className="mt-2 space-y-2">
      <div className="grid gap-2 md:grid-cols-3"><Input label="区域名称" value={value.label} onChange={(label) => patch({ label })} /><NumberInput label="持续轮数" value={value.durationRounds} min={1} onChange={(durationRounds) => patch({ durationRounds })} /><Input label="颜色" value={value.color ?? '#8b5cf6'} onChange={(color) => patch({ color })} /></div>
      <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-300">
        <input
          type="checkbox"
          checked={value.lifecycle != null}
          onChange={(event) => patch({
            lifecycle: event.target.checked
              ? {
                  timing: 'source-turn-start',
                  translateAwayFromSourceFeet: 5,
                }
              : undefined,
          })}
        />
        来源回合开始时自动推进／衰减
      </label>
      {value.lifecycle && <div className="grid gap-2 rounded-lg border border-cyan-300/15 bg-cyan-500/[0.04] p-3 md:grid-cols-3">
        <NumberInput label="向远离来源方向移动（尺）" value={value.lifecycle.translateAwayFromSourceFeet ?? 0} min={0} onChange={(translateAwayFromSourceFeet) => patch({ lifecycle: { ...value.lifecycle!, translateAwayFromSourceFeet: translateAwayFromSourceFeet || undefined } })} />
        <NumberInput label="每次降低高度（尺）" value={value.lifecycle.heightReductionFeet ?? 0} min={0} onChange={(heightReductionFeet) => patch({ lifecycle: { ...value.lifecycle!, heightReductionFeet: heightReductionFeet || undefined } })} />
        <NumberInput label="每次伤害骰数量变化" value={value.lifecycle.damageDiceCountDelta ?? 0} min={-40} onChange={(damageDiceCountDelta) => patch({ lifecycle: { ...value.lifecycle!, damageDiceCountDelta: damageDiceCountDelta || undefined } })} />
        <Input label="受影响触发器 ID（逗号分隔）" value={value.lifecycle.damageTriggerIds?.join(', ') ?? ''} onChange={(raw) => patch({ lifecycle: { ...value.lifecycle!, damageTriggerIds: raw.split(',').map((id) => id.trim()).filter(Boolean) } })} />
        <NumberInput label="最低伤害骰数量" value={value.lifecycle.minimumDamageDiceCount ?? 0} min={0} onChange={(minimumDamageDiceCount) => patch({ lifecycle: { ...value.lifecycle!, minimumDamageDiceCount } })} />
        <p className="self-end pb-2 text-[11px] leading-5 text-slate-500">Host 会保存推进次数与回合键；刷新或指令重试不会重复推进。</p>
      </div>}
    </div>}
    {value.kind === 'invoke-activity' && <div className="mt-2"><Input label="Activity ID" value={value.activityId} onChange={(activityId) => patch({ activityId })} /></div>}
    {value.kind === 'mechanic' && (() => {
      const descriptor = mechanicHandlers.find((handler) => handler.id === value.handlerId)
      const parameters = value.parameters ?? {}
      const setParameter = (key: string, next: string | number | boolean) => patch({ parameters: { ...parameters, [key]: next } })
      return <div className="mt-2 rounded-xl border border-cyan-400/15 bg-cyan-500/[0.025] p-3">
        <div className="grid gap-2 md:grid-cols-2">
          <Select label="处理器" value={value.handlerId} options={mechanicHandlers.length
            ? mechanicHandlers.map((handler) => [handler.id, handler.label] as const)
            : [[value.handlerId, value.handlerId]]} onChange={(handlerId) => patch({ handlerId, parameters: defaultDnd5eMechanicOperationParametersV1(handlerId) })} />
          <Select label="效果目标" value={value.target} options={[["actor", "行动者"], ["target", "当前目标"], ["all-targets", "全部目标"]]} onChange={(target) => patch({ target })} />
        </div>
        {descriptor && <><p className="mt-2 text-[11px] leading-5 text-slate-500">{descriptor.description}</p><div className="mt-2 grid gap-2 md:grid-cols-2">
          {descriptor.parameters.map((field) => {
            const current = parameters[field.key] ?? field.defaultValue
            if (field.kind === 'number') return <NumberInput key={field.key} label={field.label} value={typeof current === 'number' ? current : 0} min={field.minimum ?? -1_000_000} onChange={(next) => setParameter(field.key, field.integer ? Math.floor(next) : next)} />
            if (field.kind === 'boolean') return <Select key={field.key} label={field.label} value={String(current ?? false)} options={[["true", "是"], ["false", "否"]]} onChange={(next) => setParameter(field.key, next === 'true')} />
            if (field.kind === 'select') return <Select key={field.key} label={field.label} value={typeof current === 'string' ? current : field.options[0]?.value ?? ''} options={field.options.map((option) => [option.value, option.label] as const)} onChange={(next) => setParameter(field.key, next)} />
            return <Input key={field.key} label={field.label} value={typeof current === 'string' ? current : ''} onChange={(next) => setParameter(field.key, next)} />
          })}
        </div></>}
        {!descriptor && <p className="mt-2 text-[11px] text-amber-300">当前 Host 未注册此处理器；导入后会显示为未支持。</p>}
      </div>
    })()}
    {value.kind === 'manual-adjudication' && <div className="mt-2 grid gap-2 md:grid-cols-2"><Input label="DM 提示" value={value.prompt} onChange={(prompt) => patch({ prompt })} /><Input label="原因" value={value.reason} onChange={(reason) => patch({ reason })} /></div>}
  </div>
}

const modifierOptions: readonly (readonly [Dnd5eEffectModifierV1['kind'], string])[] = [
  ['armor-class', 'AC'], ['speed', '速度'], ['attack-roll', '攻击检定'], ['attack-target-lock', '攻击目标限制'],
  ['ability-check', '属性检定'], ['weapon-damage-replacement', '替换武器基础伤害'],
  ['movement-boundary-save', '越界移动豁免'],
  ['weapon-enchantment', '武器附魔'], ['attack-profile', '攻击资料覆盖'], ['saving-throw', '豁免'],
  ['saving-throw-proficiency', '豁免熟练'], ['damage-resistance', '伤害抗性'], ['damage-immunity', '伤害免疫'],
  ['damage-vulnerability', '伤害易伤'], ['condition-immunity', '状态免疫'],
  ['maximum-attacks-per-turn', '攻击次数上限'], ['darkvision', '黑暗视觉'], ['flight-speed', '飞行速度'],
  ['spell-save-disadvantage-aura', '法术豁免劣势灵光'], ['spell-action-as-bonus-action', '动作法术改附赠动作'],
  ['see-invisible', '识破隐形'], ['prohibit-reaction', '禁止反应'], ['forced-flee-from-source', '强制远离来源'],
]

function newModifier(kind: Dnd5eEffectModifierV1['kind']): Dnd5eEffectModifierV1 {
  if (kind === 'armor-class') return { kind, mode: 'add', value: { kind: 'constant', value: 1 } }
  if (kind === 'speed') return { kind, mode: 'add', value: { kind: 'constant', value: 10 } }
  if (kind === 'attack-roll') return { kind, mode: 'advantage' }
  if (kind === 'attack-target-lock') return { kind, attacksAgainstOthersThanSource: 'disadvantage' }
  if (kind === 'ability-check') return { kind, mode: 'advantage' }
  if (kind === 'weapon-damage-roll') return { kind, mode: 'add', value: { kind: 'constant', value: 1 }, appliesTo: 'all-weapon-attacks' }
  if (kind === 'weapon-damage-replacement') return { kind, attackModes: ['ranged'] }
  if (kind === 'movement-boundary-save') return { kind, maximumDistanceFeet: 30, ability: 'wis', dc: { kind: 'reference', reference: { kind: 'actor-spell-save-dc' } } }
  if (kind === 'weapon-enchantment') return { kind, weaponSlot: 'main-hand', attackAndDamageBonus: { kind: 'constant', value: 1 } }
  if (kind === 'attack-profile') return { kind, attackModes: ['melee'] }
  if (kind === 'saving-throw') return { kind, mode: 'advantage' }
  if (kind === 'saving-throw-proficiency') return { kind, ability: 'con' }
  if (kind === 'damage-resistance') return { kind, damageType: 'fire' }
  if (kind === 'damage-immunity') return { kind, damageType: 'fire' }
  if (kind === 'damage-vulnerability') return { kind, damageType: 'fire' }
  if (kind === 'condition-immunity') return { kind, condition: 'charmed' }
  if (kind === 'damage-reduction') return { kind, amount: { kind: 'constant', value: 1 } }
  if (kind === 'on-hit-bonus-damage') return { kind, amount: { kind: 'dice', rollId: 'on-hit-bonus-damage', count: 1, sides: 6 }, damageType: 'inherit-primary', appliesTo: 'all-weapon-attacks' }
  if (kind === 'attack-roll-reroll') return { kind, maximumDice: 1, appliesTo: 'all-weapon-attacks' }
  if (kind === 'death-prevention') return { kind, hitPointsAfter: 1 }
  if (kind === 'maximum-attacks-per-turn') return { kind, value: 1 }
  if (kind === 'darkvision') return { kind, rangeFeet: 60 }
  if (kind === 'flight-speed') return { kind, speedFeet: 30 }
  if (kind === 'spell-save-disadvantage-aura') return { kind, radiusFeet: 10 }
  if (kind === 'spell-action-as-bonus-action') return { kind, spellcastingClassIds: ['sorcerer'] }
  if (kind === 'see-invisible') return { kind }
  if (kind === 'forced-flee-from-source') return { kind }
  return { kind: 'prohibit-reaction' }
}

function Modifier({ value, onChange, remove }: { value: Dnd5eEffectModifierV1; onChange(value: Dnd5eEffectModifierV1): void; remove(): void }) {
  const patch = (next: object) => onChange({ ...value, ...next } as Dnd5eEffectModifierV1)
  const damageType = 'damageType' in value ? value.damageType : 'fire'
  return <div className="grid gap-2 rounded-xl border border-white/8 p-2 md:grid-cols-[1fr_3fr_auto]">
    <Select label="Modifier" value={value.kind} options={modifierOptions} onChange={(kind) => onChange(newModifier(kind as Dnd5eEffectModifierV1['kind']))} />
    <div className="grid gap-2 md:grid-cols-2">
      {value.kind === 'armor-class' && <><Select label="方式" value={value.mode} options={[["add", "增加"], ["minimum", "最低值"], ["maximum", "最高值"], ["override", "覆盖"]]} onChange={(mode) => patch({ mode })} /><Formula label="数值" id="modifier-ac" value={value.value} onChange={(next) => patch({ value: next })} /></>}
      {value.kind === 'speed' && <><Select label="方式" value={value.mode} options={[["add", "增加"], ["multiply", "倍乘"], ["minimum", "最低值"], ["maximum", "最高值"], ["override", "覆盖"]]} onChange={(mode) => patch({ mode })} /><Formula label="数值" id="modifier-speed" value={value.value} onChange={(next) => patch({ value: next })} /></>}
      {value.kind === 'attack-roll' && <><Select label="方式" value={value.mode} options={[["add", "加值"], ["advantage", "优势"], ["disadvantage", "劣势"]]} onChange={(mode) => patch({ mode, value: mode === 'add' ? value.value ?? { kind: 'constant', value: 1 } : undefined })} />{value.mode === 'add' && <Formula label="加值" id="modifier-attack-roll" value={value.value ?? { kind: 'constant', value: 1 }} onChange={(next) => patch({ value: next })} />}</>}
      {value.kind === 'attack-target-lock' && <p className="self-end pb-2 text-xs text-slate-400">攻击 Effect 来源以外的目标时获得劣势。</p>}
      {value.kind === 'ability-check' && <><Select label="方式" value={value.mode} options={[["advantage", "优势"], ["disadvantage", "劣势"]]} onChange={(mode) => patch({ mode })} /><Select label="属性（可不限）" value={value.ability ?? 'any'} options={[["any", "所有属性"], ...abilities]} onChange={(ability) => patch({ ability: ability === 'any' ? undefined : ability })} /></>}
      {value.kind === 'weapon-damage-roll' && <><Formula label="附加伤害" id="modifier-weapon-damage" value={value.value} onChange={(next) => patch({ value: next })} /><Select label="适用" value={value.appliesTo ?? 'all-weapon-attacks'} options={[["all-weapon-attacks", "所有武器攻击"], ["this-weapon", "绑定武器"]]} onChange={(appliesTo) => patch({ appliesTo })} /></>}
      {value.kind === 'weapon-damage-replacement' && <Select label="攻击方式" value={value.attackModes[0] ?? 'ranged'} options={[["melee", "近战"], ["ranged", "远程"]]} onChange={(mode) => patch({ attackModes: [mode] })} />}
      {value.kind === 'movement-boundary-save' && <><NumberInput label="来源边界（尺）" value={value.maximumDistanceFeet} onChange={(maximumDistanceFeet) => patch({ maximumDistanceFeet })} /><Select label="豁免属性" value={value.ability} options={abilities} onChange={(ability) => patch({ ability })} /><Formula label="豁免 DC" id="modifier-boundary-save" value={value.dc} onChange={(dc) => patch({ dc })} /></>}
      {value.kind === 'weapon-enchantment' && <><Select label="武器槽位" value={value.weaponSlot} options={[["main-hand", "主手"], ["off-hand", "副手"]]} onChange={(weaponSlot) => patch({ weaponSlot })} /><Formula label="攻击与伤害加值" id="modifier-enchantment" value={value.attackAndDamageBonus} onChange={(next) => patch({ attackAndDamageBonus: next })} /></>}
      {value.kind === 'attack-profile' && <><Select label="攻击方式" value={value.attackModes[0] ?? 'melee'} options={[["melee", "近战"], ["ranged", "远程"], ["unarmed", "徒手"]]} onChange={(mode) => patch({ attackModes: [mode] })} /><NumberInput label="触及加值（尺）" value={value.reachBonusFeet ?? 0} onChange={(reachBonusFeet) => patch({ reachBonusFeet: reachBonusFeet || undefined })} /></>}
      {value.kind === 'saving-throw' && <><Select label="方式" value={value.mode} options={[["add", "加值"], ["advantage", "优势"], ["disadvantage", "劣势"]]} onChange={(mode) => patch({ mode, value: mode === 'add' ? value.value ?? { kind: 'constant', value: 1 } : undefined })} /><Select label="属性（可不限）" value={value.ability ?? 'any'} options={[["any", "所有豁免"], ...abilities]} onChange={(ability) => patch({ ability: ability === 'any' ? undefined : ability })} />{value.mode === 'add' && <Formula label="加值" id="modifier-save" value={value.value ?? { kind: 'constant', value: 1 }} onChange={(next) => patch({ value: next })} />}</>}
      {value.kind === 'saving-throw-proficiency' && <Select label="属性" value={value.ability} options={abilities} onChange={(ability) => patch({ ability })} />}
      {(value.kind === 'damage-resistance' || value.kind === 'damage-immunity' || value.kind === 'damage-vulnerability') && <Select label="伤害类型" value={damageType} options={DND5E_DAMAGE_TYPES.map((type) => [type, type] as const)} onChange={(next) => patch({ damageType: next })} />}
      {value.kind === 'condition-immunity' && <Select label="状态" value={value.condition} options={Object.entries(DND5E_STANDARD_CONDITIONS).map(([id, rule]) => [id, rule.label])} onChange={(condition) => patch({ condition })} />}
      {value.kind === 'damage-reduction' && <><Formula label="减免值" id="modifier-damage-reduction" value={value.amount} onChange={(amount) => patch({ amount })} /><Input label="限定伤害类型（可留空）" value={csv(value.damageTypes)} onChange={(damageTypes) => patch({ damageTypes: csvIds(damageTypes).length ? csvIds(damageTypes) : undefined })} /></>}
      {value.kind === 'on-hit-bonus-damage' && <><Formula label="伤害" id="modifier-on-hit" value={value.amount} onChange={(amount) => patch({ amount })} /><Select label="伤害类型" value={value.damageType} options={[["inherit-primary", "继承主伤害"], ...DND5E_DAMAGE_TYPES.map((type) => [type, type] as const)]} onChange={(next) => patch({ damageType: next })} /></>}
      {value.kind === 'attack-roll-reroll' && <Select label="适用" value={value.appliesTo} options={[["all-weapon-attacks", "所有武器攻击"], ["this-weapon", "绑定武器"]]} onChange={(appliesTo) => patch({ appliesTo })} />}
      {value.kind === 'death-prevention' && <><NumberInput label="保留生命值" value={value.hitPointsAfter} onChange={(hitPointsAfter) => patch({ hitPointsAfter })} /><Select label="阻止巨量伤害" value={String(value.preventsMassiveDamage === true)} options={[["false", "否"], ["true", "是"]]} onChange={(next) => patch({ preventsMassiveDamage: next === 'true' })} /></>}
      {value.kind === 'maximum-attacks-per-turn' && <NumberInput label="每回合最多攻击" value={value.value} min={1} onChange={(next) => patch({ value: next })} />}
      {value.kind === 'darkvision' && <NumberInput label="距离（尺）" value={value.rangeFeet} min={1} onChange={(rangeFeet) => patch({ rangeFeet })} />}
      {value.kind === 'flight-speed' && <NumberInput label="飞行速度（尺）" value={value.speedFeet} min={1} onChange={(speedFeet) => patch({ speedFeet })} />}
      {value.kind === 'spell-save-disadvantage-aura' && <><NumberInput label="半径（尺）" value={value.radiusFeet} min={1} onChange={(radiusFeet) => patch({ radiusFeet })} /><Input label="限定伤害类型（可留空）" value={csv(value.damageTypes)} onChange={(damageTypes) => patch({ damageTypes: csvIds(damageTypes).length ? csvIds(damageTypes) : undefined })} /></>}
      {value.kind === 'spell-action-as-bonus-action' && <Input label="施法职业 ID（逗号分隔）" value={csv(value.spellcastingClassIds)} onChange={(spellcastingClassIds) => patch({ spellcastingClassIds: csvIds(spellcastingClassIds) })} />}
      {(value.kind === 'see-invisible' || value.kind === 'prohibit-reaction' || value.kind === 'forced-flee-from-source') && <p className="self-end pb-2 text-xs text-slate-400">此 Modifier 无需额外参数。</p>}
    </div>
    <button type="button" aria-label="删除 modifier" onClick={remove} className="mt-6 rounded-xl border border-rose-400/20 px-3 text-rose-200"><Trash2 className="h-4 w-4" /></button>
  </div>
}

function Effect({ value, onChange, remove }: { value: Dnd5eEffectDefinitionV1; onChange(value: Dnd5eEffectDefinitionV1): void; remove(): void }) {
  const patch = (next: Partial<Dnd5eEffectDefinitionV1>) => onChange({ ...value, ...next })
  const setMaintenanceEffect = (raw: string) => {
    const sourceRequiresEffectAtSourceTurnEnd = raw.trim() || undefined
    const sourceLink = { ...(value.sourceLink ?? {}), sourceRequiresEffectAtSourceTurnEnd }
    patch({
      sourceLink: Object.values(sourceLink).some((entry) => entry != null)
        ? sourceLink
        : undefined,
    })
  }
  return <div className="rounded-xl border border-violet-400/15 bg-violet-500/[0.035] p-3"><div className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]"><Input label="Effect ID" value={value.id} onChange={(id) => patch({ id })} /><Input label="名称" value={value.name} onChange={(name) => patch({ name })} /><Select label="持续" value={value.duration.kind} options={[["instantaneous", "立即"], ["rounds", "轮数"], ["save-ends", "重复豁免结束"], ["concentration", "专注"], ["permanent", "永久"]]} onChange={(kind) => patch({ duration: kind === 'rounds' ? { kind, rounds: 1, expiresAt: 'target-turn-end' } : kind === 'save-ends' ? { kind, maximumRounds: 10, timing: 'target-turn-end', ability: 'wis', dc: { kind: 'reference', reference: { kind: 'actor-spell-save-dc' } } } : kind === 'concentration' ? { kind, maximumRounds: 10 } : { kind } as Dnd5eEffectDefinitionV1['duration'] })} /><button type="button" aria-label="删除 effect" onClick={remove} className="mt-6 rounded-xl border border-rose-400/20 px-3 text-rose-200"><Trash2 className="h-4 w-4" /></button></div>
    {(value.duration.kind === 'rounds' || value.duration.kind === 'concentration' || value.duration.kind === 'save-ends') && <div className="mt-2 grid gap-2 rounded-lg border border-white/8 p-2 md:grid-cols-3">
      {value.duration.kind === 'rounds' && <><NumberInput label="轮数" value={value.duration.rounds} min={1} onChange={(rounds) => patch({ duration: { ...value.duration, rounds } as Dnd5eEffectDefinitionV1['duration'] })} /><Select label="到期边界" value={value.duration.expiresAt} options={[["source-turn-start", "来源回合开始"], ["source-turn-end", "来源回合结束"], ["target-turn-start", "目标回合开始"], ["target-turn-end", "目标回合结束"]]} onChange={(expiresAt) => patch({ duration: { ...value.duration, expiresAt } as Dnd5eEffectDefinitionV1['duration'] })} /></>}
      {value.duration.kind === 'concentration' && <NumberInput label="最长轮数" value={value.duration.maximumRounds} min={1} onChange={(maximumRounds) => patch({ duration: { ...value.duration, maximumRounds } as Dnd5eEffectDefinitionV1['duration'] })} />}
      {value.duration.kind === 'save-ends' && <><NumberInput label="最长轮数" value={value.duration.maximumRounds} min={1} onChange={(maximumRounds) => patch({ duration: { ...value.duration, maximumRounds } as Dnd5eEffectDefinitionV1['duration'] })} /><Select label="重复豁免时机" value={value.duration.timing} options={[["target-turn-start", "目标回合开始"], ["target-turn-end", "目标回合结束"]]} onChange={(timing) => patch({ duration: { ...value.duration, timing } as Dnd5eEffectDefinitionV1['duration'] })} /><Select label="豁免属性" value={value.duration.ability} options={abilities} onChange={(ability) => patch({ duration: { ...value.duration, ability } as Dnd5eEffectDefinitionV1['duration'] })} /><Formula label="豁免 DC" id={`${value.id}.repeat-save-dc`} value={value.duration.dc} onChange={(dc) => patch({ duration: { ...value.duration, dc } as Dnd5eEffectDefinitionV1['duration'] })} /></>}
    </div>}
    <div className="mt-2 grid gap-2 md:grid-cols-2"><Input label="标准状态 ID（逗号分隔）" value={csv(value.conditions)} onChange={(raw) => patch({ conditions: csvIds(raw) as Dnd5eEffectDefinitionV1['conditions'] })} /><Input label="扩展状态（可留空）" value={value.extensionCondition ?? ''} onChange={(extensionCondition) => patch({ extensionCondition: extensionCondition.trim() || undefined })} /><Input label="来源回合结束前必须刷新 Effect ID（可留空）" value={value.sourceLink?.sourceRequiresEffectAtSourceTurnEnd ?? ''} onChange={setMaintenanceEffect} /><label className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-300"><input type="checkbox" checked={value.concentration === true} onChange={(event) => patch({ concentration: event.target.checked || undefined })} />此 Effect 受来源专注约束（可与重复豁免并存）</label></div>
    <div className="mt-2 space-y-2">{(value.modifiers ?? []).map((modifier, index) => <Modifier key={`${modifier.kind}:${index}`} value={modifier} onChange={(next) => patch({ modifiers: value.modifiers?.map((entry, itemIndex) => itemIndex === index ? next : entry) })} remove={() => patch({ modifiers: value.modifiers?.filter((_, itemIndex) => itemIndex !== index) })} />)}<button type="button" onClick={() => patch({ modifiers: [...(value.modifiers ?? []), newModifier('armor-class')] })} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-300"><Plus className="mr-1 inline h-3.5 w-3.5" />添加 Modifier</button></div>
  </div>
}

function ActivityCard({ value, tracked, onChange, remove }: { value: Dnd5eActivityDefinitionV1; tracked: readonly Dnd5eTrackableDefinitionV1[]; onChange(value: Dnd5eActivityDefinitionV1): void; remove(): void }) {
  const emit = (next: Dnd5eActivityDefinitionV1) => onChange(dnd5eActivityWithDerivedAutomationV1(next))
  const patch = (next: Partial<Dnd5eActivityDefinitionV1>) => emit({ ...value, ...next })
  const analysis = dnd5eActivityAutomationAnalysisV1(value)
  const errors = validateDnd5eActivityDefinitionV1(dnd5eActivityWithDerivedAutomationV1(value))
  const trackedId = value.requirements?.find((entry) => entry.kind === 'activity-definition')?.definitionId ?? ''
  const editableRequirements = (value.requirements ?? []).filter((entry) => entry.kind !== 'activity-definition')
  const replaceEditableRequirements = (requirements: readonly Dnd5ePredicateV1[]) => patch({
    requirements: [
      ...(trackedId ? [{ kind: 'activity-definition' as const, definitionId: trackedId }] : []),
      ...requirements,
    ],
  })
  const outcome = value.outcomes[0] ?? { id: 'resolve', when: { kind: 'always' as const }, operations: [] }
  const operations = (next: readonly Dnd5eActivityOperationV1[]) => patch({ outcomes: [{ ...outcome, operations: next }, ...value.outcomes.slice(1)] })
  const setTriggerEvent = (event: string) => {
    if (value.invocation?.kind === 'triggered') patch({ invocation: { ...value.invocation, event: event as Dnd5eTriggerEventV1 } })
  }
  const setTargetKind = (kind: string) => patch({
    target: (kind === 'self'
      ? { kind: 'self' }
      : kind === 'creature'
        ? { kind: 'creature', relation: 'enemy', count: 1, rangeFeet: 5 }
        : { kind: 'area', relation: 'enemy', origin: 'point', shape: 'circle', radiusFeet: 10, placeRangeFeet: 60, maximumTargets: 32 }) as Dnd5eActivityDefinitionV1['target'],
  })
  const addCheck = () => {
    const id = `check-${(value.checks?.length ?? 0) + 1}`
    const check: Dnd5eActivityCheckV1 = {
      id, kind: 'saving-throw', rollId: id, ability: 'dex',
      dc: { kind: 'reference', reference: { kind: 'actor-spell-save-dc' } }, scope: 'per-target',
    }
    patch({ checks: [...(value.checks ?? []), check] })
  }
  const checkWithKind = (entry: Dnd5eActivityCheckV1, kind: string): Dnd5eActivityCheckV1 => kind === 'attack-roll'
    ? { id: entry.id, rollId: entry.rollId, kind, attackBonus: { kind: 'reference', reference: { kind: 'actor-spell-attack-bonus' } }, rollMode: 'host-derived', scope: 'per-target' }
    : { id: entry.id, rollId: entry.rollId, kind: kind as 'saving-throw' | 'ability-check' | 'skill-check' | 'concentration-check', ability: 'dex', dc: { kind: 'reference', reference: { kind: 'actor-spell-save-dc' } }, scope: 'per-target' }
  return <details open className="group rounded-2xl border border-white/8 bg-black/15"><summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 [&::-webkit-details-marker]:hidden"><span><strong className="block text-sm text-slate-100">{value.name}</strong><span className="text-[11px] text-slate-500">{value.id} · {analysis.capability.level} · {analysis.handlerIds.length} handlers</span></span><ChevronDown className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-180" /></summary>
    <div className="space-y-4 border-t border-white/8 p-4"><div className="grid gap-2 md:grid-cols-2"><Input label="Activity ID" value={value.id} onChange={(id) => patch({ id })} /><Input label="名称" value={value.name} onChange={(name) => patch({ name })} /></div>
      <div className="grid gap-2 md:grid-cols-3"><Select label="行动经济" value={value.activation.kind} options={[["action", "动作"], ["bonus-action", "附赠动作"], ["reaction", "反应"], ["free", "自由"], ["movement", "移动"], ["passive", "被动"], ["special", "特殊"]]} onChange={(kind) => patch({ activation: { kind } as Dnd5eActivityDefinitionV1['activation'] })} /><Select label="调用方式" value={value.invocation?.kind ?? 'active'} options={[["active", "主动"], ["triggered", "触发"]]} onChange={(kind) => patch({ invocation: kind === 'triggered' ? { kind: 'triggered', event: 'attack-hit', confirmation: 'actor-choice', retention: 'single-event' } : { kind: 'active', confirmation: 'actor-choice' } })} />{value.invocation?.kind === 'triggered' && <Select label="触发窗口" value={value.invocation.event} options={DND5E_ACTIVITY_LIFECYCLE_EVENTS_V1.map(({ event, stage, timing }) => [event, `${event} · ${stage}/${timing}`])} onChange={setTriggerEvent} />}</div>
      {value.invocation?.kind === 'triggered' && <Select label="限定触发来源（可留空）" value={trackedId} options={[["", "任意匹配来源"], ...tracked.map((entry) => [entry.definitionId, `${entry.kind} · ${entry.name}`] as const)]} onChange={(definitionId) => patch({ requirements: [...(value.requirements ?? []).filter((entry) => entry.kind !== 'activity-definition'), ...(definitionId ? [{ kind: 'activity-definition' as const, definitionId }] : [])] })} />}
      <section><div className="mb-2 flex items-start justify-between gap-3"><div><h4 className="text-xs font-semibold text-amber-100">触发与资格检查</h4><p className="mt-1 text-[11px] text-slate-500">全部由 Host 快照验证；可留空。多项检查采用“全部满足”。</p></div><button type="button" onClick={() => replaceEditableRequirements([...editableRequirements, newPredicate('event-source')])} className="text-xs text-amber-200"><Plus className="mr-1 inline h-3.5 w-3.5" />添加检查</button></div><div className="space-y-2">{editableRequirements.map((requirement, index) => <Predicate key={`${requirement.kind}:${index}`} value={requirement} onChange={(next) => replaceEditableRequirements(editableRequirements.map((entry, itemIndex) => itemIndex === index ? next : entry))} remove={() => replaceEditableRequirements(editableRequirements.filter((_, itemIndex) => itemIndex !== index))} />)}</div></section>
      <div className="grid gap-2 rounded-xl border border-white/8 p-3 md:grid-cols-4"><Select label="目标" value={value.target.kind} options={[["self", "自身"], ["creature", "生物"], ["area", "范围"]]} onChange={setTargetKind} />{value.target.kind !== 'self' && <Select label="关系" value={value.target.relation} options={[["ally", "友方"], ["enemy", "敌方"], ["any", "任意"]]} onChange={(relation) => value.target.kind !== 'self' && patch({ target: { ...value.target, relation } as Dnd5eActivityDefinitionV1['target'] })} />}{value.target.kind === 'creature' && <><NumberInput label="射程" value={value.target.rangeFeet ?? 0} onChange={(rangeFeet) => value.target.kind === 'creature' && patch({ target: { ...value.target, rangeFeet } })} /><NumberInput label="目标数" value={value.target.count} min={1} onChange={(count) => value.target.kind === 'creature' && patch({ target: { ...value.target, count } })} /></>}{value.target.kind === 'area' && <Select label="形状" value={value.target.shape} options={[["circle", "圆形"], ["sphere", "球形"], ["cone", "锥形"], ["line", "线形"], ["cube", "立方体"], ["cylinder", "圆柱"], ["rect", "长方形"]]} onChange={(shape) => value.target.kind === 'area' && patch({ target: { ...value.target, shape } as Dnd5eActivityDefinitionV1['target'] })} />}</div>
      <section><div className="mb-2 flex justify-between"><h4 className="text-xs font-semibold text-cyan-100">检定</h4><button type="button" onClick={addCheck} className="text-xs text-cyan-200"><Plus className="mr-1 inline h-3.5 w-3.5" />添加</button></div>{(value.checks ?? []).map((check, index) => <div key={`${check.id}:${index}`} className="mb-2 grid gap-2 rounded-xl border border-white/8 p-2 md:grid-cols-[1fr_1fr_1fr_auto]"><Input label="Check ID" value={check.id} onChange={(id) => patch({ checks: value.checks?.map((entry, itemIndex) => itemIndex === index ? { ...entry, id, rollId: id } as Dnd5eActivityCheckV1 : entry) })} /><Select label="类型" value={check.kind} options={[["attack-roll", "攻击"], ["saving-throw", "豁免"], ["ability-check", "属性检定"], ["skill-check", "技能"], ["concentration-check", "专注"]]} onChange={(kind) => patch({ checks: value.checks?.map((entry, itemIndex) => itemIndex === index ? checkWithKind(entry, kind) : entry) })} />{'ability' in check ? <Select label="属性" value={check.ability} options={abilities} onChange={(ability) => patch({ checks: value.checks?.map((entry, itemIndex) => itemIndex === index ? { ...entry, ability } as Dnd5eActivityCheckV1 : entry) })} /> : <span />}<button type="button" aria-label="删除 check" onClick={() => patch({ checks: value.checks?.filter((_, itemIndex) => itemIndex !== index) })} className="mt-6 rounded-xl border border-rose-400/20 px-3 text-rose-200"><Trash2 className="h-4 w-4" /></button></div>)}</section>
      <section><div className="mb-2 flex justify-between"><h4 className="text-xs font-semibold text-cyan-100">Operations</h4><button type="button" onClick={() => operations([...outcome.operations, newOperation('damage', `operation-${outcome.operations.length + 1}`)])} className="text-xs text-cyan-200"><Plus className="mr-1 inline h-3.5 w-3.5" />添加</button></div><div className="space-y-2">{outcome.operations.map((operation, index) => <Operation key={`${operation.id}:${index}`} value={operation} onChange={(next) => operations(outcome.operations.map((entry, itemIndex) => itemIndex === index ? next : entry))} remove={() => operations(outcome.operations.filter((_, itemIndex) => itemIndex !== index))} />)}</div></section>
      <section><div className="mb-2 flex justify-between"><h4 className="text-xs font-semibold text-violet-100">Effects</h4><button type="button" onClick={() => patch({ effects: [...(value.effects ?? []), { schemaVersion: 1, id: `effect-${(value.effects?.length ?? 0) + 1}`, name: '新 Effect', duration: { kind: 'rounds', rounds: 1, expiresAt: 'target-turn-end' }, modifiers: [], stacking: 'unique-by-source' }] })} className="text-xs text-violet-200"><Plus className="mr-1 inline h-3.5 w-3.5" />添加</button></div><div className="space-y-2">{(value.effects ?? []).map((effect, index) => <Effect key={`${effect.id}:${index}`} value={effect} onChange={(next) => patch({ effects: value.effects?.map((entry, itemIndex) => itemIndex === index ? next : entry) })} remove={() => patch({ effects: value.effects?.filter((_, itemIndex) => itemIndex !== index) })} />)}</div></section>
      <div className={`rounded-xl border px-3 py-2 text-xs ${analysis.capability.level === 'full' ? 'border-emerald-400/20 bg-emerald-500/5 text-emerald-100' : 'border-amber-400/20 bg-amber-500/5 text-amber-100'}`}>实际覆盖率：{analysis.capability.level} · {analysis.handledComponents.length}/{analysis.requiredComponents.length} 组件已有 handler{analysis.missingComponents.length > 0 && <span className="mt-1 block">缺失：{analysis.missingComponents.join('、')}</span>}</div>
      {errors.length > 0 && <div className="rounded-xl border border-rose-400/20 bg-rose-500/5 p-3 text-xs text-rose-200">{errors.join('；')}</div>}<button type="button" onClick={remove} className="inline-flex items-center gap-1 rounded-xl border border-rose-400/20 px-3 py-2 text-xs text-rose-200"><Trash2 className="h-3.5 w-3.5" />删除 Activity</button>
    </div></details>
}

export default function Dnd5eActivityTemplateEditor({ value, onChange }: { value: readonly Dnd5eActivityDefinitionV1[]; onChange(value: Dnd5eActivityDefinitionV1[]): void }) {
  const [presetId, setPresetId] = useState<Dnd5eActivityAuthoringPresetId>('active')
  const preset = DND5E_ACTIVITY_AUTHORING_PRESETS.find((entry) => entry.id === presetId) ?? DND5E_ACTIVITY_AUTHORING_PRESETS[0]!
  const tracked = useMemo(() => listDnd5eTrackableDefinitionsV1(), [value])
  return <section><div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h3 className="text-sm font-semibold text-slate-200">统一 Activity / Effect 编辑器</h3><p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">类型表单只保存 payload；行动经济、触发、目标、检定、operation 与 effect 在这里统一声明。</p></div><div className="flex gap-2"><select value={presetId} onChange={(event) => setPresetId(event.target.value as Dnd5eActivityAuthoringPresetId)} className={control}>{DND5E_ACTIVITY_AUTHORING_PRESETS.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select><button type="button" onClick={() => onChange([...value, ...dnd5eActivitiesFromAuthoringPresetV1(preset, value).map(dnd5eActivityWithDerivedAutomationV1)])} className="inline-flex items-center gap-1 rounded-xl bg-arcane-500/15 px-3 py-2 text-xs font-semibold text-arcane-100"><Plus className="h-3.5 w-3.5" />添加模板</button></div></div><div className="space-y-3">{value.length === 0 && <p className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-xs text-slate-600">尚未声明原生 Activity；旧字段只在加载边界通过 Legacy adapter 转换。</p>}{value.map((activity, index) => <ActivityCard key={`${activity.id}:${index}`} value={activity} tracked={tracked} onChange={(next) => onChange(value.map((entry, itemIndex) => itemIndex === index ? next : entry))} remove={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))} />)}</div></section>
}
