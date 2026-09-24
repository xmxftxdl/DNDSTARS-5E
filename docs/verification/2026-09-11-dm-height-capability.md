# DM height capability gate

## Behavior

Manual height adjustment reads the same map-to-combat projection used by the rules engine. No available flight means disabled input and buttons, with an explanatory message. Active Fly and transformed movement can unlock it; suspension, removal and movement-blocking conditions are respected. Missing character data fails closed.

Magically held aloft and controlled descent stay under effect control. Their current elevation remains visible and is never cleared by the control. This UI gate does not intercept spell elevation changes or the existing loss-of-support/falling pipeline. A supported surface is terrain elevation, distinct from height above the surface.

Validation also runs inside the height resolver, not solely via disabled HTML controls.

## Verification

- 17 tests passed: DM height collision/value validation, flight capability, Fly removal/suspension, forced magical support, controlled descent and character movement projection.
- TypeScript build check, scoped ESLint and Vite production build passed.
- Real DM browser 5273, campaign JCB9PVAHWYJH: ground goblin displayed a disabled height input and all disabled adjustment buttons. Player under Fly displayed enabled controls at 40 feet; raising to 45 succeeded, then restored to 40.
- Reverse Gravity and Levitate permission cases were checked in automated tests, not recast in this browser run.

## References

- https://foundryvtt.com/packages/flying-tokens — distinguishes flight presentation from token elevation; landing can occur on a higher level.
- https://foundryvtt.com/packages/elevationruler — separates movement-mode estimation and manual mode selection from elevation/path cost.

These are design references, not claims that Foundry enforces this application's spell rules.
