import { useState } from 'react'
import { Check, CircleGauge, Dices, GraduationCap, Shield, Sparkles } from 'lucide-react'
import { ABILITIES, SKILLS } from '../../lib/dnd'
import { classResourceDefinitions, getClassResource } from '../../lib/classResources'
import {
  dnd5eAllClassChoiceGroups,
  dnd5eAvailableCombatSpells,
  dnd5eBardMagicalSecretsLimit,
  dnd5eBardMagicalSecretsMaxSpellLevel,
  dnd5eBardMagicalSecretsOptions,
  dnd5eBarbarianRageDamage,
  dnd5eBarbarianBrutalCriticalDice,
  dnd5eBardicInspirationDie,
  dnd5eBardSongOfRestDie,
  dnd5eClericDestroyUndeadCr,
  dnd5eClassChoiceLimit,
  dnd5eClassChoiceOptionAvailable,
  dnd5eClassDefinitionForCharacter,
  dnd5eClassProgression,
  dnd5eCombatSpellSelectionLimits,
  dnd5eMonkMartialArtsDie,
  dnd5eLoreAdditionalMagicalSecretsLimit,
  dnd5ePaladinAuraRadius,
  dnd5ePreparedSpellCount,
  dnd5ePactSlotLevel,
  dnd5eRogueSneakAttackDice,
  dnd5eSpellAttackModifier,
  dnd5eSpellSelectionKey,
  dnd5eSpellSaveDc,
  dnd5eDruidWildShapeLimits,
  dnd5eWizardArcaneRecoveryLevels,
  dnd5eAvailableWildShapeForms,
  dnd5eMonsterSpeedText,
  dnd5eWarlockMysticArcanumOptions,
  getDnd5eSrdCombatSpell,
  dnd5eSpellSlotRecoveryFeature,
  dnd5eSpellSlotRecoveryLimit,
  applyDnd5eSpellSlotRecovery,
  applyDnd5eEldritchMaster,
  dnd5eWildShapeDurationHours,
  DND5E_WILD_SHAPE_KNOWN_FORMS_KEY,
  DND5E_BARD_MAGICAL_SECRETS_KEY,
  DND5E_LORE_ADDITIONAL_MAGICAL_SECRETS_KEY,
  dnd5ePluginSubclassDefinition,
  registeredDnd5ePluginSubclasses,
  type Dnd5eClassChoiceGroup,
} from '../../rulesets/dnd5e'
import type { Character } from '../../types/character'

interface Dnd5eClassProgressionPanelProps {
  character: Character
  onChange: (patch: Partial<Character>) => void
}

const SPELLCASTING_KIND_LABELS = {
  'full-known': '完整施法者（已知法术）',
  'full-prepared': '完整施法者（准备法术）',
  'half-known': '半施法者（已知法术）',
  'half-prepared': '半施法者（准备法术）',
  pact: '契约魔法',
} as const

function abilityLabel(key: string): string {
  return ABILITIES.find((ability) => ability.key === key)?.label ?? key.toUpperCase()
}

function resetLabel(reset: 'combat' | 'short-rest' | 'long-rest'): string {
  if (reset === 'short-rest') return '短休或长休恢复'
  if (reset === 'long-rest') return '长休恢复'
  return '战斗开始时恢复'
}

