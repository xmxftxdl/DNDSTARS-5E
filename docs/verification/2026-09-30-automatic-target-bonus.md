# Automatic damage and projectile target bonuses

Native automatic-damage spells reuse the validated shared-pool recipient calculation. Heat Metal's initial and sustained bonus-action damage therefore resolve a fresh qualifying target bonus before defenses without consuming another slot for the sustained action.

Player and monster core Magic Missile resolvers apply the same source-qualified target bonus to each projectile's existing damage pool before clamping, Cutting Words (player path) and defenses. Shielded or limited-magic-immunity projectiles do not receive a bonus. Existing independent projectile submissions and first-projectile class bonuses are preserved; this change does not reinterpret dice submission policy.

The projectile event has optional `targetBonus` evidence, separate from Empowered Evocation's `featureBonus`; the combat log displays it explicitly. Bonus events use `group: spell-automatic`.

## Verification

- Four-file targeted suite: 115 tests passed. New player/monster cases exercise normal damage, per-projectile resistance, Shield and invalid dice rollback. Sustained Heat Metal checks the bonus-action and slot costs.
- First core regression: 307 passed, one strict event-compatibility assertion failed because a zero targetBonus field was emitted on otherwise unchanged projectiles. Fixed by omitting the optional field for zero values, preserving the existing event shape.
- Final five-file regression: 423 tests passed (`.codex-logs/automatic-target-bonus-final.txt`). Initial full typecheck session 61722 exited 0; final typecheck after the event-shape fix session 55289 exited 0 (`.codex-logs/automatic-target-bonus-types-final.txt`). All verification processes ended. Targeted whitespace check passed.
- Logs: `.codex-logs/automatic-target-bonus.txt`, `.codex-logs/automatic-target-bonus-regression.txt`.

## Scope

This does not complete other monster damage, specialized redirection, persistent areas or legacy delayed damage routes. Full-support registration remains withheld. Original source certification remains 29/155 (18.7%); review r37, coverage r41, batch r23 unchanged. No paid API calls, no original generated configurations edited, production rooms untouched.
