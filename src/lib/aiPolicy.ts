export interface DodgePolicyParams {
  minSuccessChance: number
  significantDamageRatio: number
  lethalSuccessChance: number
  preserveApWhenSafe: boolean
}

export const DEFAULT_DODGE_POLICY: DodgePolicyParams = {
  minSuccessChance: 0.25,
  significantDamageRatio: 0.35,
  lethalSuccessChance: 0.15,
  preserveApWhenSafe: true,
}

export interface DodgeDecisionInput {
  currentAp: number
  currentHp: number
  maxHp: number
  targetAc: number
  incomingAttackBonus: number
  estimatedDamage: number
  remainingAttacksThisTurn?: number
  policy?: DodgePolicyParams
}

export interface DodgeDecision {
  shouldDodge: boolean
  successChance: number
  damageRatio: number
  lethal: boolean
  reason: string
}

export function dodgeSuccessChance(targetAc: number, incomingAttackBonus: number): number {
  let success = 0
  for (let d20 = 1; d20 <= 20; d20++) {
    if (d20 + incomingAttackBonus < targetAc) success += 1
  }
  return success / 20
}

export function decideDodge(input: DodgeDecisionInput): DodgeDecision {
  const policy = input.policy ?? DEFAULT_DODGE_POLICY
  const hp = Math.max(1, input.currentHp)
  const maxHp = Math.max(1, input.maxHp)
  const estimatedDamage = Math.max(0, input.estimatedDamage)
  const successChance = dodgeSuccessChance(input.targetAc, input.incomingAttackBonus)
  const damageRatio = estimatedDamage / maxHp
  const lethal = estimatedDamage >= hp

  if (input.currentAp < 1) {
    return { shouldDodge: false, successChance, damageRatio, lethal, reason: 'AP不足' }
  }
  if (estimatedDamage <= 0) {
    return { shouldDodge: false, successChance, damageRatio, lethal, reason: '没有有效伤害' }
  }
  if (lethal && successChance >= policy.lethalSuccessChance) {
    return { shouldDodge: true, successChance, damageRatio, lethal, reason: '可能致命' }
  }
  if (successChance < policy.minSuccessChance) {
    return { shouldDodge: false, successChance, damageRatio, lethal, reason: '闪避成功率过低' }
  }
  if (damageRatio >= policy.significantDamageRatio) {
    return { shouldDodge: true, successChance, damageRatio, lethal, reason: '伤害占比较高' }
  }
  if (policy.preserveApWhenSafe && input.currentAp <= 1 && (input.remainingAttacksThisTurn ?? 1) <= 1) {
    return { shouldDodge: false, successChance, damageRatio, lethal, reason: '保留AP用于行动/借机' }
  }
  return { shouldDodge: false, successChance, damageRatio, lethal, reason: '伤害可承受' }
}

export interface SimulationConfig {
  runs: number
  roundsLimit: number
  policy: DodgePolicyParams
  seed?: number
  playerHp: number
  enemyHp: number
  playerAc: number
  enemyAc: number
  playerAttackBonus: number
  enemyAttackBonus: number
  playerDamageDice: { count: number; sides: number; bonus: number }
  enemyDamageDice: { count: number; sides: number; bonus: number }
}

export interface SimulationSummary {
  runs: number
  playerWinRate: number
  enemyWinRate: number
  drawRate: number
  averageRounds: number
  averageEnemyDodges: number
  averageEnemyDodgeSuccesses: number
  averagePlayerHpRemaining: number
  averageEnemyHpRemaining: number
}

export interface MapSimulationActor {
  id: string
  label: string
  team: 'player' | 'enemy'
  x: number
  y: number
  hp: number
  maxHp: number
  ac: number
  attackBonus: number
  damageDice: { count: number; sides: number; bonus: number }
  speedCells: number
  attackRangeCells: number
}

export interface MapSimulationConfig {
  runs: number
  roundsLimit: number
  policy: DodgePolicyParams
  actors: MapSimulationActor[]
  seed?: number
}

