# Target-linked attack modifiers: verified integration gaps

Scope: XGE diagnosis `24814afd845eed40233fd0957c1b9f0e7f86d1cf65777e8d7865a0e65c6865d9`, source `0996cf1c03dffb49c5d0cf4777c0d1e4c27eda75f32dd1ff8ff82afc99ddd38b:55:1`. This is an implementation audit, not behavior certification and not a generated source repair.

Current evidence:

- Public Activity attack checks carry a numeric `criticalThreshold`. It belongs to a check, not a target Effect linked to its source. `resolveCheck` separately reads it for success and critical success.
- Existing target-linked attack roll flags handle advantage/disadvantage. They do not supply a critical threshold or a bonus to damage rolls against that target.
- Weapon enchantment and on-hit damage are not substitutes for a bonus to all qualifying damage rolls: the latter can include non-attack spell damage and later damage. Source ownership, actual target and dice provenance must be preserved.
- Native attack outcomes are computed in weapon attacks, redirected/retaliatory attacks, spell attacks, pending monster mechanics, monster actions/spells, monk attacks and deflected missile returns. Rechecking after AC changes and redirecting a target must not retain a modifier belonging to the previous target.
- Preparation bridges also read critical thresholds. Updating only final Host settlement would disagree with precomputed critical damage dice.

Executed inventory: `node scripts/audit-attack-outcome-entrypoints.mjs --output <new-file>`. The script uses TypeScript AST nodes, records enclosing function, line and actual argument expressions, and exclusively creates the output. It does not modify gameplay or certify support. The first engine-only inventory had 16 native calls and 2 Activity reads. Expanding to equipment/monster/opportunity/multiattack/Activity dice preparation found 19 calls total, 2 Activity reads and 10 preparation reads. Evidence: `.codex-logs/attack-outcome-entrypoints-20260930-r2.json`. Script execution and `node --check` passed.

Required implementation batch:

1. Add a closed source-linked target Effect modifier and persistence validation; do not accept a client-provided critical threshold as entitlement. Suspended, expired and foreign-source effects must not apply.
2. Resolve a minimum threshold from the existing attack profile and matching live target effects. Use the same Host resolver in dice preparation, initial settlement, AC rechecks and target redirection. Preserve natural-one failure, ordinary critical doubling and automatic-critical conditions.
3. Carry target/source context into both registered and compiled Activity snapshots/checks; include custom spells and monster attacks, not just SRD spell IDs.
4. Add damage-roll provenance before enabling a generic source-linked damage bonus. Define multi-projectile versus shared-area rolls, secondary damage, fixed damage, zero damage, critical dice and defenses explicitly; prevent double addition across proposal/application layers.
5. Verify synthetic exported modules across the inventoried routes, source mismatch, target mismatch, suspension, expiry, redirect, rollback and precomputed dice. Only then remove the corresponding limitation from source review; original source conversion still needs its later batch validation.

No runtime change or passing behavior claim was made in this audit. The exact diagnosis remains unresolved, review r37/coverage r41/batch r23 unchanged. Fullbook preflight remains 29/155 (18.7%). API calls 0; real rooms untouched.