export default function Dnd5eClassProgressionPanel({ character, onChange }: Dnd5eClassProgressionPanelProps) {
  const definition = dnd5eClassDefinitionForCharacter(character)
  if (!definition || definition.id === 'fighter') return null

  const stored = character.dnd5eClassChoices?.classes?.[definition.id] ?? {}
  const selectedSubclass = stored.subclass
  const selectedPluginSubclass = selectedSubclass ? dnd5ePluginSubclassDefinition(selectedSubclass) : undefined
  const pluginSubclassOptions = registeredDnd5ePluginSubclasses(definition.id)
  const subclassUnlocked = character.level >= definition.subclassLevel
  const progression = dnd5eClassProgression(definition)
  const classSkillKeys = definition.skillProficiencies === 'any'
    ? SKILLS.map((skill) => skill.key)
    : definition.skillProficiencies
  const classSkillGroup: Dnd5eClassChoiceGroup = {
    id: 'class-skills',
    level: 1,
    name: '起始职业技能',
    description: `从本职业允许的技能中选择 ${definition.skillChoiceCount} 项；这些选择会同步到人物卡的技能熟练。`,
    maxSelections: definition.skillChoiceCount,
    options: classSkillKeys.map((key) => {
      const skill = SKILLS.find((candidate) => candidate.key === key)
      return { id: key, name: skill?.label ?? key, summary: `${abilityLabel(skill?.ability ?? '')}技能` }
    }),
  }
  const pluginChoiceGroups: Dnd5eClassChoiceGroup[] = (selectedPluginSubclass?.choiceGroups ?? []).map((group) => ({
    ...group,
    id: `${selectedPluginSubclass!.id}/${group.id}`,
    options: group.options.map((option) => ({ ...option })),
  }))
  const groups = [classSkillGroup, ...dnd5eAllClassChoiceGroups(definition), ...pluginChoiceGroups]
    .filter((group) => character.level >= group.level)
    .filter((group) =>
      group === classSkillGroup || pluginChoiceGroups.includes(group) ||
      definition.choiceGroups?.includes(group) || selectedSubclass === definition.subclass.id,
    )
  const resources = classResourceDefinitions(character)
    .map((resourceDefinition) => ({
      definition: resourceDefinition,
      state: getClassResource(character, resourceDefinition.key),
    }))
    .filter((entry) => entry.state)
  const subclassSpellLists = selectedSubclass === definition.subclass.id
    ? (definition.subclass.spellLists ?? []).filter((list) => !list.choiceOptionId || (stored.selections?.['land-terrain'] ?? []).includes(list.choiceOptionId))
    : []
  const availableCombatSpells = dnd5eAvailableCombatSpells(character)
  const combatSpellLimits = dnd5eCombatSpellSelectionLimits(character)
  const leveledSpellSelectionKey = dnd5eSpellSelectionKey(character)
  const availableWildShapeForms = dnd5eAvailableWildShapeForms(character)

  const setClassChoices = (next: typeof stored, skills?: string[]) => {
    onChange({
      dnd5eClassChoices: {
        ...character.dnd5eClassChoices,
        classes: {
          ...character.dnd5eClassChoices?.classes,
          [definition.id]: next,
        },
      },
      ...(skills ? { skills } : {}),
    })
  }

  const setSubclass = (subclass?: string) => {
    setClassChoices({ ...stored, subclass })
  }

  const toggleChoice = (group: Dnd5eClassChoiceGroup, optionId: string) => {
    const allowed = new Set(group.options.map((option) => option.id))
    const current = [...new Set(stored.selections?.[group.id] ?? [])].filter((id) => allowed.has(id))
    const selected = current.includes(optionId)
    const option = group.options.find((candidate) => candidate.id === optionId)
    if (!selected && option && !dnd5eClassChoiceOptionAvailable(character, definition.id, option)) return
    const limit = dnd5eClassChoiceLimit(group, character.level)
    if (!selected && current.length >= limit) return
    const next = selected ? current.filter((id) => id !== optionId) : [...current, optionId]
    const grantsSkillProficiency = group.id === 'class-skills' || group.id === 'lore-bonus-skills'
    const nextSkills = grantsSkillProficiency
      ? (selected
          ? character.skills.filter((skill) => skill !== optionId)
          : [...new Set([...character.skills, optionId])])
      : undefined
    setClassChoices({
      ...stored,
      selections: { ...stored.selections, [group.id]: next },
    }, nextSkills)
  }

  const toggleCombatSpell = (spellId: string, cantrip: boolean) => {
    const selectionKey = cantrip ? 'spell-cantrips' : leveledSpellSelectionKey
    if (!selectionKey) return
    const current = [...new Set(stored.selections?.[selectionKey] ?? [])]
    const selected = current.includes(spellId)
    const limit = cantrip ? combatSpellLimits.cantrips : combatSpellLimits.spells
    if (!selected && current.length >= limit) return
    setClassChoices({
      ...stored,
      selections: {
        ...stored.selections,
        [selectionKey]: selected ? current.filter((id) => id !== spellId) : [...current, spellId],
      },
    })
  }

  const toggleKnownWildShapeForm = (formId: string) => {
    const current = [...new Set(stored.selections?.[DND5E_WILD_SHAPE_KNOWN_FORMS_KEY] ?? [])]
    const selected = current.includes(formId)
    setClassChoices({
      ...stored,
      selections: {
        ...stored.selections,
        [DND5E_WILD_SHAPE_KNOWN_FORMS_KEY]: selected
          ? current.filter((id) => id !== formId)
          : [...current, formId],
      },
    })
  }

  const setFeatureSpellSelection = (key: string, spellIds: readonly string[]) => {
    setClassChoices({
      ...stored,
      selections: {
        ...stored.selections,
        [key]: [...new Set(spellIds.filter(Boolean))],
      },
    })
  }

  const extraMetrics = classMetrics(character)

  return (
    <section className="glass rounded-2xl p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-arcane-300" />
            <h3 className="text-lg font-bold text-slate-100">{definition.name}职业特性</h3>
          </div>
          <p className="mt-1 text-sm text-slate-500">D&amp;D 5e 2014 · SRD 5.1 中文翻译 · {character.level} 级</p>
        </div>
        <label className="flex w-full flex-col gap-1 xl:w-[280px]">
          <span className="text-xs font-semibold text-slate-500">{subclassLabel(definition.name)}（{definition.subclassLevel}级）</span>
          <select
            value={selectedSubclass ?? ''}
            disabled={!subclassUnlocked}
            onChange={(event) => setSubclass(event.target.value || undefined)}
            className="rounded-lg border border-white/10 bg-void-900/70 px-3 py-2 text-sm text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">{subclassUnlocked ? '尚未选择' : `${definition.subclassLevel}级解锁`}</option>
            <option value={definition.subclass.id}>{definition.subclass.name}</option>
            {pluginSubclassOptions.map((subclass) => (
              <option key={subclass.id} value={subclass.id}>{subclass.name} · {subclass.ownerPluginName}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Summary icon={Dices} label="生命骰" value={`d${definition.hitDie}`} />
        <Summary icon={Sparkles} label="主要属性" value={definition.primaryAbilities.map(abilityLabel).join('、')} />
        <Summary icon={Shield} label="豁免熟练" value={definition.savingThrows.map(abilityLabel).join('、')} />
        <Summary icon={GraduationCap} label="技能选择" value={`从职业技能中选择 ${definition.skillChoiceCount} 项`} />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <InfoBlock title="护甲熟练" text={definition.armorProficiencies} />
        <InfoBlock title="武器熟练" text={definition.weaponProficiencies} />
      </div>

      {selectedSubclass === definition.subclass.id && (
        <div className="mt-4 rounded-xl border border-arcane-500/20 bg-arcane-500/5 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-arcane-200">{definition.subclass.name}</span>
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-slate-500">SRD 5.1</span>
          </div>
          <p className="mt-1 text-sm text-slate-400">{definition.subclass.summary}</p>
        </div>
      )}

      {selectedPluginSubclass && (
        <div className="mt-4 rounded-xl border border-violet-400/25 bg-violet-500/5 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-violet-100">{selectedPluginSubclass.name}</span>
            <span className="rounded-full border border-violet-300/20 px-2 py-0.5 text-[10px] text-violet-200">
              {selectedPluginSubclass.ownerPluginName} · {selectedPluginSubclass.ownerPluginLicense}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">{selectedPluginSubclass.summary}</p>
          <p className="mt-2 text-[11px] text-amber-200/70">第三方规则包内容；平台核心包不将其标记为 SRD 5.1。</p>
        </div>
      )}

      {subclassSpellLists.map((list) => (
        <div key={list.id} className="mt-3 rounded-xl border border-violet-400/20 bg-violet-500/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-violet-100">{list.name}</h4>
            <span className="text-[10px] text-slate-500">{list.mode === 'always-prepared' ? '始终准备，不计入准备数量' : '加入可选法术列表，不会自动学会'}</span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {list.entries.map((entry) => (
              <InfoBlock key={entry.classLevel} title={`${entry.classLevel}级`} text={entry.spells.join('、')} />
            ))}
          </div>
        </div>
      ))}

      {definition.id === 'druid' && character.level >= 2 && (
        <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-500/5 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h4 className="text-sm font-semibold text-emerald-100">荒野变形 · 已见过的形态</h4>
              <p className="mt-1 text-xs text-slate-500">只能选择当前等级合法且角色曾见过的野兽；每次持续至多 {dnd5eWildShapeDurationHours(character.level)} 小时。</p>
            </div>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-100">
              已记录 {stored.selections?.[DND5E_WILD_SHAPE_KNOWN_FORMS_KEY]?.length ?? 0} 种
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {availableWildShapeForms.map((form) => {
              const selected = stored.selections?.[DND5E_WILD_SHAPE_KNOWN_FORMS_KEY]?.includes(form.id) === true
              return <label key={form.id} className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 ${selected ? 'border-emerald-300/35 bg-emerald-400/10' : 'border-white/8 bg-black/10'}`}>
                <input type="checkbox" checked={selected} onChange={() => toggleKnownWildShapeForm(form.id)} className="mt-1" />
                <span>
                  <strong className="text-xs text-slate-200">{form.name}</strong>
                  <span className="ml-1 text-[10px] text-slate-500">CR {form.challenge.rating} · AC {form.armorClass.value} · HP {form.hitPoints.average}</span>
                  <span className="mt-1 block text-[11px] leading-4 text-slate-500">速度：{dnd5eMonsterSpeedText(form)} · {form.englishName}</span>
                </span>
              </label>
            })}
          </div>
        </div>
      )}

      {definition.spellcasting && (
        <div className="mt-4 rounded-xl border border-violet-400/20 bg-violet-500/5 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h4 className="text-sm font-semibold text-violet-100">施法</h4>
              <p className="mt-1 text-xs text-slate-500">
                {SPELLCASTING_KIND_LABELS[definition.spellcasting.kind]} · 施法属性：{abilityLabel(definition.spellcasting.ability)} ·
                法器：{definition.spellcasting.focus} · 仪式施法：{definition.spellcasting.ritualCasting ? '可以' : '不可以'}
              </p>
            </div>
            {definition.spellcasting.kind === 'pact' && (
              <span className="rounded-full bg-violet-500/10 px-2.5 py-1 text-xs font-semibold text-violet-100">
                当前法术位环级：{dnd5ePactSlotLevel(character.level)}环
              </span>
            )}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {spellcastingSummary(definition.spellcasting.kind, progression[character.level - 1], character).map((item) => (
              <InfoBlock key={item.label} title={item.label} text={item.value} />
            ))}
          </div>
          <div className="mt-4 border-t border-violet-300/10 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h5 className="text-sm font-semibold text-violet-100">已接入 Headless 的 SRD 战斗法术</h5>
              <span className="text-[10px] text-slate-500">戏法 {stored.selections?.['spell-cantrips']?.length ?? 0}/{combatSpellLimits.cantrips} · 法术 {leveledSpellSelectionKey ? stored.selections?.[leveledSpellSelectionKey]?.length ?? 0 : 0}/{combatSpellLimits.spells}</span>
            </div>
            {availableCombatSpells.length > 0 ? <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {availableCombatSpells.map((spell) => {
                const selectionKey = spell.level === 0 ? 'spell-cantrips' : leveledSpellSelectionKey
                const selected = !!selectionKey && stored.selections?.[selectionKey]?.includes(spell.id) === true
                const limit = spell.level === 0 ? combatSpellLimits.cantrips : combatSpellLimits.spells
                const count = selectionKey ? stored.selections?.[selectionKey]?.length ?? 0 : 0
                return <label key={spell.id} className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 ${selected ? 'border-violet-300/35 bg-violet-400/10' : 'border-white/8 bg-black/10'}`}>
                  <input
                    type="checkbox"
                    checked={selected}
                    disabled={!selected && count >= limit}
                    onChange={() => toggleCombatSpell(spell.id, spell.level === 0)}
                    className="mt-1"
                  />
                  <span><strong className="text-xs text-slate-200">{spell.name}</strong><span className="ml-1 text-[10px] text-slate-500">{spell.level === 0 ? '戏法' : `${spell.level}环`}</span><span className="mt-1 block text-[11px] leading-4 text-slate-500">{spell.description}</span></span>
                </label>
              })}
            </div> : <p className="mt-2 text-xs text-slate-500">当前等级暂无已接入地图结算的战斗法术。</p>}
          </div>
        </div>
      )}

      {definition.id === 'bard' && (dnd5eBardMagicalSecretsLimit(character) > 0 || dnd5eLoreAdditionalMagicalSecretsLimit(character) > 0) && (() => {
        const coreLimit = dnd5eBardMagicalSecretsLimit(character)
        const loreLimit = dnd5eLoreAdditionalMagicalSecretsLimit(character)
        const maxSpellLevel = dnd5eBardMagicalSecretsMaxSpellLevel(character)
        const options = dnd5eBardMagicalSecretsOptions(maxSpellLevel)
        const core = [...new Set(stored.selections?.[DND5E_BARD_MAGICAL_SECRETS_KEY] ?? [])].slice(0, coreLimit)
        const lore = [...new Set(stored.selections?.[DND5E_LORE_ADDITIONAL_MAGICAL_SECRETS_KEY] ?? [])].slice(0, loreLimit)
        const ordinary = new Set([
          ...(stored.selections?.['spell-cantrips'] ?? []),
          ...(stored.selections?.['spell-known'] ?? []),
        ])
        const renderSecretSlots = (key: string, label: string, limit: number, selected: string[]) => (
          <div>
            <h5 className="text-xs font-semibold text-fuchsia-100">{label} · {selected.length}/{limit}</h5>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {Array.from({ length: limit }, (_, index) => {
                const value = selected[index] ?? ''
                return <label key={`${key}-${index}`} className="text-xs text-slate-400">第 {index + 1} 个法术
                  <select
                    value={value}
                    onChange={(event) => {
                      const next = [...selected]
                      if (event.target.value) next[index] = event.target.value
                      else next.splice(index, 1)
                      setFeatureSpellSelection(key, next)
                    }}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-void-900 px-3 py-2 text-sm text-slate-200"
                  >
                    <option value="">尚未选择</option>
                    {options.map((spell) => {
                      const combatSpell = getDnd5eSrdCombatSpell(spell.id)
                      const usedElsewhere = ordinary.has(spell.id) || core.includes(spell.id) || lore.includes(spell.id)
                      return <option key={spell.id} value={spell.id} disabled={usedElsewhere && spell.id !== value}>
                        {spell.level === 0 ? '戏法' : `${spell.level}环`} · {spell.name}{combatSpell ? ' · Headless' : ' · DM裁定'}
                      </option>
                    })}
                  </select>
                </label>
              })}
            </div>
          </div>
        )
        return <div className="mt-4 rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/5 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h4 className="text-sm font-semibold text-fuchsia-100">魔法奥秘</h4>
              <p className="mt-1 text-xs leading-5 text-slate-500">从任意 SRD 5.1 职业法表选择戏法或当前可施放环级（最高 {maxSpellLevel} 环）的法术。标有“Headless”的法术可直接在地图结算；其余选择会被保存并交由 DM 按规则裁定。</p>
            </div>
            <span className="rounded-full bg-fuchsia-500/10 px-2.5 py-1 text-xs font-semibold text-fuchsia-100">施法属性：魅力</span>
          </div>
          <div className="mt-3 space-y-4">
            {coreLimit > 0 && renderSecretSlots(DND5E_BARD_MAGICAL_SECRETS_KEY, '职业魔法奥秘（计入已知法术总数）', coreLimit, core)}
            {loreLimit > 0 && renderSecretSlots(DND5E_LORE_ADDITIONAL_MAGICAL_SECRETS_KEY, '逸闻学院额外魔法奥秘（不计入已知法术总数）', loreLimit, lore)}
          </div>
        </div>
      })()}

      {definition.id === 'warlock' && character.level >= 11 && (() => {
        const unlocked = ([6, 7, 8, 9] as const).filter((spellLevel) =>
          character.level >= ({ 6: 11, 7: 13, 8: 15, 9: 17 } as const)[spellLevel],
        )
        return <div className="mt-4 rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/5 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h4 className="text-sm font-semibold text-fuchsia-100">秘法奥秘</h4>
              <p className="mt-1 text-xs leading-5 text-slate-500">每个已解锁环级选择一个 SRD 5.1 邪术师法术；每次长休后可各自免法术位施放一次。标有“Headless”的法术可直接在地图结算，其余法术保留选择并由 DM 按规则裁定。</p>
            </div>
            <span className="rounded-full bg-fuchsia-500/10 px-2.5 py-1 text-xs font-semibold text-fuchsia-100">长休恢复</span>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {unlocked.map((spellLevel) => {
              const key = `mystic-arcanum-${spellLevel}`
              const selected = stored.selections?.[key]?.[0] ?? ''
              const options = dnd5eWarlockMysticArcanumOptions(spellLevel)
              const ready = selected ? !!getDnd5eSrdCombatSpell(selected) : false
              return <label key={spellLevel} className="text-xs text-slate-400">秘法奥秘 · {spellLevel}环
                <select
                  value={selected}
                  onChange={(event) => setFeatureSpellSelection(key, event.target.value ? [event.target.value] : [])}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-void-900 px-3 py-2 text-sm text-slate-200"
                >
                  <option value="">尚未选择</option>
                  {options.map((spell) => <option key={spell.id} value={spell.id}>
                    {spell.name}（{spell.englishName}）{getDnd5eSrdCombatSpell(spell.id) ? ' · Headless' : ' · DM裁定'}
                  </option>)}
                </select>
                {selected ? <span className={`mt-1 block text-[10px] ${ready ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {ready ? '已接入地图动作、每日资源与 DM 权威结算。' : '已保存此选择；当前地图不会伪造自动效果，由 DM 按 SRD 规则裁定。'}
                </span> : null}
              </label>
            })}
          </div>
        </div>
      })()}

      {definition.id === 'wizard' && character.level >= 18 && (() => {
        const masteryOneOptions = availableCombatSpells.filter((spell) => spell.level === 1)
        const masteryTwoOptions = availableCombatSpells.filter((spell) => spell.level === 2)
        const signatureOptions = availableCombatSpells.filter((spell) => spell.level === 3)
        const masteryOne = stored.selections?.['spell-mastery-1']?.[0] ?? ''
        const masteryTwo = stored.selections?.['spell-mastery-2']?.[0] ?? ''
        const signatures = [...new Set(stored.selections?.['signature-spells'] ?? [])].slice(0, 2)
        return <div className="mt-4 rounded-xl border border-sky-400/20 bg-sky-500/5 p-4">
          <div>
            <h4 className="text-sm font-semibold text-sky-100">高阶法师法术</h4>
            <p className="mt-1 text-xs leading-5 text-slate-500">所选法术由 Headless 重新验证。法术精通以最低环级无限施放；招牌法术始终准备，每个法术每次短休可免法术位施放一次。</p>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-slate-400">法术精通 · 1环
              <select
                value={masteryOne}
                onChange={(event) => setFeatureSpellSelection('spell-mastery-1', event.target.value ? [event.target.value] : [])}
                className="mt-1 w-full rounded-lg border border-white/10 bg-void-900 px-3 py-2 text-sm text-slate-200"
              >
                <option value="">尚未选择</option>
                {masteryOneOptions.map((spell) => <option key={spell.id} value={spell.id}>{spell.name}</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-400">法术精通 · 2环
              <select
                value={masteryTwo}
                onChange={(event) => setFeatureSpellSelection('spell-mastery-2', event.target.value ? [event.target.value] : [])}
                className="mt-1 w-full rounded-lg border border-white/10 bg-void-900 px-3 py-2 text-sm text-slate-200"
              >
                <option value="">尚未选择</option>
                {masteryTwoOptions.map((spell) => <option key={spell.id} value={spell.id}>{spell.name}</option>)}
              </select>
            </label>
          </div>
          {character.level >= 20 ? <div className="mt-4 border-t border-sky-300/10 pt-3">
            <div className="flex items-center justify-between gap-2">
              <h5 className="text-xs font-semibold text-sky-100">招牌法术 · 选择两个3环法术</h5>
              <span className="text-[10px] text-slate-500">已选 {signatures.length}/2</span>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {signatureOptions.map((spell) => {
                const selected = signatures.includes(spell.id)
                return <label key={spell.id} className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 ${selected ? 'border-sky-300/35 bg-sky-400/10' : 'border-white/8 bg-black/10'}`}>
                  <input
                    type="checkbox"
                    checked={selected}
                    disabled={!selected && signatures.length >= 2}
                    onChange={() => setFeatureSpellSelection('signature-spells', selected
                      ? signatures.filter((spellId) => spellId !== spell.id)
                      : [...signatures, spell.id])}
                    className="mt-0.5"
                  />
                  <span><strong className="text-xs text-slate-200">{spell.name}</strong><span className="mt-1 block text-[10px] text-slate-500">{spell.description}</span></span>
                </label>
              })}
            </div>
          </div> : null}
        </div>
      })()}

      <Dnd5eRestFeatureControls character={character} onChange={onChange} />

      {(resources.length > 0 || extraMetrics.length > 0) && (
        <div className="mt-4 rounded-xl border border-white/10 bg-void-900/40 p-4">
          <h4 className="text-sm font-semibold text-slate-200">当前职业资源</h4>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {extraMetrics.map((metric) => <InfoBlock key={metric.label} title={metric.label} text={metric.value} />)}
            {resources.map(({ definition: resourceDefinition, state }) => {
              const unlimited = resourceDefinition.unlimited?.(character) ?? false
              return (
                <InfoBlock
                  key={resourceDefinition.key}
                  title={resourceDefinition.label}
                  text={`${unlimited ? '∞' : `${state!.current}/${state!.max}`} · ${resetLabel(resourceDefinition.resetOn)}`}
                />
              )
            })}
          </div>
        </div>
      )}

      {groups.map((group) => {
        const selected = [...new Set(stored.selections?.[group.id] ?? [])]
        const limit = dnd5eClassChoiceLimit(group, character.level)
        const options = group.id === 'expertise'
          ? group.options.filter((option) => option.id === 'thievesTools' || character.skills.includes(option.id) || selected.includes(option.id))
          : group.options
        return (
          <div key={group.id} className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/5 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-amber-100">{group.name}</h4>
                {group.description && <p className="mt-1 text-xs leading-5 text-slate-500">{group.description}</p>}
              </div>
              <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-100">已选 {selected.length}/{limit}</span>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {options.map((option) => (
                <SelectionCard
                  key={option.id}
                  name={option.name}
                  summary={option.summary}
                  selected={selected.includes(option.id)}
                  disabled={!selected.includes(option.id) && (
                    selected.length >= limit || !dnd5eClassChoiceOptionAvailable(character, definition.id, option)
                  )}
                  onClick={() => toggleChoice(group, option.id)}
                />
              ))}
            </div>
          </div>
        )
      })}

      <div className="mt-5">
        <h4 className="text-sm font-semibold text-slate-200">职业特性进度</h4>
        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          {progression.map((entry) => {
            const unlocked = entry.level <= character.level
            const current = entry.level === character.level
            const features = [
              ...entry.features.filter((feature) => feature.source === 'class' || selectedSubclass === definition.subclass.id),
              ...(selectedPluginSubclass?.features ?? [])
                .filter((feature) => feature.level === entry.level)
                .map((feature) => ({ ...feature, source: 'subclass' as const })),
            ]
            if (features.length === 0) return null
            return (
              <div key={entry.level} className={`rounded-xl border p-3 ${current ? 'border-arcane-400/60 bg-arcane-500/10' : unlocked ? 'border-white/10 bg-white/[0.03]' : 'border-white/5 bg-void-900/30 opacity-55'}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className={`text-sm font-bold ${current ? 'text-arcane-200' : 'text-slate-300'}`}>{entry.level} 级</span>
                  <span className="text-[11px] text-slate-500">熟练加值 +{entry.proficiencyBonus}</span>
                </div>
                <div className="mt-2 space-y-2">
                  {features.map((feature) => (
                    <div key={feature.id}>
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                        {feature.name}
                        {feature.source === 'subclass' && <span className="rounded bg-arcane-500/10 px-1.5 py-0.5 text-[9px] text-arcane-300">子职</span>}
                      </div>
                      <p className="mt-0.5 text-xs leading-5 text-slate-500">{feature.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function Dnd5eRestFeatureControls({
  character,
  onChange,
}: {
  character: Character
  onChange: (patch: Partial<Character>) => void
}) {
  const [draft, setDraft] = useState<{ characterId: string; amounts: Record<number, number> }>({
    characterId: character.id,
    amounts: {},
  })
  const recoveryFeature = dnd5eSpellSlotRecoveryFeature(character)
  const recoveryResourceKey = recoveryFeature === 'arcane-recovery'
    ? 'dnd5e-arcane-recovery'
    : recoveryFeature === 'natural-recovery'
      ? 'dnd5e-natural-recovery'
      : undefined
  const recoveryResource = recoveryResourceKey ? character.classResources?.[recoveryResourceKey] : undefined
  const budget = dnd5eSpellSlotRecoveryLimit(character)
  const amounts = draft.characterId === character.id ? draft.amounts : {}
  const slotOptions = Array.from({ length: 5 }, (_, index) => {
    const level = index + 1
    const slot = character.classResources?.[`dnd5e-spell-slot-${level}`]
    return slot ? { level, current: slot.current, max: slot.max, missing: Math.max(0, slot.max - slot.current) } : undefined
  }).filter((entry): entry is NonNullable<typeof entry> => !!entry && entry.missing > 0)
  const plannedLevels = Object.entries(amounts).reduce(
    (total, [level, amount]) => total + Number(level) * Math.max(0, amount),
    0,
  )
  const eldritchMaster = character.rulesetId === 'dnd5e-2014-srd-5.1' && character.charClass === '邪术师' && character.level >= 20
  const eldritchResource = character.classResources?.['dnd5e-eldritch-master']
  const pactSlots = character.classResources?.['dnd5e-pact-slot']

  if (!recoveryFeature && !eldritchMaster) return null

  const setAmount = (level: number, amount: number) => {
    const current = draft.characterId === character.id ? draft.amounts : {}
    setDraft({ characterId: character.id, amounts: { ...current, [level]: amount } })
  }

  const recoverSlots = () => {
    const allocations = Object.entries(amounts)
      .map(([level, amount]) => ({ level: Number(level), amount }))
      .filter((allocation) => allocation.amount > 0)
    const result = applyDnd5eSpellSlotRecovery(character, allocations)
    if (!result.ok) return
    onChange({ classResources: result.character.classResources })
    setDraft({ characterId: character.id, amounts: {} })
  }

  const recoverPactSlots = () => {
    const result = applyDnd5eEldritchMaster(character)
    if (!result.ok) return
    onChange({ classResources: result.character.classResources })
  }

  return (
    <div className="mt-4 rounded-xl border border-cyan-400/20 bg-cyan-500/5 p-4">
      <h4 className="text-sm font-semibold text-cyan-100">短休与每日恢复特性</h4>
      {recoveryFeature && (
        <div className="mt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-slate-200">{recoveryFeature === 'arcane-recovery' ? '奥术回想' : '自然恢复'}</p>
              <p className="mt-1 text-[11px] text-slate-500">完成一次短休后，恢复总环级不超过 {budget} 的法术位；不能恢复 6 环或更高法术位。每天一次。</p>
            </div>
            <span className="text-xs text-cyan-100">已分配 {plannedLevels}/{budget} 环</span>
          </div>
          {slotOptions.length > 0 ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              {slotOptions.map((slot) => {
                const maximum = Math.min(slot.missing, Math.floor(budget / slot.level))
                return <label key={slot.level} className="rounded-lg border border-white/8 bg-black/10 px-3 py-2">
                  <span className="block text-[11px] font-semibold text-slate-300">{slot.level}环 · {slot.current}/{slot.max}</span>
                  <select
                    value={amounts[slot.level] ?? 0}
                    disabled={(recoveryResource?.current ?? 0) < 1}
                    onChange={(event) => setAmount(slot.level, Number(event.target.value))}
                    className="mt-1 w-full rounded border border-white/10 bg-void-900 px-2 py-1 text-xs text-slate-200"
                  >
                    {Array.from({ length: maximum + 1 }, (_, amount) => <option key={amount} value={amount}>恢复 {amount} 个</option>)}
                  </select>
                </label>
              })}
            </div>
          ) : <p className="mt-2 text-xs text-slate-500">1至5环法术位均已充满。</p>}
          <button
            type="button"
            disabled={(recoveryResource?.current ?? 0) < 1 || plannedLevels < 1 || plannedLevels > budget}
            onClick={recoverSlots}
            className="mt-3 rounded-lg bg-cyan-500/20 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            确认恢复法术位
          </button>
        </div>
      )}
      {eldritchMaster && (
        <div className={recoveryFeature ? 'mt-4 border-t border-cyan-300/10 pt-4' : 'mt-3'}>
          <p className="text-xs font-semibold text-slate-200">魔能宗师</p>
          <p className="mt-1 text-[11px] text-slate-500">花费 1 分钟恳求宗主，恢复所有已消耗的契约法术位；每次长休一次。</p>
          <button
            type="button"
            disabled={(eldritchResource?.current ?? 0) < 1 || !pactSlots || pactSlots.current >= pactSlots.max}
            onClick={recoverPactSlots}
            className="mt-3 rounded-lg bg-cyan-500/20 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            恢复全部契约位（{pactSlots?.current ?? 0}/{pactSlots?.max ?? 0}）
          </button>
        </div>
      )}
    </div>
  )
}

function subclassLabel(className: string): string {
  const labels: Record<string, string> = {
    野蛮人: '原始道途', 吟游诗人: '诗人学院', 牧师: '神圣领域', 德鲁伊: '德鲁伊结社', 武僧: '武僧传统',
    圣武士: '神圣誓言', 游侠: '游侠范型', 游荡者: '游荡者范型', 术士: '术法起源', 邪术师: '异界宗主', 法师: '奥术传承',
  }
  return labels[className] ?? '子职'
}

function classMetrics(character: Character): Array<{ label: string; value: string }> {
  if (character.charClass === '野蛮人') {
    const brutal = dnd5eBarbarianBrutalCriticalDice(character.level)
    return [
      { label: '狂暴伤害', value: `+${dnd5eBarbarianRageDamage(character.level)}` },
      ...(brutal > 0 ? [{ label: '凶蛮重击', value: `额外 ${brutal} 枚武器骰` }] : []),
    ]
  }
  if (character.charClass === '吟游诗人') return [
    { label: '诗人激励骰', value: `d${dnd5eBardicInspirationDie(character.level)}` },
    ...(dnd5eBardSongOfRestDie(character.level) > 0 ? [{ label: '休憩曲', value: `d${dnd5eBardSongOfRestDie(character.level)}` }] : []),
  ]
  if (character.charClass === '牧师') {
    const cr = dnd5eClericDestroyUndeadCr(character.level)
    return cr ? [{ label: '摧毁亡灵', value: `CR ${cr} 或更低` }] : []
  }
  if (character.charClass === '德鲁伊' && character.level >= 2) {
    const limit = dnd5eDruidWildShapeLimits(character.level)
    return [{ label: '荒野变形上限', value: `CR ${limit.maxChallengeRating} · 游泳${limit.swim ? '允许' : '禁用'} · 飞行${limit.fly ? '允许' : '禁用'}` }]
  }
  if (character.charClass === '武僧') return [{ label: '武艺骰', value: `1d${dnd5eMonkMartialArtsDie(character.level)}` }]
  if (character.charClass === '圣武士' && character.level >= 6) return [{ label: '守护灵光范围', value: `${dnd5ePaladinAuraRadius(character.level)} 尺` }]
  if (character.charClass === '游荡者') return [{ label: '偷袭', value: `${dnd5eRogueSneakAttackDice(character.level)}d6` }]
  if (character.charClass === '法师') return [{ label: '奥术回想环级总和', value: `${dnd5eWizardArcaneRecoveryLevels(character.level)}` }]
  return []
}

function spellcastingSummary(kind: string, entry: ReturnType<typeof dnd5eClassProgression>[number], character: Character): Array<{ label: string; value: string }> {
  const items: Array<{ label: string; value: string }> = []
  items.push({ label: '法术豁免 DC', value: `${dnd5eSpellSaveDc(character) ?? '—'}` })
  const spellAttack = dnd5eSpellAttackModifier(character)
  items.push({ label: '法术攻击', value: spellAttack == null ? '—' : `${spellAttack >= 0 ? '+' : ''}${spellAttack}` })
  if (entry.cantripsKnown != null) items.push({ label: '已知戏法', value: `${entry.cantripsKnown}` })
  if (entry.spellsKnown != null) items.push({ label: '已知法术', value: `${entry.spellsKnown}` })
  const prepared = dnd5ePreparedSpellCount(character)
  if (prepared != null) items.push({ label: '可准备法术', value: `${prepared}` })
  if (kind === 'pact') {
    items.push({ label: '契约法术位', value: `${entry.spellSlots[0] ?? 0} 个 ${entry.pactSlotLevel ?? 1} 环位` })
  } else {
    items.push({ label: '法术位', value: entry.spellSlots.length > 0 ? entry.spellSlots.map((count, index) => `${index + 1}环×${count}`).join(' · ') : '尚未获得' })
  }
  return items
}

function Summary({ icon: Icon, label, value }: { icon: typeof CircleGauge; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center gap-2 text-xs text-slate-500"><Icon className="h-3.5 w-3.5 text-arcane-300" />{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-200">{value}</div>
    </div>
  )
}

function InfoBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-white/8 bg-white/[0.025] px-3 py-2">
      <div className="text-[11px] font-semibold text-slate-500">{title}</div>
      <div className="mt-1 text-sm leading-5 text-slate-300">{text}</div>
    </div>
  )
}

function SelectionCard({ name, summary, selected, disabled, onClick }: { name: string; summary: string; selected: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} aria-pressed={selected} className={`rounded-xl border p-3 text-left transition-colors ${selected ? 'border-arcane-400/50 bg-arcane-500/15' : 'border-white/8 bg-white/[0.03] hover:bg-white/[0.06]'} disabled:cursor-not-allowed disabled:opacity-40`}>
      <span className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-200">{name}</span>
        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${selected ? 'border-arcane-300 bg-arcane-500 text-white' : 'border-slate-600'}`}>{selected && <Check className="h-3.5 w-3.5" />}</span>
      </span>
      <span className="mt-1 block text-xs leading-5 text-slate-500">{summary}</span>
    </button>
  )
}
