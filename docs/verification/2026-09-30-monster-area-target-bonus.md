# Monster area pools and source-qualified bonuses

Common monster area actions now retain each validated component's raw total, preserving negative modifiers until the target bonus is applied. Shared pools derive independent recipient components; `damageRollsPerTargetSelection` pools remain independent and repeated targets receive a bonus for each separately rolled selection. Only the first rolled component qualifies. Audit events use `group: monster-area`.

Saving-throw modification now precedes damage defenses, consistent with the native spell/periodic paths. Multi-type pools are halved once on their combined total and then distributed with the existing component scaler. This fixes odd-valued vulnerability order and avoids losing one point by rounding every component down separately. The catalog test's former per-component-half expectation for Bulette Deadly Leap was updated to the combined pool rule. The area summary still describes the source pool; per-target bonus and damage events provide recipient outcomes.

## Verification

- New shared acid breath cases cover failed/half saves, vulnerability, resistance, foreign-source exclusion, invalid-dice rollback and recharge consumption. A raw 13 plus 2, saved for half then vulnerable, deals 14 rather than 15.
- Kraken Lightning Storm independently rolls three selections, with the first two on one target. Its marked target takes 6 + 5 after a failed and successful save; unmarked target takes 12. Exactly two bonus events.
- Five-file final regression: 813 passed, including 424 catalog-area branches, existing Kraken and monster resource suites, full core engine and new bonus integration cases (`.codex-logs/monster-area-bonus-final.txt`).
- Initial failures included the old Bulette per-component rounding expectation and an incomplete fixture classState without schemaVersion. Corrected expectations and valid fixture data without relaxing runtime validation.
- Full typecheck session 97999 exited 0 (`.codex-logs/monster-area-bonus-types.txt`). Targeted whitespace check passed. All verification processes ended.

## Limits

This common area path does not cover separate death/lair/special/on-hit-save damage, persistent areas or legacy delayed spells. Modifier full-support registration remains withheld. Original fullbook preflight 29/155 (18.7%); review r37, coverage r41, batch r23 unchanged. API calls 0, original configurations unchanged, production room state untouched.
