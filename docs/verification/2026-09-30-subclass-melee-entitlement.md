# Imported subclass melee-protection entitlement

This closes the entitlement evidence gap left by the two melee-target protection batches. A synthetic module packages a subclass, its level-three build-grant and a separate feature carrying a permanent `preventOpportunityAttacksFromMeleeAttackTargets` character capability. The feature requires rogue level three. The archive is exported, imported, exported again and reinstalled before testing.

The test upgrades a valid level-two rogue through the production advancement API, selecting the imported subclass. After JSON reload, the feature is derived from the subclass grant without an explicit feature ID on the character. Character-to-combat projection records a missed unarmed attack and rejects the attacked creature's opportunity attack. Negative cases cover level two, total level ten but rogue level two, rogue level three without the subclass, and lowering the entitled character's rogue level below the requirement.

Initial fixture failed `missing-class-choice` because it omitted the rogue's existing Expertise selections; a valid level-two character resolves that fixture error. Final archive/advancement/melee regression: 24 tests passed (`.codex-logs/subclass-footwork-final-20260930.txt`). No production code change was needed in this batch.

This supports marking the exact Fancy Footwork mechanism diagnosis expressible by the current runtime, together with the preceding attack, map and archive evidence. It does not certify the original automatic configuration, the other abilities of that subclass, or browser DM/player persistence. The original source drafts remain unchanged and still require the planned batch conversion. API calls: 0. No real rooms modified.

Full typecheck session 42277 exited 0 (`.codex-logs/subclass-footwork-types-20260930.txt`), and targeted diff check passed. Review r37 marks only this precise diagnosis expressible; coverage r41 has 117 expressible links and 29 partial links. Batch r23 retains 827 unresolved links, including 489 mechanism/evidence links. Original-source preflight remains r24: 29/155 ready (18.7%); no claim of source configuration regeneration or certification.
