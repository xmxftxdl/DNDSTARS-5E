# Native spell attack target bonuses

Single-target native spell attacks and separately rolled multi-attack spell sequences now apply the source-qualified target damage bonus inside the validated roll, before zero-clamping, Cutting Words, outgoing multipliers and target defenses. Criticals double dice only. Each attack receives its own bonus against its actual marked target; unrelated targets remain unchanged.

The native half-damage-on-miss branch also includes the bonus before halving. This does not grant a bonus to ordinary misses or cover later stored delayed damage. Audit events use `group: spell-attack`; existing spell attack damage evidence includes the increased roll bonus.

## Verification

- New 13-case integration suite covers ordinary hits, criticals, resistance, vulnerability, immunity, ordinary misses, foreign/suspended/removed marks, invalid dice, mixed-target rays, late-ray transactional rollback and acid-arrow miss damage.
- Four-file regression: 64 tests passed, including native weapon bonuses, target critical thresholds and damage mitigation interrupts. Log: `.codex-logs/native-spell-target-bonus.txt`.
- The first test iteration omitted the required unique target list for mixed-target rays and was correctly rejected as invalid-target. Corrected the fixture and asserted invalid-dice specifically in the rollback case, preventing a false-positive rollback test.
- Full typecheck session 80079 exited 0 (`.codex-logs/native-spell-target-bonus-types.txt`). Changed-file whitespace checks passed. All verification processes ended.

## Remaining scope

Shared saving-throw/automatic damage pools, specialized redirected attacks, monster-specific paths, persistent areas and legacy delayed damage still need integration. Full-support registration remains withheld. No original generated configurations were changed. Original fullbook preflight remains 29/155 (18.7%); review r37, coverage r41 and batch r23 unchanged. API calls: 0. Production rooms untouched.
