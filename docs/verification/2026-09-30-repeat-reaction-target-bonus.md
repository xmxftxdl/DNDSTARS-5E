# Repeat-save damage and Hellish Rebuke

Repeat-save failure damage now derives the target bonus from the actual effect source and adds it inside the roll before clamping/defenses. Missing or foreign sources cannot borrow another mark. Fixed zero-count damage remains ineligible. Audit events use `repeat-save` with the effect id.

Fixed a separate exposed bug: an effect requiring multiple successful saves previously still dealt `damageOnFailure` when the current save succeeded but had not reached the removal threshold. Failure damage now requires this save to fail; successful progress increments the counter without damage.

Hellish Rebuke now adds its source-qualified bonus before save-halving and defenses while preserving reaction and casting-resource validation. It uses the spell-save audit group.

## Validation

- New 11-case suite covers repeated failure damage, successful partial progress, resistance, foreign/missing sources, invalid dice rollback, and reaction save/defense ordering. The reaction fixture's initial incorrect pact-resource key was corrected to `dnd5e-pact-slot`.
- Final targeted regression: 333 passed across new tests, full core engine and periodic source bonuses (`.codex-logs/repeat-reaction-source-bonus-final.txt`).
- Expanded built-in Activity suite: 79 passed, 4 failed. Failures are capability assertions (actual assisted, expected full): aggregate coverage at Arcane Lock, Passwall, Arcane Lock/Knock mapped primitives and Light. These analysis expectations remain unresolved; no full-suite pass is claimed. Log: `.codex-logs/repeat-reaction-source-bonus.txt`.
- Full typecheck session 16292 exited 0 (`.codex-logs/repeat-reaction-source-bonus-types.txt`). Targeted whitespace checks passed. All verification processes ended.

## Scope

Other independent damage paths still need audit/integration; full-support modifier registration remains withheld. Original preflight remains 29/155 (18.7%); review r37, coverage r41, batch r23 unchanged. API calls 0; original AI drafts and production rooms untouched.
