import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Bot,
  FlaskConical,
  Import,
  Play,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react'
import {
  DND5E_COMBAT_SIMULATION_DEFAULT_TRIALS,
  DND5E_COMBAT_SIMULATION_MAX_TRIALS,
  DND5E_COMBAT_SIMULATION_MONSTERS,
  validateDnd5eCombatSimulationRequest,
  type Dnd5eCombatSimulationMonsterSelection,
  type Dnd5eCombatSimulationResult,
} from '../rulesets/dnd5e/combatSimulation'
import { useCharacterStore } from '../store/characters'
import { useCustomMonsterStore } from '../store/customMonsters'
import { useMapStore } from '../store/maps'
import type {
  Dnd5eCombatSimulationWorkerRequest,
  Dnd5eCombatSimulationWorkerResponse,
} from '../workers/dnd5eCombatSimulation.worker'

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function decimal(value: number): string {
  return (Math.round(value * 10) / 10).toLocaleString('zh-CN')
}

export default function Dnd5eCombatSimulationPanel() {
  const characters = useCharacterStore((state) => state.characters)
  const customMonsters = useCustomMonsterStore((state) => state.monsters)
  const loadCustomMonsters = useCustomMonsterStore((state) => state.loadShared)
  const maps = useMapStore((state) => state.maps)
  const selectedMapId = useMapStore((state) => state.selectedId)
  const activeMap = maps.find((map) => map.id === selectedMapId) ?? maps[0]
  const initializedCharacters = useRef(false)
  const workerRef = useRef<Worker | null>(null)
  const workerRequestId = useRef(0)
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<Set<string>>(new Set())
  const [monsterSearch, setMonsterSearch] = useState('')
  const [selectedMonsterId, setSelectedMonsterId] = useState(
    DND5E_COMBAT_SIMULATION_MONSTERS.find((monster) => monster.slug === 'goblin')?.id ??
    DND5E_COMBAT_SIMULATION_MONSTERS[0]?.id ?? '',
  )
  const [monsterSelections, setMonsterSelections] = useState<Dnd5eCombatSimulationMonsterSelection[]>([])
  const [trials, setTrials] = useState(DND5E_COMBAT_SIMULATION_DEFAULT_TRIALS)
  const [initialDistanceFeet, setInitialDistanceFeet] = useState(30)
  const [seed, setSeed] = useState(20240724)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Dnd5eCombatSimulationResult | null>(null)
  const [runtimeError, setRuntimeError] = useState<string | null>(null)

  useEffect(() => {
    void loadCustomMonsters()
  }, [loadCustomMonsters])

  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/dnd5eCombatSimulation.worker.ts', import.meta.url),
      { type: 'module' },
    )
    workerRef.current = worker
    worker.onmessage = (event: MessageEvent<Dnd5eCombatSimulationWorkerResponse>) => {
      if (event.data.id !== workerRequestId.current) return
      if (event.data.status === 'completed') setResult(event.data.result)
      else setRuntimeError(event.data.error)
      setBusy(false)
    }
    worker.onerror = (event) => {
      setRuntimeError(event.message || '战斗模拟 Worker 运行失败。')
      setBusy(false)
    }
    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (initializedCharacters.current || characters.length === 0) return
    initializedCharacters.current = true
    setSelectedCharacterIds(new Set(characters.slice(0, 8).map((character) => character.id)))
  }, [characters])

  const selectedCharacters = useMemo(
    () => characters.filter((character) => selectedCharacterIds.has(character.id)),
    [characters, selectedCharacterIds],
  )
  const monsterCatalog = useMemo(
    () => [...DND5E_COMBAT_SIMULATION_MONSTERS, ...customMonsters]
      .filter((monster, index, all) => all.findIndex((candidate) => candidate.id === monster.id) === index),
    [customMonsters],
  )
  const filteredMonsters = useMemo(() => {
    const query = monsterSearch.trim().toLowerCase()
    if (!query) return monsterCatalog
    return monsterCatalog.filter((monster) =>
      [monster.name, monster.englishName, monster.challenge.rating, monster.creatureType]
        .some((value) => value.toLowerCase().includes(query)))
  }, [monsterCatalog, monsterSearch])
  const request = useMemo(() => ({
    characters: selectedCharacters,
    monsters: monsterSelections,
    customMonsters,
    trials,
    seed,
    initialDistanceFeet,
    maxRounds: 20,
  }), [customMonsters, initialDistanceFeet, monsterSelections, seed, selectedCharacters, trials])
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
    const worker = workerRef.current
    if (!worker) {
      setRuntimeError('战斗模拟 Worker 尚未就绪，请稍后重试。')
      return
    }
    setBusy(true)
    setRuntimeError(null)
    setResult(null)
    const id = workerRequestId.current + 1
    workerRequestId.current = id
    worker.postMessage({ id, request } satisfies Dnd5eCombatSimulationWorkerRequest)
  }

  const loadCurrentEncounter = () => {
    if (!activeMap) {
      setRuntimeError('当前没有可读取的地图。')
      return
    }
    const nextMonsters: Dnd5eCombatSimulationMonsterSelection[] = []
    const counts = new Map<string, number>()
    for (const token of activeMap.tokens) {
      if (token.type !== 'enemy' || !token.poolId) continue
      if (!monsterCatalog.some((monster) => monster.id === token.poolId)) continue
      counts.set(token.poolId, (counts.get(token.poolId) ?? 0) + 1)
    }
    let remaining = 24
    for (const [monsterId, count] of counts) {
      if (remaining <= 0) break
      const accepted = Math.min(12, count, remaining)
      nextMonsters.push({ monsterId, count: accepted })
      remaining -= accepted
    }
    const characterIds = activeMap.tokens
      .filter((token) => token.type === 'player' && token.characterId)
      .map((token) => token.characterId!)
      .filter((id, index, all) => all.indexOf(id) === index && characters.some((character) => character.id === id))
      .slice(0, 8)
    if (nextMonsters.length === 0) {
      setRuntimeError(`地图“${activeMap.name}”上没有关联 SRD 或自创怪物数据的敌方 Token。`)
      return
    }
    setMonsterSelections(nextMonsters)
    if (characterIds.length > 0) setSelectedCharacterIds(new Set(characterIds))
    setRuntimeError(null)
    setResult(null)
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
            在 Web Worker 中复用 Tactical Planner V3 与 Headless 战斗事务，单次最多运行 100,000 场；
            可直接载入怪物工坊和当前地图遭遇，且不会写入角色、地图或房间资源。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={loadCurrentEncounter}
            disabled={busy || !activeMap}
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-4 py-2.5 text-sm font-bold text-cyan-100 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Import className="h-4 w-4" />
            载入当前遭遇
          </button>
          <button
            type="button"
            onClick={runSimulation}
            disabled={busy || validationErrors.length > 0}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Play className={`h-4 w-4 ${busy ? 'animate-pulse' : ''}`} />
            {busy
              ? `正在模拟 ${trials.toLocaleString('zh-CN')} 场…`
              : `模拟 ${trials.toLocaleString('zh-CN')} 场`}
          </button>
        </div>
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
                  {monster.name} · CR {monster.challenge.rating}{monster.source === 'DM 自定义' ? ' · 自创' : ''}
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
                从 SRD 5.1 或怪物工坊目录选择怪物，也可载入当前地图遭遇。
              </div>
            ) : monsterSelections.map((entry) => {
              const monster = monsterCatalog.find((candidate) => candidate.id === entry.monsterId)
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

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-white/8">
              <div className="border-b border-white/8 px-4 py-3 text-sm font-semibold text-slate-200">逐轮统计</div>
              <div className="max-h-80 overflow-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="sticky top-0 bg-void-900 text-xs text-slate-500">
                    <tr>
                      <th className="px-4 py-2">轮次</th>
                      <th className="px-4 py-2">到达场次</th>
                      <th className="px-4 py-2">玩家伤害</th>
                      <th className="px-4 py-2">怪物伤害</th>
                      <th className="px-4 py-2">玩家死亡</th>
                      <th className="px-4 py-2">怪物死亡</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.roundSummaries.map((entry) => (
                      <tr key={entry.round} className="border-t border-white/6 text-slate-300">
                        <td className="px-4 py-2 font-semibold">{entry.round}</td>
                        <td className="px-4 py-2">{entry.appearances}</td>
                        <td className="px-4 py-2">{decimal(entry.averagePlayerDamage)}</td>
                        <td className="px-4 py-2">{decimal(entry.averageMonsterDamage)}</td>
                        <td className="px-4 py-2">{decimal(entry.averagePlayerDeaths)}</td>
                        <td className="px-4 py-2">{decimal(entry.averageMonsterDeaths)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/8">
              <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3">
                <span className="text-sm font-semibold text-slate-200">技能使用率</span>
                <span className="text-[11px] text-slate-500">
                  Headless 已提交事务 {result.headlessTransactionCount.toLocaleString('zh-CN')}
                </span>
              </div>
              <div className="max-h-80 overflow-auto">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead className="sticky top-0 bg-void-900 text-xs text-slate-500">
                    <tr>
                      <th className="px-4 py-2">单位 / 技能</th>
                      <th className="px-4 py-2">次/场</th>
                      <th className="px-4 py-2">命中率</th>
                      <th className="px-4 py-2">均伤</th>
                      <th className="px-4 py-2">事务</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.actionUsage.map((entry) => (
                      <tr key={`${entry.side}:${entry.actorName}:${entry.actionId}`} className="border-t border-white/6">
                        <td className="px-4 py-2">
                          <span className="block font-semibold text-slate-200">{entry.actionName}</span>
                          <span className="text-[11px] text-slate-500">{entry.actorName}</span>
                        </td>
                        <td className="px-4 py-2 tabular-nums text-slate-300">{decimal(entry.usesPerTrial)}</td>
                        <td className="px-4 py-2 tabular-nums text-slate-300">{percent(entry.hitRate)}</td>
                        <td className="px-4 py-2 tabular-nums text-slate-300">{decimal(entry.averageDamage)}</td>
                        <td className="px-4 py-2 tabular-nums text-slate-500">{entry.headlessTransactions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
            <div className="rounded-2xl border border-white/8 p-4">
              <h4 className="text-sm font-semibold text-slate-200">死亡原因</h4>
              {result.deathCauses.length === 0 ? (
                <p className="mt-3 text-xs text-slate-500">没有单位死亡。</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {result.deathCauses.slice(0, 30).map((entry) => (
                    <div
                      key={`${entry.victimName}:${entry.killerName}:${entry.actionName}`}
                      className="flex items-center justify-between gap-3 rounded-lg bg-black/15 px-3 py-2 text-xs"
                    >
                      <span className="text-slate-300">
                        {entry.victimName} ← {entry.killerName} · {entry.actionName}
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums text-rose-300">{entry.count} 次</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <details className="rounded-2xl border border-white/8 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-slate-200">
                AI 决策日志（首场，{result.decisionLog.length} 条）
              </summary>
              <div className="mt-3 max-h-96 space-y-2 overflow-auto">
                {result.decisionLog.map((entry, index) => (
                  <details key={`${entry.round}:${entry.actorName}:${index}`} className="rounded-lg bg-black/15 px-3 py-2 text-xs">
                    <summary className="cursor-pointer list-none">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-slate-300">
                        <span className="font-semibold text-violet-200">第 {entry.round} 轮 · 顺位 {entry.turn}</span>
                        <span>{entry.actorName}（HP {entry.actorHp}/{entry.actorMaxHp}）</span>
                        {entry.controlledByName && (
                          <span className="text-fuchsia-300">受 {entry.controlledByName} 奴役</span>
                        )}
                        <span>→ {entry.targetName ?? '无目标'}</span>
                        <span>· {entry.actionName ?? '闪避/移动'}</span>
                        <span className="text-slate-500">评分 {decimal(entry.score)}</span>
                        <span className={entry.outcome.executed ? 'text-emerald-300' : 'text-amber-300'}>
                          {entry.outcome.executed ? `命中 ${entry.outcome.hits} · 伤害 ${entry.outcome.damage}` : '未执行动作'}
                        </span>
                      </div>
                    </summary>
                    <div className="mt-3 space-y-3 border-t border-white/5 pt-3 text-slate-400">
                      <div className="grid gap-1 sm:grid-cols-2">
                        <p>决策器：<span className="text-slate-300">{entry.providerId}</span></p>
                        <p>行为/目标策略：<span className="text-slate-300">{entry.behaviorStyle} / {entry.targetPriority}</span></p>
                        <p>位置：<span className="text-slate-300">{entry.actorPositionBefore} → {entry.actorPositionAfter} 尺</span></p>
                        <p>候选数量：<span className="text-slate-300">{entry.candidateCount}</span></p>
                        <p>选中候选：<span className="break-all text-slate-300">{entry.candidateId}</span></p>
                        <p>
                          目标 HP：
                          <span className="text-slate-300">
                            {entry.outcome.targetHpBefore == null
                              ? '—'
                              : `${entry.outcome.targetHpBefore} → ${entry.outcome.targetHpAfter ?? '—'}`}
                          </span>
                        </p>
                        <p>Headless 事务：<span className="text-slate-300">{entry.outcome.headlessTransactions}</span></p>
                      </div>
                      <p>
                        最终评分依据：{entry.reasons.join('；') || '无附加评分原因'}
                      </p>
                      <div className="rounded-lg border border-cyan-300/10 bg-cyan-950/10 p-3">
                        <p className="font-semibold text-cyan-100">实际执行日志</p>
                        <ol className="mt-2 space-y-1.5">
                          {entry.executionSteps.map((step, stepIndex) => (
                            <li
                              key={`${stepIndex}:${step.kind}`}
                              className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2 leading-5"
                            >
                              <span className="text-right font-mono text-cyan-500">{stepIndex + 1}.</span>
                              <span className={
                                step.kind === 'damage'
                                  ? 'text-rose-200'
                                  : step.kind === 'roll'
                                    ? 'text-amber-100'
                                    : step.kind === 'transaction'
                                      ? 'text-emerald-200'
                                      : 'text-slate-300'
                              }>
                                {step.text}
                              </span>
                            </li>
                          ))}
                        </ol>
                      </div>
                      <div className="space-y-2">
                        <p className="font-semibold text-slate-300">完整候选排名</p>
                        {entry.candidates.map((candidate) => (
                          <div
                            key={candidate.candidateId}
                            className={`rounded-md border px-2.5 py-2 ${
                              candidate.selected
                                ? 'border-violet-300/25 bg-violet-500/10'
                                : 'border-white/5 bg-black/10'
                            }`}
                          >
                            <div className="flex flex-wrap gap-x-2 gap-y-1 text-slate-300">
                              <span className="font-semibold">#{candidate.rank}</span>
                              <span>{candidate.kind}</span>
                              <span>{candidate.actionName ?? '闪避/疾走'}</span>
                              <span>→ {candidate.targetName ?? '无目标'}</span>
                              <span>位置 {candidate.nextPosition} 尺</span>
                              <span className={candidate.selected ? 'text-violet-200' : 'text-slate-500'}>
                                {decimal(candidate.score)} 分{candidate.selected ? ' · 已选择' : ''}
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                              <span>期望伤害 {decimal(candidate.metrics.expectedDamage)}</span>
                              <span>命中率 {percent(candidate.metrics.hitProbability)}</span>
                              <span>目标 HP {candidate.metrics.targetCurrentHp}/{candidate.metrics.targetMaximumHp ?? candidate.metrics.targetCurrentHp}</span>
                              <span>目标 AC {candidate.metrics.targetArmorClass ?? '—'}</span>
                              <span>距离 {candidate.metrics.targetDistanceFeet} 尺</span>
                              <span>移动 {candidate.metrics.movementFeet} 尺</span>
                              <span>距离改善 {candidate.metrics.distanceImprovementFeet} 尺</span>
                              <span>目标优先度 {percent(candidate.metrics.targetPriorityWeight ?? 0)}</span>
                              <span>控制收益 {decimal(candidate.metrics.controlValue ?? 0)}</span>
                              <span>资源成本 {decimal(candidate.metrics.resourceCost ?? 0)}</span>
                              <span>借机攻击风险 {candidate.metrics.opportunityAttackRisk}</span>
                            </div>
                            <p className="mt-1 break-all text-[11px] text-slate-600">{candidate.candidateId}</p>
                            <p className="mt-1 text-[11px] text-slate-500">
                              {candidate.reasons.join('；') || '无附加评分原因'}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            </details>
          </div>
        </div>
      )}
    </section>
  )
}
