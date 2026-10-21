# Monster spell and weapon source-linked damage bonuses

Monster core spell attacks now include the target's actual-source bonus inside the validated damage roll, before clamping and defenses. Criticals multiply dice only. Shared monster core saving-throw spells derive the bonus per recipient from the original raw pool, before saves and defenses, without modifying the shared roll.

Common monster weapon attacks claim a bonus once on the first component with a positive dice count, across ordinary, extra-critical and trait components. It is applied inside that component's roll, before mitigation. Each separately executed attack owns its own claim. Fixed components do not claim a roll bonus.

## Verification

- New cases: monster Fire Bolt ordinary/critical/resistant/foreign-source/invalid dice; shared Fireball failed/half saves with marked vulnerability and unmarked recipients; goblin weapon ordinary/critical/resistant/foreign-source/invalid dice; young red dragon two-type bite gets exactly one bonus.
- Fixture corrections: monster hostile-spell tests must use opposite controllers, and Fireball requires a known target-to-target distance within its separation limit. Kept runtime validations intact. Invalid-roll cases explicitly assert invalid-dice and full rollback.
- Final four-file regression: 434 tests passed (`.codex-logs/monster-source-bonus-final.txt`), including full core engine, monster resource and monster attack suites.
- Full typecheck session 60082 exited 0 (`.codex-logs/monster-source-bonus-types.txt`). Targeted whitespace check passed. All verification processes ended.

## Remaining scope

Monster area/death/lair/special damage, separate on-hit saving-throw damage, persistent areas and legacy delayed spell routes are not covered by these core paths. Full-support modifier registration remains withheld. Original fullbook preflight remains 29/155 (18.7%); review r37, coverage r41, batch r23 unchanged. No original generated configuration edited, API calls 0, production rooms untouched.
