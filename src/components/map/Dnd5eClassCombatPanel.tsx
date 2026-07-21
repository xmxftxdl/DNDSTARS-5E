import { useMemo, useState } from 'react'
import { Clock3, Crosshair, Footprints, PackageOpen, RotateCcw, Shield, Sparkles, Sword } from 'lucide-react'
import { classResourceDefinitions, getClassResource } from '../../lib/classResources'
import type { Dnd5eClassFeaturePayload, Dnd5eTurnEconomyCounts, Dnd5eWeaponAttackOptions } from '../../lib/sharedCombatTypes'
import {
  dnd5eArmorClass,
  dnd5eAttacksPerAttackAction,
  dnd5eClassDefinitionForCharacter,
  dnd5eKnownWildShapeForms,
  dnd5eOffHandWeaponAttackProfile,
  dnd5eWalkingSpeed,
  dnd5eWeaponAttackProfile,
  getDnd5eSrdMonster,
} from '../../rulesets/dnd5e'
import type { Character } from '../../types/character'
import Dnd5eBasicActionsPanel from './Dnd5eBasicActionsPanel'
import type { Dnd5eBasicActionPayload } from '../../lib/sharedCombatTypes'

export interface Dnd5eFeatureTargetOption {
  tokenId: string
  tokenType?: 'player' | 'enemy'
  characterId?: string
  opposed?: boolean
  label: string
  currentHp: number
  maxHp: number
  creatureType?: string
  conditions?: readonly string[]
  distanceFeet: number
  ongoingSpellEffects?: readonly {
    sourceTokenId: string
    spellId: string
    spellName: string
    sourceName: string
  }[]
}

