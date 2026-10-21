import { expect, it } from 'vitest'
import { DND5E_PLUGIN_CONTENT_CATEGORIES } from '../../../shared/plugin-content-category.mjs'
import { dnd5eLocalContentAiSdkGuide } from './localContentAiSdkGuide'
import { DND5E_DAMAGE_TYPES } from './damageTypes'
import { DND5E_GRANTED_SPELL_AUTHORING_EXAMPLE } from './activities/dnd5eGrantedSpellAuthoringExample'
import { DND5E_RACIAL_STATIC_RESOURCES } from './racialResourceCatalog'

it.each(['spell', 'feat', 'feature', 'subclass'])('includes actual racial resource references in the %s conversion contract', kind => {
  const guide = dnd5eLocalContentAiSdkGuide(kind, 'Spend an existing resource.')
  for (const resource of Object.values(DND5E_RACIAL_STATIC_RESOURCES)) expect(guide).toContain(JSON.stringify(resource))
  expect(guide).toContain('仅证明ID存在，不授予角色资格')
  expect(guide).toContain('不额外执行吐息伤害')
})
import activityContracts from './activities/dnd5eActivityContracts.ts?raw'
import effectContracts from './activities/dnd5eEffectContracts.ts?raw'

it.each(['feature', 'feat', 'auto'])('allows level-free direct Activities without inventing prerequisites (%s)', kind => {
  const guide = dnd5eLocalContentAiSdkGuide(kind, 'A standalone ability without a stated acquisition level.')
  expect(guide).toContain('Activity 本身不要求职业归属、获得等级或资源')
  expect(guide).toContain('只在原文明确时声明 minimumLevel、classRequirements、资源及消耗')
  expect(guide).toContain('能够绑定 Activity 不等于该特性已完整自动化')
})

it.each(['spell', 'feature'])('includes authorable direct Activity and Effect dependencies for %s', targetKind => {
  const guide = dnd5eLocalContentAiSdkGuide(targetKind, 'An area grants a creature an effect.')
  const names = [activityContracts, effectContracts].flatMap(source =>
    [...source.matchAll(/import type\s*\{([^}]+)\}\s*from/gu)].flatMap(match =>
      match[1].split(',').map(name => name.trim()).filter(Boolean)))
  // This dependency is used solely inside Host-only authorityBinding, which AI
  // authoring explicitly forbids. It does not justify exposing all subclass code.
  if (targetKind === 'spell') expect(guide).toContain('禁止生成 authorityBinding')
  const missing = [...new Set(names)].filter(name => !(targetKind === 'spell' && name === 'DeclarativeSubclassAbilityV1')).filter(name =>
    !new RegExp(`export (?:type|interface) ${name}\\b`).test(guide) &&
    !new RegExp(`\\b${name}=`).test(guide))
  expect(missing).toEqual([])
})

it.each(['spell', 'feature', 'focused-feature'])('expands inline Activity type dependencies in the %s conversion contract', targetKind => {
  const guide = dnd5eLocalContentAiSdkGuide(targetKind === 'focused-feature' ? 'feature' : targetKind,
    'A creature receives an ongoing effect.', targetKind === 'focused-feature'
      ? { mechanics: [], needsActivities: true, needsAreas: false } : undefined)
  const referenced = [...activityContracts.matchAll(/import\(['"][^'"]+['"]\)\.(\w+)/gu)].map(match => match[1])
  expect(referenced.length).toBeGreaterThan(0)
  const missing = [...new Set(referenced)].filter(name => !new RegExp(`export (?:type|interface) ${name}\\b`).test(guide))
  expect(missing, 'Missing inline Activity type definitions').toEqual([])
  expect(guide).toContain('export const SYMBOL_MODES')
  expect(guide).toContain("unit: 'round' | 'minute'")
})

it('exposes source-bound summon death while preserving lifecycle and missing-data boundaries', () => {
  const guide = dnd5eLocalContentAiSdkGuide('spell', 'The companion dies when its creator dies.')
  expect(guide).toContain('summon.sourceDeathBehavior:"die"')
  expect(guide).toContain('昏迷不触发')
  expect(guide).toContain('来源缺失不是死亡证据')
  expect(guide).toContain('此字段不提供缺失的怪物数据')
})

it('describes the existing damage checkpoint without inventing reaction spell slot support', () => {
  const guide = dnd5eLocalContentAiSdkGuide('spell', 'A reaction when taking damage.')
  expect(guide).toContain('before-damage 暂停、控制者确认及原子恢复窗口')
  expect(guide).toContain('职业反应法术的 spell-slot 选择')
  expect(guide).toContain('同步 prepared 地图结算入口支持将施放时消耗的材料与 HP、环位合并到同一 application')
  expect(guide).toContain('不能删除法术位消耗')
  expect(guide).not.toContain('尚不产生可暂停伤害的 before-damage')
})

it('includes the executable grant lifecycle example rather than independent orphan actions', () => {
  const guide = dnd5eLocalContentAiSdkGuide('spell', 'Grants a bonus action for the duration.')
  expect(guide).toContain(JSON.stringify(DND5E_GRANTED_SPELL_AUTHORING_EXAMPLE))
  expect(guide).toContain('施放 outcome 必须实际 apply-effect')
  expect(guide).toContain('不能机械地给所有活动加 requiresEffectGrant')
})

