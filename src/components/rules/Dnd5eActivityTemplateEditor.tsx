import { useMemo, useState } from 'react'
import { ChevronDown, Plus, Trash2 } from 'lucide-react'
import {
  DND5E_DAMAGE_TYPES,
  DND5E_STANDARD_CONDITIONS,
  DND5E_ACTIVITY_LIFECYCLE_EVENTS_V1,
  DND5E_CHARACTER_CAPABILITY_IDS_V1,
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
const numericCharacterCapabilities = new Set<string>([
  'initiativeBonus', 'hitPointsPerLevelBonus', 'passivePerceptionBonus', 'passiveInvestigationBonus',
  'minimumHitDieHealingConstitutionMultiplier', 'mediumArmorDexterityCapBonus',
  'dualWieldMeleeArmorClassBonus', 'climbWithoutSpeedCostMultiplier', 'runningJumpMinimumApproachFeet',
  'standFromProneMovementCostFeet', 'spellAttackRangeMultiplier', 'spellSavingThrowAdvantageWithinFeet',
  'combatManeuverDieSidesOverride',
])
const listCharacterCapabilities = new Set<string>(['opportunityAttacksOnEnterReachWeaponIds'])

function defaultCharacterCapabilityValue(capability: string): boolean | number | readonly string[] {
  if (numericCharacterCapabilities.has(capability)) return 1
  if (listCharacterCapabilities.has(capability)) return ['dnd5e-spear']
  return true
}

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
    {value.kind === 'reference' && <div className="mt-2 grid gap-2"><Select label="引用" value={value.reference.kind} options={[["actor-level", "角色等级"], ["actor-proficiency-bonus", "熟练加值"], ["actor-spell-save-dc", "法术豁免 DC"], ["actor-active-effect-source-spell-save-dc", "当前 Effect 来源法术豁免 DC"], ["actor-spell-attack-bonus", "法术攻击加值"], ["actor-spellcasting-ability-modifier", "施法属性调整值"], ["cast-level", "施法环阶"]]} onChange={(referenceKind) => onChange({ kind: 'reference', reference: referenceKind === 'actor-active-effect-source-spell-save-dc' ? { kind: referenceKind, effectId: 'effect-id' } : { kind: referenceKind } as Extract<Dnd5eFormulaV1, { kind: 'reference' }>['reference'] })} />{value.reference.kind === 'actor-active-effect-source-spell-save-dc' && <Input label="Effect ID" value={value.reference.effectId} onChange={(effectId) => onChange({ kind: 'reference', reference: { kind: 'actor-active-effect-source-spell-save-dc', effectId } })} />}</div>}
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
  ['movement-distance', '移动距离'], ['movement-property', '移动属性'], ['airborne-state', '空中/坠落状态'], ['owned-companion', '目标是自己的召唤伙伴'], ['condition', '状态'], ['hp-value', '当前生命值'],
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
  if (kind === 'airborne-state') return { kind, subject: 'target', state: 'unsupported-airborne' }
  if (kind === 'owned-companion') return { kind, subject: 'target' }
  if (kind === 'condition') return { kind, subject: 'actor', condition: 'prone', present: true }
  return { kind: 'hp-value', subject: 'actor', comparison: 'at-most', value: 10 }
}

function csv(value: readonly string[] | undefined): string { return value?.join(', ') ?? '' }
function csvIds(value: string): string[] { return [...new Set(value.split(',').map((entry) => entry.trim()).filter(Boolean))] }

type PersistentAreaBlockingEditorValue = NonNullable<Extract<
  Dnd5eActivityOperationV1,
  { kind: 'create-persistent-area' }
>['blocking']>

function compactPersistentAreaBlocking(
  value: PersistentAreaBlockingEditorValue,
): PersistentAreaBlockingEditorValue | undefined {
  return value.movement === true || value.blocksTeleportationEntry === true ||
    value.blocksTeleportationExit === true || value.vision === true || value.lineOfEffect === true
    ? value
    : undefined
}

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
      {value.kind === 'airborne-state' && <><Select label="对象" value={value.subject} options={[["actor", "行动者"], ["target", "目标"]]} onChange={(subject) => patch({ subject })} /><Select label="空中状态" value={value.state} options={[["unsupported-airborne", "正在坠落/无支撑"], ["airborne", "位于空中"], ["grounded", "位于地面"]]} onChange={(state) => patch({ state })} /></>}
      {value.kind === 'owned-companion' && <p className="self-end pb-2 text-[11px] leading-5 text-slate-500">Host 校验目标是当前行动者的持久召唤物，客户端不能伪造所有权。</p>}
      {value.kind === 'condition' && <><Select label="对象" value={value.subject} options={[['actor', '行动者'], ['target', '目标']]} onChange={(subject) => patch({ subject })} /><Select label="状态" value={value.condition} options={Object.entries(DND5E_STANDARD_CONDITIONS).map(([id, rule]) => [id, rule.label])} onChange={(condition) => patch({ condition })} /></>}
      {value.kind === 'hp-value' && <><Select label="对象" value={value.subject} options={[['actor', '行动者'], ['target', '目标']]} onChange={(subject) => patch({ subject })} /><Formula label="生命值阈值" id="hp-threshold" value={typeof value.value === 'number' ? { kind: 'constant', value: value.value } : value.value} onChange={(next) => patch({ value: next })} /></>}
    </div><button type="button" aria-label="删除 requirement" onClick={remove} className="mt-6 rounded-xl border border-rose-400/20 px-3 text-rose-200"><Trash2 className="h-4 w-4" /></button></div>
  </div>
}

const operationOptions: readonly (readonly [Dnd5eActivityOperationV1['kind'], string])[] = [
  ['damage', '伤害'], ['healing', '治疗'], ['temporary-hit-points', '临时生命'], ['revive', '复活目标'], ['stabilize', '稳定濒死目标'], ['instant-death', '即时死亡'], ['stand-up', '反应起身'], ['apply-standard-condition', '施加状态'],
  ['apply-effect', '施加 Effect'], ['remove-standard-condition', '移除状态'], ['remove-effect', '移除 Effect'], ['remove-effects-by-tag', '按标签移除 Effect'], ['adjust-exhaustion', '调整力竭'], ['lower-ability-score', '降低属性值'], ['recover-ability-score', '恢复属性减值'], ['recover-hit-point-maximum', '恢复最大生命值减值'], ['resource', '资源增减'],
  ['move', '移动/传送'], ['summon', '召唤'], ['duplicate-creature', '复制生物（拟像）'], ['transform-creature', '形态替换'], ['grant-extra-turns', '额外回合组'], ['dispel-area', '驱散区域'], ['command-owned-companion', '命令伙伴'],
  ['relocate-granting-area', '移动授予本 Activity 的区域'], ['reshape-granting-area', '重塑授予本 Activity 的区域'],
  ['detonate-granting-area', '引爆授予本 Activity 的区域'],
  ['emit-sound', '发出可听声音'],
  ['grant-weapon-attack', '发放武器攻击资格'], ['grant-basic-action', '发放基础动作资格'], ['create-persistent-area', '持续区域'], ['invoke-activity', '调用 Activity'], ['mechanic', 'Host 机制处理器'], ['manual-adjudication', 'DM 裁定边界'],
]

function newOperation(kind: Dnd5eActivityOperationV1['kind'], id: string): Dnd5eActivityOperationV1 {
  const one: Dnd5eFormulaV1 = { kind: 'constant', value: 1 }
  if (kind === 'damage') return { id, kind, target: 'target', amount: one, damageType: 'force' }
  if (kind === 'healing' || kind === 'temporary-hit-points') return { id, kind, target: 'target', amount: one }
  if (kind === 'revive') return {
    id, kind, target: 'target', hitPoints: one, maximumDeathAgeRounds: 10,
    excludedCreatureTypes: ['undead', '亡灵'], requiresBody: true,
  }
  if (kind === 'stabilize') return { id, kind, target: 'target' }
  if (kind === 'instant-death') return { id, kind, target: 'target' }
  if (kind === 'stand-up') return { id, kind, target: 'target', usesTargetReactionIfAvailable: true }
  if (kind === 'apply-standard-condition') return { id, kind, target: 'target', condition: 'prone', duration: { kind: 'rounds', rounds: 1, expiresAt: 'target-turn-end' } }
  if (kind === 'apply-effect') return { id, kind, target: 'target', effectId: 'effect-1' }
  if (kind === 'remove-standard-condition') return { id, kind, target: 'target', condition: 'prone' }
  if (kind === 'remove-effect') return { id, kind, target: 'target', effectId: 'effect-1', source: 'self' }
  if (kind === 'remove-effects-by-tag') return { id, kind, target: 'target', tags: ['disease'], match: 'any', source: 'any' }
  if (kind === 'adjust-exhaustion') return { id, kind, target: 'target', amount: { kind: 'constant', value: -1 } }
  if (kind === 'lower-ability-score') return { id, kind, target: 'target', ability: 'int', maximumScore: { kind: 'constant', value: 1 }, recovery: 'restoration-magic' }
  if (kind === 'recover-ability-score') return { id, kind, target: 'target', ability: 'str', maximumCount: 1 }
  if (kind === 'recover-hit-point-maximum') return { id, kind, target: 'target', maximumCount: 1 }
  if (kind === 'resource') return { id, kind, subject: 'actor', resourceId: 'resource', mode: 'spend', amount: one }
  if (kind === 'move') return { id, kind, target: 'target', mode: 'push', distanceFeet: { kind: 'constant', value: 5 } }
  if (kind === 'summon') return { id, kind, monsterId: 'srd-5.1:wolf', count: one, timing: 'immediate', durationRounds: 10, concentration: false, side: 'ally' }
  if (kind === 'duplicate-creature') return {
    id, kind, target: 'target', profile: 'simulacrum', persistent: true,
    maximumHitPointDivisor: 2, cannotIncreaseLevel: true, cannotRegainSpellSlots: true,
  }
  if (kind === 'transform-creature') return {
    id,
    kind,
    target: 'target',
    formChoiceId: 'creature-form',
    profile: 'polymorph',
    durationRounds: 10,
    concentration: true,
    maximumChallengeRating: 'target-level-or-challenge-rating',
  }
  if (kind === 'grant-extra-turns') return {
    id, kind, target: 'actor', turns: { kind: 'dice', rollId: `${id}-turns`, count: 1, sides: 4 },
    freezeOtherCreatures: true, endOnAffectOther: true,
  }
  if (kind === 'grant-inventory-item') return {
    id, kind, target: 'actor', templateId: 'srd-5.1:item:goodberry',
    quantity: one, identified: true,
  }
  if (kind === 'establish-spell-authority') return {
    id, kind, target: 'actor', recordKind: 'clone-receptacle',
    maturesAfterMinutes: 172_800,
  }
  if (kind === 'transition-spell-authority') return {
    id, kind, target: 'actor', recordKind: 'linked-planar-object',
    linkedObjectProfile: 'instant-summons', transition: 'recall-to-source',
  }
  if (kind === 'identify-inventory-item') return { id, kind, target: 'actor' }
  if (kind === 'detonate-granting-area') return { id, kind, target: 'actor' }
  if (kind === 'emit-sound') return {
    id, kind, target: 'actor', label: '巨响', audibleRadiusFeet: 300,
  }
  if (kind === 'modify-map-object-lock') return {
    id, kind, mode: 'knock', targetKinds: ['door', 'obstacle'], suppressionMinutes: 10,
  }
  if (kind === 'enchant-map-object-light') return {
    id, kind, brightRadiusFeet: 20, dimRadiusFeet: 20, color: '#fef3c7', durationMinutes: 60,
  }
  if (kind === 'dispel-area') return { id, kind, target: 'actor', areaKind: 'magical-darkness', radiusFeet: { kind: 'constant', value: 30 }, maximumSpellLevel: { kind: 'constant', value: 3 } }
  if (kind === 'command-owned-companion') return { id, kind, target: 'target', command: 'attack' }
  if (kind === 'grant-weapon-attack') return {
    id, kind, target: 'actor', grantId: 'follow-up-attack', label: '追加武器攻击',
    economy: 'bonus-action', expires: 'turn-end', weaponModes: ['melee'], proficient: true,
  }
  if (kind === 'grant-basic-action') return { id, kind, target: 'actor', grantId: 'bonus-basic-action', label: '附赠基础动作', economy: 'bonus-action', expires: 'turn-end', actions: ['shove'] }
  if (kind === 'create-persistent-area') return { id, kind, label: '持续区域', durationRounds: 10, concentration: true, color: '#8b5cf6' }
  if (kind === 'relocate-granting-area') return {
    id, kind, target: 'target', maximumFeet: { kind: 'constant', value: 20 },
  }
  if (kind === 'reshape-granting-area') return { id, kind, target: 'actor' }
  if (kind === 'invoke-activity') return { id, kind, activityId: 'activity-id', target: 'actor', repeat: one }
  if (kind === 'mechanic') {
    const handlerId = listDnd5eMechanicOperationHandlersV1()[0]?.id ?? 'core.event-damage-reflection'
    return { id, kind, target: 'target', handlerId, parameters: defaultDnd5eMechanicOperationParametersV1(handlerId) }
  }
  return {
    id, kind: 'manual-adjudication', prompt: '请由 DM 裁定此效果。',
    reason: '尚未转换为白名单 operation。', requiresDmApproval: true,
  }
}