export interface MapSimulationSummary extends SimulationSummary {
  averagePlayerDamage: number
  averageEnemyDamage: number
  averageDistanceClosed: number
}

export interface MapSimulationRunLog {
  index: number
  outcome: 'player' | 'enemy' | 'draw'
  rounds: number
  playerHpRemaining: number
  enemyHpRemaining: number
  enemyDodges: number
  enemyDodgeSuccesses: number
  log: string[]
}

export interface MapSimulationDetailedResult {
  summary: MapSimulationSummary
  runs: MapSimulationRunLog[]
}

function createRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

function rollDie(rng: () => number, sides: number): number {
  return 1 + Math.floor(rng() * sides)
}

function rollDamage(rng: () => number, dice: { count: number; sides: number; bonus: number }): number {
  let total = dice.bonus
  for (let i = 0; i < dice.count; i++) total += rollDie(rng, dice.sides)
  return Math.max(0, total)
}

function averageDamage(dice: { count: number; sides: number; bonus: number }): number {
  return dice.count * ((dice.sides + 1) / 2) + dice.bonus
}

export function runBattleSimulation(config: SimulationConfig): SimulationSummary {
  const rng = createRng(config.seed ?? 20260615)
  let playerWins = 0
  let enemyWins = 0
  let draws = 0
  let roundsTotal = 0
  let enemyDodges = 0
  let enemyDodgeSuccesses = 0
  let playerHpRemaining = 0
  let enemyHpRemaining = 0

  for (let run = 0; run < config.runs; run++) {
    let playerHp = config.playerHp
    let enemyHp = config.enemyHp
    let rounds = 0

    while (playerHp > 0 && enemyHp > 0 && rounds < config.roundsLimit) {
      rounds += 1
      let enemyAp = 2

      for (let attack = 0; attack < 2 && enemyHp > 0; attack++) {
        const decision = decideDodge({
          currentAp: enemyAp,
          currentHp: enemyHp,
          maxHp: config.enemyHp,
          targetAc: config.enemyAc,
          incomingAttackBonus: config.playerAttackBonus,
          estimatedDamage: averageDamage(config.playerDamageDice),
          remainingAttacksThisTurn: 2 - attack,
          policy: config.policy,
        })
        if (decision.shouldDodge) {
          enemyAp -= 1
          enemyDodges += 1
          const attackRoll = rollDie(rng, 20) + config.playerAttackBonus
          if (attackRoll < config.enemyAc) {
            enemyDodgeSuccesses += 1
            continue
          }
        }
        enemyHp -= rollDamage(rng, config.playerDamageDice)
      }

      if (enemyHp <= 0) break

      for (let attack = 0; attack < 2 && playerHp > 0; attack++) {
        const hit = rollDie(rng, 20) + config.enemyAttackBonus >= config.playerAc
        if (hit) playerHp -= rollDamage(rng, config.enemyDamageDice)
      }
    }

    roundsTotal += rounds
    playerHpRemaining += Math.max(0, playerHp)
    enemyHpRemaining += Math.max(0, enemyHp)
    if (playerHp > 0 && enemyHp <= 0) playerWins += 1
    else if (enemyHp > 0 && playerHp <= 0) enemyWins += 1
    else draws += 1
  }

  const runs = Math.max(1, config.runs)
  return {
    runs,
    playerWinRate: playerWins / runs,
    enemyWinRate: enemyWins / runs,
    drawRate: draws / runs,
    averageRounds: roundsTotal / runs,
    averageEnemyDodges: enemyDodges / runs,
    averageEnemyDodgeSuccesses: enemyDodgeSuccesses / runs,
    averagePlayerHpRemaining: playerHpRemaining / runs,
    averageEnemyHpRemaining: enemyHpRemaining / runs,
  }
}

function chebyshevDistance(a: Pick<MapSimulationActor, 'x' | 'y'>, b: Pick<MapSimulationActor, 'x' | 'y'>): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
}

