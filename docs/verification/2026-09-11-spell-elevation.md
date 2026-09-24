# Spell elevation and stacked targeting verification

Baseline: `b3bd3fc3`, committed and fast-forward merged into local main before implementation.
Implementation branch: `codex/spell-elevation-targeting`.

## Changes

- Area targeting carries an optional absolute `targetElevationFeet` through the draft, payload, and authoritative action. Omission preserves terrain placement. Multiple area anchors share one elevation.
- Placement commits lock elevation. Re-selecting the area clears target/modifier selections. Confirmation requires a committed area.
- Spatial preview, committed area membership, and Sculpt Spells candidates reuse the existing authoritative vertical intersection and effect-line predicates. Existing grid distance/volume conventions are retained.
- Ground-attached areas reject airborne placement. Invalid/non-finite heights and contradictory action/payload elevations are rejected.
- Both token clicks and guessed-cell targeting ask which eligible visible token to use when candidates overlap. Names include absolute elevation. Cancelling or invalidating the targeting session does not submit an action.

## Browser verification (real room, not mocked)

DM 5273, caster 5274, save owner 5275; campaign JCB9PVAHWYJH.

1. Cast Fly at level 5 on player two. Used the player's flight movement UI to ascend to 40 ft above the ground enemy.
2. A Shatter preview at 40 ft excluded ground creatures.
3. Cast level-5 Fireball at 40 ft with Sculpt Spells armed. The committed spatial list contained player two at 40 ft. The protection picker accepted that player; clicking the ground enemy did not add a protected target. Altitude input was locked after placement.
4. Removed the protection for the damage test. Only 5275 received the saving throw request. After rolling, DM displayed saving throw failure before damage; 5274 did not display the other player's d20 iframe.
5. DM confirmed the save. Caster 5274 received 10d6 damage, totaling 37. DM confirmed. With the existing +5 modifier, player two changed from 147 to 105 HP; ground enemy stayed at 40 HP and caster at 162 HP.
6. Used battle recovery to restore round 2: player two returned to 147 HP, caster's action and fifth-level slot were restored. Kept the completed Fly/movement setup for further testing.
7. On the refreshed build, clicking the overlapping square while targeting Dispel Magic displayed separate choices for player two at 40 ft and the ground enemy at 0 ft. Cancelled both picker and targeting; no spell was submitted.
8. Also exercised discarding an unrolled attack through battle recovery. It cleared pending dice. One turn advancement initially failed to save; retry succeeded after closing a duplicate DM tab. Causation is not established.

## Automated verification

225 tests passed across SpellTargetingCoordinator, spellAction, verticalCombatGeometry, spellAreaSpatialTargets, spellSculptTokenSelection, and spellAoeHighlight. Includes airborne Fireball/Shatter/Hypnotic Pattern, ground-only Grease rejection, Meteor Swarm multi-anchor altitude propagation, cone pitch, and persistent Moonbeam altitude coverage.

Architecture audit is not green: the saved baseline already exceeds workspace line/import limits and MapPersistentAreaLayers line limits. No budgets were loosened as part of this change. Workspace line counts: baseline 41,495; final 41,507; budget 41,294. Lib imports remain 73 against 72; MapPersistentAreaLayers remains 1,806 against 1,803. TypeScript app typecheck, production Vite build, local-content boundary audit, and scoped lint passed.

## Scope

This wires elevation into the core character spell targeting interface shared by player/DM-controlled character casting. It retains existing grid-based vertical volume conventions; it does not replace them with continuous mesh intersection. Manual monster ability templates and per-anchor independent altitudes are separate interfaces, not claimed as browser-verified here.
