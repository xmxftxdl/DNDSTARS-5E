# Turn banner lifetime regression

## Cause and fix

The turn-entry effect depended on the entire `turnCharacter` snapshot. An action replacing that snapshot ran its cleanup, cancelling the hide timer. The one-shot claim then prevented rescheduling, leaving the old banner state alive underneath spell/attack banners.

Use the character ID as the dependency. Keep dismissal in a separate effect owned by the displayed banner; spell, attack, and kill-streak presentations consume an outstanding turn banner.

## Validation

- Five existing banner test files: 37 tests passed.
- Vite production build passed.
- Browser UI: DM 5273 and player 5274, campaign JCB9PVAHWYJH. Advanced R2 through the initiative to the caster R3; observed “你的回合”, immediately cast Mirror Image, verified the action and second-level slot were consumed, and checked that the turn banner was absent after settlement and again later.
- Reverse Gravity was not recast: the current test caster has no seventh-level or higher slots. The tested spell exercises the shared presentation path.
- Restored the R2 caster checkpoint through the DM recovery UI after testing.

- Full-page lint hit the default Node heap limit; the larger-heap retry was stopped after prolonged memory pressure. Focused exhaustive-deps analysis completed, with existing diagnostics elsewhere in the page and none in the changed turn-banner effects. Full lint is not claimed as passing.