function moveTowardActor(
  actor: MapSimulationActor,
  target: MapSimulationActor,
  cells: number,
): MapSimulationActor {
  let x = actor.x
  let y = actor.y
  for (let i = 0; i < cells; i++) {
    if (chebyshevDistance({ x, y }, target) <= actor.attackRangeCells) break
    if (x < target.x) x += 1
    else if (x > target.x) x -= 1
    if (y < target.y) y += 1
    else if (y > target.y) y -= 1
  }
  return { ...actor, x, y }
}

function nearestLivingEnemy(actor: MapSimulationActor, actors: MapSimulationActor[]): MapSimulationActor | undefined {
  return actors
    .filter((other) => other.team !== actor.team && other.hp > 0)
    .sort((a, b) => chebyshevDistance(actor, a) - chebyshevDistance(actor, b))[0]
}

export function runMapBattleSimulation(config: MapSimulationConfig): MapSimulationSummary {
  const rng = createRng(config.seed ?? 20260615)
  let playerWins = 0
  let enemyWins = 0
  let draws = 0
  let roundsTotal = 0
  let enemyDodges = 0
  let enemyDodgeSuccesses = 0
  let playerHpRemaining = 0
  let enemyHpRemaining = 0
  let playerDamage = 0
  let enemyDamage = 0
  let distanceClosed = 0

  for (let run = 0; run < config.runs; run++) {
    const actors = config.actors.map((actor) => ({ ...actor }))
    let rounds = 0

    while (
      actors.some((actor) => actor.team === 'player' && actor.hp > 0) &&
      actors.some((actor) => actor.team === 'enemy' && actor.hp > 0) &&
      rounds < config.roundsLimit
    ) {
      rounds += 1
      const apById = new Map(actors.map((actor) => [actor.id, 2]))
      for (const actorId of actors.map((actor) => actor.id)) {
        const index = actors.findIndex((actor) => actor.id === actorId)
        if (index < 0 || actors[index].hp <= 0) continue
        let actor = actors[index]
        let ap = apById.get(actor.id) ?? 0

        while (ap > 0 && actor.hp > 0) {
          const target = nearestLivingEnemy(actor, actors)
          if (!target) break
          const beforeDistance = chebyshevDistance(actor, target)
          if (beforeDistance > actor.attackRangeCells) {
            const moved = moveTowardActor(actor, target, actor.speedCells)
            const afterDistance = chebyshevDistance(moved, target)
            distanceClosed += Math.max(0, beforeDistance - afterDistance)
            actor = moved
            actors[index] = actor
            ap -= 1
            apById.set(actor.id, ap)
            continue
          }

          const targetIndex = actors.findIndex((other) => other.id === target.id)
          if (targetIndex < 0) break
          let targetActor = actors[targetIndex]
          if (targetActor.team === 'enemy') {
            const targetAp = apById.get(targetActor.id) ?? 0
            const decision = decideDodge({
              currentAp: targetAp,
              currentHp: targetActor.hp,
              maxHp: targetActor.maxHp,
              targetAc: targetActor.ac,
              incomingAttackBonus: actor.attackBonus,
              estimatedDamage: averageDamage(actor.damageDice),
              policy: config.policy,
            })
            if (decision.shouldDodge) {
              apById.set(targetActor.id, Math.max(0, targetAp - 1))
              enemyDodges += 1
              const dodgeAttackTotal = rollDie(rng, 20) + actor.attackBonus
              if (dodgeAttackTotal < targetActor.ac) {
                enemyDodgeSuccesses += 1
                ap -= 1
                apById.set(actor.id, ap)
                continue
              }
            }
          }

          const hit = rollDie(rng, 20) + actor.attackBonus >= targetActor.ac
          if (hit) {
            const damage = rollDamage(rng, actor.damageDice)
            targetActor = { ...targetActor, hp: Math.max(0, targetActor.hp - damage) }
            actors[targetIndex] = targetActor
            if (actor.team === 'player') playerDamage += damage
            else enemyDamage += damage
          }
          ap -= 1
          apById.set(actor.id, ap)
        }
      }
    }

    roundsTotal += rounds
    const players = actors.filter((actor) => actor.team === 'player')
    const enemies = actors.filter((actor) => actor.team === 'enemy')
    const playerAlive = players.some((actor) => actor.hp > 0)
    const enemyAlive = enemies.some((actor) => actor.hp > 0)
    playerHpRemaining += players.reduce((sum, actor) => sum + Math.max(0, actor.hp), 0)
    enemyHpRemaining += enemies.reduce((sum, actor) => sum + Math.max(0, actor.hp), 0)
    if (playerAlive && !enemyAlive) playerWins += 1
    else if (enemyAlive && !playerAlive) enemyWins += 1
    else draws += 1
  }

  const runs = Math.max(1, config.runs)
  return {
    runs,
    playerWinRate: playerWins / runs,
    enemyWinRate: enemyWins / runs,
    drawRate: draws / runs,
    averageRounds: roundsTotal / runs,
    averageEnemyDodges: enemyDodges / runs,
    averageEnemyDodgeSuccesses: enemyDodgeSuccesses / runs,
    averagePlayerHpRemaining: playerHpRemaining / runs,
    averageEnemyHpRemaining: enemyHpRemaining / runs,
    averagePlayerDamage: playerDamage / runs,
    averageEnemyDamage: enemyDamage / runs,
    averageDistanceClosed: distanceClosed / runs,
  }
}