function Operation({ value, onChange, remove }: { value: Dnd5eActivityOperationV1; onChange(value: Dnd5eActivityOperationV1): void; remove(): void }) {
  const patch = (next: object) => onChange({ ...value, ...next } as Dnd5eActivityOperationV1)
  const mechanicHandlers = listDnd5eMechanicOperationHandlersV1()
  return <div className="rounded-xl border border-cyan-400/15 bg-cyan-500/[0.035] p-3">
    <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]"><Input label="Operation ID" value={value.id} onChange={(id) => patch({ id })} /><Select label="类型" value={value.kind} options={operationOptions} onChange={(kind) => onChange(newOperation(kind as Dnd5eActivityOperationV1['kind'], value.id))} /><button type="button" aria-label="删除 operation" onClick={remove} className="mt-6 rounded-xl border border-rose-400/20 px-3 text-rose-200"><Trash2 className="h-4 w-4" /></button></div>
    {(value.kind === 'damage' || value.kind === 'healing' || value.kind === 'temporary-hit-points') && <div className="mt-2 grid gap-2 md:grid-cols-2"><Formula label="数值" id={`${value.id}.amount`} value={value.amount} onChange={(amount) => patch({ amount })} />{value.kind === 'damage' && <Select label="伤害类型" value={value.damageType} options={[...DND5E_DAMAGE_TYPES.map((type) => [type, type] as const), ['inherit-primary', '继承主伤害']]} onChange={(damageType) => patch({ damageType })} />}</div>}
    {value.kind === 'revive' && <div className="mt-2 grid gap-2 md:grid-cols-3">
      <Formula label="复活后生命值" id={`${value.id}.hit-points`} value={value.hitPoints} onChange={(hitPoints) => patch({ hitPoints })} />
      <NumberInput label="死亡时限（轮，0=不限）" value={value.maximumDeathAgeRounds ?? 0} onChange={(maximumDeathAgeRounds) => patch({ maximumDeathAgeRounds: maximumDeathAgeRounds || undefined })} />
      <Input label="排除生物类型（逗号分隔）" value={csv(value.excludedCreatureTypes)} onChange={(excludedCreatureTypes) => patch({ excludedCreatureTypes: csvIds(excludedCreatureTypes) })} />
      <Select label="需要尸体" value={String(value.requiresBody === true)} options={[["true", "是"], ["false", "否"]]} onChange={(requiresBody) => patch({ requiresBody: requiresBody === 'true' })} />
      <Select label="身体恢复" value={value.restoreBody ?? 'none'} options={[["none", "不恢复"], ["missing-parts", "复原缺失部位"], ["complete", "重建完整身体"]]} onChange={(restoreBody) => patch({ restoreBody: restoreBody === 'none' ? undefined : restoreBody })} />
      <NumberInput label="复活减值（0=无）" value={value.longRestPenalty?.initial ?? 0} onChange={(initial) => patch({ longRestPenalty: initial > 0 ? { initial, recoveryPerLongRest: 1 } : undefined })} />
    </div>}
    {(value.kind === 'apply-standard-condition' || value.kind === 'remove-standard-condition') && <div className="mt-2"><Select label="状态" value={value.condition} options={Object.entries(DND5E_STANDARD_CONDITIONS).map(([id, rule]) => [id, rule.label])} onChange={(condition) => patch({ condition })} /></div>}
    {(value.kind === 'apply-effect' || value.kind === 'remove-effect') && <div className="mt-2"><Input label="Effect ID" value={value.effectId} onChange={(effectId) => patch({ effectId })} /></div>}
    {value.kind === 'remove-effects-by-tag' && <div className="mt-2 grid gap-2 md:grid-cols-4"><Input label="Effect 标签（逗号分隔）" value={csv(value.tags)} onChange={(next) => patch({ tags: csvIds(next) })} /><Select label="匹配" value={value.match} options={[["any", "任一标签"], ["all", "全部标签"]]} onChange={(match) => patch({ match: match as typeof value.match })} /><Select label="来源" value={value.source} options={[["any", "任意来源"], ["self", "仅自己"]]} onChange={(source) => patch({ source: source as typeof value.source })} /><NumberInput label="最多移除（0=全部）" value={value.maximumCount ?? 0} min={0} onChange={(maximumCount) => patch({ maximumCount: maximumCount > 0 ? Math.min(32, maximumCount) : undefined })} /></div>}
    {value.kind === 'adjust-exhaustion' && <div className="mt-2"><Formula label="力竭等级变化（负数为降低）" id={`operation-${value.id}-exhaustion`} value={value.amount} onChange={(amount) => patch({ amount })} /></div>}
    {value.kind === 'lower-ability-score' && <div className="mt-2 grid gap-2 md:grid-cols-3"><Select label="属性" value={value.ability} options={abilities} onChange={(ability) => patch({ ability })} /><Formula label="降低后上限" id={`operation-${value.id}-ability-maximum`} value={value.maximumScore} onChange={(maximumScore) => patch({ maximumScore })} /><Input label="联动恢复组（可选）" value={value.recoveryGroupId ?? ''} onChange={(recoveryGroupId) => patch({ recoveryGroupId: recoveryGroupId.trim() || undefined })} /></div>}
    {value.kind === 'recover-ability-score' && <div className="mt-2 grid gap-2 md:grid-cols-2"><Select label="属性" value={value.ability} options={abilities} onChange={(ability) => patch({ ability })} /><NumberInput label="最多恢复的来源效果" value={value.maximumCount ?? 1} min={1} onChange={(maximumCount) => patch({ maximumCount: Math.min(32, maximumCount) })} /></div>}
    {value.kind === 'recover-hit-point-maximum' && <div className="mt-2"><NumberInput label="最多恢复的来源效果" value={value.maximumCount ?? 1} min={1} onChange={(maximumCount) => patch({ maximumCount: Math.min(32, maximumCount) })} /></div>}
    {value.kind === 'resource' && <div className="mt-2 grid gap-2 md:grid-cols-3"><Input label="资源 ID" value={value.resourceId} onChange={(resourceId) => patch({ resourceId })} /><Select label="方式" value={value.mode} options={[["spend", "消耗"], ["restore", "恢复"]]} onChange={(mode) => patch({ mode })} /><Formula label="数量" id={`${value.id}.amount`} value={value.amount} onChange={(amount) => patch({ amount })} /></div>}
    {value.kind === 'move' && <div className="mt-2 grid gap-2 md:grid-cols-2"><Select label="方式" value={value.mode} options={[["push", "推离"], ["pull", "拉近"], ["teleport", "传送"], ["swap", "交换"], ["ascend", "垂直上升"], ["descend", "垂直下降"]]} onChange={(mode) => patch({ mode })} /><Formula label="距离" id={`${value.id}.distance`} value={value.distanceFeet} onChange={(distanceFeet) => patch({ distanceFeet })} /></div>}
    {value.kind === 'summon' && <div className="mt-2 grid gap-2 md:grid-cols-4"><Input label="怪物 ID" value={value.monsterId} onChange={(monsterId) => patch({ monsterId })} /><Formula label="数量" id={`${value.id}.count`} value={value.count} onChange={(count) => patch({ count })} /><NumberInput label="持续轮数" value={value.durationRounds} min={1} onChange={(durationRounds) => patch({ durationRounds })} /><Select label="出现时机" value={value.timing} options={[["immediate", "立即"], ["source-next-turn-start", "来源下回合开始"]]} onChange={(timing) => patch({ timing })} /><Select label="长期伙伴" value={value.persistent === true ? 'true' : 'false'} options={[["false", "否，按持续轮数"], ["true", "是，直至解除或死亡"]]} onChange={(persistent) => patch({ persistent: persistent === 'true' ? true : undefined })} /><Select label="允许攻击" value={value.cannotAttack === true ? 'false' : 'true'} options={[["true", "可以攻击"], ["false", "禁止所有攻击类动作"]]} onChange={(allowed) => patch({ cannotAttack: allowed === 'false' ? true : undefined })} /><NumberInput label="覆盖步行速度（尺，0=沿用）" value={value.walkingSpeedFeet?.kind === 'constant' ? value.walkingSpeedFeet.value : 0} min={0} onChange={(walkingSpeedFeet) => patch({ walkingSpeedFeet: walkingSpeedFeet > 0 ? { kind: 'constant', value: walkingSpeedFeet } : undefined })} /><NumberInput label="受伤后消散倒计时（轮，0=无）" value={value.dismissAfterDamageRounds ?? 0} min={0} onChange={(dismissAfterDamageRounds) => patch({ dismissAfterDamageRounds: dismissAfterDamageRounds > 0 ? dismissAfterDamageRounds : undefined })} /></div>}
    {value.kind === 'duplicate-creature' && <p className="mt-2 rounded-lg border border-cyan-400/15 bg-black/20 px-3 py-2 text-xs text-slate-300">Host 对选定生物建立不可升级的持久快照，生命上限减半，法术位只能消耗不能恢复；地图实体与资源状态会随房间保存。</p>}
    {value.kind === 'transform-creature' && <div className="mt-2 grid gap-2 md:grid-cols-3">
      <Input label="形态选择 Choice ID" value={value.formChoiceId} onChange={(formChoiceId) => patch({ formChoiceId })} />
      <Select label="形态规则" value={value.profile} options={[["polymorph", "变形术（替换全部属性）"], ["animal-shapes", "动物形态（保留精神属性）"]]} onChange={(profile) => patch({ profile })} />
      <NumberInput label="持续轮数" value={value.durationRounds} min={1} onChange={(durationRounds) => patch({ durationRounds })} />
      <Select label="最大挑战等级" value={value.maximumChallengeRating === 'target-level-or-challenge-rating' ? 'target' : 'fixed'} options={[["target", "目标等级或挑战等级"], ["fixed", "固定值"]]} onChange={(mode) => patch({ maximumChallengeRating: mode === 'target' ? 'target-level-or-challenge-rating' : 1 })} />
      {typeof value.maximumChallengeRating === 'number' && <NumberInput label="固定最大 CR" value={value.maximumChallengeRating} min={0} onChange={(maximumChallengeRating) => patch({ maximumChallengeRating })} />}
      <Select label="最大体型" value={value.maximumSizeRank == null ? 'none' : String(value.maximumSizeRank)} options={[["none", "不限"], ["0", "微型"], ["1", "小型"], ["2", "中型"], ["3", "大型"], ["4", "巨型"], ["5", "超巨型"]]} onChange={(maximumSizeRank) => patch({ maximumSizeRank: maximumSizeRank === 'none' ? undefined : Number(maximumSizeRank) })} />
      <Select label="需要专注" value={String(value.concentration)} options={[["true", "是"], ["false", "否"]]} onChange={(concentration) => patch({ concentration: concentration === 'true' })} />
      <Input label="仅重置既有来源 Activity（可空）" value={value.requiresExistingSourceActivityId ?? ''} onChange={(requiresExistingSourceActivityId) => patch({ requiresExistingSourceActivityId: requiresExistingSourceActivityId.trim() || undefined })} />
    </div>}
    {value.kind === 'grant-extra-turns' && <div className="mt-2 grid gap-2 md:grid-cols-2">
      <Formula label="额外回合数" id={`${value.id}.turns`} value={value.turns} onChange={(turns) => patch({ turns })} />
      <Select label="影响其他生物时" value={value.endOnAffectOther === true ? 'end' : 'keep'} options={[["end", "立即结束剩余额外回合"], ["keep", "继续额外回合"]]} onChange={(mode) => patch({ endOnAffectOther: mode === 'end' })} />
    </div>}
    {value.kind === 'grant-inventory-item' && <div className="mt-2 grid gap-2 md:grid-cols-4">
      <Input label="物品模板 ID" value={value.templateId} onChange={(templateId) => patch({ templateId })} />
      <Formula label="生成数量" id={`${value.id}.quantity`} value={value.quantity} onChange={(quantity) => patch({ quantity })} />
      <NumberInput label="有效分钟（0=永久）" value={value.expiresAfterMinutes ?? 0} min={0} onChange={(expiresAfterMinutes) => patch({ expiresAfterMinutes: expiresAfterMinutes > 0 ? expiresAfterMinutes : undefined })} />
      <Select label="鉴定状态" value={value.identified === false ? 'unidentified' : 'identified'} options={[["identified", "已鉴定"], ["unidentified", "未鉴定"]]} onChange={(identified) => patch({ identified: identified === 'identified' })} />
    </div>}
    {value.kind === 'establish-spell-authority' && <div className="mt-2 grid gap-2 md:grid-cols-4">
      <Select label="权威记录" value={value.recordKind} options={[["clone-receptacle", "克隆容器"], ["linked-planar-object", "跨位面物品"], ["soul-vessel", "灵魂容器／附身"], ["terrain-merge", "融入地形"], ["simulacrum-companion", "拟像伙伴"]]} onChange={(recordKind) => onChange({
        id: value.id, kind: 'establish-spell-authority', target: value.target,
        recordKind,
        ...(recordKind === 'clone-receptacle' ? { maturesAfterMinutes: 172_800 } : {}),
        ...(recordKind === 'linked-planar-object' ? { linkedObjectProfile: 'instant-summons', requiresSelectedInventoryItem: true as const } : {}),
      } as Dnd5eActivityOperationV1)} />
      {value.recordKind === 'clone-receptacle' && <NumberInput label="成熟分钟" value={value.maturesAfterMinutes ?? 172_800} min={1} onChange={(maturesAfterMinutes) => patch({ maturesAfterMinutes })} />}
      {value.recordKind === 'linked-planar-object' && <Select label="物品规则" value={value.linkedObjectProfile ?? 'instant-summons'} options={[["instant-summons", "瞬间召唤物品"], ["secret-chest", "秘藏箱"]]} onChange={(linkedObjectProfile) => patch({ linkedObjectProfile, requiresSelectedInventoryItem: true })} />}
      {value.recordKind === 'linked-planar-object' && <p className="self-end pb-2 text-[11px] leading-5 text-slate-500">执行时必须选择库存实例；Host 记录实例 ID 与库存修订号。</p>}
    </div>}
    {value.kind === 'transition-spell-authority' && <div className="mt-2 grid gap-2 md:grid-cols-3">
      <Select label="权威记录" value={value.recordKind} options={[["linked-planar-object", "跨位面物品"], ["soul-vessel", "灵魂容器／附身"], ["terrain-merge", "融入地形"]]} onChange={(recordKind) => onChange({
        id: value.id, kind: 'transition-spell-authority', target: value.target,
        recordKind,
        ...(recordKind === 'linked-planar-object' ? { linkedObjectProfile: 'instant-summons', transition: 'recall-to-source' as const } : {}),
        ...(recordKind === 'soul-vessel' ? { transition: 'possess-target' as const } : {}),
        ...(recordKind === 'terrain-merge' ? { transition: 'exit-merged-terrain' as const } : {}),
      } as Dnd5eActivityOperationV1)} />
      {value.recordKind === 'linked-planar-object' && <Select label="物品规则" value={value.linkedObjectProfile ?? 'instant-summons'} options={[["instant-summons", "瞬间召唤物品"], ["secret-chest", "秘藏箱"]]} onChange={(linkedObjectProfile) => patch({ linkedObjectProfile })} />}
      <Select label="状态切换" value={value.transition} options={value.recordKind === 'linked-planar-object'
        ? [["recall-to-source", "召回来源"], ["send-to-ethereal", "送往以太"]]
        : value.recordKind === 'soul-vessel'
          ? [["possess-target", "占据目标"], ["return-to-vessel", "返回容器"]]
          : [["exit-merged-terrain", "离开地形"]]} onChange={(transition) => patch({ transition })} />
    </div>}
    {value.kind === 'identify-inventory-item' && <p className="mt-2 rounded-lg border border-cyan-400/15 bg-black/20 px-3 py-2 text-xs text-slate-300">执行时由玩家或 DM 选择角色库存中的一个物品实例；Host 会重新校验实例、库存修订号和命令收据。</p>}
    {value.kind === 'emit-sound' && <div className="mt-2 grid gap-2 md:grid-cols-2"><Input label="声音名称" value={value.label} onChange={(label) => patch({ label })} /><NumberInput label="可听半径（尺）" value={value.audibleRadiusFeet} min={0} onChange={(audibleRadiusFeet) => patch({ audibleRadiusFeet })} /></div>}
    {value.kind === 'modify-map-object-lock' && <div className="mt-2 grid gap-2 md:grid-cols-3"><Select label="方式" value={value.mode} options={[["arcane-lock", "施加奥术锁"], ["knock", "解锁／压制奥术锁"]]} onChange={(mode) => patch({ mode, suppressionMinutes: mode === 'knock' ? value.suppressionMinutes ?? 10 : undefined })} /><Select label="可选物件" value={value.targetKinds.length === 2 ? 'both' : value.targetKinds[0] ?? 'door'} options={[["both", "门或障碍物"], ["door", "仅门"], ["obstacle", "仅障碍物／容器"]]} onChange={(targetKind) => patch({ targetKinds: targetKind === 'both' ? ['door', 'obstacle'] : [targetKind] })} />{value.mode === 'knock' && <NumberInput label="压制分钟" value={value.suppressionMinutes ?? 10} min={1} onChange={(suppressionMinutes) => patch({ suppressionMinutes })} />}</div>}
    {value.kind === 'enchant-map-object-light' && <div className="mt-2 grid gap-2 md:grid-cols-4"><NumberInput label="明亮光（尺）" value={value.brightRadiusFeet} min={0} onChange={(brightRadiusFeet) => patch({ brightRadiusFeet })} /><NumberInput label="微光（尺）" value={value.dimRadiusFeet} min={0} onChange={(dimRadiusFeet) => patch({ dimRadiusFeet })} /><Input label="颜色" value={value.color} onChange={(color) => patch({ color })} /><NumberInput label="持续分钟（0=永久）" value={value.durationMinutes ?? 0} min={0} onChange={(durationMinutes) => patch({ durationMinutes: durationMinutes > 0 ? durationMinutes : undefined })} /></div>}
    {value.kind === 'grant-weapon-attack' && <div className="mt-2 grid gap-2 md:grid-cols-3"><Input label="资格 ID" value={value.grantId} onChange={(grantId) => patch({ grantId })} /><Input label="按钮名称" value={value.label} onChange={(label) => patch({ label })} /><Select label="武器模式" value={value.weaponModes?.[0] ?? 'any'} options={[["any", "近战或远程"], ["melee", "近战"], ["ranged", "远程"]]} onChange={(mode) => patch({ weaponModes: mode === 'any' ? undefined : [mode] })} /><Input label="限定武器 ID（可留空）" value={csv(value.weaponIds)} onChange={(weaponIds) => patch({ weaponIds: csvIds(weaponIds).length ? csvIds(weaponIds) : undefined })} /><Input label="允许槽位（main-hand/off-hand）" value={csv(value.weaponSlots)} onChange={(weaponSlots) => patch({ weaponSlots: csvIds(weaponSlots).length ? csvIds(weaponSlots) : undefined })} /><Input label="必须具备属性" value={csv(value.requiredWeaponProperties)} onChange={(requiredWeaponProperties) => patch({ requiredWeaponProperties: csvIds(requiredWeaponProperties).length ? csvIds(requiredWeaponProperties) : undefined })} /><Input label="禁止具备属性" value={csv(value.forbiddenWeaponProperties)} onChange={(forbiddenWeaponProperties) => patch({ forbiddenWeaponProperties: csvIds(forbiddenWeaponProperties).length ? csvIds(forbiddenWeaponProperties) : undefined })} /><NumberInput label="覆盖骰数（0=沿用）" value={value.damageDice?.count ?? 0} onChange={(count) => patch({ damageDice: count > 0 ? { count, sides: value.damageDice?.sides ?? 4 } : undefined })} /><NumberInput label="覆盖骰面" value={value.damageDice?.sides ?? 4} min={2} onChange={(sides) => patch({ damageDice: { count: value.damageDice?.count ?? 1, sides } })} /><NumberInput label="固定伤害加值" value={value.damageBonus ?? 0} min={-1000} onChange={(damageBonus) => patch({ damageBonus: damageBonus || undefined })} /><Select label="覆盖伤害类型" value={value.damageType ?? 'inherit'} options={[["inherit", "沿用武器"], ...DND5E_DAMAGE_TYPES.map((type) => [type, type] as const)]} onChange={(damageType) => patch({ damageType: damageType === 'inherit' ? undefined : damageType })} /></div>}
    {value.kind === 'grant-basic-action' && <div className="mt-2 grid gap-2 md:grid-cols-3"><Input label="资格 ID" value={value.grantId} onChange={(grantId) => patch({ grantId })} /><Input label="按钮名称" value={value.label} onChange={(label) => patch({ label })} /><Select label="允许动作" value={value.actions?.[0] ?? 'shove'} options={[["dash", "疾走"], ["shove", "推撞"], ["grapple", "擒抱"]]} onChange={(action) => patch({ actions: [action] })} /><NumberInput label="推开额外距离（尺）" value={value.shovePushDistanceBonusFeet ?? 0} onChange={(shovePushDistanceBonusFeet) => patch({ shovePushDistanceBonusFeet: shovePushDistanceBonusFeet || undefined })} /></div>}
    {value.kind === 'relocate-granting-area' && <div className="mt-2 grid gap-2 md:grid-cols-2"><Formula label="最大移动距离" id={`${value.id}.maximum-feet`} value={value.maximumFeet} onChange={(maximumFeet) => patch({ maximumFeet })} /><p className="self-end pb-2 text-[11px] leading-5 text-slate-500">Host 只移动实际授予本 Activity 的区域，并重新校验距离与地图路径。</p></div>}
    {value.kind === 'reshape-granting-area' && <p className="mt-2 rounded-lg border border-cyan-400/15 bg-black/20 px-3 py-2 text-xs text-slate-300">Host 用当前 Activity 的地图范围模板，原子替换授予本 Activity 的区域几何。适用于强风线、墙体转向等通用规则。</p>}
    {value.kind === 'detonate-granting-area' && <p className="mt-2 rounded-lg border border-orange-400/15 bg-black/20 px-3 py-2 text-xs text-slate-300">Host 重新读取授予本 Activity 的当前区域快照，结算其所有“引爆”触发器后移除区域；客户端不能提交伤害骰数或伪造区域。</p>}
    {value.kind === 'create-persistent-area' && <div className="mt-2 space-y-2">
      <div className="grid gap-2 md:grid-cols-3"><Input label="区域名称" value={value.label} onChange={(label) => patch({ label })} /><NumberInput label="持续轮数" value={value.durationRounds} min={1} onChange={(durationRounds) => patch({ durationRounds })} /><Input label="颜色" value={value.color ?? '#8b5cf6'} onChange={(color) => patch({ color })} /></div>
      <div className="grid gap-2 rounded-lg border border-white/10 bg-black/20 p-3 md:grid-cols-5">
        <Select label="区域锚点" value={value.anchorMode ?? 'auto'} options={[["auto", "按目标模板自动"], ["fixed", "固定在施放位置"], ["source-token", "跟随来源 Token"], ["target-token", "跟随首个目标 Token"]]} onChange={(anchorMode) => patch({ anchorMode: anchorMode === 'auto' ? undefined : anchorMode })} />
        <Select label="来源离开区域" value={value.sourceExitBehavior ?? 'keep'} options={[["keep", "区域继续存在"], ["remove-area", "立即移除区域"]]} onChange={(sourceExitBehavior) => patch({ sourceExitBehavior: sourceExitBehavior === 'keep' ? undefined : sourceExitBehavior })} />
        <Select label="移动包入受阻生物" value={value.sourceOverlapBehavior ?? 'keep'} options={[["keep", "区域继续存在"], ["remove-area", "立即移除区域"]]} onChange={(sourceOverlapBehavior) => patch({ sourceOverlapBehavior: sourceOverlapBehavior === 'keep' ? undefined : sourceOverlapBehavior })} />
        <NumberInput label="最多容纳生物（0=不限）" value={value.creationConstraints?.maximumCreatureCount ?? 0} min={0} onChange={(maximumCreatureCount) => patch({ creationConstraints: maximumCreatureCount > 0 ? { ...value.creationConstraints, maximumCreatureCount: Math.min(128, maximumCreatureCount) } : value.creationConstraints?.maximumCreatureSizeRank != null ? { ...value.creationConstraints, maximumCreatureCount: undefined } : undefined })} />
        <Select label="最大体型（空=不限）" value={value.creationConstraints?.maximumCreatureSizeRank == null ? 'none' : String(value.creationConstraints.maximumCreatureSizeRank)} options={[["none", "不限"], ["0", "微型"], ["1", "小型"], ["2", "中型"], ["3", "大型"], ["4", "巨型"], ["5", "超巨型"]]} onChange={(maximumCreatureSizeRank) => patch({ creationConstraints: maximumCreatureSizeRank !== 'none' ? { ...value.creationConstraints, maximumCreatureSizeRank: Number(maximumCreatureSizeRank) } : value.creationConstraints?.maximumCreatureCount != null ? { ...value.creationConstraints, maximumCreatureSizeRank: undefined } : undefined })} />
      </div>
      <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-300">
        <input type="checkbox" checked={value.effectToken != null} onChange={(event) => patch({
          effectToken: event.target.checked
            ? { label: value.label, emoji: '✦', color: value.color ?? '#8b5cf6', size: 1, hiddenBody: true }
            : undefined,
        })} />
        创建跟随区域的 Host 法术实体（可移动投影／传感器）
      </label>
      {value.effectToken && <div className="grid gap-2 rounded-lg border border-cyan-300/15 bg-cyan-500/[0.04] p-3 md:grid-cols-4">
        <Input label="实体名称" value={value.effectToken.label} onChange={(label) => patch({ effectToken: { ...value.effectToken!, label } })} />
        <Input label="实体符号" value={value.effectToken.emoji ?? '✦'} onChange={(emoji) => patch({ effectToken: { ...value.effectToken!, emoji } })} />
        <Input label="实体颜色" value={value.effectToken.color ?? value.color ?? '#8b5cf6'} onChange={(color) => patch({ effectToken: { ...value.effectToken!, color } })} />
        <NumberInput label="实体尺寸（格）" value={value.effectToken.size ?? 1} min={0.25} onChange={(size) => patch({ effectToken: { ...value.effectToken!, size } })} />
        <NumberInput label="普通视野（尺，0=地图默认）" value={value.effectToken.visionRangeFeet ?? 0} min={0} onChange={(visionRangeFeet) => patch({ effectToken: { ...value.effectToken!, visionRangeFeet: visionRangeFeet || undefined } })} />
        <NumberInput label="黑暗视觉（尺）" value={value.effectToken.darkvisionRangeFeet ?? 0} min={0} onChange={(darkvisionRangeFeet) => patch({ effectToken: { ...value.effectToken!, darkvisionRangeFeet: darkvisionRangeFeet || undefined } })} />
        <Select label="共享给来源角色" value={String(value.effectToken.shareVisionWithSource === true)} options={[["true", "作为来源角色视野源"], ["false", "不共享视野"]]} onChange={(raw) => patch({ effectToken: { ...value.effectToken!, shareVisionWithSource: raw === 'true' } })} />
        <Select label="实体外观" value={value.effectToken.hiddenBody === true ? 'hidden' : 'visible'} options={[["hidden", "隐藏普通 Token 外观"], ["visible", "显示 Token 外观"]]} onChange={(raw) => patch({ effectToken: { ...value.effectToken!, hiddenBody: raw === 'hidden' } })} />
      </div>}
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
      <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-300">
        <input type="checkbox" checked={value.blocking?.movement === true} onChange={(event) => patch({
          blocking: event.target.checked
            ? { ...value.blocking, movement: true, movementMode: value.blocking?.movementMode ?? 'occupancy' }
            : compactPersistentAreaBlocking({ ...value.blocking, movement: false, movementMode: undefined, entryPermission: undefined }),
        })} />
        阻挡移动
      </label>
      {value.blocking?.movement && <div className="grid gap-2 rounded-lg border border-cyan-300/15 bg-cyan-500/[0.04] p-3 md:grid-cols-3">
        <Select label="移动阻挡方式" value={value.blocking.movementMode ?? 'occupancy'} options={[["occupancy", "不可占据（墙体）"], ["enter", "只阻止进入"], ["exit", "只阻止离开"], ["boundary", "双向阻止越界"]]} onChange={(movementMode) => patch({ blocking: { ...value.blocking!, movementMode: movementMode as NonNullable<typeof value.blocking>['movementMode'] } })} />
        <Input label="仅影响生物类型（逗号分隔）" value={csv(value.blocking.includedCreatureTypes)} onChange={(raw) => patch({ blocking: { ...value.blocking!, includedCreatureTypes: csvIds(raw).length ? csvIds(raw) : undefined } })} />
        <Input label="排除生物类型（逗号分隔）" value={csv(value.blocking.excludedCreatureTypes)} onChange={(raw) => patch({ blocking: { ...value.blocking!, excludedCreatureTypes: csvIds(raw).length ? csvIds(raw) : undefined } })} />
        <Select label="排除来源 Token" value={String(value.blocking.excludeSourceToken === true)} options={[["true", "是"], ["false", "否"]]} onChange={(raw) => patch({ blocking: { ...value.blocking!, excludeSourceToken: raw === 'true' } })} />
        <Select label="进入权限" value={value.blocking.entryPermission ?? 'any'} options={[["any", "所有受影响生物"], ["occupants-at-creation", "仅施放时区域内 Token"]]} onChange={(entryPermission) => patch({ blocking: { ...value.blocking!, entryPermission: entryPermission === 'any' ? undefined : 'occupants-at-creation', authorizedTokenIds: undefined } })} />
      </div>}
      <div className="grid gap-2 md:grid-cols-2">
        <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-300">
          <input type="checkbox" checked={value.blocking?.blocksTeleportationEntry === true} onChange={(event) => patch({
            blocking: event.target.checked
              ? { ...value.blocking, blocksTeleportationEntry: true }
              : compactPersistentAreaBlocking({ ...value.blocking, blocksTeleportationEntry: false }),
          })} />
          阻止传送进入区域
        </label>
        <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-300">
          <input type="checkbox" checked={value.blocking?.blocksTeleportationExit === true} onChange={(event) => patch({
            blocking: event.target.checked
              ? { ...value.blocking, blocksTeleportationExit: true }
              : compactPersistentAreaBlocking({ ...value.blocking, blocksTeleportationExit: false }),
          })} />
          阻止传送离开区域
        </label>
      </div>
      <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-300">
        <input type="checkbox" checked={value.teleportationExitSavingThrow != null} onChange={(event) => patch({
          teleportationExitSavingThrow: event.target.checked
            ? { ability: 'cha', dc: 'source-save-dc' }
            : undefined,
        })} />
        传送离开区域时允许豁免越界
      </label>
      {value.teleportationExitSavingThrow && <div className="grid gap-2 rounded-lg border border-cyan-300/15 bg-cyan-500/[0.04] p-3 md:grid-cols-3">
        <Select label="豁免属性" value={value.teleportationExitSavingThrow.ability} options={abilities} onChange={(ability) => patch({ teleportationExitSavingThrow: { ...value.teleportationExitSavingThrow!, ability: ability as typeof value.teleportationExitSavingThrow.ability } })} />
        <Select label="豁免 DC 来源" value={value.teleportationExitSavingThrow.dc === 'source-save-dc' ? 'source-save-dc' : 'fixed'} options={[["source-save-dc", "来源法术 DC"], ["fixed", "固定 DC"]]} onChange={(mode) => patch({ teleportationExitSavingThrow: { ...value.teleportationExitSavingThrow!, dc: mode === 'source-save-dc' ? 'source-save-dc' : 10 } })} />
        {value.teleportationExitSavingThrow.dc !== 'source-save-dc' && <NumberInput label="固定 DC" value={value.teleportationExitSavingThrow.dc} min={1} onChange={(dc) => patch({ teleportationExitSavingThrow: { ...value.teleportationExitSavingThrow!, dc: Math.max(1, Math.min(40, dc)) } })} />}
      </div>}
      <div className="grid gap-2 md:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input type="checkbox" checked={value.blocking?.vision === true} onChange={(event) => patch({
              blocking: event.target.checked
                ? { ...value.blocking, vision: true, visionMode: value.blocking?.visionMode ?? 'occupancy' }
                : compactPersistentAreaBlocking({ ...value.blocking, vision: false, visionMode: undefined }),
            })} />
            阻挡视觉
          </label>
          {value.blocking?.vision === true && <div className="mt-2"><Select label="视觉方向" value={value.blocking.visionMode ?? 'occupancy'} options={[["occupancy", "区域本身不透明"], ["outside-in", "外部看不进，内部可向外看"]]} onChange={(visionMode) => patch({ blocking: { ...value.blocking!, visionMode: visionMode as NonNullable<typeof value.blocking>['visionMode'] } })} /></div>}
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input type="checkbox" checked={value.blocking?.lineOfEffect === true} onChange={(event) => patch({
              blocking: event.target.checked
                ? { ...value.blocking, lineOfEffect: true, lineOfEffectMode: value.blocking?.lineOfEffectMode ?? 'occupancy' }
                : compactPersistentAreaBlocking({ ...value.blocking, lineOfEffect: false, lineOfEffectMode: undefined }),
            })} />
            阻挡法术／效果线
          </label>
          {value.blocking?.lineOfEffect === true && <div className="mt-2"><Select label="效果线规则" value={value.blocking.lineOfEffectMode ?? 'occupancy'} options={[["occupancy", "区域本身阻挡"], ["boundary", "只阻止跨越边界"]]} onChange={(lineOfEffectMode) => patch({ blocking: { ...value.blocking!, lineOfEffectMode: lineOfEffectMode as NonNullable<typeof value.blocking>['lineOfEffectMode'] } })} /></div>}
        </div>
      </div>
      <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-300">
        <input type="checkbox" checked={value.occupantModifiers?.suppressesMagic === true} onChange={(event) => patch({
          occupantModifiers: event.target.checked
            ? { ...value.occupantModifiers, suppressesMagic: true }
            : value.occupantModifiers?.suppressesSpellsThroughLevel != null
              ? { ...value.occupantModifiers, suppressesMagic: false }
              : undefined,
        })} />
        区域内压制魔法（阻止施法并暂停魔法 ActiveEffect）
      </label>
      <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-300">
        <input type="checkbox" checked={value.occupantModifiers?.suppressesSpellsThroughLevel != null} onChange={(event) => patch({
          occupantModifiers: event.target.checked
            ? { ...value.occupantModifiers, suppressesSpellsThroughLevel: 5 }
            : value.occupantModifiers?.suppressesMagic === true
              ? { ...value.occupantModifiers, suppressesSpellsThroughLevel: undefined }
              : undefined,
        })} />
        跨越区域边界时压制指定环级以下法术
      </label>
      {value.occupantModifiers?.suppressesSpellsThroughLevel != null && <NumberInput
        label="压制法术最高基础环级（0–9）"
        value={value.occupantModifiers.suppressesSpellsThroughLevel}
        min={0}
        onChange={(suppressesSpellsThroughLevel) => patch({
          occupantModifiers: {
            ...value.occupantModifiers!,
            suppressesSpellsThroughLevel: Math.max(0, Math.min(9, Math.floor(suppressesSpellsThroughLevel))),
          },
        })}
      />}
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
  ['attacks-against-target', '针对目标的攻击检定'], ['cannot-be-surprised-while-conscious', '清醒时不会被突袭'],
  ['attacks-against-target-by-creature-type', '指定生物类型攻击目标时劣势'],
  ['ability-check', '属性检定'], ['perception-target-lock', '感知目标限制'], ['weapon-damage-replacement', '替换武器基础伤害'],
  ['weapon-damage-multiplier', '武器伤害倍率'],
  ['minimum-ability-check-d20', '属性检定 d20 最低值'],
  ['skill-check-bonus-aura', '技能检定加值灵光'],
  ['movement-boundary-save', '越界移动豁免'],
  ['weapon-enchantment', '武器附魔'], ['attack-profile', '攻击资料覆盖'], ['saving-throw', '豁免'],
  ['death-saving-throw', '死亡豁免'], ['maximize-healing-dice', '治疗骰最大化'],
  ['saving-throw-proficiency', '豁免熟练'], ['damage-resistance', '伤害抗性'], ['damage-immunity', '伤害免疫'],
  ['conditional-damage-resistance', '条件伤害抗性'],
  ['damage-vulnerability', '伤害易伤'], ['condition-immunity', '状态免疫'],
  ['condition-immunity-by-source-creature-type', '按来源生物类型状态免疫'],
  ['saving-throw-advantage-by-source-creature-type', '按来源生物类型获得状态豁免优势'],
  ['condition-immunity-by-source-magic', '按魔法来源状态免疫'],
  ['character-capability', '永久角色能力'], ['racial-saving-throw-advantage', '种族条件豁免优势'],
  ['maximum-attacks-per-turn', '攻击次数上限'], ['darkvision', '黑暗视觉'], ['flight-speed', '飞行速度'],
  ['safe-fall', '坠落免伤'], ['controlled-descent', '受控下降'],
  ['automatic-escape', '消耗移动自动挣脱'],
  ['ignore-magical-speed-reductions', '忽略魔法减速'],
  ['action-restriction', '行动限制'],
  ['spell-save-disadvantage-aura', '法术豁免劣势灵光'], ['spell-action-as-bonus-action', '动作法术改附赠动作'],
  ['see-invisible', '识破隐形'], ['language-capability', '语言理解/交流'], ['environmental-capability', '环境生存/行走'],
  ['tracking-capability', '追踪与足迹能力'],
  ['emitted-light', '发出光照'],
  ['prohibit-reaction', '禁止反应'], ['forced-flee-from-source', '强制远离来源'],
]

