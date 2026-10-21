# Explicit area target subsets

`target.selection: "choose-any"` separates Host-derived eligible occupants from the caster's explicit intent. `minimumTargets` defaults to zero; `maximumTargets` is optional and must come from the source rule. Candidates are never truncated to the chosen-target cap.

Implemented paths:

- Command authority accepts only a unique, bounded subset of the current Host candidate set. Ordinary area Activities still require exact membership.
- Imported spell preparation and feature map preparation rebuild candidates, apply perception and geometry, and validate explicit target IDs before settlement. Missing selection is rejected; an explicit empty selection may consume resources without fabricating a caster target.
- Generic map selection and event-centered areas retain all candidates for selection. Event settlement passes the full Host list to command validation while checks and effects use only selected IDs.
- Player spell confirmation and feature map placement offer a multi-choice dialog. Automatic one-click submission is disabled when a spell needs this choice. Event effects use the room's existing actor/DM choice windows with toggles, confirm and cancel; ownership and timeout behavior remain in that shared protocol.
- The Activity editor, AI SDK guide and source constraints support the field. Explicit all-occupant instantaneous source clauses reject invented choose-any semantics.

Validation evidence:

- `area-subset-first-20260930.txt`: 15 passed (7 imported spell transaction cases, 8 chooser cases; chooser cases subsequently corrected/rechecked as described below).
- `area-subset-shared-20260930.txt`: 48 passed across effective command contracts, archived modules, chooser and submission projection.
- `area-subset-contract-20260930.txt`: 104 passed across chooser, source constraints and existing definition validation (overlapping suites).
- `area-subset-trigger-final-20260930.txt`: six trigger cases passed, 62 not selected. The first run timed out one case and inspection revealed the test table was spreading array values as positional arguments. Wrapped values in named cases and verified actual zero/one/duplicate/over-cap/outside/cancel branches with a 20-second test limit. The chooser's array cases were likewise corrected and rechecked.
- `area-subset-feature-20260930.txt`: four feature map-facade cases passed, 35 not selected.
- `area-subset-feature-regression-20260930.txt`: full feature facade plus definition validation, 132 passed, including nine new minimum-bound cases.

Across the final suites above there are 205 distinct passing tests, including overlaps only once. No claim of whole-repository success. Imported spell tests assert target HP, spell-slot expenditure and unchanged input; feature tests assert affected targets and action consumption; trigger tests distinguish explicit zero from cancellation via resource expenditure.

No paid conversion, source-draft repair, real-room writes or browser DM/player certification. This is shared mechanism evidence, not certification of Holy Weapon or the entire PDF. The typecheck result is recorded in the goal log.

Final typecheck exited 0 (`area-subset-types-final-20260930.txt`) after correcting the chooser type-narrowing order; eight chooser tests passed again. Offline preflight r21 still reports 29 ready/125 blocked/one unparseable. Review r32 records only partial progress for the Maddening Hex selection diagnosis; coverage r35 and batch r18 preserve unresolved source work. All verification processes ended.
