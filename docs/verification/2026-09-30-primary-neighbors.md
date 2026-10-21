# Primary target and optional neighbors

The existing event-area selector can express a mandatory primary target followed by an optional selection of nearby recipients. This batch connected the missing completion-event provenance and window lifecycle instead of inventing another area-placement contract.

Implemented:

- Stamp Activity completion and spell-cast events with the same Host execution identity as grants applied/refreshed by that transaction.
- Compiled Activities emit a completion event, as the registered authority path already did. Spell-cast plus matching completion produces one resolved window.
- Execution-bound ephemeral grants may expire at feature/spell/item/action completion windows. Cleanup is constrained to matching execution and invocation event, single-use grants, and original actor/targets. Effects shared with ongoing actions remain.
- Actor-effect trigger discovery now uses the same predicate evaluator as final execution, including anyOf ownership/suspension. Shared effect matching also supports inherited source levels; execution-bound follow-ups use their exact grant level.
- SDK and AI instructions describe root eligibility/resource/damage plus an execution-bound, free, event-target choose-any follow-up. Cancelling optional recipients leaves the already committed primary result intact.

Synthetic archive tests cover registered and compiled root execution, fixed ability damage with minimum one, primary dying, unseen optional neighbors, exclusions, walls, zero/cancel/invalid selections, JSON reload of state and committed events, changed delivery IDs, replay, stale/missing provenance and simultaneous grants. Separate cases cover actor/target cleanup for four completion events, spell-window deduplication and source level inheritance.

Initial tests found test expectations for an absent empty effect list and a missing legacy compiled distance argument. After fixing those fixtures, the compiled test exposed the real missing completion event; both root paths passed after that fix. The early primary/scaling archive run passed seven tests (`primary-neighbors-third-20260930.txt`). Final regression/type results are recorded in the goal log.

This is synthetic shared-mechanism evidence, not a conversion of the original PDF. No source-generated draft was repaired, no paid API was invoked, and no real room or service was modified. JSON reload is not a DM/player browser refresh certification. Maddening Hex still needs source effect dependencies and source-level acceptance. Event-area selection now includes zero-HP creatures still using death saves; dead creatures and zero-HP creatures without death saves remain excluded. The final synthetic fixture uses a real unconscious ActiveEffect, and verifies one failed death save from secondary damage. Do not mark the whole source complete.
Final synthetic suite passed all ten tests (`primary-neighbors-confirmed-20260930.txt`). The broader runs yielded 389 distinct passing tests and four existing map-write-gate failures (Purify Food and Drink, Passwall, Knock, Arcane Lock). All four repeat alone; `primary-neighbors-gates.jsonl` records their registered handlers and assisted runtime map-operation limitations. The gates were not relaxed and the failures are not reported as passing. Final full typecheck is recorded in the goal log.
Final full typecheck exited 0 (session 6318, `primary-neighbors-types-confirmed-20260930.txt`). Offline whole-book preflight r23 passed, retaining 29 ready/125 blocked/one unparseable. All verification processes ended. Review r34 upgrades only the target-flow diagnosis to expressible; original source configuration and curse dependencies are not certified.
