import { advanceDelayMs, RESOLUTION_MS } from '../lib/diceOverlayShared'
import { TOKEN_MOVE_DURATION_S } from '../lib/gridCombat'
export const TOKEN_MOVE_MS = Math.ceil(TOKEN_MOVE_DURATION_S * 1000) + 80
export const DICE_ROLL_MS = 3200
// ORDERING INVARIANT：结算（overlay 可见窗口 + 结果 HUD）必须先于回合推进。
// 推进延迟从共享时序契约 advanceDelayMs() 派生（= max(overlay 可见窗口, HUD) + ε），
// 由构造保证 ≥ 结算窗口 RESOLUTION_MS，而不是靠几个魔数恰好相等。原先用
// DICE_ROLL_MS+200=3400ms，反而 < HUD 自关闭 4000ms —— 推进会抢在结果卡定格之前。
export const ADVANCE_DELAY_MS = advanceDelayMs()
if (ADVANCE_DELAY_MS < RESOLUTION_MS) {
  // 不可达：advanceDelayMs() 由构造 = RESOLUTION_MS + ε ≥ RESOLUTION_MS。
  // 留作回归护栏——若有人改坏了契约常量，开发期立即炸出来。
  throw new Error(
    `[T12/F2] 时序契约被破坏：ADVANCE_DELAY_MS(${ADVANCE_DELAY_MS}) < RESOLUTION_MS(${RESOLUTION_MS})`,
  )
}
// reentrancy guard window: blocks a second initiative advance within this
// window of another (manual + timer, or two death-skip effects firing). Mirrors
// the previously-inline 350ms in advanceInitiative.
export const ADVANCE_GUARD_MS = 350
// bounded fallback so a superseded death dice-overlay (no onDone) can't
// stall combat-end forever. Must be >= the longest dice overlay visible window.
export const DEATH_KEY_WATCHDOG_MS = 5000
