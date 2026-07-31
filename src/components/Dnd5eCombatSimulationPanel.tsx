import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import {
  AlertTriangle,
  Bot,
  FlaskConical,
  Pause,
  Play,
  ShieldCheck,
  Users,
} from 'lucide-react'
import {
  DND5E_COMBAT_SIMULATION_DEFAULT_TRIALS,
  DND5E_COMBAT_SIMULATION_MAX_TRIALS,
  DND5E_COMBAT_SIMULATION_MONSTERS,
  validateDnd5eCombatSimulationRequest,
  type Dnd5eCombatSimulationRequest,
} from '../rulesets/dnd5e/combatSimulation'
import { useCharacterStore } from '../store/characters'
import { useCustomMonsterStore } from '../store/customMonsters'
import { useMapStore } from '../store/maps'
import { useMapGeometryStore } from '../store/mapGeometry'
import { getRoomSession } from '../lib/roomSession'
import {
  clearDnd5eLearnedStrategy,
  dnd5eStrategyScopeId,
  loadDnd5eLearnedStrategy,
  saveDnd5eLearnedStrategy,
} from '../rulesets/dnd5e/monsterStrategyLearning'
import {
  dnd5eCombatSimulationJobSnapshot,
  pauseDnd5eCombatSimulationJob,
  resumeDnd5eCombatSimulationJob,
  startDnd5eCombatSimulationJob,
  subscribeDnd5eCombatSimulationJob,
} from '../lib/dnd5eCombatSimulationJob'

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function decimal(value: number): string {
  return (Math.round(value * 10) / 10).toLocaleString('zh-CN')
}

function signedPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`
}

export default function Dnd5eCombatSimulationPanel() {
  const characters = useCharacterStore((state) => state.characters)
  const customMonsters = useCustomMonsterStore((state) => state.monsters)
  const loadCustomMonsters = useCustomMonsterStore((state) => state.loadShared)
  const maps = useMapStore((state) => state.maps)
  const selectedMapId = useMapStore((state) => state.selectedId)
  const activeMap = maps.find((map) => map.id === selectedMapId) ?? maps[0]
  const mapGeometries = useMapGeometryStore((state) => state.maps)
  const [trials, setTrials] = useState(DND5E_COMBAT_SIMULATION_DEFAULT_TRIALS)
  const [seedText, setSeedText] = useState('20240724')
  const [runtimeError, setRuntimeError] = useState<string | null>(null)
  const simulationJob = useSyncExternalStore(
    subscribeDnd5eCombatSimulationJob,
    dnd5eCombatSimulationJobSnapshot,
    dnd5eCombatSimulationJobSnapshot,
  )
  const busy = ['running', 'pausing', 'paused'].includes(simulationJob.status)
  const simulationPaused = simulationJob.status === 'paused'
  const simulationPausing = simulationJob.status === 'pausing'
  const simulationProgress = simulationJob.progress
  const result = simulationJob.result ?? null
  const strategyScopeId = useMemo(() => dnd5eStrategyScopeId(getRoomSession()), [])
  const [strategyApplied, setStrategyApplied] = useState(
    () => loadDnd5eLearnedStrategy(strategyScopeId) != null,
  )

  useEffect(() => {
    void loadCustomMonsters()
  }, [loadCustomMonsters])

  const monsterCatalog = useMemo(
    () => [...DND5E_COMBAT_SIMULATION_MONSTERS, ...customMonsters]
      .filter((monster, index, all) => all.findIndex((candidate) => candidate.id === monster.id) === index),
    [customMonsters],
  )
  const currentEncounter = useMemo(() => {
    if (!activeMap) {
      return {
        characters: [],
        monsters: [],
        errors: ['当前没有可模拟的地图遭遇。'],
        battlefield: undefined,
      }
    }
    const catalogIds = new Set(monsterCatalog.map((monster) => monster.id))
    const errors: string[] = []
    const characterIds = activeMap.tokens
      .filter((token) => token.type === 'player' && token.characterId)
      .map((token) => token.characterId!)
      .filter((id, index, all) => all.indexOf(id) === index)
    const encounterCharacters = characterIds
      .map((id) => characters.find((character) => character.id === id))
      .filter((character): character is NonNullable<typeof character> => !!character)
    const missingCharacterCount = characterIds.length - encounterCharacters.length
    if (missingCharacterCount > 0) errors.push(`当前遭遇有 ${missingCharacterCount} 个玩家 Token 未关联有效角色。`)
    if (encounterCharacters.length > 8) errors.push('当前遭遇超过 8 名玩家，暂时无法进行模拟。')

    const counts = new Map<string, number>()
    let unknownMonsterCount = 0
    for (const token of activeMap.tokens) {
      if (token.type !== 'enemy') continue
      if (!token.poolId || !catalogIds.has(token.poolId)) {
        unknownMonsterCount += 1
        continue
      }
      counts.set(token.poolId, (counts.get(token.poolId) ?? 0) + 1)
    }
    const encounterMonsters = [...counts].map(([monsterId, count]) => ({ monsterId, count }))
    const monsterCount = encounterMonsters.reduce((sum, entry) => sum + entry.count, 0)
    if (unknownMonsterCount > 0) {
      errors.push(`当前遭遇有 ${unknownMonsterCount} 个敌方 Token 未关联 SRD 或怪物工坊数据。`)
    }
    if (monsterCount > 24) errors.push('当前遭遇超过 24 只怪物，暂时无法进行模拟。')
    if (encounterMonsters.some((entry) => entry.count > 12)) {
      errors.push('当前遭遇中同一种怪物超过 12 只，暂时无法进行模拟。')
    }
    return {
      characters: encounterCharacters,
      monsters: encounterMonsters,
      errors,
      battlefield: {
        map: activeMap,
        geometry: mapGeometries.find((geometry) => geometry.mapId === activeMap.id),
      },
    }
  }, [activeMap, characters, mapGeometries, monsterCatalog])
  const seedIsValid = /^[1-9]\d{7}$/.test(seedText)
  const request = useMemo<Dnd5eCombatSimulationRequest>(() => ({
    characters: currentEncounter.characters,
    monsters: currentEncounter.monsters,
    customMonsters,
    trials,
    seed: seedIsValid ? Number(seedText) : 10_000_000,
    maxRounds: 20,
    battlefield: currentEncounter.battlefield,
    strategyTraining: {
      enabled: true,
      explorationRate: 0.08,
      terminalRewardWeight: 0.75,
      evaluationFraction: 0.3,
    },
  }), [currentEncounter, customMonsters, seedIsValid, seedText, trials])
  const validationErrors = useMemo(
    () => [
      ...currentEncounter.errors,
      ...(!seedIsValid ? ['随机种子必须是正好 8 位数字，且首位不能为 0。'] : []),
      ...validateDnd5eCombatSimulationRequest(request),
    ],
    [currentEncounter.errors, request, seedIsValid],
  )

  const runSimulation = () => {
    if (busy || validationErrors.length > 0 || !activeMap) return
    setRuntimeError(null)
    startDnd5eCombatSimulationJob(request, {
      mapId: activeMap.id,
      mapName: activeMap.name,
    })
  }

  const toggleSimulationPause = () => {
    if (simulationPaused) resumeDnd5eCombatSimulationJob()
    else pauseDnd5eCombatSimulationJob()
  }

  const applyLearnedStrategy = () => {
    if (!result || result.learnedStrategy.global.sampleCount < 8) return
    if (!saveDnd5eLearnedStrategy(strategyScopeId, result.learnedStrategy)) {
      setRuntimeError('无法保存学习策略，请检查浏览器本地存储权限。')
      return
    }
    setStrategyApplied(true)
    setRuntimeError(null)
  }

  const restoreDefaultStrategy = () => {
    if (!clearDnd5eLearnedStrategy(strategyScopeId)) {
      setRuntimeError('无法恢复默认策略，请检查浏览器本地存储权限。')
      return
    }
    setStrategyApplied(false)
    setRuntimeError(null)
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
            仅模拟当前地图遭遇，使用当前玩家/敌方 Token、真实坐标、墙门、遮蔽和范围落点。
            任务在独立后台 Worker 中持续运行，切换页面不会中断，也不会写入角色、地图或房间资源。
          </p>
          <p className="mt-1 text-xs text-cyan-300/70">
            当前遭遇：{activeMap?.name ?? '无'}
            {busy && simulationJob.encounter
              ? ` · ${simulationPaused ? '训练已暂停' : simulationPausing ? '正在暂停训练' : '后台正在模拟'}：${simulationJob.encounter.mapName}`
              : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={runSimulation}
            disabled={busy || validationErrors.length > 0}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Play className={`h-4 w-4 ${busy ? 'animate-pulse' : ''}`} />
            {busy
              ? simulationProgress
                ? `${simulationPaused ? '已暂停' : simulationPausing ? '暂停中' : simulationProgress.phase === 'training' ? '训练' : '留出评估'} ${simulationProgress.completedTrials.toLocaleString('zh-CN')}/${simulationProgress.totalTrials.toLocaleString('zh-CN')}`
                : `正在模拟 ${trials.toLocaleString('zh-CN')} 场…`
              : `模拟 ${trials.toLocaleString('zh-CN')} 场`}
          </button>
          {busy && (
            <button
              type="button"
              onClick={toggleSimulationPause}
              disabled={simulationPausing}
              title={simulationPaused
                ? '从已保存的训练状态继续。'
                : simulationPausing
                  ? '会在当前一场战斗完整结算后暂停。'
                  : '会在当前一场战斗完整结算后暂停，不会丢失学习状态。'}
              className="inline-flex items-center gap-2 rounded-xl border border-violet-300/30 bg-violet-400/10 px-4 py-2.5 text-sm font-bold text-violet-100 transition hover:bg-violet-400/20 disabled:cursor-wait disabled:opacity-45"
            >
              {simulationPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              {simulationPaused ? '继续训练' : simulationPausing ? '正在暂停…' : '暂停训练'}
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-5 p-5 xl:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-emerald-300" />
            <h4 className="text-sm font-semibold text-slate-200">当前遭遇玩家</h4>
            <span className="text-xs text-slate-600">{currentEncounter.characters.length}/8</span>
          </div>
          {currentEncounter.characters.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/8 px-4 py-8 text-center text-sm text-slate-600">
              当前地图没有关联有效角色的玩家 Token。
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {currentEncounter.characters.map((character) => (
                <div
                  key={character.id}
                  className="rounded-xl border border-emerald-400/25 bg-emerald-500/8 px-3 py-2.5"
                >
                  <span className="block truncate text-sm font-semibold text-slate-200">{character.name}</span>
                  <span className="block text-[11px] text-slate-500">
                    {character.charClass} {character.level}级 · HP {character.maxHp} · AC {character.ac}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-3 flex items-center gap-2">
            <Bot className="h-4 w-4 text-rose-300" />
            <h4 className="text-sm font-semibold text-slate-200">当前遭遇怪物</h4>
            <span className="text-xs text-slate-600">
              {currentEncounter.monsters.reduce((sum, entry) => sum + entry.count, 0)}/24
            </span>
          </div>
          <div className="space-y-2">
            {currentEncounter.monsters.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/8 px-4 py-6 text-center text-sm text-slate-600">
                当前地图没有关联 SRD 或怪物工坊数据的敌方 Token。
              </div>
            ) : currentEncounter.monsters.map((entry) => {
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
                  <span className="rounded-lg bg-rose-400/10 px-3 py-1 text-sm font-bold text-rose-200">
                    ×{entry.count}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-3 border-t border-white/8 px-5 py-4 sm:grid-cols-2">
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
          8 位随机种子（相同遭遇快照可复现）
          <input
            type="text"
            inputMode="numeric"
            pattern="\d{8}"
            maxLength={8}
            value={seedText}
            onChange={(event) => setSeedText(event.target.value.replace(/\D/g, '').slice(0, 8))}
            className={`mt-1 block w-full rounded-lg border bg-void-900/70 px-3 py-2 font-mono text-sm tracking-[0.2em] text-slate-200 ${
              seedIsValid ? 'border-white/10' : 'border-amber-400/50'
            }`}
          />
        </label>
      </div>

      {(runtimeError || simulationJob.error || validationErrors.length > 0) && (
        <div className="mx-5 mb-5 flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-500/8 px-4 py-3 text-sm text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{runtimeError ?? simulationJob.error ?? validationErrors.join(' ')}</span>
        </div>
      )}

      {result && (
        <div className="border-t border-white/8 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-400/20 bg-violet-500/8 p-4">
            <div>
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-violet-300" />
                <p className="text-sm font-semibold text-violet-100">离线情境策略</p>
                <span className="rounded-full border border-violet-300/20 bg-black/20 px-2 py-0.5 text-[10px] font-semibold text-violet-200">
                  {result.mode === 'mapped-encounter' ? '二维地图遭遇' : '快速估算'}
                </span>
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                已学习 {result.learnedStrategy.global.sampleCount.toLocaleString('zh-CN')} 次怪物决策与{' '}
                {Object.values(result.learnedStrategy.players)
                  .reduce((sum, strategy) => sum + strategy.sampleCount, 0)
                  .toLocaleString('zh-CN')} 次玩家协同决策；
                全局置信度 {percent(result.learnedStrategy.global.confidence)}。策略只重排 Host 生成的合法候选。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={applyLearnedStrategy}
                disabled={result.learnedStrategy.global.sampleCount < 8}
                className="rounded-xl border border-violet-300/30 bg-violet-400/15 px-4 py-2 text-sm font-bold text-violet-100 transition hover:bg-violet-400/25 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {strategyApplied ? '替换当前实战策略' : '应用到当前战役实战'}
              </button>
              {strategyApplied && (
                <button
                  type="button"
                  onClick={restoreDefaultStrategy}
                  className="rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/5"
                >
                  恢复 Tactical V3
                </button>
              )}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/8 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">玩家胜率</p>
              <p className="mt-1 text-3xl font-black text-emerald-200">{percent(result.playerWinRate)}</p>
              <p className="mt-1 text-[11px] text-emerald-400/70">
                95% 区间 {percent(result.playerWinRate95PercentInterval.low)}–{percent(result.playerWinRate95PercentInterval.high)}
                <span className="ml-1 text-slate-500">· 全体 {result.trials.toLocaleString('zh-CN')} 场</span>
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

          {result.strategyEvaluation && (
            <div className="mt-4 overflow-hidden rounded-2xl border border-violet-400/20 bg-violet-500/[0.04]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/8 px-4 py-3">
                <div>
                  <h4 className="text-sm font-semibold text-violet-100">配对冻结留出集策略 A/B</h4>
                  <p className="mt-1 text-[11px] text-slate-500">
                    前 {result.strategyEvaluation.trainingTrials.toLocaleString('zh-CN')} 场训练；
                    后 {result.strategyEvaluation.evaluationTrials.toLocaleString('zh-CN')} 场关闭探索且不回写学习数据；
                    三组按同一随机局面配对比较。
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px]">
                  <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-emerald-300">
                    玩家学习增益 {signedPercent(result.strategyEvaluation.learnedPlayerWinRateDelta)}
                  </span>
                  <span className="rounded-full bg-rose-400/10 px-2 py-1 text-rose-300">
                    怪物学习增益 {signedPercent(result.strategyEvaluation.learnedMonsterWinRateDelta)}
                  </span>
                </div>
              </div>
              <p className="px-4 py-2 text-[11px] leading-5 text-slate-500">
                此表只统计留出集，和上方“全体场次”不是同一分母，不能直接与总胜率比较。若学习增益为 0%，表示学习后的候选排序没有改变 Tactical V3 的首选动作，并非策略没有加载。
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="bg-white/[0.03] text-xs text-slate-500">
                    <tr>
                      <th className="px-4 py-2">冻结策略</th>
                      <th className="px-4 py-2">样本</th>
                      <th className="px-4 py-2">玩家胜率</th>
                      <th className="px-4 py-2">95% 区间</th>
                      <th className="px-4 py-2">怪物胜率</th>
                      <th className="px-4 py-2">平均轮数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {([
                      ['Tactical V3 基线', result.strategyEvaluation.baseline],
                      ['仅玩家使用学习策略', result.strategyEvaluation.learnedPlayers],
                      ['仅怪物使用学习策略', result.strategyEvaluation.learnedMonsters],
                    ] as const).map(([label, cohort]) => (
                      <tr key={label} className="border-t border-white/6 text-slate-300">
                        <td className="px-4 py-2 font-semibold text-slate-200">{label}</td>
                        <td className="px-4 py-2 tabular-nums">{cohort.trials.toLocaleString('zh-CN')}</td>
                        <td className="px-4 py-2 tabular-nums text-emerald-300">{percent(cohort.playerWinRate)}</td>
                        <td className="px-4 py-2 tabular-nums text-slate-500">
                          {percent(cohort.playerWinRate95PercentInterval.low)}–
                          {percent(cohort.playerWinRate95PercentInterval.high)}
                        </td>
                        <td className="px-4 py-2 tabular-nums text-rose-300">{percent(cohort.monsterWinRate)}</td>
                        <td className="px-4 py-2 tabular-nums">{decimal(cohort.averageRounds)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

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
                玩家法术 {result.coverage.automatedPlayerSpells}/{result.coverage.totalPlayerSpells} ·
                怪物动作 {result.coverage.automatedMonsterActions}/{result.coverage.totalMonsterActions} ·
                怪物法术 {result.coverage.automatedMonsterSpells}/{result.coverage.totalMonsterSpells}
              </p>
              <ul className="mt-4 space-y-2 text-xs leading-5 text-slate-500">
                {result.coverage.limitations.map((limitation) => <li key={limitation}>• {limitation}</li>)}
              </ul>
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-2xl border border-white/8 bg-black/15 p-4">
              <h4 className="text-sm font-semibold text-slate-200">战术行为汇总</h4>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                {[
                  ['玩家法术', result.tacticalSummary.playerSpellUses],
                  ['怪物法术', result.tacticalSummary.monsterSpellUses],
                  ['范围技能', result.tacticalSummary.areaActionUses],
                  ['紧急支援', result.tacticalSummary.emergencySupportUses],
                  ['治疗动作', result.tacticalSummary.healingActions],
                  ['累计治疗', result.tacticalSummary.totalHealing],
                  ['高打低', result.tacticalSummary.highGroundAttackUses],
                  ['低打高', result.tacticalSummary.lowGroundAttackUses],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-white/[0.03] px-3 py-2">
                    <span className="text-slate-500">{label}</span>
                    <span className="float-right font-semibold tabular-nums text-slate-200">
                      {Number(value).toLocaleString('zh-CN')}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] leading-5 text-slate-500">
                范围技能平均覆盖 {decimal(result.tacticalSummary.averageEnemiesHitByAreaAction)} 名敌人；
                {result.tacticalSummary.areaActionsWithFriendlyFireRisk.toLocaleString('zh-CN')} 次选择存在友伤风险。
              </p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-black/15 p-4">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-slate-200">胜率收敛</h4>
                <span className="text-[11px] text-slate-500">最多 20 个检查点</span>
              </div>
              <div className="mt-3 max-h-56 space-y-2 overflow-auto">
                {result.convergence.map((point) => (
                  <div key={point.trials} className="grid grid-cols-[5rem_minmax(0,1fr)_4rem] items-center gap-2 text-[11px]">
                    <span className="tabular-nums text-slate-500">{point.trials.toLocaleString('zh-CN')} 场</span>
                    <div className="h-2 overflow-hidden rounded-full bg-rose-400/15">
                      <div
                        className="h-full rounded-full bg-emerald-400/70"
                        style={{ width: `${Math.max(0, Math.min(100, point.playerWinRate * 100))}%` }}
                      />
                    </div>
                    <span className="text-right tabular-nums text-emerald-300">{percent(point.playerWinRate)}</span>
                  </div>
                ))}
              </div>
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
                      <th className="px-4 py-2">均治疗</th>
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
                        <td className="px-4 py-2 tabular-nums text-emerald-300">{decimal(entry.averageHealing)}</td>
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
                        <p>位置：<span className="text-slate-300">
                          ({decimal(entry.actorPositionBefore.x)}, {decimal(entry.actorPositionBefore.y)})
                          {' → '}
                          ({decimal(entry.actorPositionAfter.x)}, {decimal(entry.actorPositionAfter.y)})
                          {' · 高程 '}
                          {decimal(entry.actorElevationBeforeFeet)} → {decimal(entry.actorElevationAfterFeet)} 尺
                        </span></p>
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
                              <span>
                                位置 ({decimal(candidate.nextPosition.x)}, {decimal(candidate.nextPosition.y)})
                                {candidate.nextPosition.elevationFeet == null
                                  ? ''
                                  : ` · ${decimal(candidate.nextPosition.elevationFeet)} 尺`}
                              </span>
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