function newModifier(kind: Dnd5eEffectModifierV1['kind']): Dnd5eEffectModifierV1 {
  if (kind === 'armor-class') return { kind, mode: 'add', value: { kind: 'constant', value: 1 } }
  if (kind === 'speed') return { kind, mode: 'add', value: { kind: 'constant', value: 10 } }
  if (kind === 'attack-roll') return { kind, mode: 'advantage' }
  if (kind === 'attacks-against-target') return { kind, mode: 'advantage' }
  if (kind === 'attacks-against-target-by-creature-type') return { kind, mode: 'disadvantage', sourceCreatureTypes: ['undead'] }
  if (kind === 'cannot-be-surprised-while-conscious') return { kind }
  if (kind === 'attack-target-lock') return { kind, attacksAgainstOthersThanSource: 'disadvantage' }
  if (kind === 'ability-check') return { kind, mode: 'advantage' }
  if (kind === 'perception-target-lock') return { kind, disadvantageAgainstOthersThanSource: true }
  if (kind === 'skill-check-bonus-aura') return { kind, skill: 'stealth', bonus: 10, radiusFeet: 30, relation: 'ally-and-self' }
  if (kind === 'minimum-ability-check-d20') return { kind, ability: 'cha', minimum: 15 }
  if (kind === 'weapon-damage-roll') return { kind, mode: 'add', value: { kind: 'constant', value: 1 }, appliesTo: 'all-weapon-attacks' }
  if (kind === 'weapon-damage-multiplier') return { kind, multiplier: 0.5, ability: 'str' }
  if (kind === 'weapon-damage-replacement') return { kind, attackModes: ['ranged'] }
  if (kind === 'movement-boundary-save') return { kind, maximumDistanceFeet: 30, ability: 'wis', dc: { kind: 'reference', reference: { kind: 'actor-spell-save-dc' } } }
  if (kind === 'weapon-enchantment') return { kind, weaponSlot: 'main-hand', attackAndDamageBonus: { kind: 'constant', value: 1 } }
  if (kind === 'attack-profile') return { kind, attackModes: ['melee'] }
  if (kind === 'saving-throw') return { kind, mode: 'advantage' }
  if (kind === 'death-saving-throw') return { kind, mode: 'advantage' }
  if (kind === 'maximize-healing-dice') return { kind }
  if (kind === 'saving-throw-proficiency') return { kind, ability: 'con' }
  if (kind === 'damage-resistance') return { kind, damageType: 'fire' }
  if (kind === 'conditional-damage-resistance') return { kind, damageTypes: ['bludgeoning'], sourceMagical: false }
  if (kind === 'damage-immunity') return { kind, damageType: 'fire' }
  if (kind === 'damage-vulnerability') return { kind, damageType: 'fire' }
  if (kind === 'condition-immunity') return { kind, condition: 'charmed' }
  if (kind === 'condition-immunity-by-source-creature-type') return { kind, conditions: ['charmed'], sourceCreatureTypes: ['undead'] }
  if (kind === 'saving-throw-advantage-by-source-creature-type') return { kind, conditions: ['charmed'], sourceCreatureTypes: ['undead'] }
  if (kind === 'condition-immunity-by-source-magic') return { kind, conditions: ['restrained'], sourceMagical: true }
  if (kind === 'character-capability') return { kind, capability: 'cannotBeSurprisedWhileConscious', value: true }
  if (kind === 'racial-saving-throw-advantage') return { kind, conditions: ['charmed'] }
  if (kind === 'damage-reduction') return { kind, amount: { kind: 'constant', value: 1 } }
  if (kind === 'on-hit-bonus-damage') return { kind, amount: { kind: 'dice', rollId: 'on-hit-bonus-damage', count: 1, sides: 6 }, damageType: 'inherit-primary', appliesTo: 'all-weapon-attacks' }
  if (kind === 'attack-roll-reroll') return { kind, maximumDice: 1, appliesTo: 'all-weapon-attacks' }
  if (kind === 'death-prevention') return { kind, hitPointsAfter: 1 }
  if (kind === 'maximum-attacks-per-turn') return { kind, value: 1 }
  if (kind === 'darkvision') return { kind, rangeFeet: 60 }
  if (kind === 'flight-speed') return { kind, speedFeet: 30 }
  if (kind === 'safe-fall') return { kind, maximumFeet: 20 }
  if (kind === 'controlled-descent') return { kind, maximumFeetPerRound: 60, safeLanding: true, endsOnLanding: true }
  if (kind === 'automatic-escape') return { kind, conditions: ['grappled', 'restrained'], movementCostFeet: 5, sourceMagical: false }
  if (kind === 'ignore-magical-speed-reductions') return { kind }
  if (kind === 'action-restriction') return { kind, prohibited: ['attack', 'spellcasting', 'object-interaction', 'speech'] }
  if (kind === 'spell-save-disadvantage-aura') return { kind, radiusFeet: 10 }
  if (kind === 'spell-action-as-bonus-action') return { kind, spellcastingClassIds: ['sorcerer'] }
  if (kind === 'see-invisible') return { kind }
  if (kind === 'emitted-light') return { kind, brightRadiusFeet: 20, dimRadiusFeet: 20, color: '#fef3c7' }
  if (kind === 'language-capability') return { kind, understandSpoken: 'all' }
  if (kind === 'environmental-capability') return { kind, breatheIn: ['water'] }
  if (kind === 'tracking-capability') return { kind, mundaneTracking: 'impossible', leavesTracks: false }
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
      {value.kind === 'attacks-against-target' && <Select label="攻击该目标时" value={value.mode} options={[["advantage", "获得优势"], ["disadvantage", "承受劣势"]]} onChange={(mode) => patch({ mode })} />}
      {value.kind === 'attacks-against-target-by-creature-type' && <Input label="来源生物类型 ID（逗号分隔）" value={csv(value.sourceCreatureTypes)} onChange={(next) => patch({ sourceCreatureTypes: csvIds(next) })} />}
      {value.kind === 'cannot-be-surprised-while-conscious' && <p className="self-end pb-2 text-xs text-slate-400">只要目标清醒，Host 将忽略本场突袭标记。</p>}
      {value.kind === 'attack-target-lock' && <p className="self-end pb-2 text-xs text-slate-400">攻击 Effect 来源以外的目标时获得劣势。</p>}
      {value.kind === 'ability-check' && <><Select label="方式" value={value.mode} options={[["advantage", "优势"], ["disadvantage", "劣势"]]} onChange={(mode) => patch({ mode })} /><Select label="属性（可不限）" value={value.ability ?? 'any'} options={[["any", "所有属性"], ...abilities]} onChange={(ability) => patch({ ability: ability === 'any' ? undefined : ability })} /></>}
      {value.kind === 'perception-target-lock' && <p className="self-end pb-2 text-xs text-slate-400">感知 Effect 来源以外的生物时承受劣势；Host 要求检定明确选择观察目标。</p>}
      {value.kind === 'skill-check-bonus-aura' && <><Input label="技能 ID" value={value.skill} onChange={(skill) => patch({ skill })} /><NumberInput label="检定加值" value={value.bonus} min={-100} onChange={(bonus) => patch({ bonus: Math.min(100, bonus) })} /><NumberInput label="半径（尺）" value={value.radiusFeet} min={0} onChange={(radiusFeet) => patch({ radiusFeet })} /><p className="self-end pb-2 text-xs text-slate-400">影响同阵营盟友与自身；Host 按地图距离判定。</p></>}
      {value.kind === 'minimum-ability-check-d20' && <><Select label="属性" value={value.ability} options={abilities} onChange={(ability) => patch({ ability })} /><NumberInput label="原始 d20 最低值（1–20）" value={value.minimum} min={1} onChange={(minimum) => patch({ minimum: Math.min(20, minimum) })} /></>}
      {value.kind === 'weapon-damage-roll' && <><Formula label="附加伤害" id="modifier-weapon-damage" value={value.value} onChange={(next) => patch({ value: next })} /><Select label="适用" value={value.appliesTo ?? 'all-weapon-attacks'} options={[["all-weapon-attacks", "所有武器攻击"], ["this-weapon", "绑定武器"]]} onChange={(appliesTo) => patch({ appliesTo })} /></>}
      {value.kind === 'weapon-damage-multiplier' && <><NumberInput label="伤害倍率（0–10）" value={value.multiplier} min={0} onChange={(multiplier) => patch({ multiplier: Math.min(10, multiplier) })} /><Select label="关联属性" value={value.ability ?? 'any'} options={[["any", "不限"], ["str", "力量"], ["dex", "敏捷"]]} onChange={(ability) => patch({ ability: ability === 'any' ? undefined : ability })} /><Input label="攻击方式（melee/ranged，可留空）" value={csv(value.attackModes)} onChange={(next) => patch({ attackModes: csvIds(next).length ? csvIds(next) as typeof value.attackModes : undefined })} /></>}
      {value.kind === 'weapon-damage-replacement' && <Select label="攻击方式" value={value.attackModes[0] ?? 'ranged'} options={[["melee", "近战"], ["ranged", "远程"]]} onChange={(mode) => patch({ attackModes: [mode] })} />}
      {value.kind === 'movement-boundary-save' && <><NumberInput label="来源边界（尺）" value={value.maximumDistanceFeet} onChange={(maximumDistanceFeet) => patch({ maximumDistanceFeet })} /><Select label="豁免属性" value={value.ability} options={abilities} onChange={(ability) => patch({ ability })} /><Formula label="豁免 DC" id="modifier-boundary-save" value={value.dc} onChange={(dc) => patch({ dc })} /></>}
      {value.kind === 'weapon-enchantment' && <><Select label="武器槽位" value={value.weaponSlot} options={[["main-hand", "主手"], ["off-hand", "副手"]]} onChange={(weaponSlot) => patch({ weaponSlot })} /><Formula label="攻击与伤害加值" id="modifier-enchantment" value={value.attackAndDamageBonus} onChange={(next) => patch({ attackAndDamageBonus: next })} /></>}
      {value.kind === 'attack-profile' && <><Select label="攻击方式" value={value.attackModes[0] ?? 'melee'} options={[["melee", "近战"], ["ranged", "远程"], ["unarmed", "徒手"]]} onChange={(mode) => patch({ attackModes: [mode] })} /><NumberInput label="触及加值（尺）" value={value.reachBonusFeet ?? 0} onChange={(reachBonusFeet) => patch({ reachBonusFeet: reachBonusFeet || undefined })} /></>}
      {value.kind === 'saving-throw' && <><Select label="方式" value={value.mode} options={[["add", "加值"], ["advantage", "优势"], ["disadvantage", "劣势"]]} onChange={(mode) => patch({ mode, value: mode === 'add' ? value.value ?? { kind: 'constant', value: 1 } : undefined })} /><Select label="属性（可不限）" value={value.ability ?? 'any'} options={[["any", "所有豁免"], ...abilities]} onChange={(ability) => patch({ ability: ability === 'any' ? undefined : ability })} />{value.mode === 'add' && <Formula label="加值" id="modifier-save" value={value.value ?? { kind: 'constant', value: 1 }} onChange={(next) => patch({ value: next })} />}</>}
      {value.kind === 'death-saving-throw' && <p className="self-end pb-2 text-xs text-slate-400">死亡豁免获得优势。</p>}
      {value.kind === 'maximize-healing-dice' && <p className="self-end pb-2 text-xs text-slate-400">目标收到的治疗骰按每枚骰最大值结算。</p>}
      {value.kind === 'saving-throw-proficiency' && <Select label="属性" value={value.ability} options={abilities} onChange={(ability) => patch({ ability })} />}
      {(value.kind === 'damage-resistance' || value.kind === 'damage-immunity' || value.kind === 'damage-vulnerability') && <Select label="伤害类型" value={damageType} options={DND5E_DAMAGE_TYPES.map((type) => [type, type] as const)} onChange={(next) => patch({ damageType: next })} />}
      {value.kind === 'conditional-damage-resistance' && <><Input label="伤害类型（逗号分隔）" value={csv(value.damageTypes)} onChange={(next) => patch({ damageTypes: csvIds(next) })} /><Select label="来源是否魔法" value={value.sourceMagical == null ? 'any' : String(value.sourceMagical)} options={[["any", "不限"], ["false", "仅非魔法"], ["true", "仅魔法"]]} onChange={(next) => patch({ sourceMagical: next === 'any' ? undefined : next === 'true' })} /><Input label="来源方式（可留空）" value={csv(value.deliveries)} onChange={(next) => patch({ deliveries: csvIds(next).length ? csvIds(next) as typeof value.deliveries : undefined })} /></>}
      {value.kind === 'condition-immunity' && <Select label="状态" value={value.condition} options={Object.entries(DND5E_STANDARD_CONDITIONS).map(([id, rule]) => [id, rule.label])} onChange={(condition) => patch({ condition })} />}
      {value.kind === 'condition-immunity-by-source-creature-type' && <><Input label="状态 ID（逗号分隔）" value={csv(value.conditions)} onChange={(next) => patch({ conditions: csvIds(next) as typeof value.conditions })} /><Input label="来源生物类型 ID（逗号分隔）" value={csv(value.sourceCreatureTypes)} onChange={(next) => patch({ sourceCreatureTypes: csvIds(next) })} /></>}
      {value.kind === 'saving-throw-advantage-by-source-creature-type' && <><Input label="状态 ID（逗号分隔）" value={csv(value.conditions)} onChange={(next) => patch({ conditions: csvIds(next) as typeof value.conditions })} /><Input label="来源生物类型 ID（逗号分隔）" value={csv(value.sourceCreatureTypes)} onChange={(next) => patch({ sourceCreatureTypes: csvIds(next) })} /></>}
      {value.kind === 'condition-immunity-by-source-magic' && <><Input label="状态 ID（逗号分隔）" value={csv(value.conditions)} onChange={(next) => patch({ conditions: csvIds(next) })} /><Select label="来源" value={String(value.sourceMagical)} options={[["true", "仅魔法来源"], ["false", "仅非魔法来源"]]} onChange={(next) => patch({ sourceMagical: next === 'true' })} /><Select label="暂停既有效果" value={String(value.suppressExisting === true)} options={[["false", "否"], ["true", "是"]]} onChange={(next) => patch({ suppressExisting: next === 'true' ? true : undefined })} /></>}
      {value.kind === 'character-capability' && <><Select label="能力" value={value.capability} options={DND5E_CHARACTER_CAPABILITY_IDS_V1.map((id) => [id, id] as const)} onChange={(capability) => patch({ capability, value: defaultCharacterCapabilityValue(capability) })} />{numericCharacterCapabilities.has(value.capability) ? <NumberInput label="数值" value={typeof value.value === 'number' ? value.value : 1} onChange={(next) => patch({ value: next })} /> : listCharacterCapabilities.has(value.capability) ? <Input label="ID 列表（逗号分隔）" value={csv(Array.isArray(value.value) ? value.value : [])} onChange={(next) => patch({ value: csvIds(next) })} /> : <Select label="启用" value={String(value.value === true)} options={[["true", "是"], ["false", "否"]]} onChange={(next) => patch({ value: next === 'true' })} />}</>}
      {value.kind === 'racial-saving-throw-advantage' && <><Input label="关联状态（逗号分隔）" value={csv(value.conditions)} onChange={(next) => patch({ conditions: csvIds(next).length ? csvIds(next) : undefined })} /><Input label="关联伤害类型（逗号分隔）" value={csv(value.damageTypes)} onChange={(next) => patch({ damageTypes: csvIds(next).length ? csvIds(next) : undefined })} /><Input label="魔法豁免属性（逗号分隔）" value={csv(value.magicAbilities)} onChange={(next) => patch({ magicAbilities: csvIds(next).length ? csvIds(next) : undefined })} /></>}
      {value.kind === 'damage-reduction' && <><Formula label="减免值" id="modifier-damage-reduction" value={value.amount} onChange={(amount) => patch({ amount })} /><Input label="限定伤害类型（可留空）" value={csv(value.damageTypes)} onChange={(damageTypes) => patch({ damageTypes: csvIds(damageTypes).length ? csvIds(damageTypes) : undefined })} /><Input label="来源方式（weapon-attack/spell/other）" value={csv(value.deliveries)} onChange={(next) => patch({ deliveries: csvIds(next).length ? csvIds(next) as typeof value.deliveries : undefined })} /><Select label="仅穿重甲" value={String(value.requiresHeavyArmor === true)} options={[["false", "否"], ["true", "是"]]} onChange={(next) => patch({ requiresHeavyArmor: next === 'true' || undefined })} /></>}
      {value.kind === 'on-hit-bonus-damage' && <>
        <Formula label="伤害" id="modifier-on-hit" value={value.amount} onChange={(amount) => patch({ amount })} />
        <Select label="伤害类型" value={value.damageType} options={[["inherit-primary", "继承主伤害"], ...DND5E_DAMAGE_TYPES.map((type) => [type, type] as const)]} onChange={(next) => patch({ damageType: next })} />
        <Select label="适用武器" value={value.appliesTo} options={[["all-weapon-attacks", "所有武器攻击"], ["this-weapon", "施加 Effect 时所持武器"]]} onChange={(appliesTo) => patch({ appliesTo })} />
        <Select label="暴击伤害骰翻倍" value={String(value.doubleDiceOnCritical !== false)} options={[["true", "是"], ["false", "否"]]} onChange={(next) => patch({ doubleDiceOnCritical: next === 'true' })} />
        <Select label="每回合一次" value={String(value.oncePerTurn === true)} options={[["false", "否"], ["true", "是"]]} onChange={(next) => patch({ oncePerTurn: next === 'true' || undefined })} />
        <Input label="限定生物类型（可留空）" value={csv(value.targetCreatureTypes)} onChange={(next) => patch({ targetCreatureTypes: csvIds(next).length ? csvIds(next) : undefined })} />
        <Select label="命中后显形" value={String(value.onHitTargetEffect?.revealInvisible === true)} options={[["false", "否"], ["true", "是"]]} onChange={(next) => patch({ onHitTargetEffect: { ...(value.onHitTargetEffect ?? {}), revealInvisible: next === 'true' ? true : undefined } })} />
        <Select label="命中后禁止隐形" value={String(value.onHitTargetEffect?.preventInvisibility === true)} options={[["false", "否"], ["true", "是"]]} onChange={(next) => patch({ onHitTargetEffect: { ...(value.onHitTargetEffect ?? {}), preventInvisibility: next === 'true' ? true : undefined } })} />
        <Select label="命中后发光" value={String(value.onHitTargetEffect?.emittedLight != null)} options={[["false", "否"], ["true", "是"]]} onChange={(next) => patch({ onHitTargetEffect: { ...(value.onHitTargetEffect ?? {}), emittedLight: next === 'true' ? value.onHitTargetEffect?.emittedLight ?? { brightRadiusFeet: 0, dimRadiusFeet: 5, color: '#fef3c7' } : undefined } })} />
        {value.onHitTargetEffect?.emittedLight && <>
          <NumberInput label="命中后明亮光照（尺）" value={value.onHitTargetEffect.emittedLight.brightRadiusFeet} min={0} onChange={(brightRadiusFeet) => patch({ onHitTargetEffect: { ...value.onHitTargetEffect!, emittedLight: { ...value.onHitTargetEffect!.emittedLight!, brightRadiusFeet } } })} />
          <NumberInput label="命中后额外微光（尺）" value={value.onHitTargetEffect.emittedLight.dimRadiusFeet} min={0} onChange={(dimRadiusFeet) => patch({ onHitTargetEffect: { ...value.onHitTargetEffect!, emittedLight: { ...value.onHitTargetEffect!.emittedLight!, dimRadiusFeet } } })} />
          <Input label="命中后光色" value={value.onHitTargetEffect.emittedLight.color} onChange={(color) => patch({ onHitTargetEffect: { ...value.onHitTargetEffect!, emittedLight: { ...value.onHitTargetEffect!.emittedLight!, color } } })} />
        </>}
      </>}
      {value.kind === 'attack-roll-reroll' && <Select label="适用" value={value.appliesTo} options={[["all-weapon-attacks", "所有武器攻击"], ["this-weapon", "绑定武器"]]} onChange={(appliesTo) => patch({ appliesTo })} />}
      {value.kind === 'death-prevention' && <><NumberInput label="保留生命值" value={value.hitPointsAfter} onChange={(hitPointsAfter) => patch({ hitPointsAfter })} /><Select label="阻止巨量伤害" value={String(value.preventsMassiveDamage === true)} options={[["false", "否"], ["true", "是"]]} onChange={(next) => patch({ preventsMassiveDamage: next === 'true' })} /></>}
      {value.kind === 'maximum-attacks-per-turn' && <NumberInput label="每回合最多攻击" value={value.value} min={1} onChange={(next) => patch({ value: next })} />}
      {value.kind === 'darkvision' && <NumberInput label="距离（尺）" value={value.rangeFeet} min={1} onChange={(rangeFeet) => patch({ rangeFeet })} />}
      {value.kind === 'flight-speed' && <><NumberInput label="飞行速度（尺）" value={value.speedFeet} min={1} onChange={(speedFeet) => patch({ speedFeet })} /><Select label="悬浮" value={String(value.hover === true)} options={[["false", "否"], ["true", "是"]]} onChange={(next) => patch({ hover: next === 'true' ? true : undefined })} /></>}
      {value.kind === 'safe-fall' && <NumberInput label="免伤坠落距离（尺）" value={value.maximumFeet} min={1} onChange={(maximumFeet) => patch({ maximumFeet })} />}
      {value.kind === 'controlled-descent' && <NumberInput label="每轮最大下降（尺）" value={value.maximumFeetPerRound} min={1} onChange={(maximumFeetPerRound) => patch({ maximumFeetPerRound })} />}
      {value.kind === 'automatic-escape' && <><Input label="状态（grappled/restrained）" value={csv(value.conditions)} onChange={(next) => patch({ conditions: csvIds(next) as typeof value.conditions })} /><NumberInput label="每个效果消耗移动（尺）" value={value.movementCostFeet} min={0} onChange={(movementCostFeet) => patch({ movementCostFeet })} /><Select label="来源" value={value.sourceMagical == null ? 'any' : String(value.sourceMagical)} options={[["any", "不限"], ["false", "仅非魔法"], ["true", "仅魔法"]]} onChange={(next) => patch({ sourceMagical: next === 'any' ? undefined : next === 'true' })} /></>}
      {value.kind === 'action-restriction' && <><Input label="禁止（attack/spellcasting/object-interaction/speech）" value={csv(value.prohibited)} onChange={(next) => patch({ prohibited: csvIds(next) as typeof value.prohibited })} /><Input label="仍允许的基础动作（dash/dismiss-effect，可留空）" value={csv(value.allowedBasicActions)} onChange={(next) => patch({ allowedBasicActions: csvIds(next).length ? csvIds(next) as typeof value.allowedBasicActions : undefined })} /><Input label="仍允许的 Activity ID（可留空）" value={csv(value.allowedActivityIds)} onChange={(next) => patch({ allowedActivityIds: csvIds(next).length ? csvIds(next) : undefined })} /></>}
      {value.kind === 'spell-save-disadvantage-aura' && <><NumberInput label="半径（尺）" value={value.radiusFeet} min={1} onChange={(radiusFeet) => patch({ radiusFeet })} /><Input label="限定伤害类型（可留空）" value={csv(value.damageTypes)} onChange={(damageTypes) => patch({ damageTypes: csvIds(damageTypes).length ? csvIds(damageTypes) : undefined })} /></>}
      {value.kind === 'spell-action-as-bonus-action' && <Input label="施法职业 ID（逗号分隔）" value={csv(value.spellcastingClassIds)} onChange={(spellcastingClassIds) => patch({ spellcastingClassIds: csvIds(spellcastingClassIds) })} />}
      {value.kind === 'language-capability' && <><Select label="理解口语" value={value.understandSpoken ?? 'none'} options={[["none", "不授予"], ["all", "所有听到的语言"]]} onChange={(understandSpoken) => patch({ understandSpoken: understandSpoken === 'all' ? 'all' : undefined })} /><Select label="理解文字" value={value.understandWritten ?? 'none'} options={[["none", "不授予"], ["literal-written", "所有文字的字面意义"]]} onChange={(understandWritten) => patch({ understandWritten: understandWritten === 'literal-written' ? 'literal-written' : undefined, writtenRequiresTouch: understandWritten === 'literal-written' ? true : undefined, writtenMinutesPerPage: understandWritten === 'literal-written' ? 1 : undefined })} /><Select label="他人理解你的话" value={value.speechUnderstoodBy ?? 'none'} options={[["none", "不授予"], ["any-creature-knowing-a-language", "会至少一种语言的生物"]]} onChange={(speechUnderstoodBy) => patch({ speechUnderstoodBy: speechUnderstoodBy === 'any-creature-knowing-a-language' ? speechUnderstoodBy : undefined })} /></>}
      {value.kind === 'environmental-capability' && <><Select label="水下呼吸" value={value.breatheIn?.includes('water') ? 'water' : 'none'} options={[["none", "不授予"], ["water", "可以在水中呼吸"]]} onChange={(next) => patch({ breatheIn: next === 'water' ? ['water'] : undefined })} /><Select label="液体表面行走" value={value.treatLiquidSurfacesAsSolidGround === true ? 'true' : 'false'} options={[["false", "不授予"], ["true", "视为坚实地面"]]} onChange={(next) => patch({ treatLiquidSurfacesAsSolidGround: next === 'true' ? true : undefined })} /><Select label="忽略困难地形" value={String(value.ignoreDifficultTerrain === true)} options={[["false", "否"], ["true", "是"]]} onChange={(next) => patch({ ignoreDifficultTerrain: next === 'true' ? true : undefined })} /><Select label="忽略水下移动惩罚" value={String(value.ignoreUnderwaterMovementPenalty === true)} options={[["false", "否"], ["true", "是"]]} onChange={(next) => patch({ ignoreUnderwaterMovementPenalty: next === 'true' ? true : undefined })} /><Select label="忽略水下攻击惩罚" value={String(value.ignoreUnderwaterAttackPenalty === true)} options={[["false", "否"], ["true", "是"]]} onChange={(next) => patch({ ignoreUnderwaterAttackPenalty: next === 'true' ? true : undefined })} /></>}
      {value.kind === 'environmental-capability' && <Select label="可占据生物空间" value={String(value.occupyCreatureSpaces === true)} options={[["false", "否"], ["true", "是"]]} onChange={(next) => patch({ occupyCreatureSpaces: next === 'true' ? true : undefined })} />}
      {value.kind === 'environmental-capability' && <NumberInput label="可穿狭缝下限（英寸）" value={value.minimumPassageGapInches ?? 0} min={0} onChange={(next) => patch({ minimumPassageGapInches: next > 0 ? next : undefined })} />}
      {value.kind === 'tracking-capability' && <p className="self-end pb-2 text-xs text-slate-400">目标不会留下足迹或其他踪迹，无法被非魔法手段追踪。</p>}
      {value.kind === 'emitted-light' && <><NumberInput label="明亮光照（尺）" value={value.brightRadiusFeet} min={0} onChange={(brightRadiusFeet) => patch({ brightRadiusFeet })} /><NumberInput label="额外微光（尺）" value={value.dimRadiusFeet} min={0} onChange={(dimRadiusFeet) => patch({ dimRadiusFeet })} /><Input label="颜色（#RRGGBB）" value={value.color} onChange={(color) => patch({ color })} /></>}
      {(value.kind === 'see-invisible' || value.kind === 'prohibit-reaction' || value.kind === 'forced-flee-from-source' || value.kind === 'ignore-magical-speed-reductions') && <p className="self-end pb-2 text-xs text-slate-400">此 Modifier 无需额外参数。</p>}
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
  const setRequiredSourceEffect = (raw: string) => {
    const sourceRequiresEffect = raw.trim() || undefined
    const sourceLink = { ...(value.sourceLink ?? {}), sourceRequiresEffect }
    patch({
      sourceLink: Object.values(sourceLink).some((entry) => entry != null)
        ? sourceLink
        : undefined,
    })
  }
  const setSourceSpeechMaintenance = (enabled: boolean) => {
    const sourceLink = {
      ...(value.sourceLink ?? {}),
      sourceMustBeConsciousAndAbleToSpeak: enabled ? true as const : undefined,
    }
    patch({
      sourceLink: Object.values(sourceLink).some((entry) => entry != null)
        ? sourceLink
        : undefined,
    })
  }
  return <div className="rounded-xl border border-violet-400/15 bg-violet-500/[0.035] p-3"><div className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]"><Input label="Effect ID" value={value.id} onChange={(id) => patch({ id })} /><Input label="名称" value={value.name} onChange={(name) => patch({ name })} /><Select label="持续" value={value.duration.kind} options={[["instantaneous", "立即"], ["rounds", "轮数"], ["save-ends", "重复豁免结束"], ["concentration", "专注"], ["permanent", "永久"]]} onChange={(kind) => patch({ duration: kind === 'rounds' ? { kind, rounds: 1, expiresAt: 'target-turn-end' } : kind === 'save-ends' ? { kind, maximumRounds: 10, timing: 'target-turn-end', ability: 'wis', dc: { kind: 'reference', reference: { kind: 'actor-spell-save-dc' } } } : kind === 'concentration' ? { kind, maximumRounds: 10 } : { kind } as Dnd5eEffectDefinitionV1['duration'] })} /><button type="button" aria-label="删除 effect" onClick={remove} className="mt-6 rounded-xl border border-rose-400/20 px-3 text-rose-200"><Trash2 className="h-4 w-4" /></button></div><div className="mt-2"><Input label="语义标签（疾病 disease、诅咒 curse 等，逗号分隔）" value={csv(value.tags)} onChange={(raw) => patch({ tags: csvIds(raw) })} /></div>
    {(value.duration.kind === 'rounds' || value.duration.kind === 'concentration' || value.duration.kind === 'save-ends') && <div className="mt-2 grid gap-2 rounded-lg border border-white/8 p-2 md:grid-cols-3">
      {value.duration.kind === 'rounds' && <><NumberInput label="轮数" value={value.duration.rounds} min={1} onChange={(rounds) => patch({ duration: { ...value.duration, rounds } as Dnd5eEffectDefinitionV1['duration'] })} /><Select label="到期边界" value={value.duration.expiresAt} options={[["source-turn-start", "来源回合开始"], ["source-turn-end", "来源回合结束"], ["target-turn-start", "目标回合开始"], ["target-turn-end", "目标回合结束"]]} onChange={(expiresAt) => patch({ duration: { ...value.duration, expiresAt } as Dnd5eEffectDefinitionV1['duration'] })} /></>}
      {value.duration.kind === 'concentration' && <NumberInput label="最长轮数" value={value.duration.maximumRounds} min={1} onChange={(maximumRounds) => patch({ duration: { ...value.duration, maximumRounds } as Dnd5eEffectDefinitionV1['duration'] })} />}
      {value.duration.kind === 'save-ends' && <><NumberInput label="最长轮数" value={value.duration.maximumRounds} min={1} onChange={(maximumRounds) => patch({ duration: { ...value.duration, maximumRounds } as Dnd5eEffectDefinitionV1['duration'] })} /><Select label="重复豁免时机" value={value.duration.timing} options={[["target-turn-start", "目标回合开始"], ["target-turn-end", "目标回合结束"]]} onChange={(timing) => patch({ duration: { ...value.duration, timing } as Dnd5eEffectDefinitionV1['duration'] })} /><Select label="豁免属性" value={value.duration.ability} options={abilities} onChange={(ability) => patch({ duration: { ...value.duration, ability } as Dnd5eEffectDefinitionV1['duration'] })} /><Formula label="豁免 DC" id={`${value.id}.repeat-save-dc`} value={value.duration.dc} onChange={(dc) => patch({ duration: { ...value.duration, dc } as Dnd5eEffectDefinitionV1['duration'] })} /><label className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-300"><input type="checkbox" checked={value.duration.requiresSourceNotVisible === true} onChange={(event) => patch({ duration: { ...value.duration, requiresSourceNotVisible: event.target.checked || undefined } as Dnd5eEffectDefinitionV1['duration'] })} />仅在目标看不见来源时重复豁免</label></>}
    </div>}
    <div className="mt-2 grid gap-2 md:grid-cols-2"><Input label="标准状态 ID（逗号分隔）" value={csv(value.conditions)} onChange={(raw) => patch({ conditions: csvIds(raw) as Dnd5eEffectDefinitionV1['conditions'] })} /><Input label="扩展状态（可留空）" value={value.extensionCondition ?? ''} onChange={(extensionCondition) => patch({ extensionCondition: extensionCondition.trim() || undefined })} /><Input label="来源必须持续拥有 Effect ID（可留空）" value={value.sourceLink?.sourceRequiresEffect ?? ''} onChange={setRequiredSourceEffect} /><Input label="来源回合结束前必须刷新 Effect ID（可留空）" value={value.sourceLink?.sourceRequiresEffectAtSourceTurnEnd ?? ''} onChange={setMaintenanceEffect} /><label className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-300"><input type="checkbox" checked={value.sourceLink?.sourceMustBeConsciousAndAbleToSpeak === true} onChange={(event) => setSourceSpeechMaintenance(event.target.checked)} />来源必须保持清醒且能够说话</label><label className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-300"><input type="checkbox" checked={value.concentration === true} onChange={(event) => patch({ concentration: event.target.checked || undefined })} />此 Effect 受来源专注约束（可与重复豁免并存）</label></div>
    <div className="mt-2 space-y-2">{(value.modifiers ?? []).map((modifier, index) => <Modifier key={`${modifier.kind}:${index}`} value={modifier} onChange={(next) => patch({ modifiers: value.modifiers?.map((entry, itemIndex) => itemIndex === index ? next : entry) })} remove={() => patch({ modifiers: value.modifiers?.filter((_, itemIndex) => itemIndex !== index) })} />)}<button type="button" onClick={() => patch({ modifiers: [...(value.modifiers ?? []), newModifier('armor-class')] })} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-300"><Plus className="mr-1 inline h-3.5 w-3.5" />添加 Modifier</button></div>
  </div>
}

