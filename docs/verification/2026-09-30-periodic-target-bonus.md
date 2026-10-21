# Target-linked bonus for common periodic damage

The common ActiveEffect periodic-damage resolver now adds a source-qualified target bonus inside the validated damage roll before zero-clamping. It resolves the actual effect source from Host state; a missing source does not receive a bonus. Suspended, removed and foreign-source marks remain excluded by the shared helper.

Corrected the same resolver's existing defense order: save modification precedes target resistance/vulnerability. A raw roll of 7 plus 2, saved for half and then doubled by vulnerability, now deals 8 rather than 9. The change applies to this common path even without a target bonus, matching the existing saving-throw spell pipeline order.

Each periodic effect has its own pool. Source-turn start, target-turn start and target-turn end share the implementation. The existing turn-key guard prevents a second begin-turn settlement after JSON state reload. Audit events identify the actual source, target and periodic effect with `group: periodic-damage`.

## Tests

- New matrix covers ordinary damage, half saves, resistance, vulnerability, immunity, save-for-none, foreign/removed/suspended marks, missing source, negative base modifiers and invalid-dice rollback.
- Repeat begin-turn after serialization preserves HP and produces no second bonus event.
- Additional boundary tests apply two separate periodic effects at source-turn start and target-turn end, with independent bonuses and unchanged source HP.
- Five-file regression: 67 passed (`.codex-logs/periodic-target-bonus-final.txt`), including existing source periodic, native weapon, Activity pattern and die-face scaling coverage.
- Full typecheck session 5337 exited 0 (`.codex-logs/periodic-target-bonus-types.txt`). Changed-file whitespace checks passed; all verification processes ended.

## Scope

This does not cover separate legacy delayed-spell, persistent-area or monster-specific damage implementations. Native spell and other special paths still need integration; the target bonus modifier remains partially supported and its full-support registration is withheld.

Original fullbook preflight: 29/155 (18.7%). Review r37, coverage r41, batch r23 unchanged. No original generated configuration changed, API calls 0, production rooms untouched.
