import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Bot,
  FlaskConical,
  Play,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react'
import {
  DND5E_COMBAT_SIMULATION_MAX_TRIALS,
  DND5E_COMBAT_SIMULATION_MONSTERS,
  simulateDnd5eCombats,
  validateDnd5eCombatSimulationRequest,
  type Dnd5eCombatSimulationMonsterSelection,
  type Dnd5eCombatSimulationResult,
} from '../rulesets/dnd5e/combatSimulation'
import { useCharacterStore } from '../store/characters'

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function decimal(value: number): string {
  return (Math.round(value * 10) / 10).toLocaleString('zh-CN')
}

export default function Dnd5eCombatSimulationPanel() {
  const characters = useCharacterStore((state) => state.characters)
  const initializedCharacters = useRef(false)
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<Set<string>>(new Set())
  const [monsterSearch, setMonsterSearch] = useState('')
  const [selectedMonsterId, setSelectedMonsterId] = useState(
    DND5E_COMBAT_SIMULATION_MONSTERS.find((monster) => monster.slug === 'goblin')?.id ??
    DND5E_COMBAT_SIMULATION_MONSTERS[0]?.id ?? '',
  )
  const [monsterSelections, setMonsterSelections] = useState<Dnd5eCombatSimulationMonsterSelection[]>([])
  const [trials, setTrials] = useState(DND5E_COMBAT_SIMULATION_MAX_TRIALS)
  const [initialDistanceFeet, setInitialDistanceFeet] = useState(30)
  const [seed, setSeed] = useState(20240724)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Dnd5eCombatSimulationResult | null>(null)
  const [runtimeError, setRuntimeError] = useState<string | null>(null)

  useEffect(() => {
    if (initializedCharacters.current || characters.length === 0) return
    initializedCharacters.current = true
    setSelectedCharacterIds(new Set(characters.slice(0, 8).map((character) => character.id)))
  }, [characters])

  const selectedCharacters = useMemo(
    () => characters.filter((character) => selectedCharacterIds.has(character.id)),
    [characters, selectedCharacterIds],
  )
  const filteredMonsters = useMemo(() => {
    const query = monsterSearch.trim().toLowerCase()
    if (!query) return DND5E_COMBAT_SIMULATION_MONSTERS
    return DND5E_COMBAT_SIMULATION_MONSTERS.filter((monster) =>
      [monster.name, monster.englishName, monster.challenge.rating, monster.creatureType]
        .some((value) => value.toLowerCase().includes(query)))
  }, [monsterSearch])
  const request = useMemo(() => ({
    characters: selectedCharacters,
    monsters: monsterSelections,
    trials,
    seed,
    initialDistanceFeet,
    maxRounds: 20,
  }), [initialDistanceFeet, monsterSelections, seed, selectedCharacters, trials])
  const validationErrors = useMemo(
    () => validateDnd5eCombatSimulationRequest(request),
    [request],
  )

  const addMonster = () => {
    if (!selectedMonsterId) return
    setMonsterSelections((current) => {
      const existing = current.find((entry) => entry.monsterId === selectedMonsterId)
      if (existing) {
        return current.map((entry) => entry.monsterId === selectedMonsterId
          ? { ...entry, count: Math.min(12, entry.count + 1) }
          : entry)
      }
      return [...current, { monsterId: selectedMonsterId, count: 1 }]
    })
  }

  const runSimulation = () => {
    if (busy || validationErrors.length > 0) return
    setBusy(true)
    setRuntimeError(null)
    setResult(null)
    window.setTimeout(() => {
      try {
        setResult(simulateDnd5eCombats(request))
      } catch (error) {
        setRuntimeError(error instanceof Error ? error.message : String(error))
      } finally {
        setBusy(false)
      }
    }, 0)
  }

  return (
    <section className="glass overflow-hidden rounded-2xl" data-testid="dnd5e-combat-simulation">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/8 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-violet-300" />
            <h3 className="font-semibold text-slate-100">遭遇模拟器</h3>
          </div>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
            使用确定性 Tactical Planner V3 和带种子的 5e 骰池批量模拟，最多运行 1000 场。
            模拟不会写入角色、地图或房间资源。
          </p>
        </div>
        <button
          type="button"
          onClick={runSimulation}
          disabled={busy || validationErrors.length > 0}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Play className={`h-4 w-4 ${busy ? 'animate-pulse' : ''}`} />
          {busy ? `正在模拟 ${trials} 场…` : `模拟 ${trials} 场`}
        </button>
      </div>

      <div className="grid gap-5 p-5 xl:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-emerald-300" />
            <h4 className="text-sm font-semibold text-slate-200">玩家队伍</h4>
            <span className="text-xs text-slate-600">{selectedCharacters.length}/8</span>
          </div>
          {characters.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/8 px-4 py-8 text-center text-sm text-slate-600">
              房间内还没有可用于模拟的角色。
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {characters.map((character) => {
                const checked = selectedCharacterIds.has(character.id)
                return (
                  <label
                    key={character.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
                      checked ? 'border-emerald-400/30 bg-emerald-500/8' : 'border-white/8 bg-black/15'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!checked && selectedCharacterIds.size >= 8}
                      onChange={(event) => setSelectedCharacterIds((current) => {
                        const next = new Set(current)
                        if (event.target.checked) next.add(character.id)
                        else next.delete(character.id)
                        return next
                      })}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-200">{character.name}</span>
                      <span className="block text-[11px] text-slate-500">
                        {character.charClass} {character.level}级 · HP {character.maxHp} · AC {character.ac}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          )}
        </div>

        <div>
          <div className="mb-3 flex items-center gap-2">
            <Bot className="h-4 w-4 text-rose-300" />
            <h4 className="text-sm font-semibold text-slate-200">怪物队伍</h4>
            <span className="text-xs text-slate-600">
              {monsterSelections.reduce((sum, entry) => sum + entry.count, 0)}/24
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_auto]">
            <input
              value={monsterSearch}
              onChange={(event) => setMonsterSearch(event.target.value)}
              placeholder="搜索中文名、英文名、CR…"
              className="rounded-xl border border-white/10 bg-void-900/70 px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-violet-400/40"
            />
            <select
              value={selectedMonsterId}
              onChange={(event) => setSelectedMonsterId(event.target.value)}
              className="rounded-xl border border-white/10 bg-void-900/70 px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-violet-400/40"
            >
              {filteredMonsters.map((monster) => (
                <option key={monster.id} value={monster.id}>
                  {monster.name} · CR {monster.challenge.rating}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={addMonster}
              disabled={!selectedMonsterId}
              className="inline-flex items-center justify-center gap-1 rounded-xl border border-violet-400/25 bg-violet-500/10 px-3 text-sm font-semibold text-violet-200 hover:bg-violet-500/20 disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />加入
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {monsterSelections.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/8 px-4 py-6 text-center text-sm text-slate-600">
                从 SRD 5.1 目录选择怪物加入模拟。
              </div>
            ) : monsterSelections.map((entry) => {
              const monster = DND5E_COMBAT_SIMULATION_MONSTERS.find((candidate) => candidate.id === entry.monsterId)
              if (!monster) return null
              return (
                <div key={entry.monsterId} className="flex items-center gap-3 rounded-xl border border-white/8 bg-black/15 px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-200">{monster.name}</span>
                    <span className="block text-[11px] text-slate-500">
                      CR {monster.challenge.rating} · HP {monster.hitPoints.average} · AC {monster.armorClass.value}
                    </span>
                  </span>
                  <input
                    aria-label={`${monster.name}数量`}
                    type="number"
                    min={1}
                    max={12}
                    value={entry.count}
                    onChange={(event) => setMonsterSelections((current) => current.map((candidate) =>
                      candidate.monsterId === entry.monsterId
                        ? { ...candidate, count: Math.max(1, Math.min(12, Number(event.target.value) || 1)) }
                        : candidate))}
                    className="w-16 rounded-lg border border-white/10 bg-void-900/70 px-2 py-1.5 text-center text-sm text-slate-200"
                  />
                  <button
                    type="button"
                    aria-label={`移除${monster.name}`}
                    onClick={() => setMonsterSelections((current) =>
                      current.filter((candidate) => candidate.monsterId !== entry.monsterId))}
                    className="rounded-lg p-2 text-slate-600 hover:bg-red-500/10 hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-3 border-t border-white/8 px-5 py-4 sm:grid-cols-3">
        <label className="text-xs text-slate-500">
          模拟场数
          <input
            type="number"
            min={1}
            max={DND5E_COMBAT_SIMULATION_MAX_TRIALS}
            value={trials}
            onChange={(event) => setTrials(Math.max(1, Math.min(DND5E_COMBAT_SIMULATION_MAX_TRIALS, Number(event.target.value) || 1)))}
            className="mt-1 block w-full rounded-lg border border-white/10 bg-void-900/70 px-3 py-2 text-sm text-slate-200"
          />
        </label>
        <label className="text-xs text-slate-500">
          初始距离（尺）
          <input
            type="number"
            min={5}
            max={300}
            step={5}
            value={initialDistanceFeet}
            onChange={(event) => setInitialDistanceFeet(Math.max(5, Math.min(300, Number(event.target.value) || 5)))}
            className="mt-1 block w-full rounded-lg border border-white/10 bg-void-900/70 px-3 py-2 text-sm text-slate-200"
          />
        </label>
        <label className="text-xs text-slate-500">
          随机种子（相同配置可复现）
          <input
            type="number"
            value={seed}
            onChange={(event) => setSeed(Number(event.target.value) || 1)}
            className="mt-1 block w-full rounded-lg border border-white/10 bg-void-900/70 px-3 py-2 text-sm text-slate-200"
          />
        </label>
      </div>

      {(runtimeError || validationErrors.length > 0) && (
        <div className="mx-5 mb-5 flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-500/8 px-4 py-3 text-sm text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{runtimeError ?? validationErrors.join(' ')}</span>
        </div>
      )}

      {result && (
        <div className="border-t border-white/8 p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/8 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">玩家胜率</p>
              <p className="mt-1 text-3xl font-black text-emerald-200">{percent(result.playerWinRate)}</p>
              <p className="mt-1 text-[11px] text-emerald-400/70">
                95% 区间 {percent(result.playerWinRate95PercentInterval.low)}–{percent(result.playerWinRate95PercentInterval.high)}
              </p>
            </div>
            <div className="rounded-2xl border border-rose-400/20 bg-rose-500/8 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-rose-400">怪物胜率</p>
              <p className="mt-1 text-3xl font-black text-rose-200">{percent(result.monsterWinRate)}</p>
              <p className="mt-1 text-[11px] text-rose-400/70">{result.monsterWins} 场胜利</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-black/15 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">战斗长度</p>
              <p className="mt-1 text-3xl font-black text-slate-200">{decimal(result.averageRounds)} 轮</p>
              <p className="mt-1 text-[11px] text-slate-500">
                平局 {percent(result.drawRate)} · 种子 {result.seed}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <div className="overflow-hidden rounded-2xl border border-white/8">
              <div className="border-b border-white/8 px-4 py-3 text-sm font-semibold text-slate-200">单位模拟均值</div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[540px] text-left text-sm">
                  <thead className="bg-white/[0.03] text-xs text-slate-500">
                    <tr><th className="px-4 py-2">单位</th><th className="px-4 py-2">阵营</th><th className="px-4 py-2">存活率</th><th className="px-4 py-2">伤害</th><th className="px-4 py-2">剩余 HP</th></tr>
                  </thead>
                  <tbody>
                    {result.participantSummaries.map((entry) => (
                      <tr key={entry.id} className="border-t border-white/6">
                        <td className="px-4 py-2 font-semibold text-slate-200">{entry.name}</td>
                        <td className="px-4 py-2 text-slate-500">{entry.side === 'players' ? '玩家' : '怪物'}</td>
                        <td className="px-4 py-2 tabular-nums text-slate-300">{percent(entry.survivalRate)}</td>
                        <td className="px-4 py-2 tabular-nums text-slate-300">{decimal(entry.averageDamage)}</td>
                        <td className="px-4 py-2 tabular-nums text-slate-300">{decimal(entry.averageRemainingHp)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="rounded-2xl border border-white/8 bg-black/15 p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-cyan-300" />
                <h4 className="text-sm font-semibold text-slate-200">自动化覆盖</h4>
              </div>
              <p className="mt-3 text-3xl font-black text-cyan-200">{percent(result.coverage.percentage)}</p>
              <p className="mt-1 text-xs text-slate-500">
                玩家武器配置 {result.coverage.playerBasicAttackProfiles}/{result.coverage.playerCount} ·
                怪物动作 {result.coverage.automatedMonsterActions}/{result.coverage.totalMonsterActions} ·
                怪物法术 {result.coverage.automatedMonsterSpells}/{result.coverage.totalMonsterSpells}
              </p>
              <ul className="mt-4 space-y-2 text-xs leading-5 text-slate-500">
                {result.coverage.limitations.map((limitation) => <li key={limitation}>• {limitation}</li>)}
              </ul>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
