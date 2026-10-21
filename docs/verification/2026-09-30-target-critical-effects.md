# Source-linked target critical range

Implemented an Effect modifier `attacks-by-source-critical-threshold` with an integer threshold from 2 to 20. It belongs to the defender and only benefits the effect's source actor. The lowest applicable threshold wins; suspended, absent and foreign-source effects cannot contribute.

The public contract, validation, runtime capability registry, effect projection, Host mechanical-effect creation, strict state validation and normalization preserve this field. Both Activity snapshot builders derive the threshold from authoritative current combat state. Native outcome calls use their actual attacker and defender, including redirected targets. Registered and compiled Activity dice recipes and player preparation receive the same source-target context.

Map preparation now includes equipment, monster, opportunity, hunter and native spell attack previews. Independent map-page damage preparation uses the range for weapon/spell damage dice and retains critical hits when AC changes through reactions. Natural-face metadata remains the actual die value. Empty guessed spell locations still miss.

## Evidence

- `targetCriticalThreshold.test.ts`: strict serialization; invalid threshold rejection; foreign, removed and suspended effects; native attacks and two native spell deliveries; synthetic module export/import followed by a declarative mark and registered/compiled attacks using two damage dice on a 19 against AC 30.
- `monsterAttackAction.test.ts`: actual monster target/source pairing in previews.
- `spellAction.test.ts`: source-specific spell preview, foreign-source exclusion and blind-target miss preservation.
- Eight-file regression: 244 passed (`.codex-logs/target-critical-ui-regression.txt`). Targeted spell preview/guessed-location regression: 6 passed, 204 unrelated tests skipped (`.codex-logs/target-critical-spell-preview.txt`). These are 250 distinct passing tests.
- Final full typecheck passed, session 14527 exit 0 (`.codex-logs/target-critical-types-ui.txt`); changed-file whitespace checks passed. Earlier typecheck found two missing result-narrowing guards in the new test; both were fixed before the final run. All verification processes finished.
- Initial integration test exposed the Host mechanical-effect constructor dropping the new modifier. Added its input field and projection; the exported-module test then passed.
- Corrected an old opportunity-preview assertion that treated expanded criticals as misses against high AC. It now agrees with the previously documented critical rule verification.

## Scope and remaining work

This implements the target-linked critical component of diagnosis `24814afd845eed40233fd0957c1b9f0e7f86d1cf65777e8d7865a0e65c6865d9`. The separate bonus to qualifying damage rolls remains unresolved; this is not certification of the entire source feature. No original AI-generated configuration was manually repaired or regenerated, and no browser DM/player end-to-end certification is claimed.

Original preflight remains 29/155 (18.7%), with 125 blocked and one unparseable entry. API calls: 0. Real rooms 5273/5274 were not modified.
