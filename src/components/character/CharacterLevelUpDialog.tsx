import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronRight, Dices, LockKeyhole, Sparkles, X } from 'lucide-react'
import { ABILITIES, type AbilityKey } from '../../lib/dnd'
import {
  FIGHTER_FIGHTING_STYLE_OPTIONS,
  applyDnd5eLevelAdvancement,
  buildDnd5eLevelAdvancementPlan,
  dnd5eAdvancementRevisionBaseCharacter,
  dnd5eClassDefinition,
  dnd5ePluginFeatAvailableForCharacter,
  dnd5eSrdFeatAvailableForCharacter,
  DND5E_SRD_FEATS,
  fighterFightingStyleSelectionLimit,
  registeredDnd5ePluginFeats,
  reviseDnd5eLevelAdvancement,
  type Dnd5eClassId,
  type FighterFightingStyleId,
  type Dnd5eLevelAdvancementFailure,
} from '../../rulesets/dnd5e'
import type {
  Character,
  Dnd5eAdvancementAsiChoice,
  Dnd5eAdvancementSpellSelectionsV1,
  Dnd5eLevelAdvancementDecisionV1,
  Dnd5eLevelAdvancementRecordV1,
} from '../../types/character'
import Dnd5eSpellAdvancementPicker from './Dnd5eSpellAdvancementPicker'

interface CharacterLevelUpDialogProps {
  character: Character
  classId: Dnd5eClassId
  levelsGained: number
  revisionRecord?: Dnd5eLevelAdvancementRecordV1
  onCancel: () => void
  onConfirm: (character: Character) => void
}

type AsiDraft =
  | { mode: 'single'; first?: AbilityKey }
  | { mode: 'split'; first?: AbilityKey; second?: AbilityKey }
  | { mode: 'feat'; featId?: string }

const FAILURE_MESSAGES: Record<Dnd5eLevelAdvancementFailure, string> = {
  'invalid-level-gain': '升级等级无效。',
  'maximum-level': '角色总等级不能超过 20 级。',
  'invalid-class': '职业不存在或当前规则包未提供该职业。',
  'multiclass-prerequisite': '角色不满足该兼职职业的属性前提。',
  'rolled-hit-points-not-supported-for-multiclass': '兼职生命值当前必须使用职业固定值。',
  'invalid-hit-point-rolls': '生命骰数量或结果无效，请重新投掷。',
  'subclass-required': '必须先选择本次升级获得的子职。',
  'invalid-subclass': '所选子职不存在，或对应规则插件未安装。',
  'missing-asi-choice': '还有属性值提升／专长尚未选择。',
  'invalid-asi-choice': '属性值提升不合法，或会令属性超过 20。',
  'invalid-feat': '所选专长不满足前提、已经拥有，或对应插件未安装。',
  'missing-class-choice': '还有职业或子职选项尚未选满。',
  'invalid-class-choice': '职业或子职选项无效。',
  'missing-spell-choice': '还有本级戏法、已知法术或法师法术书选择尚未完成。',
  'invalid-spell-choice': '法术数量、环级、职业归属或替换次数不符合本级规则。',
  'only-latest-advancement-can-be-revised': '找不到要修订的升级记录。',
  'dependent-advancement-invalid': '这项修改会使后续升级中的专长或职业选择失效，因此未保存任何改动。',
}

function asiDraftFromChoice(choice: Dnd5eAdvancementAsiChoice | undefined): AsiDraft {
  if (!choice) return { mode: 'single' }
  if (choice.kind === 'feat') return { mode: 'feat', featId: choice.featId }
  const entries = Object.entries(choice.increases) as Array<[AbilityKey, number]>
  const single = entries.find(([, increase]) => increase === 2)
  if (single) return { mode: 'single', first: single[0] }
  return { mode: 'split', first: entries[0]?.[0], second: entries[1]?.[0] }
}

