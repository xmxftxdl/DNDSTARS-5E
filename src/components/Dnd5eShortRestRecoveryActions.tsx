import { useMemo, useState } from 'react'
import { Dices, LoaderCircle, Sparkles } from 'lucide-react'
import type { CampaignTimeAdvance } from '../lib/campaignTime'
import { useCharacterStore } from '../store/characters'
import { resolveDnd5eShortRestHitDice } from '../rulesets/dnd5e/hitPoints'
import { dnd5eBardSongOfRestDie } from '../rulesets/dnd5e/classes'
import { dnd5eCharacterClassLevel } from '../rulesets/dnd5e/multiclass'
import {
  applyDnd5eSpellSlotRecovery,
  dnd5eSpellSlotRecoveryFeature,
  dnd5eSpellSlotRecoveryLimit,
} from '../rulesets/dnd5e/restFeatures'

interface Dnd5eShortRestRecoveryActionsProps {
  advance: CampaignTimeAdvance
  characterId: string
}

function rollDie(sides: number): number {
  const safeSides = Math.max(2, Math.floor(sides))
  if (!globalThis.crypto?.getRandomValues) return Math.floor(Math.random() * safeSides) + 1
  const range = 0x1_0000_0000
  const limit = Math.floor(range / safeSides) * safeSides
  const value = new Uint32Array(1)
  do globalThis.crypto.getRandomValues(value)
  while (value[0] >= limit)
  return value[0] % safeSides + 1
}