it('offers the authenticated preparation workflow without treating ordinary time advances as completion', () => {
  const guide = dnd5eLocalContentAiSdkGuide('feature', '持续交谈后获得针对原听者的一次性能力。')
  expect(guide).toContain('Host 原子推进时间、结束准备并发放授权')
  expect(guide).toContain('普通推进时间会打断未确认准备')
  expect(guide).toContain('singleUse:true')
  expect(guide).toContain('requiresEffectGrant:true')
  expect(guide).toContain('玩家不能自行提交完成证明')
  expect(guide).toContain('私密性及交谈内容仍是 DM 事实裁定')
  expect(guide).not.toContain('暂不支持时间跳跃完成')
})

it('distinguishes defender-side weapon delivery from spell attacks and item classification',()=>{
  const guide=dnd5eLocalContentAiSdkGuide('spell','Ranged weapon attacks against you have disadvantage.')
  expect(guide).toContain('weapon-attacks-against-target')
  expect(guide).toContain('不影响法术攻击')
  expect(guide).toContain('本次ranged投掷')
  expect(guide).toContain('坠落预检与原子结算')
  expect(guide).toContain('保留其他有效飞行来源')
})

it('explains composing all-type immunity from the actual closed damage vocabulary',()=>{
  const guide=dnd5eLocalContentAiSdkGuide('spell','免疫所有伤害。')
  expect(guide).toContain('不要求发明单一all字段')
  expect(guide).toContain(DND5E_DAMAGE_TYPES.join(', '))
})

it('documents target-bounded chains without inventing a rules limit',()=>{
  const guide=dnd5eLocalContentAiSdkGuide('spell','An attack jumps to a new creature on matching dice.')
  expect(guide).toContain('"distinct-targets"')
  expect(guide).toContain('不要虚构64次')
  expect(guide).toContain('每次重新掷伤害时不要 carryRolls')
  expect(guide).toContain('从上一目标量距')
  expect(guide).toContain('必须合成一个 damage 操作')
  expect(guide).toContain('d6 放在 add.values 的第一项')
})

it('includes temporary expertise and closed skill choices in spell conversion guidance',()=>{
  const guide=dnd5eLocalContentAiSdkGuide('spell','A willing creature gains temporary expertise.')
  expect(guide).toContain('持续时间内授予技能专精')
  expect(guide).toContain('skill-proficiency')
  expect(guide).toContain('sleightOfHand')
  expect(guide).toContain('不需要运行时字符串替换')
})

it('includes the imported effect-die type and per-check semantics for conversion',()=>{
  const guide=dnd5eLocalContentAiSdkGuide('spell','Each saving throw subtracts a fresh d6.')
  expect(guide).toContain('export interface Dnd5eRollDiceModifier')
  expect(guide).toContain('kind:"roll-dice"')
  expect(guide).toContain('不要把该 d6 在施放时投一次保存成固定加值')
  expect(guide).toContain('saving-throw 包含维持专注豁免')
  expect(guide).toContain('maximumTargets 可省略')
})

it('retains feature grants and static capabilities in focused subclass conversion context', () => {
  const guide = dnd5eLocalContentAiSdkGuide('subclass', 'Synthetic passive.', { mechanics: [], needsActivities: false, needsAreas: false })
  expect(guide).toContain('export interface Dnd5ePluginFeatureDefinition')
  expect(guide).toContain('standFromProneMovementCostFeet?: number')
  expect(guide).toContain('grants:[{kind:"feature",featureId:')
})

it.each(['spell', 'subclass', 'feat', 'feature'])('gives %s conversions the real Host manifest category enum', kind => {
  const guide = dnd5eLocalContentAiSdkGuide(kind, 'A custom ability.')
  expect(guide).toContain(`合法 ID 仅为 ${DND5E_PLUGIN_CONTENT_CATEGORIES.map(category => category.id).join('|')}`)
  expect(guide).toContain('子职使用 subclasses')
  expect(guide).toContain('公式 dice 已按 rollId')
})

it('distinguishes independent feature prerequisites from subclass ownership', () => {
  const guide = dnd5eLocalContentAiSdkGuide('feature', 'Synthetic invocation.', { mechanics: [], needsActivities: false, needsAreas: false })
  expect(guide).toContain('sourceClassId/sourceSubclassId/grantedBySubclass')
  expect(guide).toContain('PDF 跨栏、跨页正文可能夹入页眉、旁白')
})

it('explains independent area timings, fixed placement and recurring damage scaling', () => {
  const guide = dnd5eLocalContentAiSdkGuide('spell', 'Synthetic persistent hazard.')
  expect(guide).toContain('diceCountPerStep 会增加该操作所有 triggers.damage.count')
  expect(guide).toContain('on-enter 与 turn-end 使用不同 id 并省略 frequencyGroupId')
  expect(guide).toContain('anchorMode 使用 fixed（或省略）')
})
