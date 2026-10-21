# Redirected and Monk bonus attacks

Stand Against the Tide's repeated attack now claims a target damage bonus using the original attacker, not the reacting hunter. It claims once across the first rolled primary/class damage component; subtract-from-weapon dice do not qualify. The bonus enters the original roll before clamping, weapon subtraction and later defenses. Fixed bonuses do not double on a critical.

The independent Monk unarmed bonus resolver now includes the bonus inside each successful attack's damage roll. Flurry attacks are separate pools, so each eligible hit receives one bonus. Both paths retain the existing weapon-attack audit group.

## Verification

- Five redirect cases: original-source mark, hunter-source exclusion, suspended mark, critical and invalid dice. Hunter remains unharmed; reaction is consumed on success and restored on failed settlement.
- Two Flurry cases: ordinary + critical hits deal 5 + 7; invalid second-hit dice roll back first-hit damage, ki and bonus action.
- Four-file regression: 367 passed, including class feature preparation/action, declarative defense and full Headless core suites (`.codex-logs/special-attack-source-bonus.txt`).
- Full typecheck session 14748 exited 0 (`.codex-logs/special-attack-source-bonus-types.txt`); targeted whitespace checks passed. All verification processes ended.

## Remaining scope

Other independent special damage and on-hit/repeated saving-throw damage paths still require audit/integration. This is not full modifier certification or fullbook source certification. Original preflight 29/155 (18.7%); review r37, coverage r41, batch r23 unchanged. API calls 0, original generated configurations and production rooms untouched.