export function runMapBattleSimulationDetailed(config: MapSimulationConfig): MapSimulationDetailedResult {
  const rng = createRng(config.seed ?? 20260615)
  const runLogs: MapSimulationRunLog[] = []
  let playerWins = 0
  let enemyWins = 0
  let draws = 0
  let roundsTotal = 0
  let enemyDodgesTotal = 0
  let enemyDodgeSuccessesTotal = 0
  let playerHpRemainingTotal = 0
  let enemyHpRemainingTotal = 0
  let playerDamageTotal = 0
  let enemyDamageTotal = 0
  let distanceClosedTotal = 0

  for (let run = 0; run < config.runs; run++) {
    const actors = config.actors.map((actor) => ({ ...actor }))
    const log: string[] = []
    let rounds = 0
    let enemyDodges = 0
    let enemyDodgeSuccesses = 0
    let playerDamage = 0
    let enemyDamage = 0
    let distanceClosed = 0

    while (
      actors.some((actor) => actor.team === 'player' && actor.hp > 0) &&
      actors.some((actor) => actor.team === 'enemy' && actor.hp > 0) &&
      rounds < config.roundsLimit
    ) {
      rounds += 1
      log.push(`R${rounds} 开始`)
      const apById = new Map(actors.map((actor) => [actor.id, 2]))
      for (const actorId of actors.map((actor) => actor.id)) {
        const index = actors.findIndex((actor) => actor.id === actorId)
        if (index < 0 || actors[index].hp <= 0) continue
        let actor = actors[index]
        let ap = apById.get(actor.id) ?? 0
        log.push(`${actor.label} 行动，AP ${ap}/2，位置 (${actor.x},${actor.y})`)

        while (ap > 0 && actor.hp > 0) {
          const target = nearestLivingEnemy(actor, actors)
          if (!target) break
          const beforeDistance = chebyshevDistance(actor, target)
          if (beforeDistance > actor.attackRangeCells) {
            const moved = moveTowardActor(actor, target, actor.speedCells)
            const afterDistance = chebyshevDistance(moved, target)
            const closed = Math.max(0, beforeDistance - afterDistance)
            distanceClosed += closed
            actor = moved
            actors[index] = actor
            ap -= 1
            apById.set(actor.id, ap)
            log.push(`${actor.label} 花费 1 AP 移动到 (${actor.x},${actor.y})，距离 ${beforeDistance} -> ${afterDistance}`)
            continue
          }

          const targetIndex = actors.findIndex((other) => other.id === target.id)
          if (targetIndex < 0) break
          let targetActor = actors[targetIndex]
          if (targetActor.team === 'enemy') {
            const targetAp = apById.get(targetActor.id) ?? 0
            const decision = decideDodge({
              currentAp: targetAp,
              currentHp: targetActor.hp,
              maxHp: targetActor.maxHp,
              targetAc: targetActor.ac,
              incomingAttackBonus: actor.attackBonus,
              estimatedDamage: averageDamage(actor.damageDice),
              policy: config.policy,
            })
            if (decision.shouldDodge) {
              apById.set(targetActor.id, Math.max(0, targetAp - 1))
              enemyDodges += 1
              const d20 = rollDie(rng, 20)
              const dodgeAttackTotal = d20 + actor.attackBonus
              if (dodgeAttackTotal < targetActor.ac) {
                enemyDodgeSuccesses += 1
                ap -= 1
                apById.set(actor.id, ap)
                log.push(
                  `${targetActor.label} 花费 1 AP 闪避 ${actor.label}；攻击判定 ${d20}+${actor.attackBonus}=${dodgeAttackTotal} vs AC ${targetActor.ac}，闪避成功`,
                )
                continue
              }
              log.push(
                `${targetActor.label} 花费 1 AP 闪避 ${actor.label}；攻击判定 ${d20}+${actor.attackBonus}=${dodgeAttackTotal} vs AC ${targetActor.ac}，闪避失败`,
              )
            } else {
              log.push(
                `${targetActor.label} 不闪避 ${actor.label}：${decision.reason}，成功率 ${Math.round(decision.successChance * 100)}%`,
              )
            }
          }

          const d20 = rollDie(rng, 20)
          const hitTotal = d20 + actor.attackBonus
          const hit = hitTotal >= targetActor.ac
          if (hit) {
            const damage = rollDamage(rng, actor.damageDice)
            targetActor = { ...targetActor, hp: Math.max(0, targetActor.hp - damage) }
            actors[targetIndex] = targetActor
            if (actor.team === 'player') playerDamage += damage
            else enemyDamage += damage
            log.push(
              `${actor.label} 攻击 ${targetActor.label}：${d20}+${actor.attackBonus}=${hitTotal} vs AC ${targetActor.ac}，命中，造成 ${damage}，HP ${targetActor.hp}/${targetActor.maxHp}`,
            )
          } else {
            log.push(
              `${actor.label} 攻击 ${targetActor.label}：${d20}+${actor.attackBonus}=${hitTotal} vs AC ${targetActor.ac}，未命中`,
            )
          }
          ap -= 1
          apById.set(actor.id, ap)
        }
      }
    }

    const players = actors.filter((actor) => actor.team === 'player')
    const enemies = actors.filter((actor) => actor.team === 'enemy')
    const playerAlive = players.some((actor) => actor.hp > 0)
    const enemyAlive = enemies.some((actor) => actor.hp > 0)
    const playerHpRemaining = players.reduce((sum, actor) => sum + Math.max(0, actor.hp), 0)
    const enemyHpRemaining = enemies.reduce((sum, actor) => sum + Math.max(0, actor.hp), 0)
    const outcome: MapSimulationRunLog['outcome'] = playerAlive && !enemyAlive ? 'player' : enemyAlive && !playerAlive ? 'enemy' : 'draw'
    if (outcome === 'player') playerWins += 1
    else if (outcome === 'enemy') enemyWins += 1
    else draws += 1
    roundsTotal += rounds
    enemyDodgesTotal += enemyDodges
    enemyDodgeSuccessesTotal += enemyDodgeSuccesses
    playerHpRemainingTotal += playerHpRemaining
    enemyHpRemainingTotal += enemyHpRemaining
    playerDamageTotal += playerDamage
    enemyDamageTotal += enemyDamage
    distanceClosedTotal += distanceClosed
    log.push(
      `结束：${outcome === 'player' ? '玩家胜利' : outcome === 'enemy' ? '敌人胜利' : '平局/超时'}，玩家剩余 HP ${playerHpRemaining}，敌人剩余 HP ${enemyHpRemaining}`,
    )
    runLogs.push({
      index: run + 1,
      outcome,
      rounds,
      playerHpRemaining,
      enemyHpRemaining,
      enemyDodges,
      enemyDodgeSuccesses,
      log,
    })
  }

  const runs = Math.max(1, config.runs)
  return {
    summary: {
      runs,
      playerWinRate: playerWins / runs,
      enemyWinRate: enemyWins / runs,
      drawRate: draws / runs,
      averageRounds: roundsTotal / runs,
      averageEnemyDodges: enemyDodgesTotal / runs,
      averageEnemyDodgeSuccesses: enemyDodgeSuccessesTotal / runs,
      averagePlayerHpRemaining: playerHpRemainingTotal / runs,
      averageEnemyHpRemaining: enemyHpRemainingTotal / runs,
      averagePlayerDamage: playerDamageTotal / runs,
      averageEnemyDamage: enemyDamageTotal / runs,
      averageDistanceClosed: distanceClosedTotal / runs,
    },
    runs: runLogs,
  }
}