export default function Dnd5eShortRestRecoveryActions({
  advance,
  characterId,
}: Dnd5eShortRestRecoveryActionsProps) {
  const characters = useCharacterStore((state) => state.characters)
  const character = characters.find((candidate) => candidate.id === characterId)
  const [busy, setBusy] = useState<string>()
  const [error, setError] = useState('')
  const [hitDieResult, setHitDieResult] = useState('')
  const [slotResult, setSlotResult] = useState('')
  const [useSongOfRest, setUseSongOfRest] = useState(false)
  const [songOfRestUsed, setSongOfRestUsed] = useState(false)
  const [slotAmounts, setSlotAmounts] = useState<Record<number, number>>({})
  const beneficiaries = useMemo(
    () => advance.beneficiaryCharacterIds == null ? null : new Set(advance.beneficiaryCharacterIds),
    [advance.beneficiaryCharacterIds],
  )
  const songOfRestBard = useMemo(() => characters
    .filter((candidate) =>
      candidate.rulesetId === 'dnd5e-2014-srd-5.1' &&
      (beneficiaries == null || beneficiaries.has(candidate.id)) &&
      dnd5eCharacterClassLevel(candidate, 'bard') >= 2,
    )
    .map((candidate) => ({
      character: candidate,
      dieSides: dnd5eBardSongOfRestDie(dnd5eCharacterClassLevel(candidate, 'bard')),
    }))
    .filter((entry) => entry.dieSides > 0)
    .sort((left, right) => right.dieSides - left.dieSides)[0], [beneficiaries, characters])

  if (!character) return null
  const hitDice = character.hitPointDice ?? []
  const recoveryFeature = dnd5eSpellSlotRecoveryFeature(character)
  const recoveryResourceKey = recoveryFeature === 'arcane-recovery'
    ? 'dnd5e-arcane-recovery'
    : recoveryFeature === 'natural-recovery'
      ? 'dnd5e-natural-recovery'
      : undefined
  const recoveryResource = recoveryResourceKey
    ? character.classResources?.[recoveryResourceKey]
    : undefined
  const recoveryBudget = recoveryFeature ? dnd5eSpellSlotRecoveryLimit(character) : 0
  const slotOptions = Array.from({ length: 5 }, (_, index) => {
    const level = index + 1
    const slot = character.classResources?.[`dnd5e-spell-slot-${level}`]
    return slot && slot.current < slot.max
      ? { level, current: slot.current, max: slot.max, missing: slot.max - slot.current }
      : undefined
  }).filter((entry): entry is NonNullable<typeof entry> => entry != null)
  const plannedSlotLevels = Object.entries(slotAmounts).reduce(
    (total, [level, amount]) => total + Number(level) * Math.max(0, Math.floor(amount)),
    0,
  )

  const spendHitDie = async (poolIndex: number) => {
    if (busy) return
    const latestState = useCharacterStore.getState()
    const latest = latestState.characters.find((candidate) => candidate.id === characterId)
    const pool = latest?.hitPointDice?.[poolIndex]
    if (!latest || !pool || pool.current < 1 || latest.currentHp >= latest.maxHp) return
    setBusy(`hit-die:${poolIndex}`)
    setError('')
    const previous = structuredClone(latest)
    const dieRoll = rollDie(pool.sides)
    const applySong = useSongOfRest && !songOfRestUsed && songOfRestBard != null
    const songRoll = applySong ? rollDie(songOfRestBard.dieSides) : undefined
    try {
      const resolved = resolveDnd5eShortRestHitDice({
        character: latest,
        spends: [{ poolIndex, rolls: [dieRoll] }],
        ...(songRoll == null ? {} : {
          songOfRest: {
            dieSides: songOfRestBard!.dieSides as 6 | 8 | 10 | 12,
            roll: songRoll,
          },
        }),
      })
      latestState.applyAuthorityUpdate(characterId, {
        currentHp: resolved.character.currentHp,
        hitPointDice: resolved.character.hitPointDice,
      }, { protectHitPointsUntilAcknowledged: true })
      await latestState.saveSharedNow()
      if (applySong) {
        setSongOfRestUsed(true)
        setUseSongOfRest(false)
      }
      setHitDieResult(
        `d${pool.sides} 掷出 ${dieRoll}，生命骰与体质共恢复 ${resolved.hitDiceHealing} 点` +
        (songRoll == null ? '' : `；休憩曲 d${songOfRestBard!.dieSides} 掷出 ${songRoll}`) +
        `，实际恢复 ${resolved.healingApplied} 点。`,
      )
    } catch (cause) {
      latestState.applyAuthorityUpdate(characterId, previous)
      await latestState.loadShared().catch(() => undefined)
      setError(cause instanceof Error ? cause.message : '生命骰结算失败，请重试。')
    } finally {
      setBusy(undefined)
    }
  }

  const recoverSpellSlots = async () => {
    if (busy || !recoveryFeature || plannedSlotLevels < 1 || plannedSlotLevels > recoveryBudget) return
    const allocations = Object.entries(slotAmounts)
      .map(([level, amount]) => ({ level: Number(level), amount: Math.max(0, Math.floor(amount)) }))
      .filter((allocation) => allocation.amount > 0)
    const latestState = useCharacterStore.getState()
    const latest = latestState.characters.find((candidate) => candidate.id === characterId)
    if (!latest) return
    setBusy('spell-slots')
    setError('')
    const previous = structuredClone(latest)
    try {
      const resolved = applyDnd5eSpellSlotRecovery(latest, allocations)
      if (!resolved.ok) throw new Error(`法术位恢复未通过规则校验：${resolved.reason}`)
      latestState.applyAuthorityUpdate(
        characterId,
        { classResources: resolved.character.classResources },
        { protectClassResourcesUntilAcknowledged: true },
      )
      await latestState.saveSharedNow()
      setSlotAmounts({})
      setSlotResult(
        `${recoveryFeature === 'arcane-recovery' ? '奥术回想' : '自然恢复'}已恢复 ${resolved.recovered} 个法术位（总环级 ${resolved.levelsRecovered}）。`,
      )
    } catch (cause) {
      latestState.applyAuthorityUpdate(characterId, previous)
      await latestState.loadShared().catch(() => undefined)
      setError(cause instanceof Error ? cause.message : '法术位恢复失败，请重试。')
    } finally {
      setBusy(undefined)
    }
  }

  return <section className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-500/[0.055] p-3">
    <div className="flex items-center gap-2 text-xs font-semibold text-cyan-100">
      <Dices className="h-4 w-4" />玩家短休选择
    </div>
    <p className="mt-1 text-[10px] leading-4 text-slate-500">生命骰由角色拥有者逐枚投掷；每次结算后可根据当前生命值决定是否继续。</p>

    <div className="mt-3 space-y-2">
      {hitDice.map((pool, index) => <div key={`${pool.sides}:${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/8 bg-black/15 px-3 py-2">
        <div>
          <p className="text-xs font-semibold text-slate-200">d{pool.sides} 生命骰</p>
          <p className="mt-0.5 text-[10px] text-slate-500">剩余 {pool.current}/{pool.max} · 生命值 {character.currentHp}/{character.maxHp}</p>
        </div>
        <button
          type="button"
          disabled={busy != null || pool.current < 1 || character.currentHp >= character.maxHp}
          onClick={() => void spendHitDie(index)}
          className="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy === `hit-die:${index}` ? <LoaderCircle className="h-4 w-4 animate-spin" /> : `投掷 1d${pool.sides}`}
        </button>
      </div>)}
      {hitDice.length === 0 && <p className="text-xs text-slate-500">当前角色没有可用的生命骰池。</p>}
      {songOfRestBard && !songOfRestUsed && <label className="flex items-start gap-2 rounded-xl border border-violet-400/15 bg-violet-500/[0.055] px-3 py-2 text-[11px] text-slate-300">
        <input type="checkbox" checked={useSongOfRest} onChange={(event) => setUseSongOfRest(event.target.checked)} className="mt-0.5" />
        <span><strong className="text-violet-200">使用 {songOfRestBard.character.name} 的休憩曲 d{songOfRestBard.dieSides}</strong><span className="mt-0.5 block text-slate-500">本次短休首次花费生命骰时额外结算一次。</span></span>
      </label>}
      {hitDieResult && <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-[11px] leading-5 text-emerald-200">{hitDieResult}</p>}
    </div>

    {recoveryFeature && <div className="mt-4 border-t border-cyan-300/10 pt-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-cyan-100"><Sparkles className="h-3.5 w-3.5" />{recoveryFeature === 'arcane-recovery' ? '奥术回想' : '自然恢复'}</p>
          <p className="mt-1 text-[10px] leading-4 text-slate-500">完成短休后选择恢复1至5环法术位，总环级上限 {recoveryBudget}；每天一次。</p>
        </div>
        <span className="shrink-0 text-[10px] text-cyan-200">可用 {recoveryResource?.current ?? 0}/{recoveryResource?.max ?? 0}</span>
      </div>
      {slotOptions.length > 0 ? <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {slotOptions.map((slot) => <label key={slot.level} className="flex items-center justify-between gap-2 rounded-lg border border-white/8 bg-black/15 px-3 py-2 text-[11px] text-slate-300">
          <span>{slot.level}环 · {slot.current}/{slot.max}</span>
          <select
            value={slotAmounts[slot.level] ?? 0}
            disabled={busy != null || (recoveryResource?.current ?? 0) < 1}
            onChange={(event) => setSlotAmounts((current) => ({ ...current, [slot.level]: Number(event.target.value) }))}
            className="rounded border border-white/10 bg-void-950 px-2 py-1 text-slate-200"
          >
            {Array.from({ length: Math.min(slot.missing, Math.floor(recoveryBudget / slot.level)) + 1 }, (_, amount) => <option key={amount} value={amount}>恢复 {amount}</option>)}
          </select>
        </label>)}
      </div> : <p className="mt-2 text-[11px] text-slate-500">符合条件的法术位均已充满。</p>}
      <button
        type="button"
        disabled={busy != null || (recoveryResource?.current ?? 0) < 1 || plannedSlotLevels < 1 || plannedSlotLevels > recoveryBudget}
        onClick={() => void recoverSpellSlots()}
        className="mt-2 w-full rounded-lg bg-cyan-500/15 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy === 'spell-slots' ? '正在结算……' : `确认恢复法术位（${plannedSlotLevels}/${recoveryBudget}环）`}
      </button>
      {slotResult && <p className="mt-2 rounded-lg bg-cyan-500/10 px-3 py-2 text-[11px] leading-5 text-cyan-100">{slotResult}</p>}
    </div>}
    {error && <p role="alert" className="mt-3 rounded-lg border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">{error}</p>}
  </section>
}