function OutcomeCard({
  value,
  checks,
  onChange,
  remove,
  canRemove,
}: {
  value: Dnd5eActivityDefinitionV1['outcomes'][number]
  checks: readonly Dnd5eActivityCheckV1[]
  onChange(value: Dnd5eActivityDefinitionV1['outcomes'][number]): void
  remove(): void
  canRemove: boolean
}) {
  const patch = (next: Partial<Dnd5eActivityDefinitionV1['outcomes'][number]>) => onChange({ ...value, ...next })
  const firstCheck = checks[0]
  const conditionKind = ['always', 'check', 'check-total'].includes(value.when.kind) ? value.when.kind : 'preserved'
  const setConditionKind = (kind: string) => {
    if (kind === 'always') patch({ when: { kind: 'always' } })
    if (kind === 'check' && firstCheck) patch({ when: { kind: 'check', checkId: firstCheck.id, result: 'success' } })
    if (kind === 'check-total' && firstCheck) {
      const maximum = firstCheck.kind === 'random-roll'
        ? firstCheck.count * firstCheck.sides + (firstCheck.modifier ?? 0)
        : 20
      patch({ when: { kind: 'check-total', checkId: firstCheck.id, minimum: 1, maximum } })
    }
  }
  const operations = (operations: readonly Dnd5eActivityOperationV1[]) => patch({ operations })
  const patchCheckOutcome = (next: Partial<Extract<Dnd5eActivityDefinitionV1['outcomes'][number]['when'], { kind: 'check' }>>) => {
    if (value.when.kind === 'check') patch({ when: { ...value.when, ...next } })
  }
  const patchCheckTotalOutcome = (next: Partial<Extract<Dnd5eActivityDefinitionV1['outcomes'][number]['when'], { kind: 'check-total' }>>) => {
    if (value.when.kind === 'check-total') patch({ when: { ...value.when, ...next } })
  }
  return <div className="space-y-3 rounded-xl border border-cyan-400/15 bg-cyan-500/[0.025] p-3">
    <div className="grid gap-2 md:grid-cols-[1fr_1fr_2fr_auto]"><Input label="Outcome ID" value={value.id} onChange={(id) => patch({ id })} /><Select label="触发结果" value={conditionKind} options={[["always", "总是"], ["check", "检定成功/失败"], ["check-total", "骰值区间"], ...(conditionKind === 'preserved' ? [["preserved", `复杂条件（${value.when.kind}，保留）`] as const] : [])]} onChange={setConditionKind} />
      {value.when.kind === 'check' && <div className="grid grid-cols-2 gap-2"><Select label="Check" value={value.when.checkId} options={checks.map((check) => [check.id, check.id] as const)} onChange={(checkId) => patchCheckOutcome({ checkId })} /><Select label="结果" value={value.when.result} options={[["success", "成功"], ["failure", "失败"], ["critical-success", "大成功"], ["critical-failure", "大失败"]]} onChange={(result) => patchCheckOutcome({ result: result as Extract<Dnd5eActivityDefinitionV1['outcomes'][number]['when'], { kind: 'check' }>['result'] })} /></div>}
      {value.when.kind === 'check-total' && <div className="grid grid-cols-3 gap-2"><Select label="Check" value={value.when.checkId} options={checks.map((check) => [check.id, check.id] as const)} onChange={(checkId) => patchCheckTotalOutcome({ checkId })} /><NumberInput label="最小值" value={value.when.minimum ?? 1} min={-1_000_000} onChange={(minimum) => patchCheckTotalOutcome({ minimum })} /><NumberInput label="最大值" value={value.when.maximum ?? 20} min={-1_000_000} onChange={(maximum) => patchCheckTotalOutcome({ maximum })} /></div>}
      {conditionKind === 'preserved' && <p className="self-end pb-2 text-[11px] text-slate-500">此条件由高级 schema 保留；选择其他类型后才会替换。</p>}
      <button type="button" aria-label="删除 outcome" disabled={!canRemove} onClick={remove} className="mt-6 rounded-xl border border-rose-400/20 px-3 text-rose-200 disabled:cursor-not-allowed disabled:opacity-30"><Trash2 className="h-4 w-4" /></button>
    </div>
    <div className="space-y-2">{value.operations.map((operation, index) => <Operation key={`${operation.id}:${index}`} value={operation} onChange={(next) => operations(value.operations.map((entry, itemIndex) => itemIndex === index ? next : entry))} remove={() => operations(value.operations.filter((_, itemIndex) => itemIndex !== index))} />)}<button type="button" onClick={() => operations([...value.operations, newOperation('damage', `operation-${value.operations.length + 1}`)])} className="text-xs text-cyan-200"><Plus className="mr-1 inline h-3.5 w-3.5" />添加 Operation</button></div>
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
    : kind === 'random-roll'
      ? { id: entry.id, rollId: entry.rollId, kind, count: 1, sides: 10, modifier: 0, scope: 'shared' }
    : { id: entry.id, rollId: entry.rollId, kind: kind as 'saving-throw' | 'ability-check' | 'skill-check' | 'concentration-check', ability: 'dex', dc: { kind: 'reference', reference: { kind: 'actor-spell-save-dc' } }, scope: 'per-target' }
  return <details open className="group rounded-2xl border border-white/8 bg-black/15"><summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 [&::-webkit-details-marker]:hidden"><span><strong className="block text-sm text-slate-100">{value.name}</strong><span className="text-[11px] text-slate-500">{value.id} · {analysis.capability.level} · {analysis.handlerIds.length} handlers</span></span><ChevronDown className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-180" /></summary>
    <div className="space-y-4 border-t border-white/8 p-4"><div className="grid gap-2 md:grid-cols-2"><Input label="Activity ID" value={value.id} onChange={(id) => patch({ id })} /><Input label="名称" value={value.name} onChange={(name) => patch({ name })} /></div>
      <div className="grid gap-2 md:grid-cols-3"><Select label="行动经济" value={value.activation.kind} options={[["action", "动作"], ["bonus-action", "附赠动作"], ["reaction", "反应"], ["free", "自由"], ["movement", "移动"], ["passive", "被动"], ["special", "特殊"]]} onChange={(kind) => patch({ activation: { kind } as Dnd5eActivityDefinitionV1['activation'] })} /><Select label="调用方式" value={value.invocation?.kind ?? 'active'} options={[["active", "主动"], ["triggered", "触发"]]} onChange={(kind) => patch({ invocation: kind === 'triggered' ? { kind: 'triggered', event: 'attack-hit', confirmation: 'actor-choice', retention: 'single-event' } : { kind: 'active', confirmation: 'actor-choice' } })} />{value.invocation?.kind === 'triggered' && <Select label="触发窗口" value={value.invocation.event} options={DND5E_ACTIVITY_LIFECYCLE_EVENTS_V1.map(({ event, stage, timing }) => [event, `${event} · ${stage}/${timing}`])} onChange={setTriggerEvent} />}</div>
      {value.invocation?.kind === 'triggered' && <Select label="限定触发来源（可留空）" value={trackedId} options={[["", "任意匹配来源"], ...tracked.map((entry) => [entry.definitionId, `${entry.kind} · ${entry.name}`] as const)]} onChange={(definitionId) => patch({ requirements: [...(value.requirements ?? []).filter((entry) => entry.kind !== 'activity-definition'), ...(definitionId ? [{ kind: 'activity-definition' as const, definitionId }] : [])] })} />}
      <section><div className="mb-2 flex items-start justify-between gap-3"><div><h4 className="text-xs font-semibold text-amber-100">触发与资格检查</h4><p className="mt-1 text-[11px] text-slate-500">全部由 Host 快照验证；可留空。多项检查采用“全部满足”。</p></div><button type="button" onClick={() => replaceEditableRequirements([...editableRequirements, newPredicate('event-source')])} className="text-xs text-amber-200"><Plus className="mr-1 inline h-3.5 w-3.5" />添加检查</button></div><div className="space-y-2">{editableRequirements.map((requirement, index) => <Predicate key={`${requirement.kind}:${index}`} value={requirement} onChange={(next) => replaceEditableRequirements(editableRequirements.map((entry, itemIndex) => itemIndex === index ? next : entry))} remove={() => replaceEditableRequirements(editableRequirements.filter((_, itemIndex) => itemIndex !== index))} />)}</div></section>
      <div className="grid gap-2 rounded-xl border border-white/8 p-3 md:grid-cols-4"><Select label="目标" value={value.target.kind} options={[["self", "自身"], ["creature", "生物"], ["area", "范围"]]} onChange={setTargetKind} />{value.target.kind !== 'self' && <Select label="关系" value={value.target.relation} options={[["ally", "友方"], ["enemy", "敌方"], ["any", "任意"]]} onChange={(relation) => value.target.kind !== 'self' && patch({ target: { ...value.target, relation } as Dnd5eActivityDefinitionV1['target'] })} />}{value.target.kind === 'creature' && <><NumberInput label="射程" value={value.target.rangeFeet ?? 0} onChange={(rangeFeet) => value.target.kind === 'creature' && patch({ target: { ...value.target, rangeFeet } })} /><NumberInput label="目标数" value={value.target.count} min={1} onChange={(count) => value.target.kind === 'creature' && patch({ target: { ...value.target, count } })} /></>}{value.target.kind === 'area' && <Select label="形状" value={value.target.shape} options={[["circle", "圆形"], ["sphere", "球形"], ["cone", "锥形"], ["line", "线形"], ["cube", "立方体"], ["cylinder", "圆柱"], ["rect", "长方形"]]} onChange={(shape) => value.target.kind === 'area' && patch({ target: { ...value.target, shape } as Dnd5eActivityDefinitionV1['target'] })} />}</div>
      <section><div className="mb-2 flex justify-between"><div><h4 className="text-xs font-semibold text-cyan-100">检定与随机表</h4><p className="mt-1 text-[11px] text-slate-500">随机表由 Host 掷骰；区间结果在下方 Outcome 中配置。</p></div><button type="button" onClick={addCheck} className="text-xs text-cyan-200"><Plus className="mr-1 inline h-3.5 w-3.5" />添加</button></div>{(value.checks ?? []).map((check, index) => <div key={`${check.id}:${index}`} className="mb-2 grid gap-2 rounded-xl border border-white/8 p-2 md:grid-cols-[1fr_1fr_2fr_auto]"><Input label="Check ID" value={check.id} onChange={(id) => patch({ checks: value.checks?.map((entry, itemIndex) => itemIndex === index ? { ...entry, id, rollId: id } as Dnd5eActivityCheckV1 : entry) })} /><Select label="类型" value={check.kind} options={[["attack-roll", "攻击"], ["saving-throw", "豁免"], ["ability-check", "属性检定"], ["skill-check", "技能"], ["concentration-check", "专注"], ["random-roll", "权威随机表"]]} onChange={(kind) => patch({ checks: value.checks?.map((entry, itemIndex) => itemIndex === index ? checkWithKind(entry, kind) : entry) })} />{check.kind === 'random-roll' ? <div className="grid grid-cols-4 gap-2"><NumberInput label="骰数" value={check.count} min={1} onChange={(count) => patch({ checks: value.checks?.map((entry, itemIndex) => itemIndex === index ? { ...check, count } : entry) })} /><NumberInput label="面数" value={check.sides} min={2} onChange={(sides) => patch({ checks: value.checks?.map((entry, itemIndex) => itemIndex === index ? { ...check, sides } : entry) })} /><NumberInput label="修正" value={check.modifier ?? 0} min={-1_000_000} onChange={(modifier) => patch({ checks: value.checks?.map((entry, itemIndex) => itemIndex === index ? { ...check, modifier } : entry) })} /><Select label="范围" value={check.scope ?? 'shared'} options={[["shared", "共享"], ["per-target", "逐目标"]]} onChange={(scope) => patch({ checks: value.checks?.map((entry, itemIndex) => itemIndex === index ? { ...check, scope: scope as 'shared' | 'per-target' } : entry) })} /></div> : 'ability' in check ? <Select label="属性" value={check.ability} options={abilities} onChange={(ability) => patch({ checks: value.checks?.map((entry, itemIndex) => itemIndex === index ? { ...entry, ability } as Dnd5eActivityCheckV1 : entry) })} /> : <span />}<button type="button" aria-label="删除 check" onClick={() => patch({ checks: value.checks?.filter((_, itemIndex) => itemIndex !== index) })} className="mt-6 rounded-xl border border-rose-400/20 px-3 text-rose-200"><Trash2 className="h-4 w-4" /></button></div>)}</section>
      <section><div className="mb-2 flex justify-between"><div><h4 className="text-xs font-semibold text-cyan-100">Outcomes / Operations</h4><p className="mt-1 text-[11px] text-slate-500">每个骰值区间建立一个 Outcome；Host 只执行命中的分支。</p></div><button type="button" onClick={() => patch({ outcomes: [...value.outcomes, { id: `outcome-${value.outcomes.length + 1}`, when: { kind: 'always' }, operations: [newOperation('damage', 'operation-1')] }] })} className="text-xs text-cyan-200"><Plus className="mr-1 inline h-3.5 w-3.5" />添加结果</button></div><div className="space-y-2">{value.outcomes.map((entry, index) => <OutcomeCard key={`${entry.id}:${index}`} value={entry} checks={value.checks ?? []} onChange={(next) => patch({ outcomes: value.outcomes.map((candidate, itemIndex) => itemIndex === index ? next : candidate) })} remove={() => patch({ outcomes: value.outcomes.filter((_, itemIndex) => itemIndex !== index) })} canRemove={value.outcomes.length > 1} />)}</div></section>
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
