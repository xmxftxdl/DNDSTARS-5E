import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

// Independent suites are grouped for clear evidence, not additive coverage totals.
const groups = [
  { output: 'semantic-boundaries-tests.json', files: [
    'src/rulesets/dnd5e/monsterVampireFormVerification.test.ts',
    'src/rulesets/dnd5e/monsterKrakenBoundaryVerification.test.ts',
    'src/rulesets/dnd5e/monsterKrakenFling.test.ts',
    'src/rulesets/dnd5e/monsterComplexRelationMultiattacks.test.ts',
    'src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts',
    'src/rulesets/dnd5e/monsterHeadlessSafetyPolicy.test.ts',
    'src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts',
    'src/rulesets/dnd5e/monsterCoreSpellAction.test.ts',
    'src/rulesets/dnd5e/monsterTeleportInvisibility.test.ts',
  ] },
  {
    "output": "weapon-boundaries-tests.json",
    "files": [
      "src/rulesets/dnd5e/monsterCatalogWeaponVerification.test.ts"
    ]
  },
  {
    "output": "area-tests.json",
    "files": [
      "src/rulesets/dnd5e/monsterCatalogAreaVerification.test.ts",
      "src/rulesets/dnd5e/monsterCentaurHeadless.test.ts",
      "src/rulesets/dnd5e/monsterChainDevilUnnervingMaskHeadless.test.ts",
      "src/rulesets/dnd5e/monsterHeadlessSafetyPolicy.test.ts",
      "src/rulesets/dnd5e/monsterLegendaryMapMovement.test.ts",
      "src/rulesets/dnd5e/monsterParryHeadless.test.ts",
      "src/rulesets/dnd5e/monsterRoperReelMultiattack.test.ts",
      "src/rulesets/dnd5e/monsterShamblingMoundEngulf.test.ts",
      "src/rulesets/dnd5e/monsterVerificationInventory.test.ts"
    ]
  },
  {
    "output": "multiattack-tests.json",
    "files": [
      "src/rulesets/dnd5e/monsterCatalogMultiattackVerification.test.ts"
    ]
  },
  {
    "output": "legendary-tests.json",
    "files": [
      "src/rulesets/dnd5e/legendaryActionWindow.test.ts",
      "src/rulesets/dnd5e/monsterCatalogLegendaryVerification.test.ts",
      "src/rulesets/dnd5e/monsterCatalogSpecialVerification.test.ts",
      "src/rulesets/dnd5e/monsterResourceActions.test.ts"
    ]
  },
  {
    "output": "trait-tests.json",
    "files": [
      "src/rulesets/dnd5e/monsterCatalogTraitVerification.test.ts"
    ]
  },
  {
    "output": "trigger-tests.json",
    "files": [
      "src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts",
      "src/rulesets/dnd5e/monsterCatalogTriggerVerification.test.ts"
    ]
  },
  {
    "output": "lifecycle-tests.json",
    "files": [
      "src/rulesets/dnd5e/fleshGolemHeadless.test.ts",
      "src/rulesets/dnd5e/flyingSnakeHeadless.test.ts",
      "src/rulesets/dnd5e/headlessCombatEngine.test.ts",
      "src/rulesets/dnd5e/monsterBasiliskGazeHeadless.test.ts",
      "src/rulesets/dnd5e/monsterCatalogLifecycleVerification.test.ts",
      "src/rulesets/dnd5e/monsterDeathAreaRuntime.test.ts",
      "src/rulesets/dnd5e/monsters.test.ts",
      "src/rulesets/dnd5e/monsterTriggeredAttackTraits.test.ts",
      "src/rulesets/dnd5e/monsterTurnStartAuraHeadless.test.ts"
    ]
  },
  {
    "output": "defense-tests.json",
    "files": [
      "src/rulesets/dnd5e/monsterCatalogDefenseVerification.test.ts"
    ]
  },
  {
    "output": "attack-authority-tests.json",
    "files": [
      "src/rulesets/dnd5e/monsterAttackEffectAuthority.test.ts"
    ]
  },
  {
    "output": "on-hit-tests.json",
    "files": [
      "src/rulesets/dnd5e/activeEffects.test.ts",
      "src/rulesets/dnd5e/campaignTimeRules.test.ts",
      "src/rulesets/dnd5e/monsterCalendarReductionVerification.test.ts",
      "src/rulesets/dnd5e/monsterCatalogOnHitVerification.test.ts",
      "src/rulesets/dnd5e/monsterCurseVariantMultiattack.test.ts",
      "src/rulesets/dnd5e/monsterMummyRotMultiattack.test.ts"
    ]
  },
  {
    "output": "calendar-tests.json",
    "files": [
      "src/rulesets/dnd5e/monsterCalendarReductionVerification.test.ts"
    ]
  }
]
const destination = path.resolve(process.env.STARS_MONSTER_INVENTORY_DIR ?? '.codex-temp/monster-verification-20260904')
if (path.relative(process.cwd(), destination).startsWith('..')) throw new Error('Evidence must stay inside this repository')
fs.mkdirSync(destination, { recursive: true })
const env = { ...process.env, STARS_MONSTER_INVENTORY_DIR: destination }
let failed = false
for (const group of groups) {
  console.log('Verifying ' + group.output)
  const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', ...group.files,
    '--maxWorkers=2', '--reporter=json', '--outputFile=' + path.join(destination, group.output)],
    { env, stdio: 'inherit', windowsHide: true })
  if (result.error) throw result.error
  if (result.status !== 0) failed = true
}
for (const script of ['create-monster-verification-controller.mjs', 'report-monster-verification.mjs']) {
  const result = spawnSync(process.execPath, [path.join('scripts', script)], { env, stdio: 'inherit', windowsHide: true })
  if (result.error) throw result.error
  if (result.status !== 0) failed = true
}
process.exitCode = failed ? 1 : 0
