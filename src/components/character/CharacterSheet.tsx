import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { Award, Dices, Footprints, HeartPulse, Shield, Sparkles, Swords } from 'lucide-react'
import { useCharacterStore } from '../../store/characters'
import { ABILITIES, SKILLS, formatMod, type AbilityKey, type SkillDef } from '../../lib/dnd'
import {
  DND5E_2014_ALIGNMENT_OPTIONS,
  DND5E_2014_BACKGROUND_OPTIONS,
  DND5E_2014_CLASS_OPTIONS,
  DND5E_2014_RACE_OPTIONS,
  dnd5eClassHitPointRule,
  dnd5eFixedMaxHp,
  dnd5eManualHitPointRolls,
  dnd5e2014Adapter as rules,
  dnd5eArmorClass,
  dnd5eClassDefinition,
  dnd5eClassDefinitionForCharacter,
  dnd5eWalkingSpeed,
  defaultEquipmentForDnd5eCharacter,
  dnd5eEffectiveSavingThrowProficiencies,
  dnd5eStoredCharacterInitiativeModifier,
  dnd5eBardSongOfRestDie,
  dnd5eSelfSavingThrowAuraBonus,
  dnd5eSkillCheckModifier,
  dnd5eSkillCheckProficiencyRank,
  resolveDnd5eShortRestHitDice,
  dnd5eRulesPluginRegistrySnapshot,
  registeredDnd5ePluginFeatures,
  registeredDnd5ePluginBackgrounds,
  registeredDnd5ePluginRaces,
  dnd5eRaceSpeed,
  subscribeDnd5eRulesPluginRegistry,
  normalizeDnd5eClassLevels,
  dnd5eCharacterClassLevel,
  type Dnd5eClassId,
} from '../../rulesets/dnd5e'
import { normalizeLegacyAbilities } from '../../rulesets/dnd5e/character'
import HpPanel from './HpPanel'
import FighterProgressionPanel from './FighterProgressionPanel'
import Dnd5eClassProgressionPanel from './Dnd5eClassProgressionPanel'
import Dnd5ePluginFeaturesPanel from './Dnd5ePluginFeaturesPanel'
import Dnd5eSpellbookPanel from './Dnd5eSpellbookPanel'
import EquipmentTab from './EquipmentTab'
import CharacterPortraitEditor from './CharacterPortraitEditor'
import Dnd5eMulticlassPanel from './Dnd5eMulticlassPanel'
import { parseBoundedNumberDraft, resolveBoundedNumberDraft } from './numberInput'

interface CharacterSheetProps {
  id: string
  isDM: boolean
  readOnly?: boolean
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Math.floor(value)))
}

