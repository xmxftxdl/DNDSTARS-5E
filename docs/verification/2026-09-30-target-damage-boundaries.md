# Target-linked bonus at an explicit damage-roll boundary

Implemented the Activity portion of source-linked damage-roll bonuses. This is progress beyond provenance collection, not completion of the native damage integration or the full source feature.

`damage-roll` is a formula node with a stable group `rollId` and inner `value`. It participates in formula validation, dice declaration collection, scaling, critical dice collection and evaluation. Its Host bonus is added after evaluating the inner dice but before outer arithmetic such as save-halving. It only qualifies if a positive number of dice were consumed. Nested boundaries suppress inner bonus applications; repeated boundary IDs for the same target and attribution can receive only one bonus in a resolution. A fresh resolution has a fresh consumed-group set.

The target Effect modifier `damage-rolls-by-source-bonus` evaluates its formula at application and preserves the bounded integer through Host mechanical-effect creation, normalization and strict serialization validation. The helper filters current effective target effects by actual source actor and groups duplicate definitions without summing duplicate copies. Registered and compiled Activity entry points supply a Host-only resolver; grant-source damage uses the original source rather than the bearer executing the Activity. The callback and consumed-group set are absent from the wire command.

## Verification scope

- Synthetic module export/import exercises marked-target criticals and fixed damage bonuses together through registered and compiled commits. A critical damage roll of 3+4 with a +2 bonus deals 9, not 11; evidence retains two dice and a +2 formula adjustment.
- Formula/Activity cases exercise bonus-before-halving, repeated references, nested boundaries, fixed damage, unwrapped legacy dice and separate execution lifetimes.
- Source-state cases exercise serialization, missing/foreign source, removed and suspended effects, invalid fractional values and duplicate definitions.
- Compiled grant-source integration verifies a bearer executing a source-owned damage roll receives the source's target-specific bonus and retains the source's spell level and damage attribution.
- `.codex-logs/target-damage-regression.txt`: six discovered test files, 198 passing cases. The initial command also named `dnd5eActivityScaling.test.ts`, which does not exist; no standalone scaling test is claimed from that name.
- Full typecheck session 94374 exited 0 (`.codex-logs/target-damage-types.txt`); changed-file whitespace checks passed. All verification processes finished.

## Remaining scope

The modifier intentionally remains unregistered in the full-support capability registry. Native weapon, spell, periodic and legacy unwrapped damage still need equivalent boundaries and source/target qualification; there is no full support claim. Current source-bound diagnosis and original AI-generated configurations remain uncertified. The SDK documents partial integration and grouping requirements.

Original preflight remains 29/155 (18.7%). Review r37, coverage r41 and batch r23 unchanged. API calls: 0. Production room state untouched.