export default function Dnd5eClassCombatPanel({ character, canAct, targeting, pending, turnEconomy, featureTargets, onAttack, onDisengage, onDodge, onBasicAction, onFeature }: {
  character: Character
  canAct: boolean
  targeting: boolean
  pending: boolean
  turnEconomy: Dnd5eTurnEconomyCounts
  featureTargets: readonly Dnd5eFeatureTargetOption[]
  onAttack: (options?: Dnd5eWeaponAttackOptions) => void
  onDisengage: () => void
  onDodge: () => void
  onBasicAction: (payload: Dnd5eBasicActionPayload) => void
  onFeature: (payload: Dnd5eClassFeaturePayload) => void
}) {
  const definition = dnd5eClassDefinitionForCharacter(character)
  const profile = dnd5eWeaponAttackProfile(character)
  const offHandProfile = dnd5eOffHandWeaponAttackProfile(character)
  const activeWildShape = character.dnd5eCombatState?.wildShapeFormId
    ? getDnd5eSrdMonster(character.dnd5eCombatState.wildShapeFormId)
    : undefined
  const wildShapeAttackActions = activeWildShape?.actions.filter((action) => {
    if (action.kind === 'multiattack') return true
    if (action.kind !== 'weapon-attack') return false
    return !activeWildShape.actions.some((candidate) => candidate.kind === 'multiattack' && candidate.sequence?.includes(action.id))
  }) ?? []
  const [divineSmiteSlotLevel, setDivineSmiteSlotLevel] = useState(0)
  const [recklessAttack, setRecklessAttack] = useState(false)
  const [stunningStrike, setStunningStrike] = useState(false)
  const [foeSlayer, setFoeSlayer] = useState<'none' | 'attack' | 'damage'>('none')
  const availableSmiteSlots = Array.from({ length: 9 }, (_, index) => index + 1)
    .filter((level) => (getClassResource(character, `dnd5e-spell-slot-${level}`)?.current ?? 0) > 0)
  const selectedSmiteSlotLevel = availableSmiteSlots.includes(divineSmiteSlotLevel) ? divineSmiteSlotLevel : 0
  const recklessAttackActive = !!character.dnd5eCombatState?.recklessAttackTurnKey
  const foeSlayerAvailable = definition?.id === 'ranger' && character.level >= 20 &&
    character.dnd5eCombatState?.foeSlayerTurnKey !== turnEconomy.turnKey
  const requestedAttackOptions: Dnd5eWeaponAttackOptions = {
    ...(selectedSmiteSlotLevel > 0 ? { divineSmiteSlotLevel: selectedSmiteSlotLevel } : {}),
    ...(recklessAttack && !recklessAttackActive ? { recklessAttack: true } : {}),
    ...(stunningStrike ? { stunningStrike: true } : {}),
    ...(foeSlayerAvailable && foeSlayer !== 'none' ? { foeSlayer } : {}),
  }
  const hasRequestedAttackOptions = Object.keys(requestedAttackOptions).length > 0
  const frenzyAttackAvailable = definition?.id === 'barbarian' &&
    character.dnd5eClassChoices?.classes?.barbarian?.subclass === 'berserker' &&
    character.dnd5eCombatState?.raging === true &&
    character.dnd5eCombatState?.frenzying === true &&
    character.dnd5eCombatState?.frenzyStartedTurnKey !== turnEconomy.turnKey &&
    profile?.mode === 'melee'
  const hordeBreakerAttackAvailable = definition?.id === 'ranger' &&
    character.dnd5eClassChoices?.classes?.ranger?.subclass === 'hunter' &&
    character.dnd5eClassChoices?.classes?.ranger?.selections?.['hunters-prey']?.includes('horde-breaker') === true &&
    character.dnd5eCombatState?.hordeBreakerOpportunityTurnKey === turnEconomy.turnKey &&
    character.dnd5eCombatState?.hordeBreakerUsedTurnKey !== turnEconomy.turnKey
  const selectedHunterMultiattack = definition?.id === 'ranger' && character.level >= 11 &&
    character.dnd5eClassChoices?.classes?.ranger?.subclass === 'hunter'
    ? character.dnd5eClassChoices.classes.ranger.selections?.multiattack?.[0]
    : undefined
  const hunterMultiattack = selectedHunterMultiattack === 'volley' || selectedHunterMultiattack === 'whirlwind-attack'
    ? selectedHunterMultiattack
    : undefined
  const hunterMultiattackAvailable = !!profile && turnEconomy.action.current > 0 &&
    ((hunterMultiattack === 'volley' && profile.mode === 'ranged') ||
      (hunterMultiattack === 'whirlwind-attack' && profile.mode === 'melee'))
  const attacksPerAction = dnd5eAttacksPerAttackAction(character)
  const attackLimit = attacksPerAction * Math.max(1, turnEconomy.action.max)
  const canContinueAttackAction = turnEconomy.attacksUsed > 0 && turnEconomy.attacksUsed % attacksPerAction !== 0
  const weaponAttackAvailable = turnEconomy.attacksUsed < attackLimit && (turnEconomy.action.current > 0 || canContinueAttackAction)
  const offHandAttackAvailable = !!offHandProfile && turnEconomy.attacksUsed > 0 && turnEconomy.bonusAction.current > 0
  const resources = classResourceDefinitions(character)
    .filter((resource) => !resource.key.startsWith('dnd5e-spell-slot-') && resource.key !== 'dnd5e-pact-slot')
    .map((resource) => ({ resource, state: getClassResource(character, resource.key) }))
    .filter((entry) => entry.state)

  return (
    <div className="grid gap-3 md:grid-cols-[1fr_220px]">
      <section className="rounded-xl border border-white/10 bg-void-900/45 p-3 md:col-span-2" aria-label="本回合行动经济">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200"><Clock3 className="h-4 w-4 text-arcane-300" />本回合可用行动</div>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${canAct ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-slate-500'}`}>{canAct ? '你的回合' : '回合外'}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <EconomyCard icon={Sword} label="主动动作" pool={turnEconomy.action} detail="攻击、施法等" />
          <EconomyCard icon={Sparkles} label="附赠动作" pool={turnEconomy.bonusAction} detail="职业特性等" />
          <EconomyCard icon={RotateCcw} label="反应" pool={turnEconomy.reaction} detail="借机攻击等" />
          <EconomyCard icon={Footprints} label="移动" pool={turnEconomy.movement} detail="独立于动作" suffix="尺" />
          <EconomyCard icon={PackageOpen} label="物件交互" pool={turnEconomy.objectInteraction ?? { current: 1, max: 1 }} detail="每回合一次免费" />
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-void-900/45 p-4">
        <div className="flex items-center gap-2"><Sword className="h-5 w-5 text-arcane-300" /><div><h3 className="font-bold text-slate-100">武器攻击</h3><p className="text-xs text-slate-500">D&amp;D 5e 2014 · 主动动作</p></div></div>
        {activeWildShape ? (
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <Stat label="当前形态" value={activeWildShape.name} />
            <Stat label="形态生命" value={`${character.dnd5eCombatState?.wildShapeCurrentHp ?? activeWildShape.hitPoints.average}/${activeWildShape.hitPoints.average}`} />
            <Stat label="护甲等级" value={`${activeWildShape.armorClass.value}`} />
            <Stat label="速度" value={`${activeWildShape.speed.walk} 尺`} />
          </div>
        ) : profile ? (
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <Stat label="武器" value={profile.weaponName} />
            <Stat label="命中" value={`${profile.attackModifier >= 0 ? '+' : ''}${profile.attackModifier}`} />
            <Stat label="伤害" value={`${profile.damage.count}d${profile.damage.sides}${profile.damage.bonus >= 0 ? '+' : ''}${profile.damage.bonus}`} />
            <Stat label="攻击次数" value={`${dnd5eAttacksPerAttackAction(character)} 次／动作`} />
          </div>
        ) : <p className="mt-4 text-sm text-rose-300">没有装备可用的 5e 武器。</p>}
        {definition?.id === 'paladin' && character.level >= 2 && profile?.mode === 'melee' ? <label className="mt-4 block text-xs text-slate-400">
          命中时至圣斩
          <select
            value={selectedSmiteSlotLevel}
            onChange={(event) => setDivineSmiteSlotLevel(Number(event.target.value))}
            disabled={pending || availableSmiteSlots.length === 0}
            className="mt-1 w-full rounded-lg border border-white/10 bg-void-950/70 px-3 py-2 text-sm text-slate-200 disabled:opacity-40"
          >
            <option value={0}>不消耗法术位</option>
            {availableSmiteSlots.map((level) => <option key={level} value={level}>{level} 环法术位</option>)}
          </select>
          <span className="mt-1 block text-[11px] text-slate-500">仅命中时消耗；重击会使至圣斩伤害骰翻倍。</span>
        </label> : null}
        {definition?.id === 'barbarian' && character.level >= 2 && profile?.mode === 'melee' && profile.attackAbility === 'str' ? <label className="mt-4 flex items-start gap-2 rounded-lg border border-amber-400/15 bg-amber-500/[0.05] p-3 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={recklessAttack || recklessAttackActive}
            onChange={(event) => setRecklessAttack(event.target.checked)}
            disabled={pending || recklessAttackActive}
            className="mt-0.5"
          />
          <span><strong className="text-amber-200">鲁莽攻击</strong><span className="mt-1 block text-slate-500">本回合力量近战攻击获得优势；直到你的下一回合开始前，针对你的攻击也具有优势。</span></span>
        </label> : null}
        {definition?.id === 'monk' && character.level >= 5 && profile?.mode === 'melee' ? <label className="mt-4 flex items-start gap-2 rounded-lg border border-violet-400/15 bg-violet-500/[0.05] p-3 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={stunningStrike}
            onChange={(event) => setStunningStrike(event.target.checked)}
            disabled={pending || (getClassResource(character, 'dnd5e-ki')?.current ?? 0) < 1}
            className="mt-0.5"
          />
          <span><strong className="text-violet-200">震慑拳</strong><span className="mt-1 block text-slate-500">下一次近战武器攻击或徒手附赠攻击命中时，每次命中消耗 1 点气；目标体质豁免失败则震慑至你的下一回合结束。</span></span>
        </label> : null}
        {definition?.id === 'ranger' && character.level >= 20 ? <label className="mt-4 block text-xs text-slate-400">
          屠灭众敌
          <select
            value={foeSlayerAvailable ? foeSlayer : 'none'}
            onChange={(event) => setFoeSlayer(event.target.value as 'none' | 'attack' | 'damage')}
            disabled={pending || !foeSlayerAvailable}
            className="mt-1 w-full rounded-lg border border-white/10 bg-void-950/70 px-3 py-2 text-sm text-slate-200 disabled:opacity-40"
          >
            <option value="none">本次不使用</option>
            <option value="attack">感知调整值加入命中</option>
            <option value="damage">感知调整值加入伤害</option>
          </select>
          <span className="mt-1 block text-[11px] text-slate-500">仅对已选宿敌生效，每回合一次；Headless 会验证目标类型。</span>
        </label> : null}
        {!activeWildShape ? <button type="button" onClick={() => onAttack(hasRequestedAttackOptions ? requestedAttackOptions : undefined)} disabled={!canAct || !profile || pending || !weaponAttackAvailable} className={`${(definition?.id === 'paladin' && character.level >= 2 && profile?.mode === 'melee') || (definition?.id === 'barbarian' && character.level >= 2 && profile?.mode === 'melee' && profile.attackAbility === 'str') || (definition?.id === 'monk' && character.level >= 5 && profile?.mode === 'melee') ? 'mt-2' : 'mt-4'} flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold ${targeting ? 'bg-amber-500 text-void-950' : 'bg-arcane-500/25 text-arcane-100 hover:bg-arcane-500/40'} disabled:cursor-not-allowed disabled:opacity-40`}>
          <Crosshair className="h-4 w-4" />{pending ? '等待 DM 结算…' : targeting ? '请点击地图上的目标' : '选择目标并攻击'}
        </button> : <div className="mt-4 grid gap-2">
          {wildShapeAttackActions.map((shapeAction) => <button
            key={shapeAction.id}
            type="button"
            onClick={() => onAttack({ wildShapeActionIndex: activeWildShape.actions.indexOf(shapeAction) })}
            disabled={!canAct || pending || turnEconomy.action.current < 1}
            className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold ${targeting ? 'bg-amber-500 text-void-950' : 'bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/35'} disabled:cursor-not-allowed disabled:opacity-40`}
          >
            <Crosshair className="h-4 w-4" />{targeting ? '请点击地图上的目标' : `${activeWildShape.name}：${shapeAction.name}`}
          </button>)}
          {wildShapeAttackActions.length === 0 ? <p className="text-xs text-slate-500">此形态没有可用的攻击动作。</p> : null}
        </div>}
        {!activeWildShape && offHandProfile ? <button
          type="button"
          onClick={() => onAttack({ ...requestedAttackOptions, offHandAttack: true })}
          disabled={!canAct || pending || !offHandAttackAvailable}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-violet-400/20 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-200 hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Sword className="h-4 w-4" />副手附赠攻击（{offHandProfile.damage.count}d{offHandProfile.damage.sides}{offHandProfile.damage.bonus >= 0 ? '+' : ''}{offHandProfile.damage.bonus}）
        </button> : null}
        {!activeWildShape && hunterMultiattack ? <button
          type="button"
          onClick={() => onAttack({ hunterMultiattack })}
          disabled={!canAct || pending || !hunterMultiattackAvailable}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Crosshair className="h-4 w-4" />
          {hunterMultiattack === 'volley'
            ? '万箭齐发（点击射程内的中心 Token）'
            : '旋风攻击（点击任一相邻敌人）'}
        </button> : null}
        {frenzyAttackAvailable ? <button
          type="button"
          onClick={() => onAttack({ ...requestedAttackOptions, frenzyAttack: true })}
          disabled={!canAct || pending || turnEconomy.bonusAction.current < 1}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Sword className="h-4 w-4" />狂乱附赠攻击
        </button> : null}
        {hordeBreakerAttackAvailable ? <button
          type="button"
          onClick={() => onAttack({ ...requestedAttackOptions, hordeBreakerAttack: true })}
          disabled={!canAct || pending}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Sword className="h-4 w-4" />灭群者追加攻击（请选择原目标 5 尺内另一生物）
        </button> : null}
        <button type="button" onClick={onDisengage} disabled={!canAct || pending || turnEconomy.action.current < 1} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40">
          <Footprints className="h-4 w-4" />撤离（主动动作）
        </button>
        <button type="button" onClick={onDodge} disabled={!canAct || pending || turnEconomy.action.current < 1} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-sky-400/20 bg-sky-500/10 px-4 py-2 text-sm font-semibold text-sky-200 hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-40">
          <Shield className="h-4 w-4" />闪避（主动动作）
        </button>
      </section>

      <section className="rounded-xl border border-white/10 bg-void-900/45 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200"><Shield className="h-4 w-4 text-sky-300" />{definition?.name ?? character.charClass}</div>
        <dl className="mt-3 space-y-2 text-xs">
          <Equipment label="护甲等级" value={`${dnd5eArmorClass(character)}`} />
          <Equipment label="护甲" value={character.equipment?.armor?.name ?? '未装备'} />
          <Equipment label="副手" value={character.equipment?.offHand?.name ?? '未装备'} />
          <Equipment label="主武器" value={character.equipment?.mainWeapon?.name ?? '未装备'} />
        </dl>
      </section>

      <ClassFeatureControls
        character={character}
        canAct={canAct}
        pending={pending}
        stunningStrike={stunningStrike}
        turnEconomy={turnEconomy}
        targets={featureTargets}
        onFeature={onFeature}
      />

      <Dnd5eBasicActionsPanel
        canAct={canAct && (turnEconomy.action.current > 0 || canContinueAttackAction)}
        pending={pending}
        targets={featureTargets}
        onAction={onBasicAction}
      />

      <section className="rounded-xl border border-white/10 bg-void-900/45 p-4 md:col-span-2">
        <div className="text-sm font-semibold text-slate-200">职业资源</div>
        {resources.length > 0 ? <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {resources.map(({ resource, state }) => <Stat key={resource.key} label={resource.label} value={resource.unlimited?.(character) ? '∞' : `${state!.current}/${state!.max}`} />)}
        </div> : <p className="mt-2 text-xs text-slate-500">当前等级没有需记录次数的职业资源。</p>}
        <p className="mt-3 text-xs text-slate-500">职业资源只通过 D&amp;D Headless 的动作、附赠动作或反应事务消费。</p>
      </section>
    </div>
  )
}

function ClassFeatureControls({ character, canAct, pending, stunningStrike, turnEconomy, targets, onFeature }: {
  character: Character
  canAct: boolean
  pending: boolean
  stunningStrike: boolean
  turnEconomy: Dnd5eTurnEconomyCounts
  targets: readonly Dnd5eFeatureTargetOption[]
  onFeature: (payload: Dnd5eClassFeaturePayload) => void
}) {
  const definition = dnd5eClassDefinitionForCharacter(character)
  const [selectedTargetId, setSelectedTargetId] = useState('')
  const [selectedSecondaryTargetId, setSelectedSecondaryTargetId] = useState('')
  const [selectedCleansingTargetId, setSelectedCleansingTargetId] = useState('')
  const [selectedCleansingEffectKey, setSelectedCleansingEffectKey] = useState('')
  const [layOnHandsAmount, setLayOnHandsAmount] = useState(1)
  const [preserveAllocations, setPreserveAllocations] = useState<Record<string, number>>({})
  const [createSlotLevel, setCreateSlotLevel] = useState(1)
  const [convertSlotLevel, setConvertSlotLevel] = useState(1)
  const [draconicPresenceMode, setDraconicPresenceMode] = useState<'awe' | 'fear'>('fear')
  const [enterFrenzy, setEnterFrenzy] = useState(false)
  const [selectedWildShapeFormId, setSelectedWildShapeFormId] = useState('')
  const [primevalAwarenessSlotLevel, setPrimevalAwarenessSlotLevel] = useState<0 | 1 | 2 | 3 | 4 | 5>(0)
  const [firstOpenHandTechnique, setFirstOpenHandTechnique] = useState<'none' | 'prone' | 'push' | 'no-reactions'>('none')
  const [secondOpenHandTechnique, setSecondOpenHandTechnique] = useState<'none' | 'prone' | 'push' | 'no-reactions'>('none')
  const [quiveringPalmAttack, setQuiveringPalmAttack] = useState<'none' | 'first' | 'second'>('none')
  const livingTargets = useMemo(() => targets.filter((target) => target.currentHp > 0), [targets])
  const resource = (key: string) => getClassResource(character, key)
  const disabled = !canAct || pending
  const actionAvailable = turnEconomy.action.current > 0
  const bonusAvailable = turnEconomy.bonusAction.current > 0
  const availablePrimevalAwarenessSlots = ([1, 2, 3, 4, 5] as const)
    .filter((level) => (getClassResource(character, `dnd5e-spell-slot-${level}`)?.current ?? 0) > 0)
  const selectedPrimevalAwarenessSlotLevel = availablePrimevalAwarenessSlots.includes(
    primevalAwarenessSlotLevel as 1 | 2 | 3 | 4 | 5,
  )
    ? primevalAwarenessSlotLevel as 1 | 2 | 3 | 4 | 5
    : availablePrimevalAwarenessSlots[0]
  const subclassId = definition?.id === 'fighter'
    ? character.dnd5eClassChoices?.fighter?.subclass
    : definition
      ? character.dnd5eClassChoices?.classes?.[definition.id]?.subclass
      : undefined

  if (!definition || !['barbarian', 'bard', 'cleric', 'druid', 'monk', 'paladin', 'ranger', 'rogue', 'sorcerer', 'warlock'].includes(definition.id)) return null

  let controls: React.ReactNode
  if (definition.id === 'barbarian') {
    const rage = resource('dnd5e-rage')
    const heavyArmor = character.equipment?.armor?.dnd5e?.kind === 'armor' && character.equipment.armor.dnd5e.category === 'heavy'
    const canFrenzy = subclassId === 'berserker' && character.level >= 3
    const raging = character.dnd5eCombatState?.raging === true
    const frenzying = character.dnd5eCombatState?.frenzying === true
    const intimidatingTargets = livingTargets.filter((target) => target.tokenType === 'enemy' && target.distanceFeet <= 30)
    const intimidatingTarget = intimidatingTargets.find((entry) => entry.tokenId === selectedTargetId) ?? intimidatingTargets[0]
    controls = <div className="grid gap-2">
      {canFrenzy && !character.dnd5eCombatState?.raging ? <label className="flex items-start gap-2 rounded-lg border border-rose-400/15 bg-rose-500/[0.05] p-3 text-xs text-slate-300">
        <input type="checkbox" checked={enterFrenzy} onChange={(event) => setEnterFrenzy(event.target.checked)} className="mt-0.5" />
        <span><strong className="text-rose-200">以狂乱进入狂暴</strong><span className="mt-1 block text-slate-500">狂暴后的下一回合起可进行狂乱附赠攻击；狂暴结束时获得 1 级力竭。</span></span>
      </label> : null}
      <FeatureButton
        label={raging ? frenzying ? '主动结束狂乱' : '主动结束狂暴' : '进入狂暴'}
        detail={raging
          ? `附赠动作 · 立即结束${frenzying ? '狂乱并获得 1 级力竭' : '狂暴'}`
          : `附赠动作 · 消耗 1 次狂暴${canFrenzy && enterFrenzy ? ' · 启用狂乱' : ''}`}
        disabled={disabled || !bonusAvailable || (!raging && (heavyArmor || (rage?.current ?? 0) < 1))}
        onClick={() => onFeature(raging
          ? { feature: 'barbarian-rage', end: true }
          : { feature: 'barbarian-rage', frenzy: canFrenzy && enterFrenzy })}
      />
      {subclassId === 'berserker' && character.level >= 10 ? <TargetFeatureControl
        label="威吓气势"
        detail="动作 · 30 尺 · 目标进行感知豁免；后续回合可用动作延长"
        targets={intimidatingTargets}
        selectedId={intimidatingTarget?.tokenId ?? ''}
        onSelected={setSelectedTargetId}
        disabled={disabled || !actionAvailable || !intimidatingTarget}
        onUse={() => intimidatingTarget && onFeature({
          feature: 'barbarian-intimidating-presence',
          targetTokenId: intimidatingTarget.tokenId,
        })}
      /> : null}
    </div>
  } else if (definition.id === 'bard') {
    const inspiration = resource('dnd5e-bardic-inspiration')
    const candidates = livingTargets.filter((target) => target.characterId !== character.id && target.distanceFeet <= 60)
    const target = candidates.find((entry) => entry.tokenId === selectedTargetId) ?? candidates[0]
    controls = <div className="grid gap-2">
      <TargetFeatureControl
        label="给予吟游激励"
        detail="附赠动作 · 60 尺 · 目标不能是自己"
        targets={candidates}
        selectedId={target?.tokenId ?? ''}
        onSelected={setSelectedTargetId}
        disabled={disabled || !bonusAvailable || !target || (inspiration?.current ?? 0) < 1}
        onUse={() => target && onFeature({ feature: 'bardic-inspiration', targetTokenId: target.tokenId })}
      />
      {character.level >= 6 ? <FeatureButton
        label={(character.dnd5eCombatState?.countercharmRoundsRemaining ?? 0) > 0 ? '反魅惑演奏中' : '反魅惑'}
        detail="动作 · 自身及30尺内能听见的友军，对抗魅惑或恐慌的豁免具有优势，持续至你的下一回合结束"
        disabled={disabled || !actionAvailable}
        onClick={() => onFeature({ feature: 'bard-countercharm' })}
      /> : null}
    </div>
  } else if (definition.id === 'paladin') {
    const pool = resource('dnd5e-lay-on-hands')
    const channel = resource('dnd5e-channel-divinity')
    const divineSense = resource('dnd5e-divine-sense')
    const cleansingTouch = resource('dnd5e-cleansing-touch')
    const holyNimbus = resource('dnd5e-holy-nimbus')
    const touchTargets = livingTargets.filter((target) => target.distanceFeet <= 5)
    const touchTarget = touchTargets.find((target) => target.tokenId === selectedTargetId) ?? touchTargets[0]
    const cleansingTargets = touchTargets.filter((target) => !target.opposed && (target.ongoingSpellEffects?.length ?? 0) > 0)
    const cleansingTarget = cleansingTargets.find((target) => target.tokenId === selectedCleansingTargetId) ?? cleansingTargets[0]
    const cleansingEffects = cleansingTarget?.ongoingSpellEffects ?? []
    const cleansingEffect = cleansingEffects.find((effect) =>
      `${effect.sourceTokenId}:${effect.spellId}` === selectedCleansingEffectKey,
    ) ?? cleansingEffects[0]
    const missingHp = touchTarget ? Math.max(0, touchTarget.maxHp - touchTarget.currentHp) : 0
    const maximum = Math.max(0, Math.min(pool?.current ?? 0, missingHp))
    const amount = Math.max(1, Math.min(maximum || 1, Math.floor(layOnHandsAmount || 1)))
    const targetHasDisease = touchTarget?.conditions?.some((condition) => ['disease', '疾病'].includes(condition.toLowerCase())) === true
    const targetIsPoisoned = touchTarget?.conditions?.some((condition) => ['poisoned', '中毒'].includes(condition.toLowerCase())) === true
    const unholyTargets = livingTargets.filter((target) => {
      const creatureType = (target.creatureType ?? '').toLowerCase()
      return target.distanceFeet <= 30 && (
        creatureType === '亡灵' || creatureType === 'undead' || creatureType.includes('亡灵') ||
        creatureType === '邪魔' || creatureType === 'fiend' || creatureType.includes('邪魔')
      )
    })
    controls = <div className="grid gap-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_110px_auto]">
        <TargetSelect targets={touchTargets} value={touchTarget?.tokenId ?? ''} onChange={setSelectedTargetId} />
        <NumberInput label="治疗点数" value={amount} min={1} max={Math.max(1, maximum)} onChange={setLayOnHandsAmount} />
        <FeatureButton
          compact label="使用圣疗" detail="动作 · 接触"
          disabled={disabled || !actionAvailable || !touchTarget || maximum < 1}
          onClick={() => touchTarget && onFeature({ feature: 'paladin-lay-on-hands', targetTokenId: touchTarget.tokenId, amount })}
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <FeatureButton
          label="圣疗：治愈疾病"
          detail="动作 · 接触 · 消耗 5 点圣疗池"
          disabled={disabled || !actionAvailable || !touchTarget || !targetHasDisease || (pool?.current ?? 0) < 5}
          onClick={() => touchTarget && onFeature({ feature: 'paladin-lay-on-hands', targetTokenId: touchTarget.tokenId, cure: 'disease' })}
        />
        <FeatureButton
          label="圣疗：中和毒素"
          detail="动作 · 接触 · 消耗 5 点圣疗池"
          disabled={disabled || !actionAvailable || !touchTarget || !targetIsPoisoned || (pool?.current ?? 0) < 5}
          onClick={() => touchTarget && onFeature({ feature: 'paladin-lay-on-hands', targetTokenId: touchTarget.tokenId, cure: 'poisoned' })}
        />
        <FeatureButton
          label="神圣感知"
          detail="动作 · 扫描 60 尺内的天界、邪魔与亡灵"
          disabled={disabled || !actionAvailable || (divineSense?.current ?? 0) < 1}
          onClick={() => onFeature({ feature: 'paladin-divine-sense' })}
        />
        {subclassId === 'devotion' && character.level >= 3 ? <FeatureButton
          label={(character.dnd5eCombatState?.sacredWeaponTurnsRemaining ?? 0) > 0 ? '神圣武器已激活' : '引导神力：神圣武器'}
          detail="动作 · 持续 1 分钟 · 武器命中加入魅力调整值（至少 +1）"
          disabled={disabled || !actionAvailable || (channel?.current ?? 0) < 1 || (character.dnd5eCombatState?.sacredWeaponTurnsRemaining ?? 0) > 0}
          onClick={() => onFeature({ feature: 'paladin-sacred-weapon' })}
        /> : null}
        {subclassId === 'devotion' && character.level >= 3 ? <FeatureButton
          label={`引导神力：驱散邪魔（${unholyTargets.length} 个目标）`}
          detail="动作 · 30 尺 · 能看见或听见你的邪魔与亡灵进行感知豁免"
          disabled={disabled || !actionAvailable || (channel?.current ?? 0) < 1 || unholyTargets.length === 0}
          onClick={() => onFeature({ feature: 'paladin-turn-the-unholy' })}
        /> : null}
        {subclassId === 'devotion' && character.level >= 20 ? <FeatureButton
          label={(character.dnd5eCombatState?.holyNimbusRoundsRemaining ?? 0) > 0 ? '神圣光轮生效中' : '神圣光轮'}
          detail="动作 · 持续 1 分钟 · 30 尺明亮光照；敌人在其中开始回合时受到 10 点光耀伤害"
          disabled={disabled || !actionAvailable || (holyNimbus?.current ?? 0) < 1 || (character.dnd5eCombatState?.holyNimbusRoundsRemaining ?? 0) > 0}
          onClick={() => onFeature({ feature: 'paladin-holy-nimbus' })}
        /> : null}
      </div>
      {character.level >= 14 ? <div className="grid gap-2 rounded-xl border border-sky-400/15 bg-sky-500/[0.05] p-3 sm:grid-cols-[1fr_1fr_auto]">
        <label className="block text-[11px] text-slate-500">接触目标
          <select
            value={cleansingTarget?.tokenId ?? ''}
            onChange={(event) => {
              setSelectedCleansingTargetId(event.target.value)
              setSelectedCleansingEffectKey('')
            }}
            className="mt-1 w-full rounded-lg border border-white/10 bg-void-900 px-3 py-2 text-sm text-slate-200"
          >
            {cleansingTargets.length === 0 ? <option value="">5 尺内没有可结束的持续法术</option> : null}
            {cleansingTargets.map((target) => <option key={target.tokenId} value={target.tokenId}>{target.label}</option>)}
          </select>
        </label>
        <label className="block text-[11px] text-slate-500">结束一个法术
          <select
            value={cleansingEffect ? `${cleansingEffect.sourceTokenId}:${cleansingEffect.spellId}` : ''}
            onChange={(event) => setSelectedCleansingEffectKey(event.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-void-900 px-3 py-2 text-sm text-slate-200"
          >
            {cleansingEffects.length === 0 ? <option value="">无可选法术</option> : null}
            {cleansingEffects.map((effect) => <option
              key={`${effect.sourceTokenId}:${effect.spellId}`}
              value={`${effect.sourceTokenId}:${effect.spellId}`}
            >{effect.spellName}（来源：{effect.sourceName}）</option>)}
          </select>
        </label>
        <FeatureButton
          compact
          label="净化之触"
          detail={`动作 · 接触 · 剩余 ${cleansingTouch?.current ?? 0}/${cleansingTouch?.max ?? 0} 次`}
          disabled={disabled || !actionAvailable || !cleansingTarget || !cleansingEffect || (cleansingTouch?.current ?? 0) < 1}
          onClick={() => cleansingTarget && cleansingEffect && onFeature({
            feature: 'paladin-cleansing-touch',
            targetTokenId: cleansingTarget.tokenId,
            sourceTokenId: cleansingEffect.sourceTokenId,
            spellId: cleansingEffect.spellId,
          })}
        />
      </div> : null}
    </div>
  } else if (definition.id === 'druid') {
    const uses = resource('dnd5e-wild-shape')
    const knownForms = dnd5eKnownWildShapeForms(character)
    const selectedForm = knownForms.find((form) => form.id === selectedWildShapeFormId) ?? knownForms[0]
    const activeForm = character.dnd5eCombatState?.wildShapeFormId
      ? getDnd5eSrdMonster(character.dnd5eCombatState.wildShapeFormId)
      : undefined
    controls = activeForm ? <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
      <div className="rounded-lg border border-emerald-400/15 bg-emerald-500/[0.05] p-3 text-xs text-slate-300">
        <strong className="text-emerald-200">当前形态：{activeForm.name}</strong>
        <span className="mt-1 block text-slate-500">
          形态生命 {character.dnd5eCombatState?.wildShapeCurrentHp ?? activeForm.hitPoints.average}/{activeForm.hitPoints.average}；剩余约 {character.dnd5eCombatState?.wildShapeRoundsRemaining ?? 0} 轮
        </span>
      </div>
      <FeatureButton
        compact
        label="恢复原形"
        detail="附赠动作；形态生命归零时无需动作并自动恢复"
        disabled={disabled || !bonusAvailable}
        onClick={() => onFeature({ feature: 'druid-end-wild-shape' })}
      />
    </div> : <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
      <label className="block text-[11px] text-slate-500">已知野兽形态
        <select
          value={selectedForm?.id ?? ''}
          onChange={(event) => setSelectedWildShapeFormId(event.target.value)}
          className="mt-1 w-full rounded-lg border border-white/10 bg-void-900 px-3 py-2 text-sm text-slate-200"
        >
          {knownForms.length === 0 ? <option value="">尚未在角色卡选择已知形态</option> : null}
          {knownForms.map((form) => <option key={form.id} value={form.id}>{form.name}（CR {form.challenge.rating}，HP {form.hitPoints.average}）</option>)}
        </select>
      </label>
      <FeatureButton
        compact
        label="荒野变形"
        detail={character.level >= 20 ? '动作；大德鲁伊：不限次数' : `动作；剩余 ${uses?.current ?? 0}/${uses?.max ?? 2} 次`}
        disabled={disabled || !actionAvailable || character.level < 2 || !selectedForm || (character.level < 20 && (uses?.current ?? 0) < 1)}
        onClick={() => selectedForm && onFeature({ feature: 'druid-wild-shape', formId: selectedForm.id })}
      />
    </div>
  } else if (definition.id === 'ranger') {
    const previousTargetId = character.dnd5eCombatState?.huntersMarkTargetId
    const previousTarget = targets.find((target) => target.tokenId === previousTargetId)
    const candidates = livingTargets.filter((target) => target.tokenType === 'enemy' && target.distanceFeet <= 90 && target.tokenId !== previousTargetId)
    const target = candidates.find((entry) => entry.tokenId === selectedTargetId) ?? candidates[0]
    const canTransfer = !!previousTargetId && (!previousTarget || previousTarget.currentHp <= 0) && character.concentrating === true
    controls = <div className="grid gap-2">
      {character.level >= 10 && (
        <FeatureButton
          label={character.dnd5eCombatState?.hideInPlainSightPrepared ? '隐匿无踪：伪装已就绪' : '隐匿无踪：准备伪装'}
          detail={character.dnd5eCombatState?.hideInPlainSightPrepared
            ? '下一次敏捷（隐匿）检定 +10；移动或执行其他动作会失效'
            : '需先在自然材料附近花费1分钟；由DM确认，不消耗当前回合动作'}
          disabled={disabled || !!character.dnd5eCombatState?.hideInPlainSightPrepared}
          onClick={() => onFeature({ feature: 'ranger-hide-in-plain-sight' })}
        />
      )}
      {character.level >= 3 && (
        <div className="grid gap-2 rounded-lg border border-violet-400/15 bg-violet-500/[0.04] p-3 sm:grid-cols-[1fr_auto]">
          <label className="block text-[11px] text-slate-500">原初感知使用的法术位
            <select
              value={selectedPrimevalAwarenessSlotLevel ?? ''}
              onChange={(event) => setPrimevalAwarenessSlotLevel(Number(event.target.value) as 1 | 2 | 3 | 4 | 5)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-void-900 px-3 py-2 text-sm text-slate-200"
            >
              {availablePrimevalAwarenessSlots.length === 0 ? <option value="">没有可用的1–5环法术位</option> : null}
              {availablePrimevalAwarenessSlots.map((level) => <option key={level} value={level}>{level} 环法术位</option>)}
            </select>
          </label>
          <FeatureButton
            compact
            label="原初感知"
            detail={selectedPrimevalAwarenessSlotLevel
              ? `动作 · 消耗${selectedPrimevalAwarenessSlotLevel}环法术位 · 感知持续${selectedPrimevalAwarenessSlotLevel}分钟`
              : '动作 · 需要可用的游侠法术位'}
            disabled={disabled || !actionAvailable || !selectedPrimevalAwarenessSlotLevel}
            onClick={() => selectedPrimevalAwarenessSlotLevel && onFeature({
              feature: 'ranger-primeval-awareness',
              slotLevel: selectedPrimevalAwarenessSlotLevel,
            })}
          />
        </div>
      )}
      <TargetFeatureControl
        label="转移猎人印记"
        detail="附赠动作 · 90 尺 · 旧目标降至0生命后 · 不消耗法术位"
        targets={candidates}
        selectedId={target?.tokenId ?? ''}
        onSelected={setSelectedTargetId}
        disabled={disabled || !bonusAvailable || !canTransfer || !target}
        onUse={() => target && onFeature({ feature: 'ranger-move-hunters-mark', targetTokenId: target.tokenId })}
      />
      {character.level >= 14 && (
        <FeatureButton
          label="无踪步：躲藏"
          detail="附赠动作 · DM 确认具备躲藏条件后进行敏捷（隐匿）检定"
          disabled={disabled || !bonusAvailable}
          onClick={() => onFeature({ feature: 'ranger-vanish' })}
        />
      )}
    </div>
  } else if (definition.id === 'rogue') {
    controls = character.level < 2
      ? <p className="text-xs text-slate-500">2 级获得“巧妙动作”后，可用附赠动作疾走或撤离。</p>
      : <div className="grid gap-2 sm:grid-cols-2">
          <FeatureButton
            label="巧妙动作：疾走"
            detail={`附赠动作 · 本回合再获得 ${character.speed} 尺移动`}
            disabled={disabled || !bonusAvailable}
            onClick={() => onFeature({ feature: 'rogue-cunning-action', option: 'dash' })}
          />
          <FeatureButton
            label="巧妙动作：撤离"
            detail="附赠动作 · 本回合移动不触发借机攻击"
            disabled={disabled || !bonusAvailable}
            onClick={() => onFeature({ feature: 'rogue-cunning-action', option: 'disengage' })}
          />
          <FeatureButton
            label="巧妙动作：躲藏"
            detail={subclassId === 'thief' && character.level >= 9
              ? '附赠动作 · 本回合移动不超过半速时，高超潜行提供优势'
              : '附赠动作 · DM 确认具备藏身条件后进行隐匿检定'}
            disabled={disabled || !bonusAvailable}
            onClick={() => onFeature({ feature: 'rogue-cunning-action', option: 'hide' })}
          />
          {subclassId === 'thief' && character.level >= 3 ? <>
            <FeatureButton
              label="快手：巧手检定"
              detail="附赠动作 · 进行敏捷（巧手）检定"
              disabled={disabled || !bonusAvailable}
              onClick={() => onFeature({ feature: 'rogue-fast-hands', option: 'sleight-of-hand' })}
            />
            <FeatureButton
              label="快手：盗贼工具"
              detail="附赠动作 · 解除陷阱或开锁；检定结果由 DM 对照 DC"
              disabled={disabled || !bonusAvailable}
              onClick={() => onFeature({ feature: 'rogue-fast-hands', option: 'thieves-tools' })}
            />
            <FeatureButton
              label="快手：使用物品"
              detail="附赠动作 · 执行使用物品动作；具体效果由物品规则处理"
              disabled={disabled || !bonusAvailable}
              onClick={() => onFeature({ feature: 'rogue-fast-hands', option: 'use-object' })}
            />
          </> : null}
        </div>
  } else if (definition.id === 'monk') {
    const use = resource('dnd5e-wholeness-of-body')
    const ki = resource('dnd5e-ki')
    const hostileTargets = livingTargets.filter((target) => target.tokenType === 'enemy' && target.distanceFeet <= 5)
    const firstTarget = hostileTargets.find((target) => target.tokenId === selectedTargetId) ?? hostileTargets[0]
    const secondTarget = hostileTargets.find((target) => target.tokenId === selectedSecondaryTargetId) ?? firstTarget
    const attackActionTaken = character.dnd5eCombatState?.monkAttackActionTurnKey === turnEconomy.turnKey
    const martialArtsEligible = character.dnd5eCombatState?.monkMartialArtsTurnKey === turnEconomy.turnKey
    const quiveringPalmTargetId = character.dnd5eCombatState?.quiveringPalmTargetId
    const quiveringPalmTarget = targets.find((target) => target.tokenId === quiveringPalmTargetId)
    const quiveringPalmRequested = subclassId === 'open-hand' && character.level >= 17 && quiveringPalmAttack !== 'none'
    const martialArtsKiCost = (stunningStrike ? 1 : 0) + (quiveringPalmAttack === 'first' ? 3 : 0)
    const flurryKiCost = 1 + (stunningStrike ? 2 : 0) + (quiveringPalmRequested ? 3 : 0)
    const charmed = character.conditions.some((condition) => condition === 'charmed' || condition === '魅惑')
    const frightened = character.conditions.some((condition) => ['frightened', '惊惧', '恐慌'].includes(condition))
    controls = <div className="grid gap-3">
      {character.dnd5eCombatState?.tranquilityActive ? <div className="rounded-lg border border-sky-400/20 bg-sky-500/[0.07] px-3 py-2 text-xs text-sky-200">
        宁静心境生效中：敌人以攻击或有害法术指定你时，须先通过感知豁免；你进行攻击或对敌施法后结束。
      </div> : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <TargetSelect targets={hostileTargets} value={firstTarget?.tokenId ?? ''} onChange={setSelectedTargetId} />
        <TargetSelect targets={hostileTargets} value={secondTarget?.tokenId ?? ''} onChange={setSelectedSecondaryTargetId} />
      </div>
      {subclassId === 'open-hand' && character.level >= 3 ? <div className="grid gap-2 sm:grid-cols-2">
        {([
          ['第一次命中后的散打技法', firstOpenHandTechnique, setFirstOpenHandTechnique],
          ['第二次命中后的散打技法', secondOpenHandTechnique, setSecondOpenHandTechnique],
        ] as const).map(([label, value, setValue]) => <label key={label} className="block text-[11px] text-slate-500">
          {label}
          <select
            value={value}
            onChange={(event) => setValue(event.target.value as typeof value)}
            disabled={disabled}
            className="mt-1 w-full rounded-lg border border-white/10 bg-void-900 px-3 py-2 text-sm text-slate-200 disabled:opacity-40"
          >
            <option value="none">不附加效果</option>
            <option value="prone">敏捷豁免失败：倒地</option>
            <option value="push">力量豁免失败：推开至多 15 尺</option>
            <option value="no-reactions">不能进行反应，直到你的下一回合结束</option>
          </select>
        </label>)}
      </div> : null}
      {subclassId === 'open-hand' && character.level >= 17 ? <label className="block text-[11px] text-slate-500">
        渗透劲植入时机
        <select
          value={quiveringPalmAttack}
          onChange={(event) => setQuiveringPalmAttack(event.target.value as typeof quiveringPalmAttack)}
          disabled={disabled}
          className="mt-1 w-full rounded-lg border border-white/10 bg-void-900 px-3 py-2 text-sm text-slate-200 disabled:opacity-40"
        >
          <option value="none">本次不使用</option>
          <option value="first">第一次徒手攻击命中时（3 气）</option>
          <option value="second">疾风连击第二次攻击命中时（3 气）</option>
        </select>
      </label> : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <FeatureButton
          label="武艺：附赠徒手攻击"
          detail="使用合格的攻击动作后 · 附赠动作 · 1 次徒手攻击"
          disabled={disabled || !bonusAvailable || !martialArtsEligible || !firstTarget || quiveringPalmAttack === 'second' || (ki?.current ?? 0) < martialArtsKiCost}
          onClick={() => firstTarget && onFeature({
            feature: 'monk-unarmed-bonus', mode: 'martial-arts', targetTokenIds: [firstTarget.tokenId], stunningStrike,
            ...(quiveringPalmAttack === 'first' ? { quiveringPalmAttackIndex: 0 } : {}),
          })}
        />
        <FeatureButton
          label="疾风连击"
          detail="使用攻击动作后 · 附赠动作 · 1 气 · 2 次徒手攻击"
          disabled={disabled || !bonusAvailable || character.level < 2 || !attackActionTaken || (ki?.current ?? 0) < flurryKiCost || !firstTarget || !secondTarget}
          onClick={() => firstTarget && secondTarget && onFeature({
            feature: 'monk-unarmed-bonus',
            mode: 'flurry',
            targetTokenIds: [firstTarget.tokenId, secondTarget.tokenId],
            stunningStrike,
            ...(quiveringPalmAttack !== 'none' ? { quiveringPalmAttackIndex: quiveringPalmAttack === 'first' ? 0 : 1 } : {}),
            ...(subclassId === 'open-hand' && character.level >= 3 ? {
              openHandTechniques: [
                firstOpenHandTechnique === 'none' ? undefined : firstOpenHandTechnique,
                secondOpenHandTechnique === 'none' ? undefined : secondOpenHandTechnique,
              ],
            } : {}),
          })}
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {subclassId === 'open-hand' && character.level >= 17 && quiveringPalmTargetId ? <>
          <FeatureButton
            label={`引爆渗透劲：${quiveringPalmTarget?.label ?? quiveringPalmTargetId}`}
            detail="动作 · 体质豁免失败降至 0 HP，成功受到 10d10 黯蚀伤害"
            disabled={disabled || !actionAvailable || !quiveringPalmTarget || quiveringPalmTarget.currentHp <= 0}
            onClick={() => onFeature({ feature: 'monk-quivering-palm-release', targetTokenId: quiveringPalmTargetId })}
          />
          <FeatureButton
            label="无害结束渗透劲"
            detail="不消耗动作 · 清除当前目标体内的震动"
            disabled={disabled}
            onClick={() => onFeature({ feature: 'monk-quivering-palm-end' })}
          />
        </> : null}
        <FeatureButton
          label="疾风步：疾走"
          detail={`附赠动作 · 1 气 · 本回合再获得 ${dnd5eWalkingSpeed(character)} 尺移动`}
          disabled={disabled || !bonusAvailable || character.level < 2 || (ki?.current ?? 0) < 1}
          onClick={() => onFeature({ feature: 'monk-step-of-the-wind', option: 'dash' })}
        />
        <FeatureButton
          label="疾风步：撤离"
          detail="附赠动作 · 1 气 · 本回合移动不触发借机攻击"
          disabled={disabled || !bonusAvailable || character.level < 2 || (ki?.current ?? 0) < 1}
          onClick={() => onFeature({ feature: 'monk-step-of-the-wind', option: 'disengage' })}
        />
        <FeatureButton
          label="耐心防御"
          detail="附赠动作 · 1 气 · 执行闪避动作至下一回合开始"
          disabled={disabled || !bonusAvailable || character.level < 2 || (ki?.current ?? 0) < 1 || !!character.dnd5eCombatState?.dodgingTurnKey}
          onClick={() => onFeature({ feature: 'monk-patient-defense' })}
        />
        <FeatureButton
          label="身心合一"
          detail={`动作 · 恢复 ${character.level * 3} 点生命值 · 长休 1 次`}
          disabled={disabled || !actionAvailable || character.level < 6 || subclassId !== 'open-hand' || character.currentHp >= character.maxHp || (use?.current ?? 0) < 1}
          onClick={() => onFeature({ feature: 'monk-wholeness-of-body' })}
        />
        {character.level >= 7 ? <FeatureButton
          label="心如止水"
          detail="动作 · 结束自身一个魅惑或恐慌效果"
          disabled={disabled || !actionAvailable || (!charmed && !frightened)}
          onClick={() => onFeature({ feature: 'monk-stillness-of-mind', condition: charmed ? 'charmed' : 'frightened' })}
        /> : null}
        {character.level >= 18 ? <FeatureButton
          label={(character.dnd5eCombatState?.emptyBodyRoundsRemaining ?? 0) > 0 ? '空灵体生效中' : '空灵体'}
          detail="动作 · 4 气 · 隐形1分钟，并获得除力场外所有伤害抗性"
          disabled={disabled || !actionAvailable || (ki?.current ?? 0) < 4 || (character.dnd5eCombatState?.emptyBodyRoundsRemaining ?? 0) > 0}
          onClick={() => onFeature({ feature: 'monk-empty-body' })}
        /> : null}
      </div>
    </div>
  } else if (definition.id === 'cleric') {
    const channel = resource('dnd5e-channel-divinity')
    const divineIntervention = resource('dnd5e-divine-intervention')
    const interventionCooldown = character.dnd5eCombatState?.divineInterventionCooldownDays ?? 0
    const undeadTargets = livingTargets.filter((target) => {
      const creatureType = (target.creatureType ?? '').toLowerCase()
      return target.distanceFeet <= 30 &&
        (creatureType === '亡灵' || creatureType === 'undead' || creatureType.includes('亡灵'))
    })
    const candidates = livingTargets.filter((target) =>
      target.distanceFeet <= 30 && target.currentHp < Math.floor(target.maxHp / 2) &&
      target.creatureType !== '亡灵' && target.creatureType !== '构装生物',
    )
    const allocations = candidates.flatMap((target) => {
      const maximum = Math.max(0, Math.floor(target.maxHp / 2) - target.currentHp)
      const amount = Math.max(0, Math.min(maximum, Math.floor(preserveAllocations[target.tokenId] ?? 0)))
      return amount > 0 ? [{ targetTokenId: target.tokenId, amount }] : []
    })
    const total = allocations.reduce((sum, allocation) => sum + allocation.amount, 0)
    const budget = character.level * 5
    controls = <div className="space-y-3">
      <FeatureButton
        label={`驱散亡灵（${undeadTargets.length} 个目标）`}
        detail={`${character.level >= 5 ? '低 CR 亡灵豁免失败时会被摧毁 · ' : ''}动作 · 30 尺 · 感知豁免 · 消耗 1 次引导神力`}
        disabled={disabled || !actionAvailable || character.level < 2 || (channel?.current ?? 0) < 1 || undeadTargets.length === 0}
        onClick={() => onFeature({ feature: 'cleric-turn-undead' })}
      />
      {character.level >= 10 ? <FeatureButton
        label={character.level >= 20 ? '神圣干预（自动成功）' : `神圣干预（成功率 ${character.level}%）`}
        detail={interventionCooldown > 0
          ? `成功后冷却中：还需经过 ${interventionCooldown} 天`
          : '动作 · 请求神祇援助；成功时具体效果由 DM 裁定'}
        disabled={disabled || !actionAvailable || interventionCooldown > 0 || (divineIntervention?.current ?? 0) < 1}
        onClick={() => onFeature({ feature: 'cleric-divine-intervention' })}
      /> : null}
      {subclassId === 'life' && character.level >= 2 ? <div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {candidates.map((target) => <NumberInput
              key={target.tokenId}
              label={`${target.label}（${target.currentHp}/${target.maxHp}）`}
              value={preserveAllocations[target.tokenId] ?? 0}
              min={0}
              max={Math.max(0, Math.floor(target.maxHp / 2) - target.currentHp)}
              onChange={(value) => setPreserveAllocations((current) => ({ ...current, [target.tokenId]: value }))}
            />)}
          </div>
          <FeatureButton
            label={`维持生命（已分配 ${total}/${budget}）`}
            detail="动作 · 30 尺 · 消耗 1 次引导神力"
            disabled={disabled || !actionAvailable || (channel?.current ?? 0) < 1 || total < 1 || total > budget}
            onClick={() => onFeature({ feature: 'cleric-preserve-life', allocations })}
          />
        </div> : <p className="text-xs text-slate-500">生命领域牧师还可使用引导神力“维持生命”。</p>}
    </div>
  } else if (definition.id === 'warlock') {
    const hurlThroughHell = resource('dnd5e-hurl-through-hell')
    const ready = character.dnd5eCombatState?.hurlThroughHellReady === true
    controls = subclassId === 'fiend' && character.level >= 14
      ? <FeatureButton
          label={ready ? '取消坠入地狱预备' : '预备坠入地狱'}
          detail="不消耗动作 · 下一次攻击命中时放逐目标；在你的下一回合结束时返回并受到 10d10 心灵伤害"
          disabled={disabled || (!ready && (hurlThroughHell?.current ?? 0) < 1)}
          onClick={() => onFeature({ feature: 'warlock-hurl-through-hell-ready', active: !ready })}
        />
      : <p className="text-xs text-slate-500">14级邪魔宗主可预备“坠入地狱”。</p>
  } else {
    const points = resource('dnd5e-sorcery-points')
    const createCosts = [0, 2, 3, 5, 6, 7]
    const creatable = [1, 2, 3, 4, 5].filter((level) => {
      const slot = resource(`dnd5e-spell-slot-${level}`)
      return !!slot && slot.max > 0
    })
    const convertible = Array.from({ length: 9 }, (_, index) => index + 1).filter((level) => (resource(`dnd5e-spell-slot-${level}`)?.current ?? 0) > 0)
    const createLevel = creatable.includes(createSlotLevel) ? createSlotLevel : (creatable[0] ?? 1)
    const convertLevel = convertible.includes(convertSlotLevel) ? convertSlotLevel : (convertible[0] ?? 1)
    const createSlot = resource(`dnd5e-spell-slot-${createLevel}`)
    controls = character.level < 2
      ? <p className="text-xs text-slate-500">2级获得“灵活施法”后可转换术法点与法术位。</p>
      : <div className="grid gap-3 lg:grid-cols-2">
          <SlotConversionControl
            label="创造法术位"
            levels={creatable}
            value={createLevel}
            onChange={setCreateSlotLevel}
            detail={`消耗 ${createCosts[createLevel]} 点术法点`}
            disabled={disabled || !bonusAvailable || (points?.current ?? 0) < createCosts[createLevel] || !createSlot || createSlot.current >= createSlot.max}
            onUse={() => onFeature({ feature: 'sorcerer-create-spell-slot', slotLevel: createLevel as 1 | 2 | 3 | 4 | 5 })}
          />
          <SlotConversionControl
            label="转换为术法点"
            levels={convertible}
            value={convertLevel}
            onChange={setConvertSlotLevel}
            detail={`恢复 ${convertLevel} 点术法点`}
            disabled={disabled || !bonusAvailable || convertible.length === 0 || (points?.current ?? 0) + convertLevel > (points?.max ?? 0)}
            onUse={() => onFeature({ feature: 'sorcerer-convert-spell-slot', slotLevel: convertLevel })}
          />
          {subclassId === 'draconic' && character.level >= 14 ? <FeatureButton
            label={character.dnd5eCombatState?.draconicWingsActive ? '收起龙翼' : '展开龙翼'}
            detail={character.dnd5eCombatState?.draconicWingsActive
              ? '附赠动作 · 结束飞行速度'
              : '附赠动作 · 获得等同当前步行速度的飞行速度；普通护甲需预先改造'}
            disabled={disabled || !bonusAvailable || (!character.dnd5eCombatState?.draconicWingsActive && !!character.equipment?.armor)}
            onClick={() => onFeature({ feature: 'sorcerer-draconic-wings', active: !character.dnd5eCombatState?.draconicWingsActive })}
          /> : null}
          {subclassId === 'draconic' && character.level >= 18 ? <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <label className="block text-[11px] text-slate-500">龙威模式
              <select
                value={draconicPresenceMode}
                onChange={(event) => setDraconicPresenceMode(event.target.value as 'awe' | 'fear')}
                className="mt-1 w-full rounded-lg border border-white/10 bg-void-900 px-3 py-2 text-sm text-slate-200"
              >
                <option value="awe">敬畏（魅惑）</option>
                <option value="fear">恐惧（恐慌）</option>
              </select>
            </label>
            <FeatureButton
              compact
              label={character.dnd5eCombatState?.concentrationSpellId?.startsWith('class:draconic-presence:') ? '龙威维持中' : '发动龙威'}
              detail="动作 · 5 术法点 · 专注至多1分钟 · 60尺内敌人在回合开始进行感知豁免"
              disabled={disabled || !actionAvailable || (points?.current ?? 0) < 5 || character.dnd5eCombatState?.concentrationSpellId?.startsWith('class:draconic-presence:') === true}
              onClick={() => onFeature({ feature: 'sorcerer-draconic-presence', mode: draconicPresenceMode })}
            />
          </div> : null}
        </div>
  }

  return <section className="rounded-xl border border-arcane-400/15 bg-arcane-500/[0.04] p-4 md:col-span-2">
    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-arcane-100"><Sparkles className="h-4 w-4" />职业特性动作</div>
    {controls}
  </section>
}

function TargetFeatureControl({ label, detail, targets, selectedId, onSelected, disabled, onUse }: {
  label: string
  detail: string
  targets: readonly Dnd5eFeatureTargetOption[]
  selectedId: string
  onSelected: (value: string) => void
  disabled: boolean
  onUse: () => void
}) {
  return <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
    <TargetSelect targets={targets} value={selectedId} onChange={onSelected} />
    <FeatureButton compact label={label} detail={detail} disabled={disabled} onClick={onUse} />
  </div>
}

function TargetSelect({ targets, value, onChange }: { targets: readonly Dnd5eFeatureTargetOption[]; value: string; onChange: (value: string) => void }) {
  return <label className="block text-[11px] text-slate-500">目标
    <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-void-900 px-3 py-2 text-sm text-slate-200">
      {targets.length === 0 && <option value="">没有可用目标</option>}
      {targets.map((target) => <option key={target.tokenId} value={target.tokenId}>{target.label} · HP {target.currentHp}/{target.maxHp}</option>)}
    </select>
  </label>
}

function NumberInput({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return <label className="block text-[11px] text-slate-500">{label}
    <input type="number" value={value} min={min} max={max} onChange={(event) => onChange(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-white/10 bg-void-900 px-3 py-2 text-sm text-slate-200" />
  </label>
}

function SlotConversionControl({ label, levels, value, onChange, detail, disabled, onUse }: {
  label: string
  levels: readonly number[]
  value: number
  onChange: (value: number) => void
  detail: string
  disabled: boolean
  onUse: () => void
}) {
  return <div className="rounded-lg border border-white/10 bg-white/[0.025] p-3">
    <div className="grid grid-cols-[1fr_auto] gap-2">
      <label className="text-[11px] text-slate-500">{label}
        <select value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-white/10 bg-void-900 px-3 py-2 text-sm text-slate-200">
          {levels.length === 0 && <option value={1}>没有可用法术位</option>}
          {levels.map((level) => <option key={level} value={level}>{level} 环</option>)}
        </select>
      </label>
      <FeatureButton compact label="执行" detail={detail} disabled={disabled} onClick={onUse} />
    </div>
  </div>
}

function FeatureButton({ label, detail, disabled, onClick, compact = false }: { label: string; detail: string; disabled: boolean; onClick: () => void; compact?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className={`${compact ? 'mt-4 px-3 py-2' : 'mt-2 w-full px-4 py-3'} rounded-xl bg-arcane-500/20 text-left text-sm font-semibold text-arcane-100 hover:bg-arcane-500/35 disabled:cursor-not-allowed disabled:opacity-40`}>
    <span className="block">{label}</span><span className="block text-[10px] font-normal text-slate-400">{detail}</span>
  </button>
}

function EconomyCard({ icon: Icon, label, pool, detail, suffix }: { icon: React.ComponentType<{ className?: string }>; label: string; pool: { current: number; max: number }; detail: string; suffix?: string }) {
  const available = pool.current > 0
  return <div className={`rounded-lg border px-3 py-2 ${available ? 'border-emerald-500/20 bg-emerald-500/[0.07]' : 'border-white/10 bg-white/[0.025]'}`}><div className="flex items-center gap-1.5"><Icon className={`h-3.5 w-3.5 ${available ? 'text-emerald-300' : 'text-slate-600'}`} /><span className="text-xs font-semibold text-slate-300">{label}</span></div><div className={`mt-1 text-lg font-black tabular-nums ${available ? 'text-emerald-200' : 'text-slate-600'}`}>{pool.current}/{pool.max}{suffix ? ` ${suffix}` : ''}</div><div className="text-[10px] text-slate-500">{available ? detail : '已使用'}</div></div>
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-white/[0.04] px-3 py-2"><div className="text-[11px] text-slate-500">{label}</div><div className="mt-0.5 font-semibold text-slate-200">{value}</div></div>
}

function Equipment({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">{label}</dt><dd className="font-semibold text-slate-300">{value}</dd></div>
}
