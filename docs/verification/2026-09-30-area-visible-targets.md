# Area occupant visibility

Scope: a declarative `target.requiresVisibleTargets` flag, independent of map anchor `requiresLineOfSight`. Synthetic fixtures verify this shared mechanism, not full PDF conversion or a complete source spell.

- Map selection builds a temporary Host perception snapshot including creatures outside initiative, filters occupants before the target cap, and leaves ordinary area effects unchanged when the flag is absent.
- Registered Activity and compiled plugin settlement independently recheck the effective target contract (including choice and cast-level overrides). Stale invisible targets reject before consumption; seeing invisibility permits them.
- Event-centered trigger selection honors the new field and retains existing event-centered sight behavior.
- Strict boolean validation, SDK guidance, and `.starmod` export/import cover the declaration.

Initial archive tests omitted legacy plugin target-cell input; fixed the fixture to use the real command contract. The final five dedicated tests pass. Two new event-trigger tests pass. Broader map/Host regression initially passed 124 tests with three then-unfixed fixture failures. The subsequent run passed 53 with two existing non-spell-magic cases exceeding the default 5-second timeout; these are rechecked separately, not suppressed.

No paid API calls, source regeneration, real-room writes, or browser certification. The cached Holy Weapon source explicitly requires caster-visible creatures; this interface addresses that individual diagnosis, while selectable subsets, weapon ownership and the rest of the spell retain their separate requirements.

Recheck: both timeout cases passed in isolation with a 20-second limit. Across map, Host and dedicated suites, 129 distinct tests have passing evidence (not a whole-repository pass). Initial typecheck found only an undefined-valued JSON property in the new fixture; corrected to omit it, then all five dedicated tests passed again. Final typecheck is tracked in the main goal log.
Final full TypeScript check exited 0 (`area-visible-targets-types-final-20260930.txt`). Targeted diff check passed. All verification processes ended.