function choiceFromAsiDraft(draft: AsiDraft): Dnd5eAdvancementAsiChoice | undefined {
  if (draft.mode === 'feat') {
    return draft.featId ? { kind: 'feat', featId: draft.featId } : undefined
  }
  if (draft.mode === 'single') {
    return draft.first
      ? { kind: 'ability-score', increases: { [draft.first]: 2 } }
      : undefined
  }
  if (!draft.first || !draft.second || draft.first === draft.second) return undefined
  return {
    kind: 'ability-score',
    increases: { [draft.first]: 1, [draft.second]: 1 },
  }
}

function initialAsiDrafts(
  record: Dnd5eLevelAdvancementRecordV1 | undefined,
): Record<number, AsiDraft> {
  return Object.fromEntries((record?.decision.asiChoices ?? []).map((entry) => [
    entry.classLevel,
    asiDraftFromChoice(entry.choice),
  ]))
}

export default function CharacterLevelUpDialog({
  character,
  classId,
  levelsGained,
  revisionRecord,
  onCancel,
  onConfirm,
}: CharacterLevelUpDialogProps) {
  const baseCharacter = useMemo(
    () => revisionRecord
      ? dnd5eAdvancementRevisionBaseCharacter(character, revisionRecord)
      : character,
    [character, revisionRecord],
  )
  const initialDecision = revisionRecord?.decision
  const [subclassId, setSubclassId] = useState(
    initialDecision?.subclassId ??
    (classId === 'fighter'
      ? baseCharacter.dnd5eClassChoices?.fighter?.subclass
      : baseCharacter.dnd5eClassChoices?.classes?.[classId]?.subclass) ??
    '',
  )
  const [hpMethod, setHpMethod] = useState<'fixed' | 'rolled'>(
    initialDecision?.hitPointMethod ?? 'fixed',
  )
  const [hpRolls, setHpRolls] = useState<number[]>(initialDecision?.hitPointRolls ?? [])
  const [asiDrafts, setAsiDrafts] = useState<Record<number, AsiDraft>>(
    () => initialAsiDrafts(revisionRecord),
  )
  const [classSelections, setClassSelections] = useState<Record<string, string[]>>(
    initialDecision?.classChoiceSelections ?? {},
  )
  const [fighterSubclassSelections, setFighterSubclassSelections] = useState<Record<string, string[]>>(
    initialDecision?.fighterSubclassSelections ?? {},
  )
  const [fighterStyles, setFighterStyles] = useState<FighterFightingStyleId[]>(
    initialDecision?.fighterFightingStyles ??
    baseCharacter.dnd5eClassChoices?.fighter?.fightingStyles ??
    [],
  )
  const [spellSelections, setSpellSelections] = useState<Dnd5eAdvancementSpellSelectionsV1 | undefined>(
    initialDecision?.spellSelections,
  )
  const [error, setError] = useState('')
  const plan = useMemo(
    () => buildDnd5eLevelAdvancementPlan(
      baseCharacter,
      classId,
      levelsGained,
      subclassId || undefined,
    ),
    [baseCharacter, classId, levelsGained, subclassId],
  )
  const effectiveHpMethod = plan?.rolledHitPointsAllowed ? hpMethod : 'fixed'
  const definition = dnd5eClassDefinition(classId)
  const targetFighter = plan && classId === 'fighter'
    ? {
        ...baseCharacter,
        level: plan.toClassLevel,
        dnd5eClassChoices: {
          ...baseCharacter.dnd5eClassChoices,
          fighter: {
            ...baseCharacter.dnd5eClassChoices?.fighter,
            subclass: subclassId || undefined,
          },
        },
      }
    : undefined
  const fighterStyleLimit = targetFighter ? fighterFightingStyleSelectionLimit(targetFighter) : 0
  const featCandidateCharacter = plan
    ? { ...baseCharacter, level: plan.toLevel }
    : baseCharacter
  const feats = [
    ...DND5E_SRD_FEATS.filter((feat) =>
      !baseCharacter.dnd5eFeatIds?.includes(feat.id) &&
      dnd5eSrdFeatAvailableForCharacter(feat, featCandidateCharacter)),
    ...registeredDnd5ePluginFeats().filter((feat) =>
      !baseCharacter.dnd5eFeatIds?.includes(feat.id) &&
      dnd5ePluginFeatAvailableForCharacter(feat, featCandidateCharacter)),
  ]

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  if (!plan || !definition) return null

  const rollAllHitDice = () => {
    if (hpRolls.length === levelsGained) return
    setHpRolls(Array.from(
      { length: levelsGained },
      () => 1 + Math.floor(Math.random() * plan.hitDie),
    ))
  }

  const toggleSelection = (
    key: string,
    optionId: string,
    targetLimit: number,
    currentSelections: readonly string[],
    kind: 'class' | 'fighter-subclass',
    replaceable: boolean = false,
  ) => {
    const setter = kind === 'class' ? setClassSelections : setFighterSubclassSelections
    setter((current) => {
      const existing = current[key] ?? (replaceable ? [...currentSelections] : [])
      const alreadyGranted = currentSelections.includes(optionId) && !replaceable
      if (alreadyGranted) return current
      const selected = existing.includes(optionId)
      if (
        selected &&
        replaceable &&
        currentSelections.includes(optionId) &&
        currentSelections.filter((id) => !existing.includes(id)).length >= 1
      ) return current
      if (
        !selected &&
        (replaceable ? existing.length : existing.length + currentSelections.length) >= targetLimit
      ) return current
      return {
        ...current,
        [key]: selected ? existing.filter((id) => id !== optionId) : [...existing, optionId],
      }
    })
  }

  const toggleFighterStyle = (styleId: FighterFightingStyleId) => {
    const existing = baseCharacter.dnd5eClassChoices?.fighter?.fightingStyles ?? []
    if (existing.includes(styleId)) return
    setFighterStyles((current) => {
      if (current.includes(styleId)) return current.filter((id) => id !== styleId)
      if (current.length >= fighterStyleLimit) return current
      return [...current, styleId]
    })
  }

  const confirm = () => {
    const asiChoices = plan.asiLevels.flatMap((classLevel) => {
      const choice = choiceFromAsiDraft(asiDrafts[classLevel] ?? { mode: 'single' })
      return choice ? [{ classLevel, choice }] : []
    })
    const resolvedClassSelections = { ...classSelections }
    for (const requirement of plan.choiceRequirements) {
      if (
        requirement.kind === 'class' &&
        requirement.replaceable &&
        resolvedClassSelections[requirement.key] == null
      ) resolvedClassSelections[requirement.key] = [...requirement.currentSelections]
    }
    const effectiveSpellSelections = plan.spellAdvancement?.selectionRequired
      ? spellSelections ?? plan.spellAdvancement.defaultSelections
      : undefined
    const decision: Dnd5eLevelAdvancementDecisionV1 = {
      schemaVersion: 1,
      classId,
      levelsGained,
      hitPointMethod: effectiveHpMethod,
      hitPointRolls: effectiveHpMethod === 'rolled' ? hpRolls : [],
      subclassId: subclassId || undefined,
      asiChoices,
      classChoiceSelections: classId === 'fighter' ? undefined : resolvedClassSelections,
      fighterFightingStyles: classId === 'fighter' ? fighterStyles : undefined,
      fighterSubclassSelections: classId === 'fighter' ? fighterSubclassSelections : undefined,
      ...(effectiveSpellSelections ? { spellSelections: effectiveSpellSelections } : {}),
    }
    const result = revisionRecord
      ? reviseDnd5eLevelAdvancement(
          character,
          revisionRecord.id,
          decision,
        )
      : applyDnd5eLevelAdvancement(character, decision)
    if (!result.ok) {
      setError(FAILURE_MESSAGES[result.reason])
      return
    }
    onConfirm(result.character)
  }

  return createPortal(
    <div
      role="presentation"
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/80 p-3 backdrop-blur-md sm:p-6"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onCancel()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="level-up-title"
        className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-violet-300/20 bg-void-950 shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-7">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-violet-300">
              <Sparkles className="h-4 w-4" />
              {revisionRecord ? 'DM 升级修订' : '升级结算'}
            </div>
            <h2 id="level-up-title" className="mt-2 text-xl font-bold text-white">
              {plan.className} {plan.fromClassLevel} → {plan.toClassLevel} 级
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              角色总等级 {plan.fromLevel} → {plan.toLevel}。所有选择会作为一笔原子事务保存。
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="关闭升级面板"
            className="rounded-xl border border-white/10 p-2 text-slate-400 transition hover:bg-white/5 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-7">
          <div className="rounded-2xl border border-amber-300/20 bg-amber-500/[0.07] px-4 py-3 text-sm leading-6 text-amber-100">
            <LockKeyhole className="mr-2 inline h-4 w-4" />
            玩家确认后不能自行更改本次升级。DM 可以在角色检视页修订任意一次升级；系统会安全重放后续升级。
          </div>

          <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <h3 className="font-semibold text-slate-100">本次自动获得</h3>
            {plan.grantedFeatures.length > 0 ? (
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {plan.grantedFeatures.map((feature) => (
                  <div key={`${feature.level}-${feature.id}`} className="rounded-xl border border-white/8 bg-black/20 px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-violet-500/15 px-2 py-0.5 text-[10px] font-bold text-violet-200">{feature.level}级</span>
                      <span className="text-sm font-semibold text-slate-100">{feature.name}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{feature.description}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">本次没有新增自动职业特性。</p>
            )}
          </section>

          {plan.subclassChoiceUnlocked && (
            <section className="rounded-2xl border border-violet-300/20 bg-violet-500/[0.05] p-4">
              <h3 className="font-semibold text-violet-100">选择子职</h3>
              <p className="mt-1 text-xs text-slate-500">该选择会决定后续获得的子职特性和 Headless 能力。</p>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {plan.subclassOptions.map((option) => (
                  <button
                    type="button"
                    key={option.id}
                    aria-pressed={subclassId === option.id}
                    onClick={() => {
                      setSubclassId(option.id)
                      setClassSelections({})
                      setFighterSubclassSelections({})
                      setSpellSelections(undefined)
                    }}
                    className={`rounded-xl border p-3 text-left transition ${
                      subclassId === option.id
                        ? 'border-violet-300/60 bg-violet-500/15 text-violet-50'
                        : 'border-white/10 bg-black/20 text-slate-300 hover:border-white/20'
                    }`}
                  >
                    <span className="text-sm font-semibold">{option.name}</span>
                    <span className="mt-1 block text-xs leading-5 opacity-65">{option.summary}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-emerald-300/15 bg-emerald-500/[0.04] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-emerald-100">生命值成长</h3>
                <p className="mt-1 text-xs text-slate-500">本次获得 {levelsGained} 枚 d{plan.hitDie} 升级生命骰。</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  aria-pressed={effectiveHpMethod === 'fixed'}
                  onClick={() => {
                    setHpMethod('fixed')
                  }}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                    effectiveHpMethod === 'fixed'
                      ? 'border-emerald-300/50 bg-emerald-500/15 text-emerald-100'
                      : 'border-white/10 text-slate-400'
                  }`}
                >
                  固定值（每级 {Math.floor(plan.hitDie / 2) + 1}）
                </button>
                <button
                  type="button"
                  disabled={!plan.rolledHitPointsAllowed}
                  aria-pressed={effectiveHpMethod === 'rolled'}
                  onClick={() => setHpMethod('rolled')}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-35 ${
                    effectiveHpMethod === 'rolled'
                      ? 'border-violet-300/50 bg-violet-500/15 text-violet-100'
                      : 'border-white/10 text-slate-400'
                  }`}
                >
                  投掷生命骰
                </button>
              </div>
            </div>
            {!plan.rolledHitPointsAllowed && (
              <p className="mt-2 text-xs text-amber-200/75">兼职生命骰池不同，当前版本统一使用各职业固定生命值。</p>
            )}
            {effectiveHpMethod === 'rolled' && (
              <div className="mt-4">
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: levelsGained }, (_, index) => (
                    <div
                      key={index}
                      className="flex h-12 w-12 items-center justify-center rounded-xl border border-violet-300/20 bg-violet-500/10 font-mono text-lg font-bold text-violet-100"
                    >
                      {hpRolls[index] ?? '—'}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={hpRolls.length === levelsGained}
                  onClick={rollAllHitDice}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-violet-500/25 disabled:text-violet-200/60"
                >
                  <Dices className="h-4 w-4" /> {hpRolls.length === levelsGained ? '投掷结果已锁定' : `投掷 ${levelsGained}d${plan.hitDie}`}
                </button>
                {hpRolls.length === levelsGained && <p className="mt-2 text-[11px] text-violet-200/60">升级生命骰只能投掷一次，确认后不可重骰。</p>}
              </div>
            )}
          </section>

          {plan.asiLevels.map((classLevel) => {
            const draft = asiDrafts[classLevel] ?? { mode: 'single' as const }
            return (
              <section key={classLevel} className="rounded-2xl border border-sky-300/15 bg-sky-500/[0.04] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-sky-100">{classLevel}级：属性值提升或专长</h3>
                    <p className="mt-1 text-xs text-slate-500">属性值不能通过本次选择超过 20。</p>
                  </div>
                  <select
                    value={draft.mode}
                    onChange={(event) => setAsiDrafts((current) => ({
                      ...current,
                      [classLevel]: event.target.value === 'feat'
                        ? { mode: 'feat' }
                        : event.target.value === 'split'
                          ? { mode: 'split' }
                          : { mode: 'single' },
                    }))}
                    className="rounded-lg border border-white/10 bg-void-900 px-3 py-2 text-sm text-slate-200"
                  >
                    <option value="single">一项属性 +2</option>
                    <option value="split">两项属性各 +1</option>
                    {feats.length > 0 && <option value="feat">选择专长</option>}
                  </select>
                </div>
                {draft.mode === 'feat' ? (
                  <select
                    value={draft.featId ?? ''}
                    onChange={(event) => setAsiDrafts((current) => ({
                      ...current,
                      [classLevel]: { mode: 'feat', featId: event.target.value || undefined },
                    }))}
                    className="mt-3 w-full rounded-lg border border-white/10 bg-void-900 px-3 py-2 text-sm text-slate-200"
                  >
                    <option value="">选择满足前提的专长…</option>
                    {feats.map((feat) => <option key={feat.id} value={feat.id}>{feat.name}</option>)}
                  </select>
                ) : (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <AbilitySelect
                      label={draft.mode === 'single' ? '提升 +2' : '第一项 +1'}
                      value={draft.first}
                      character={baseCharacter}
                      onChange={(ability) => setAsiDrafts((current) => ({
                        ...current,
                        [classLevel]: { ...draft, first: ability },
                      }))}
                    />
                    {draft.mode === 'split' && (
                      <AbilitySelect
                        label="第二项 +1"
                        value={draft.second}
                        character={baseCharacter}
                        exclude={draft.first}
                        onChange={(ability) => setAsiDrafts((current) => ({
                          ...current,
                          [classLevel]: { ...draft, second: ability },
                        }))}
                      />
                    )}
                  </div>
                )}
              </section>
            )
          })}

          {classId === 'fighter' && fighterStyleLimit > 0 && (
            <section className="rounded-2xl border border-orange-300/15 bg-orange-500/[0.04] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-orange-100">战斗风格</h3>
                  <p className="mt-1 text-xs text-slate-500">已选 {fighterStyles.length}/{fighterStyleLimit}，已经确认过的风格不能移除。</p>
                </div>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {FIGHTER_FIGHTING_STYLE_OPTIONS.map((option) => {
                  const selected = fighterStyles.includes(option.id)
                  const locked = baseCharacter.dnd5eClassChoices?.fighter?.fightingStyles?.includes(option.id)
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleFighterStyle(option.id)}
                      className={`rounded-xl border p-3 text-left ${
                        selected
                          ? 'border-orange-300/45 bg-orange-500/10 text-orange-50'
                          : 'border-white/10 bg-black/20 text-slate-400'
                      }`}
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        {selected && <Check className="h-4 w-4" />}
                        {option.name}
                        {locked && <LockKeyhole className="h-3.5 w-3.5 text-slate-500" />}
                      </span>
                      <span className="mt-1 block text-xs leading-5 opacity-65">{option.summary}</span>
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          {plan.choiceRequirements.map((requirement) => {
            const source = requirement.kind === 'class' ? classSelections : fighterSubclassSelections
            const selected = new Set(requirement.replaceable
              ? source[requirement.key] ?? requirement.currentSelections
              : [
                  ...requirement.currentSelections,
                  ...(source[requirement.key] ?? []),
                ])
            return (
              <section key={`${requirement.kind}-${requirement.key}`} className="rounded-2xl border border-fuchsia-300/15 bg-fuchsia-500/[0.04] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-fuchsia-100">{requirement.name}</h3>
                    {requirement.description && <p className="mt-1 text-xs leading-5 text-slate-500">{requirement.description}</p>}
                  </div>
                  <span className="rounded-full bg-fuchsia-500/10 px-2.5 py-1 text-xs font-semibold text-fuchsia-100">
                    {selected.size}/{requirement.targetLimit}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {requirement.options.map((option) => {
                    const active = selected.has(option.id)
                    const locked = requirement.currentSelections.includes(option.id)
                    const unavailable = requirement.key === 'expertise' &&
                      option.id !== 'thievesTools' &&
                      !baseCharacter.skills.includes(option.id) &&
                      !(classSelections['class-skills'] ?? []).includes(option.id)
                    return (
                      <button
                        key={option.id}
                        type="button"
                        disabled={unavailable}
                        aria-pressed={active}
                        onClick={() => toggleSelection(
                          requirement.key,
                          option.id,
                          requirement.targetLimit,
                          requirement.currentSelections,
                          requirement.kind,
                          requirement.replaceable,
                        )}
                        className={`rounded-xl border p-3 text-left disabled:cursor-not-allowed disabled:opacity-35 ${
                          active
                            ? 'border-fuchsia-300/45 bg-fuchsia-500/10 text-fuchsia-50'
                            : 'border-white/10 bg-black/20 text-slate-400'
                        }`}
                      >
                        <span className="flex items-center gap-2 text-sm font-semibold">
                          {active && <Check className="h-4 w-4" />}
                          {option.name}
                          {locked && <LockKeyhole className="h-3.5 w-3.5 text-slate-500" />}
                        </span>
                        <span className="mt-1 block text-xs leading-5 opacity-65">{option.summary}</span>
                      </button>
                    )
                  })}
                </div>
              </section>
            )
          })}

          {plan.spellAdvancement?.selectionRequired && (
            <Dnd5eSpellAdvancementPicker
              plan={plan.spellAdvancement}
              value={spellSelections ?? plan.spellAdvancement.defaultSelections}
              onChange={setSpellSelections}
            />
          )}

          {error && (
            <div role="alert" className="rounded-xl border border-rose-300/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-black/20 px-5 py-4 sm:px-7">
          <p className="text-xs text-slate-500">
            确认时会同时写入等级、生命值、属性、专长、职业选择、法术书和升级审计记录。
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-300">
              取消
            </button>
            <button type="button" onClick={confirm} className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-950/30">
              {revisionRecord ? '确认修订' : '确认升级'}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </footer>
      </section>
    </div>,
    document.body,
  )
}

function AbilitySelect({
  label,
  value,
  character,
  exclude,
  onChange,
}: {
  label: string
  value?: AbilityKey
  character: Character
  exclude?: AbilityKey
  onChange: (ability: AbilityKey | undefined) => void
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <select
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value
          ? event.target.value as AbilityKey
          : undefined)}
        className="rounded-lg border border-white/10 bg-void-900 px-3 py-2 text-sm text-slate-200"
      >
        <option value="">选择属性…</option>
        {ABILITIES.filter((ability) => ability.key !== exclude).map((ability) => (
          <option key={ability.key} value={ability.key} disabled={character.abilities[ability.key] >= 20}>
            {ability.label}（当前 {character.abilities[ability.key]}）
          </option>
        ))}
      </select>
    </label>
  )
}