export default function CharacterSheet({ id, isDM, readOnly = false }: CharacterSheetProps) {
  const [selectedTab, setSelectedTab] = useState<'sheet' | 'class' | 'inventory' | 'spellbook' | 'plugins'>('sheet')
  const [shortRestHitDice, setShortRestHitDice] = useState<Record<number, number>>({})
  const [useSongOfRest, setUseSongOfRest] = useState(false)
  const [shortRestResult, setShortRestResult] = useState('')
  const [selectedClassId, setSelectedClassId] = useState<Dnd5eClassId | undefined>()
  const characters = useCharacterStore((state) => state.characters)
  const character = useCharacterStore((state) => state.characters.find((item) => item.id === id))
  const update = useCharacterStore((state) => state.update)
  const updateSheetHitPoints = useCharacterStore((state) => state.updateSheetHitPoints)
  useSyncExternalStore(
    subscribeDnd5eRulesPluginRegistry,
    dnd5eRulesPluginRegistrySnapshot,
    dnd5eRulesPluginRegistrySnapshot,
  )
  const hitDice = useMemo(() => {
    if (!character) return []
    if (character.hitPointDice?.length) return character.hitPointDice
    const sides = Number(character.hitDice.match(/d(\d+)/i)?.[1] ?? 8)
    return [{ sides, current: character.level, max: character.level }]
  }, [character])

  useEffect(() => {
    if (readOnly || !character || character.rulesetId === 'dnd5e-2014-srd-5.1') return
    const level = clamp(character.level, 1, 20)
    const sides = Number(character.hitDice.match(/d(\d+)/i)?.[1] ?? 8)
    update(character.id, {
      rulesetId: 'dnd5e-2014-srd-5.1',
      level,
      abilities: character.rulesetId ? character.abilities : normalizeLegacyAbilities(character.abilities),
      hitPointDice: character.hitPointDice?.length
        ? character.hitPointDice
        : [{ sides, current: level, max: level }],
      deathSaveSuccesses: character.deathSaveSuccesses ?? 0,
      deathSaveFailures: character.deathSaveFailures ?? 0,
      deathSaveStable: character.deathSaveStable ?? false,
      concentrating: character.concentrating ?? false,
      inspiration: character.inspiration > 0 ? 1 : 0,
      exhaustionLevel: character.exhaustionLevel ?? 0,
    })
  }, [character, readOnly, update])

  if (!character) return <p className="text-slate-400">未找到角色。</p>
  const c = character
  const updateCharacter = (patch: Parameters<typeof update>[1]) => {
    if (!readOnly) update(id, patch)
  }
  const updateCharacterHitPoints = (
    patch: Parameters<typeof updateSheetHitPoints>[1],
  ) => {
    if (!readOnly) updateSheetHitPoints(id, patch)
  }
  const pluginRaces = registeredDnd5ePluginRaces()
  const pluginBackgrounds = registeredDnd5ePluginBackgrounds()
  const raceOptions = [...DND5E_2014_RACE_OPTIONS, ...pluginRaces.map((race) => race.name)]
  const backgroundOptions = [...DND5E_2014_BACKGROUND_OPTIONS, ...pluginBackgrounds.map((background) => background.name)]
  const selectedPluginBackground = pluginBackgrounds.find((background) =>
    background.id === c.dnd5eBackgroundId || background.name === c.background)
  const classDefinition = dnd5eClassDefinitionForCharacter(c)
  const classLevels = normalizeDnd5eClassLevels(c)
  const activeClassId = selectedClassId && classLevels[selectedClassId]
    ? selectedClassId
    : classDefinition?.id
  const activeClassDefinition = activeClassId ? dnd5eClassDefinition(activeClassId) : classDefinition
  const activeClassLevel = activeClassId ? dnd5eCharacterClassLevel(c, activeClassId) : c.level
  const classCharacter = activeClassDefinition
    ? { ...c, charClass: activeClassDefinition.name, level: Math.max(1, activeClassLevel) }
    : c
  const hasSpellbookTab = Object.keys(classLevels).some((classId) => !!dnd5eClassDefinition(classId)?.spellcasting)
  const hasPluginTab = registeredDnd5ePluginFeatures().length > 0 || (c.dnd5ePluginFeatureIds?.length ?? 0) > 0
  const activeTab = selectedTab === 'class' && !classDefinition
    ? 'sheet'
    : selectedTab === 'spellbook' && !hasSpellbookTab
      ? 'sheet'
    : selectedTab === 'plugins' && !hasPluginTab
      ? 'sheet'
      : selectedTab
  const effectiveSavingThrows = dnd5eEffectiveSavingThrowProficiencies(c)
  const savingThrowAuraBonus = dnd5eSelfSavingThrowAuraBonus(c)
  const proficiency = rules.proficiencyBonus(clamp(c.level, 1, 20))
  const initiative = dnd5eStoredCharacterInitiativeModifier(c)
  const passivePerception = 10 + dnd5eSkillCheckModifier(c, 'perception')
  const hitPointRule = dnd5eClassHitPointRule(c)
  const fixedMaxHp = dnd5eFixedMaxHp(c)
  const hitPointMaximumMode = c.hitPointMaximumMode ?? 'fixed'
  const manualHitPointRolls = dnd5eManualHitPointRolls(c)
  const constitutionModifier = rules.abilityModifier(clamp(c.abilities.con, 1, 30))
  const songOfRestBard = characters
    .filter((candidate) => candidate.rulesetId === 'dnd5e-2014-srd-5.1' && dnd5eCharacterClassLevel(candidate, 'bard') >= 2)
    .map((candidate) => ({ character: candidate, dieSides: dnd5eBardSongOfRestDie(dnd5eCharacterClassLevel(candidate, 'bard')) }))
    .filter((entry) => entry.dieSides > 0)
    .sort((left, right) => right.dieSides - left.dieSides)[0]
  const selectedHitDiceCount = hitDice.reduce((total, pool, index) =>
    total + Math.min(pool.current, Math.max(0, Math.floor(shortRestHitDice[index] ?? 0))), 0)

  const rollDie = (sides: number): number => {
    if (globalThis.crypto?.getRandomValues) {
      const value = new Uint32Array(1)
      globalThis.crypto.getRandomValues(value)
      return value[0] % sides + 1
    }
    return Math.floor(Math.random() * sides) + 1
  }

  const settleShortRestHitDice = () => {
    const spends = hitDice.flatMap((pool, poolIndex) => {
      const count = Math.min(pool.current, Math.max(0, Math.floor(shortRestHitDice[poolIndex] ?? 0)))
      return count > 0 ? [{ poolIndex, rolls: Array.from({ length: count }, () => rollDie(pool.sides)) }] : []
    })
    if (spends.length === 0) return
    const songOfRest = useSongOfRest && songOfRestBard
      ? {
          dieSides: songOfRestBard.dieSides as 6 | 8 | 10 | 12,
          roll: rollDie(songOfRestBard.dieSides),
        }
      : undefined
    const resolved = resolveDnd5eShortRestHitDice({ character: c, spends, songOfRest })
    updateCharacterHitPoints({
      currentHp: resolved.character.currentHp,
      hitPointDice: resolved.character.hitPointDice,
    })
    setShortRestHitDice({})
    setShortRestResult(
      `花费 ${resolved.hitDiceSpent} 枚生命骰，生命骰恢复 ${resolved.hitDiceHealing} 点` +
      (resolved.songOfRestHealing > 0 ? `，休憩曲额外恢复 ${resolved.songOfRestHealing} 点` : '') +
      `；实际恢复 ${resolved.healingApplied} 点。`,
    )
  }

  const toggleSavingThrow = (key: AbilityKey) => {
    updateCharacter({
      savingThrows: c.savingThrows.includes(key)
        ? c.savingThrows.filter((item) => item !== key)
        : [...c.savingThrows, key],
    })
  }
  const toggleSkill = (key: string) => {
    updateCharacter({
      skills: c.skills.includes(key)
        ? c.skills.filter((item) => item !== key)
        : [...c.skills, key],
    })
  }

  return (
    <div className="space-y-5">
      {readOnly && (
        <div className="rounded-xl border border-amber-400/20 bg-amber-500/[0.08] px-4 py-3 text-sm text-amber-100">
          DM 只读检视：这里展示玩家同步到房间的角色快照，任何字段都不能从此窗口修改。
        </div>
      )}
      <fieldset disabled={readOnly} className="contents">
      <section className="glass rounded-2xl p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <CharacterPortraitEditor
            name={c.name}
            avatar={c.avatar}
            accent={c.accent}
            portrait={c.portrait}
            editable={!readOnly}
            onChange={(portrait) => updateCharacter({ portrait })}
            onAvatarChange={(avatar) => updateCharacter({ avatar })}
          />
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-3 md:grid-cols-4">
            <Field label="角色名称" value={c.name} onChange={(value) => updateCharacter({ name: value })} className="col-span-2" />
            <SelectField
              label="起始职业"
              value={c.charClass}
              options={DND5E_2014_CLASS_OPTIONS}
              disabled={Object.keys(classLevels).length > 1}
              onChange={(value) => {
                const nextClass = dnd5eClassDefinition(value)
                setSelectedTab('sheet')
                updateCharacter({
                  charClass: value,
                  savingThrows: nextClass ? [...nextClass.savingThrows] : c.savingThrows,
                  equipment: defaultEquipmentForDnd5eCharacter({ charClass: value }),
                })
              }}
            />
            <NumberField label="等级" value={c.level} min={1} max={20} disabled={Object.keys(classLevels).length > 1} onChange={(value) => updateCharacter({ level: value })} />
            <SelectField
              label="种族"
              value={c.race}
              options={raceOptions}
              onChange={(value) => {
                const pluginRace = pluginRaces.find((race) => race.name === value)
                updateCharacter({
                  race: value,
                  dnd5eRaceId: pluginRace?.id,
                  speed: dnd5eRaceSpeed(pluginRace?.id ?? value),
                })
              }}
            />
            <SelectField
              label="背景"
              value={c.background}
              options={backgroundOptions}
              onChange={(value) => {
                const pluginBackground = pluginBackgrounds.find((background) => background.name === value)
                const previousBackgroundSkills = new Set(c.dnd5eBackgroundSkillProficiencies ?? [])
                updateCharacter({
                  background: value,
                  dnd5eBackgroundId: pluginBackground?.id,
                  dnd5eBackgroundSkillProficiencies: pluginBackground ? [...pluginBackground.skillProficiencies] : [],
                  skills: pluginBackground
                    ? [...new Set([...c.skills.filter((skill) => !previousBackgroundSkills.has(skill)), ...pluginBackground.skillProficiencies])]
                    : c.skills.filter((skill) => !previousBackgroundSkills.has(skill)),
                })
              }}
            />
            <SelectField label="阵营" value={c.alignment ?? ''} options={DND5E_2014_ALIGNMENT_OPTIONS} onChange={(value) => updateCharacter({ alignment: value })} />
            <NumberField label="经验值" value={c.experience} min={0} max={999999999} onChange={(value) => updateCharacter({ experience: value })} />
            <Field label="玩家" value={c.player} onChange={(value) => updateCharacter({ player: value })} />
            <NumberField label="激励骰数量" value={c.inspiration} min={0} max={99} onChange={(value) => updateCharacter({ inspiration: value })} />
          </div>
        </div>
      </section>
      </fieldset>

      <nav className="glass flex gap-1 rounded-2xl p-1.5" aria-label="角色页面分页">
          <CharacterTab active={activeTab === 'sheet'} onClick={() => setSelectedTab('sheet')}>人物卡</CharacterTab>
          {classDefinition && <CharacterTab active={activeTab === 'class'} onClick={() => setSelectedTab('class')}>职业</CharacterTab>}
          <CharacterTab active={activeTab === 'inventory'} onClick={() => setSelectedTab('inventory')}>物品栏</CharacterTab>
          {hasSpellbookTab && <CharacterTab active={activeTab === 'spellbook'} onClick={() => setSelectedTab('spellbook')}>法术书</CharacterTab>}
          {hasPluginTab && <CharacterTab active={activeTab === 'plugins'} onClick={() => setSelectedTab('plugins')}>扩展规则</CharacterTab>}
      </nav>

      <fieldset disabled={readOnly} className="contents">
      {activeTab === 'sheet' && <>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <Stat icon={Shield} label="护甲等级" value={`${dnd5eArmorClass(c)}`} />
        <Stat icon={Footprints} label="速度" value={`${dnd5eWalkingSpeed(c)} 尺`} />
        <Stat icon={Swords} label="先攻" value={formatMod(initiative)} />
        <Stat icon={Award} label="熟练加值" value={formatMod(proficiency)} />
        <Stat icon={Sparkles} label="被动察觉" value={`${passivePerception}`} />
        <Stat icon={Dices} label="规则版本" value="5e 2014" />
      </section>

      {selectedPluginBackground && <section className="glass rounded-2xl border border-amber-400/15 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h3 className="text-sm font-semibold text-amber-100">{selectedPluginBackground.name}</h3><p className="mt-1 text-xs text-slate-500">背景插件：{selectedPluginBackground.ownerPluginName}</p></div>
          <span className="rounded-lg border border-white/8 bg-black/15 px-2.5 py-1 text-[11px] text-slate-400">技能：{selectedPluginBackground.skillProficiencies.map((key) => SKILLS.find((skill) => skill.key === key)?.label ?? key).join('、') || '无'}</span>
        </div>
        {selectedPluginBackground.description && <p className="mt-3 text-xs leading-5 text-slate-400">{selectedPluginBackground.description}</p>}
        {selectedPluginBackground.feature && <div className="mt-3 rounded-xl border border-white/8 bg-black/15 px-3 py-2"><p className="text-xs font-semibold text-slate-200">背景特性：{selectedPluginBackground.feature.name}</p><p className="mt-1 text-xs leading-5 text-slate-500">{selectedPluginBackground.feature.description}</p></div>}
      </section>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <section className="glass rounded-2xl p-4">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-200">属性、豁免与技能</h3>
            <p className="mt-1 text-xs text-slate-500">技能依照 D&D 5e 2014 人物卡归入其默认关联属性。</p>
          </div>
          <div className="space-y-3">
            {ABILITIES.map((ability) => (
              <AbilitySection
                key={ability.key}
                abilityKey={ability.key}
                label={ability.label}
                score={clamp(c.abilities[ability.key], 1, 30)}
                skills={SKILLS.filter((skill) => skill.ability === ability.key)}
                proficiency={proficiency}
                savingThrowProficient={effectiveSavingThrows.includes(ability.key)}
                savingThrowAdditionalBonus={savingThrowAuraBonus}
                skillProficiencyRank={(skillKey) => dnd5eSkillCheckProficiencyRank(c, skillKey)}
                skillCheckModifier={(skillKey) => dnd5eSkillCheckModifier(c, skillKey)}
                onScoreChange={(score) => updateCharacter({ abilities: { ...c.abilities, [ability.key]: score } })}
                onToggleSavingThrow={() => toggleSavingThrow(ability.key)}
                onToggleSkill={toggleSkill}
              />
            ))}
          </div>
        </section>

        <div className="space-y-5">
          <div className="space-y-2">
            <HpPanel
              current={c.currentHp}
              max={c.maxHp}
              temp={c.tempHp}
              editable={!readOnly}
              maxEditable={false}
              onChange={updateCharacterHitPoints}
            />
            <div className="glass rounded-xl px-4 py-3 text-xs text-slate-400">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor={`hp-mode-${id}`} className="font-medium text-slate-300">生命值方案</label>
                <select
                  id={`hp-mode-${id}`}
                  value={hitPointMaximumMode}
                  onChange={(event) => {
                    const mode = event.target.value as 'fixed' | 'manual'
                    updateCharacter({
                      hitPointMaximumMode: mode,
                      ...(mode === 'manual' ? { hitPointRolls: dnd5eManualHitPointRolls(c) } : {}),
                    })
                  }}
                  className="rounded-lg border border-white/10 bg-void-900/80 px-2 py-1 text-slate-200 outline-none focus:border-arcane-500"
                >
                  <option value="fixed">固定值（自动）</option>
                  <option value="manual">逐级掷骰（手动）</option>
                </select>
              </div>
              {hitPointMaximumMode === 'fixed' ? (
                <p className="mt-2">
                  d{hitPointRule.hitDieSides}：1 级取满；之后每级固定 {hitPointRule.fixedHitPointsPerLevel}＋体质调整值，每级至少增加 1。当前固定上限为 {fixedMaxHp}。
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  <p className="leading-5">
                    第 1 级自动取 d{hitPointRule.hitDieSides} 满值；之后每一级分别记录原始骰面，再逐级加入体质调整值 {formatMod(constitutionModifier)}，且每级至少增加 1。体质豁免的熟练加值不参与生命值计算。
                  </p>
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    <span className="rounded-md border border-white/8 bg-black/20 px-2 py-1 text-slate-300">
                      原始骰面合计 {manualHitPointRolls.reduce((total, roll) => total + roll, 0)}
                    </span>
                    <span className="rounded-md border border-rose-300/10 bg-rose-500/[0.06] px-2 py-1 text-rose-100">
                      当前生命上限 {c.maxHp}
                    </span>
                  </div>
                  {manualHitPointRolls.length > 1 && (
                    <details className="rounded-lg border border-white/8 bg-black/15 p-3" open={manualHitPointRolls.length <= 6}>
                      <summary className="cursor-pointer select-none font-medium text-slate-300">
                        各级生命骰结果（不含体质）
                      </summary>
                      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {manualHitPointRolls.slice(1).map((roll, rollIndex) => {
                          const levelIndex = rollIndex + 1
                          return (
                            <label key={levelIndex} className="space-y-1 text-[10px] text-slate-500">
                              <span>{levelIndex + 1} 级 · d{hitPointRule.hitDieSides}</span>
                              <input
                                type="number"
                                min={1}
                                max={hitPointRule.hitDieSides}
                                value={roll}
                                aria-label={`${levelIndex + 1} 级生命骰结果`}
                                onChange={(event) => {
                                  const nextRolls = [...manualHitPointRolls]
                                  nextRolls[levelIndex] = clamp(Number(event.target.value) || 1, 1, hitPointRule.hitDieSides)
                                  updateCharacter({ hitPointRolls: nextRolls })
                                }}
                                className="w-full rounded-md border border-white/10 bg-void-900/70 px-2 py-1.5 text-center text-xs font-semibold text-slate-100 outline-none focus:border-rose-400/50"
                              />
                            </label>
                          )
                        })}
                      </div>
                    </details>
                  )}
                </div>
              )}
            </div>
          </div>

          <section className="glass rounded-2xl p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
              <HeartPulse className="h-4 w-4 text-rose-300" />死亡豁免与专注
            </h3>
            <div className="space-y-3">
              <Counter label="成功" value={c.deathSaveSuccesses ?? 0} max={3} tone="emerald" onChange={(value) => updateCharacter({ deathSaveSuccesses: value, deathSaveStable: value >= 3 })} />
              <Counter label="失败" value={c.deathSaveFailures ?? 0} max={3} tone="rose" onChange={(value) => updateCharacter({ deathSaveFailures: value })} />
              <div className="grid grid-cols-2 gap-2">
                <Toggle label="伤势稳定" active={!!c.deathSaveStable} onClick={() => updateCharacter({ deathSaveStable: !c.deathSaveStable })} />
                <Toggle label="保持专注" active={!!c.concentrating} onClick={() => updateCharacter({ concentrating: !c.concentrating })} />
              </div>
            </div>
          </section>

          <section className="glass rounded-2xl p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-200">生命骰</h3>
            <div className="space-y-2">
              {hitDice.map((pool, index) => (
                <div key={`${pool.sides}-${index}`} className="grid grid-cols-[auto_auto_1fr] items-center gap-3 rounded-lg bg-white/5 px-3 py-2">
                  <span className="font-bold text-arcane-200">d{pool.sides}</span>
                  <input
                    type="number"
                    min={0}
                    max={pool.max}
                    value={pool.current}
                    aria-label={`剩余 d${pool.sides} 生命骰`}
                    onChange={(event) => {
                      const next = hitDice.map((item, itemIndex) => itemIndex === index
                        ? { ...item, current: clamp(Number(event.target.value) || 0, 0, item.max) }
                        : item)
                      updateCharacter({ hitPointDice: next })
                    }}
                    className="w-14 rounded border border-white/10 bg-void-950/70 px-1 py-1 text-center text-sm"
                  />
                  <span className="text-sm text-slate-500">/ {pool.max} 枚</span>
                  <label className="col-span-3 grid grid-cols-[1fr_70px] items-center gap-2 text-xs text-slate-400">
                    本次短休花费
                    <input
                      type="number"
                      min={0}
                      max={pool.current}
                      value={shortRestHitDice[index] ?? 0}
                      onChange={(event) => setShortRestHitDice((current) => ({
                        ...current,
                        [index]: clamp(Number(event.target.value) || 0, 0, pool.current),
                      }))}
                      className="rounded border border-white/10 bg-void-950/70 px-2 py-1 text-center text-sm text-slate-200"
                    />
                  </label>
                </div>
              ))}
              {songOfRestBard ? <label className="flex items-start gap-2 rounded-lg border border-violet-400/15 bg-violet-500/[0.06] px-3 py-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={useSongOfRest}
                  onChange={(event) => setUseSongOfRest(event.target.checked)}
                  className="mt-0.5"
                />
                <span><strong className="text-violet-200">使用休憩曲 d{songOfRestBard.dieSides}</strong><span className="mt-0.5 block text-slate-500">由 {songOfRestBard.character.name} 演奏；本次短休只额外掷一次。</span></span>
              </label> : null}
              <button
                type="button"
                onClick={settleShortRestHitDice}
                disabled={selectedHitDiceCount < 1 || c.currentHp >= c.maxHp}
                className="w-full rounded-lg bg-emerald-500/15 px-3 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                结算短休生命骰{selectedHitDiceCount > 0 ? `（${selectedHitDiceCount} 枚）` : ''}
              </button>
              {shortRestResult ? <p className="text-xs leading-5 text-emerald-300">{shortRestResult}</p> : null}
            </div>
          </section>

          <section className="glass rounded-2xl p-4">
            <h3 className="mb-2 text-sm font-semibold text-slate-200">状态</h3>
            <div className="rounded-lg border border-white/10 bg-void-900/60 px-3 py-2 text-sm text-slate-300">
              {c.conditions.length > 0 ? c.conditions.join('、') : '当前没有状态效果'}
            </div>
            <p className="mt-2 text-xs text-slate-500">此处为 ActiveEffect 的只读投影；状态由 DM 战斗面板、法术、特性或规则插件修改。</p>
          </section>

          <section className="glass rounded-2xl p-4">
            <h3 className="mb-2 text-sm font-semibold text-slate-200">背景故事</h3>
            <p className="mb-3 text-xs leading-5 text-slate-500">记录角色的出身、重要经历、关系、目标以及踏上冒险的原因。</p>
            <textarea
              aria-label="背景故事"
              value={c.backstory ?? ''}
              onChange={(event) => updateCharacter({ backstory: event.target.value })}
              rows={8}
              placeholder="例如：角色来自哪里？为什么离开故乡？他最在意的人或目标是什么？"
              className="w-full resize-y rounded-lg border border-white/10 bg-void-900/60 p-3 text-sm leading-6 text-slate-200 outline-none focus:border-arcane-500"
            />
          </section>

          <section className="glass rounded-2xl p-4">
            <h3 className="mb-2 text-sm font-semibold text-slate-200">角色笔记</h3>
            <textarea aria-label="角色笔记" value={c.notes} onChange={(event) => updateCharacter({ notes: event.target.value })} rows={5} className="w-full resize-none rounded-lg border border-white/10 bg-void-900/60 p-3 text-sm text-slate-200" />
            {isDM && (
              <textarea
                value={c.dmNotes}
                onChange={(event) => updateCharacter({ dmNotes: event.target.value })}
                rows={3}
                placeholder="仅 DM 可见的笔记"
                className="mt-3 w-full resize-none rounded-lg border border-amber-500/20 bg-void-900/60 p-3 text-sm text-amber-100"
              />
            )}
          </section>
        </div>
      </div>
      </>}
      </fieldset>

      {activeTab === 'class' && <Dnd5eMulticlassPanel character={c} selectedClassId={activeClassId} onSelectClass={setSelectedClassId} onChange={updateCharacter} />}
      {activeTab === 'class' && activeClassDefinition?.id === 'fighter' && <FighterProgressionPanel character={classCharacter} onChange={updateCharacter} />}
      {activeTab === 'class' && activeClassDefinition && activeClassDefinition.id !== 'fighter' && <Dnd5eClassProgressionPanel character={classCharacter} isStartingClass={activeClassDefinition.name === c.charClass} onChange={updateCharacter} />}
      {activeTab === 'inventory' && <EquipmentTab charId={c.id} editable={!readOnly} />}
      {activeTab === 'spellbook' && <Dnd5eSpellbookPanel character={c} onChange={updateCharacter} />}
      {activeTab === 'plugins' && <Dnd5ePluginFeaturesPanel character={c} onChange={updateCharacter} />}
    </div>
  )
}

function CharacterTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-5 py-2 text-sm font-semibold transition-colors ${active ? 'bg-arcane-500/20 text-arcane-100 shadow-sm' : 'text-slate-500 hover:bg-white/5 hover:text-slate-200'}`}
    >
      {children}
    </button>
  )
}

function AbilitySection({
  abilityKey,
  label,
  score,
  skills,
  proficiency,
  savingThrowProficient,
  savingThrowAdditionalBonus,
  skillProficiencyRank,
  skillCheckModifier,
  onScoreChange,
  onToggleSavingThrow,
  onToggleSkill,
}: {
  abilityKey: AbilityKey
  label: string
  score: number
  skills: SkillDef[]
  proficiency: number
  savingThrowProficient: boolean
  savingThrowAdditionalBonus: number
  skillProficiencyRank: (skillKey: string) => 0 | 1 | 2
  skillCheckModifier: (skillKey: string) => number
  onScoreChange: (score: number) => void
  onToggleSavingThrow: () => void
  onToggleSkill: (key: string) => void
}) {
  const modifier = rules.abilityModifier(score)
  const saveBonus = modifier + (savingThrowProficient ? proficiency : 0) + savingThrowAdditionalBonus
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-void-900/40">
      <div className="grid gap-3 p-3 sm:grid-cols-[180px_1fr]">
        <div className="flex items-center gap-2 sm:border-r sm:border-white/10 sm:pr-3">
          <div className="min-w-0 flex-1">
            <div className="whitespace-nowrap text-base font-bold text-slate-100">{label}</div>
            <div className="text-[11px] text-slate-500">{abilityKey.toUpperCase()}</div>
          </div>
          <input
            type="number"
            min={1}
            max={30}
            value={score}
            aria-label={`${label}属性值`}
            onChange={(event) => onScoreChange(clamp(Number(event.target.value) || 1, 1, 30))}
            className="w-14 rounded-md border border-white/10 bg-void-950/70 px-1 py-1 text-center text-sm text-slate-100"
          />
          <span className="w-10 text-right text-xl font-bold text-arcane-200">{formatMod(modifier)}</span>
        </div>
        <div className="min-w-0">
          <button type="button" onClick={onToggleSavingThrow} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/5">
            <Dot active={savingThrowProficient} />
            <span className="min-w-0 flex-1 text-slate-300">{label}豁免</span>
            <span className="font-semibold text-arcane-200">{formatMod(saveBonus)}</span>
          </button>
          {skills.length > 0 && (
            <div className="mt-1 border-t border-white/8 pt-1">
              {skills.map((skill) => {
              const proficiencyRank = skillProficiencyRank(skill.key)
              const proficient = proficiencyRank > 0
              const expertise = proficiencyRank === 2
              const bonus = skillCheckModifier(skill.key)
              return (
                <button key={skill.key} type="button" onClick={() => onToggleSkill(skill.key)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/5">
                  <Dot active={proficient} />
                  <span className="min-w-0 flex-1 text-slate-300">{skill.label}{expertise && <span className="ml-1.5 text-[10px] text-amber-300">专精</span>}</span>
                  <span className="font-semibold text-arcane-200">{formatMod(bonus)}</span>
                </button>
              )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Dot({ active }: { active: boolean }) {
  return <span className={`h-3 w-3 shrink-0 rounded-full border ${active ? 'border-arcane-300 bg-arcane-500' : 'border-slate-600'}`} />
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return <div className="glass flex flex-col items-center rounded-xl px-2 py-3"><Icon className="h-4 w-4 text-arcane-300" /><strong className="mt-1 text-xl text-slate-100">{value}</strong><span className="text-center text-[11px] text-slate-500">{label}</span></div>
}

function Field({ label, value, onChange, className = '' }: { label: string; value: string; onChange: (value: string) => void; className?: string }) {
  return <label className={`flex flex-col gap-1 ${className}`}><span className="text-xs font-semibold tracking-wider text-slate-500">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} className="rounded-lg border border-white/10 bg-void-900/60 px-3 py-1.5 text-sm text-slate-200" /></label>
}

function SelectField({ label, value, options, onChange, disabled = false }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void; disabled?: boolean }) {
  const legacyValue = value && !options.some((option) => option === value)
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold tracking-wider text-slate-500">{label}</span>
      <select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="rounded-lg border border-white/10 bg-void-900/60 px-3 py-1.5 text-sm text-slate-200 disabled:cursor-not-allowed disabled:opacity-50">
        <option value="">未选择</option>
        {legacyValue && <option value={value}>{value}（旧数据）</option>}
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  )
}

function NumberField({ label, value, min, max, onChange, disabled = false }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void; disabled?: boolean }) {
  const [draft, setDraft] = useState<string | null>(null)
  const displayedValue = draft ?? String(value)

  const commit = () => {
    const next = resolveBoundedNumberDraft(displayedValue, value, min, max)
    setDraft(null)
    if (next !== value) onChange(next)
  }

  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold tracking-wider text-slate-500">{label}</span>
      <input
        type="number"
        value={displayedValue}
        min={min}
        max={max}
        disabled={disabled}
        onFocus={() => setDraft(String(value))}
        onChange={(event) => {
          const nextDraft = event.target.value
          setDraft(nextDraft)
          const next = parseBoundedNumberDraft(nextDraft, min, max)
          if (next != null && next !== value) onChange(next)
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
        className="rounded-lg border border-white/10 bg-void-900/60 px-3 py-1.5 text-sm text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
      />
    </label>
  )
}

function Toggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`rounded-lg border px-3 py-2 text-sm ${active ? 'border-arcane-400/50 bg-arcane-500/20 text-arcane-100' : 'border-white/10 bg-white/5 text-slate-400'}`}>{label}：{active ? '是' : '否'}</button>
}

function Counter({ label, value, max, tone, onChange }: { label: string; value: number; max: number; tone: 'emerald' | 'rose'; onChange: (value: number) => void }) {
  return <div className="flex items-center justify-between"><span className="text-sm text-slate-300">{label}</span><div className="flex gap-2">{Array.from({ length: max }, (_, index) => <button key={index} type="button" aria-label={`${label} ${index + 1}`} onClick={() => onChange(value === index + 1 ? index : index + 1)} className={`h-5 w-5 rounded-full border ${index < value ? tone === 'emerald' ? 'border-emerald-300 bg-emerald-500' : 'border-rose-300 bg-rose-500' : 'border-slate-600'}`} />)}</div></div>
}
