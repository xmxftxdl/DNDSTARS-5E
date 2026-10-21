# Death burst and racial breath source bonuses

Monster death-area effects now retain the raw validated roll and derive the target bonus using the snapshot source combatant, including when that source is dead. The bonus is applied before zero-clamping, the saving throw and target defenses. Suspended, removed or differently sourced marks remain excluded. Existing snapshot consumption prevents replay.

Dragonborn breath uses the same ordering and target-specific qualification, preserving the shared dice pool and racial resource consumption. Audit groups are `monster-death` and `racial-breath`.

Read-only inspection of `resolveMonsterLairAction` found it accepts DM-adjudicated final effects via `applyMonsterAdjudicatedEffects`, not raw dice. No automatic roll bonus is added to these final values, avoiding double application. This is a final-value authority boundary, not proof of automated lair dice support.

## Verification

- Five death-burst cases: own/foreign/suspended/removed source marks and invalid dice. A 21-point Balor roll plus 2, saved for half and vulnerable, deals 22. Without an eligible mark it deals 20. Old defense-before-save ordering would differ by one.
- Successful death settlements are serialized and replayed; replay is rejected without further HP loss. Invalid dice leave the pending transaction and state unchanged.
- Two Dragonborn cases compare marked/unmarked recipients with failed/half saves and vulnerability; the breath resource is spent once.
- Four-file regression: 118 passed, including monster death lifecycle catalog, death runtime, racial automation and monster resources (`.codex-logs/death-racial-source-bonus.txt`).
- Full typecheck session 47007 exited 0 (`.codex-logs/death-racial-source-bonus-types.txt`); changed-file whitespace checks passed. All verification processes ended.

## Remaining scope

Independent special/on-hit-save attacks, persistent areas and legacy delayed damage still require audit/integration. Full-support registration remains withheld. Original source preflight: 29/155 (18.7%). Review r37, coverage r41 and batch r23 unchanged. API calls 0; original configurations and production rooms untouched.