export function trainDodgePolicy(runs = 1000): { policy: DodgePolicyParams; summary: SimulationSummary; score: number } {
  const candidates: DodgePolicyParams[] = []
  for (const minSuccessChance of [0.15, 0.25, 0.35, 0.45]) {
    for (const significantDamageRatio of [0.25, 0.35, 0.45, 0.55]) {
      for (const lethalSuccessChance of [0.05, 0.15, 0.25]) {
        candidates.push({ minSuccessChance, significantDamageRatio, lethalSuccessChance, preserveApWhenSafe: true })
      }
    }
  }

  let best: { policy: DodgePolicyParams; summary: SimulationSummary; score: number } | null = null
  for (let i = 0; i < candidates.length; i++) {
    const policy = candidates[i]
    const summary = runBattleSimulation({
      runs,
      roundsLimit: 20,
      policy,
      seed: 9000 + i,
      playerHp: 26,
      enemyHp: 20,
      playerAc: 14,
      enemyAc: 14,
      playerAttackBonus: 6,
      enemyAttackBonus: 4,
      playerDamageDice: { count: 1, sides: 8, bonus: 4 },
      enemyDamageDice: { count: 1, sides: 6, bonus: 2 },
    })
    const targetWinRate = 0.6
    const dodgePenalty = Math.max(0, summary.averageEnemyDodges - 1.2) * 0.12
    const stallPenalty = Math.max(0, summary.averageRounds - 8) * 0.04
    const score = Math.abs(summary.playerWinRate - targetWinRate) + dodgePenalty + stallPenalty
    if (!best || score < best.score) best = { policy, summary, score }
  }
  return best!
}

