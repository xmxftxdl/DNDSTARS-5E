# Predetermined dice: rollback and animation correction

## Scope

Reverted the preceding natural-D20 change. MapsWorkspacePage again generates, checkpoints and broadcasts predetermined D20 values before displaying animations. Removed the preceding natural-value helper, tests and temporary fixture. Earlier height, banner and rules changes remain intact.

## Findings and final implementation

The vendor's face reader assumes one triangle per geometry group. The adapter now reads actual normal spans using the physics body pose during hidden simulation, before forced labels are assigned.

That alone was insufficient: real-room testing reproduced predetermined 15 landing as 15 on DM 5273 but 8 on player 5274 before correction. The vendor runs physics twice, and the visible simulation can diverge from the hidden preflight.

Forced rolls now capture the preflight poses, map labels against the terminal pose before any visible frame, and replay those same poses. No second physical simulation can choose a different terminal face. Gathering retains the expected face. Both endpoints still receive their authoritative numbers before playback and simulate locally in parallel. Natural grabs/rerolls retain native physics.

## Verification

- New regression tests cover multi-triangle face groups/body pose, exact trajectory replay without a second simulation, cancellation and native unforced fallback. An early RAF timestamp edge was found in browser testing and clamped; the test exercises that boundary.
- Five focused test files: 11 tests passed. Scoped ESLint, TypeScript and Vite build passed.
- Final WebGL fixture continuous batch: nine recorded completed animations all had initial settled values equal to supplied values (alternating 8 and 6/8); one request was skipped by the existing background-tab completion path. No fresh frame errors after the timestamp fix. Do not count the skipped request as a rendered animation.
- Final actual campaign test: Acid Splash from 5274 against the goblin. Predetermined 16 landed as 16 on player 5274 at 07:32:15.479 UTC and DM 5273 at 07:32:15.671 UTC. Both readings are before any post-settlement correction or gathering. DM screenshot and confirmation both 16. The fixture uses a goblin, not a drow, through the same saving-throw path.
- The existing server/room authority protocol is unchanged by the final patch.

- Final follow-through: 4d6 initial faces [2,1,3,6] matched supplied values; damage confirmed, then R2 checkpoint restored. Verified goblin HP restored to 40 and caster HP 162. No test action remains pending.
