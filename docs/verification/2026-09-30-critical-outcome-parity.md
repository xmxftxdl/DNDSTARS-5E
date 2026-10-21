# Critical outcome parity prerequisite

While preparing source-linked target critical modifiers, the audit exposed incompatible native and Activity semantics. Native `resolveDnd5eAttackOutcome` required an expanded-range roll to beat AC; Activity checks treated a roll in that range as a critical hit. The initial local change incorrectly copied native semantics into Activity execution. Source verification corrected that interpretation before the final implementation.

Rule evidence: the [2014 Champion text](https://www.dndbeyond.com/subclasses/16-champion) states that its expanded rolls score a critical hit. The [archived designer clarification](https://www.sageadvice.eu/about-critical-hit/) explicitly treats such a scored critical as a hit. This differs from an effect making a hit automatically critical: that still requires a successful attack first. These external references supplement source evidence; this is not a PDF-only conversion claim.

Implemented one shared `resolveDnd5eAttackRollOutcome` used by the native outcome wrapper, Activity executor and submitted-dice hit predictor. Expanded-range rolls hit regardless of ordinary AC; natural-one failure and the Host total-cover sentinel remain. Automatic-critical-on-hit alone does not bypass AC. Activity critical-success now requires an actual hit, and its preparation predictor respects delivery-specific AC rather than base AC alone.

The existing Champion high-AC test encoded the old rule. It was deliberately corrected to expect a hit, doubled damage dice and critical damage, supported by the references above. The initial seven-case run under the incorrect interpretation is superseded by the final nine-case parity suite, including high AC, ordinary hits below critical range, natural 20, natural 1, total cover, attack bonuses and automatic-critical-on-hit misses.

Final verification: seven executor/recipe/equipment/monster/opportunity/multiattack files passed 235 tests (`critical-hit-parity-final-20260930.txt`); filtered native combat suite passed 8, skipped 300 (`critical-native-20260930.txt`). Total 243 distinct passing tests. Targeted diff check passed. Full typecheck status is recorded in the goal log.

This batch is a prerequisite fix, not delivery of the target-linked effect modifier or damage-roll bonus. The source diagnosis remains unresolved. Original source drafts and fullbook preflight remain unchanged (29/155, 18.7%). API calls 0; real rooms untouched.

Full `npm run typecheck` session 77141 exited 0 (`critical-hit-parity-types-20260930.txt`). All verification processes are terminal. The exact target-linked diagnosis has not been promoted in review r37.