export function trainMapDodgePolicy(
  actors: MapSimulationActor[],
  runs = 1000,
): { policy: DodgePolicyParams; summary: MapSimulationSummary; score: number } {
  const candidates: DodgePolicyParams[] = []
  for (const minSuccessChance of [0.15, 0.25, 0.35, 0.45]) {
    for (const significantDamageRatio of [0.2, 0.3, 0.4, 0.5]) {
      for (const lethalSuccessChance of [0.05, 0.15, 0.25]) {
        candidates.push({ minSuccessChance, significantDamageRatio, lethalSuccessChance, preserveApWhenSafe: true })
      }
    }
  }

  let best: { policy: DodgePolicyParams; summary: MapSimulationSummary; score: number } | null = null
  for (let i = 0; i < candidates.length; i++) {
    const policy = candidates[i]
    const summary = runMapBattleSimulation({
      runs,
      roundsLimit: 20,
      policy,
      seed: 12000 + i,
      actors,
    })
    const targetWinRate = 0.6
    const dodgePenalty = Math.max(0, summary.averageEnemyDodges - actors.filter((a) => a.team === 'enemy').length) * 0.1
    const stallPenalty = Math.max(0, summary.averageRounds - 10) * 0.04
    const score = Math.abs(summary.playerWinRate - targetWinRate) + dodgePenalty + stallPenalty
    if (!best || score < best.score) best = { policy, summary, score }
  }
  return best!
}
