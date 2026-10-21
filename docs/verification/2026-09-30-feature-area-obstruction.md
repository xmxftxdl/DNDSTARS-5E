# Feature area obstruction consistency

The Activity-backed feature map facade previously collected occupants using the 2D template and vertical tests without applying the shared area obstruction mask. A valid placement on the near side of a wall could therefore collect creatures on the far side, unlike the generic Activity map selector.

The facade now uses `resolveSpellAreaObstruction` before target limits and explicit subset validation. It preserves declared `requiresLineOfEffect: false` and existing core-spell corner-spread bindings; legacy features without an Activity retain their existing path. Persistent-area cells returned by preparation use the same obstruction mask. The feature choose-any dialog intersects its candidates with the shared Activity map selector and refuses invalid placements before asking for targets. Host validation remains authoritative.

Evidence:

- Monster granted-area controls: ordinary and choose-any areas, each with a blocking wall, nonblocking wall, and explicit wall bypass. Tests compare map-selector and preparation target/cell lists, settle damage and bonus-action consumption, verify unchanged inputs, and reject an explicitly selected wall-blocked target.
- Player imported feature: wall-blocked selection is rejected; a near-side selected target receives the effect and consumes the action.
- Initial two-file run: 45 tests passed (`feature-area-obstruction-20260930.txt`). Final full feature, monster area and map interaction suites: 121 tests passed (`feature-area-obstruction-final-20260930.txt`).
- Targeted diff whitespace check passed (only CRLF notices). Full typecheck is recorded in the goal log.

No paid API calls, original-source regeneration, real-room changes or DM/player browser certification. This fixes a shared execution path and does not upgrade any whole-source/fullbook certification. The offline source status remains r21: 29 ready for behavior testing, 125 blocked, one unparseable.
`npm run typecheck` finished with exit 0 (session 52115, `feature-area-obstruction-types-20260930.txt`). All validation processes for this batch ended.
