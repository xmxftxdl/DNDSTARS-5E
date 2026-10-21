# Native weapon target-linked damage bonus

The common native weapon and opportunity-attack settlement now applies a matching target Effect's damage-roll bonus once per attack damage group. It includes the primary weapon pool, explicit extra dice, resolved or typed Host Activity on-hit damage, granted weapon damage dice, class damage and inventory on-hit dice. Fixed values do not independently qualify. The first eligible damage component receives the bonus and its damage type; later components do not receive it again.

Qualification is derived from validated dice declarations. `dnd5eWeaponHitActivity` retains whether its resolved proposal consumed dice, and reaction replay forwards that evidence. Inventory on-hit components derive the same flag from validated requirements. These fields belong to Host-internal decisions, not the player action payload.

The bonus is added before base pool zero-clamping when applicable, weapon damage subtraction, damage-roll reductions, outgoing multipliers and target defenses. Criticals do not multiply it. Replacement of ordinary weapon damage does not erase rolled on-hit qualification. A `damage-roll-bonus-applied` event records the actual source, target, value and receiving damage type.

## Validation

- `nativeTargetDamageBonus.test.ts`: ordinary/critical attacks, negative base modifier, resistance, immunity, fixed damage, misses, foreign/removed/suspended effects, invalid-dice rollback, primary-plus-typed on-hit grouping, replaced primary pools, fixed on-hit values, Reduce subtraction order and opportunity attacks.
- Initial fixed-primary on-hit fixtures did not enter the real checkpoint, because that checkpoint requires weapon damage dice. Replaced these with the actual supported primary-replacement path; did not weaken the checkpoint to satisfy tests.
- Added the bonus before the existing Reduce subtraction/minimum clamp and tested the low-roll case. A separate negative-base test verifies it is not added after prematurely clamping the original pool to zero.
- Six-file final regression: 166 passed (`.codex-logs/native-target-bonus-final.txt`). The exported weapon-hit Activity suite passed 18 additional distinct scenarios (`.codex-logs/native-target-bonus-order.txt`, whose 33 cases also include 15 overlapping native tests). Total: 184 distinct passing cases.
- Full typecheck session 5576 exit 0 (`.codex-logs/native-target-bonus-types.txt`); changed-file whitespace checks passed. All verification processes finished.

## Remaining work

Specialized redirected attacks, monster damage, native spells and periodic damage still need integration. The full-support capability registration remains withheld. Neither the whole source feature nor the original generated configuration is certified by this batch.

Original preflight remains 29/155 (18.7%), review r37/coverage r41/batch r23 unchanged. API calls 0. Original source drafts and production rooms untouched.
