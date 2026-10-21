# Effective target authority

Inspection of selectable area targets found a prerequisite defect: the command boundary validated the registered base target, while execution already applied cast-level profiles and target choices. A creature-to-area variant could be rejected for carrying its required placement; area-to-creature variants could incorrectly require stale geometry.

The command boundary now derives its effective target using the same scale-then-choice order as execution. Area member equality and placement requirements use that contract. Transport limits may use the Host member count for uncapped areas; declared target caps remain enforced by execution. Invalid Host scaling data rejects without throwing through the boundary.

Registered combat authority now also derives pairwise target distances and source-relative condition-immunity exclusions from the effective target. Temporary and source-type immunities no longer disappear when exclusions are declared only in a choice or cast-level variant.

Evidence:

- `dnd5eEffectiveTargetCommand.test.ts`: ten cases cover explicit/default choices, slot profiles, both creature/area transitions, forged/missing members, placement mismatch, uncapped 300-member areas, preserved caps, and Host pairwise distances.
- Command and prior visible-area archive regression: 20 tests passed (`effective-target-regression-20260930.txt`).
- Immunity matrix: 18 tests passed, 44 not selected (`effective-target-immunity-20260930.txt`), covering base/temporary/suspended/source-type/no immunity across direct/choice/slot declarations.

This batch fixes shared authority consistency. It does not yet implement arbitrary selectable subsets of an area, regenerate original PDF configurations, or certify browser DM/player flows. Paid API calls: zero; real room data untouched.

Follow-through: `pluginSpellTransaction` collects imported spell area targets independently of the generic map selector. It now uses the same Host perception snapshot before the target cap when `requiresVisibleTargets` is declared. Nine imported JSON spell cases (three relations × ordinary/visible-only/see-invisible) exercise the real player action payload, preparation and settlement, and assert target HP plus spell-slot consumption. All nine pass; 130 unrelated cases in that file were not selected (`imported-area-perception-final-20260930.txt`). Combined batch evidence: 47 distinct passing tests. This is a transaction test, not browser verification.

Final full typecheck exited 0 (`effective-target-types-final-20260930.txt`); targeted diff check passed. Offline preflight r20 covers all 155 exact-source entries and remains 29 ready for behavior tests, 125 blocked and one without a parseable current-source draft. No source certification was upgraded.
