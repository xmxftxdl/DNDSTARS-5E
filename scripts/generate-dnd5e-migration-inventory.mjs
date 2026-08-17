import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const localRoot = resolve(repositoryRoot, 'local-content/phb-2014')
const collectionPath = resolve(localRoot, 'collection.json')
const jsonOutputPath = resolve(localRoot, 'unified-activity-migration-inventory.json')
const markdownOutputPath = resolve(localRoot, 'UNIFIED-ACTIVITY-MIGRATION.md')
const definitionProjectionPath = resolve(repositoryRoot, 'src/rulesets/dnd5e/activities/dnd5eContentDefinitionProjection.ts')
const permanentEffectRuntimePath = resolve(repositoryRoot, 'src/rulesets/dnd5e/activities/dnd5ePermanentContentEffects.ts')
const pluginContentCatalogPath = resolve(repositoryRoot, 'src/rulesets/dnd5e/plugins/pluginContentCatalog.ts')
const localCollectionTestPath = resolve(repositoryRoot, 'src/rulesets/dnd5e/localContentCollection.test.ts')

const definitionProjectionSource = readFileSync(definitionProjectionPath, 'utf8')
const permanentEffectRuntimeSource = readFileSync(permanentEffectRuntimePath, 'utf8')
const pluginContentCatalogSource = readFileSync(pluginContentCatalogPath, 'utf8')
const localCollectionTestSource = readFileSync(localCollectionTestPath, 'utf8')
const unifiedDeclarativeRuntime =
  definitionProjectionSource.includes('subclass-ability:') &&
  pluginContentCatalogSource.includes("return unifiedFeatureDefinition(feature) ? 'unified-content' : 'legacy-adapter'") &&
  localCollectionTestSource.includes("toBe('unified-content')")
const unifiedPermanentEffectRuntime =
  definitionProjectionSource.includes("kind: 'character-capability'") &&
  definitionProjectionSource.includes("kind: 'racial-saving-throw-advantage'") &&
  permanentEffectRuntimeSource.includes('dnd5ePermanentContentEffectProjectionV1') &&
  pluginContentCatalogSource.includes('permanentProjection(definition)')

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function asArray(value) {
  return Array.isArray(value) ? value : value == null ? [] : [value]
}

function localPath(path) {
  return relative(repositoryRoot, path).replaceAll('\\', '/')
}

function loadCollectionEntries(collection, key) {
  return asArray(collection.json?.[key]).flatMap((entry) => {
    const path = resolve(localRoot, entry)
    return asArray(readJson(path)).map((value) => ({ value, file: localPath(path) }))
  })
}

function activityOperations(activity) {
  return asArray(activity.outcomes).flatMap((outcome) => asArray(outcome.operations))
}

function activityOwner(activity) {
  const source = activity.legacySource
  return source && typeof source.kind === 'string' && typeof source.id === 'string'
    ? { kind: source.kind, id: source.id }
    : { kind: 'unbound', id: activity.id }
}

function classifyActivity(activity) {
  const operations = activityOperations(activity)
  if (activity.authorityBinding) return {
    status: 'P0-LEGACY-AUTHORITY',
    migrationNeeded: true,
    target: 'Replace authorityBinding with native operations/effects or an allowlisted Mechanic Handler.',
  }
  if (operations.some((operation) => operation.kind === 'manual-adjudication')) return {
    status: 'REVIEW-DM-BOUNDARY',
    migrationNeeded: false,
    target: 'Keep the explicit DM boundary; migrate only deterministic sibling operations.',
  }
  if (operations.some((operation) => operation.kind === 'mechanic')) return {
    status: 'DONE-NATIVE-HANDLER',
    migrationNeeded: false,
    target: 'Already uses a registered Mechanic Handler operation.',
  }
  return {
    status: 'DONE-NATIVE-ACTIVITY',
    migrationNeeded: false,
    target: 'Already expressed as native Activity operations/effects.',
  }
}

function declaredAutomation(value) {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') return value.level ?? value.mode ?? 'structured'
  return 'unspecified'
}

function hasValues(value) {
  if (Array.isArray(value)) return value.length > 0
  return value != null && typeof value === 'object' ? Object.keys(value).length > 0 : value != null
}

const deterministicAbilityKeys = [
  'cost', 'targeting', 'rolls', 'effects', 'activityEffects', 'choices', 'predicates',
  'limits', 'duration', 'resources', 'passiveEffects', 'staticModifiers',
]

const executableAbilityKeys = [
  'cost', 'rolls', 'effects', 'activityEffects', 'choices', 'limits', 'duration',
  'resources', 'passiveEffects', 'staticModifiers',
]

function abilityHasDeterministicPayload(ability) {
  return executableAbilityKeys.some((key) => hasValues(ability[key]))
}

function classifyDeclarativeAbility(ability) {
  if (declaredAutomation(ability.automation) === 'manual') return {
    status: 'KEEP-DM-REFERENCE',
    migrationNeeded: false,
    target: 'Keep as build/reference or DM-adjudicated content; do not create an executable runtime obligation.',
  }
  if (unifiedDeclarativeRuntime && declaredAutomation(ability.automation) !== 'manual') return {
    status: ability.mechanic ? 'DONE-UNIFIED-HOST-ACTIVITY' : 'DONE-UNIFIED-ACTIVITY-ADAPTER',
    migrationNeeded: false,
    target: ability.mechanic
      ? 'Converted at the V2 loading boundary; runtime authority is the Unified Activity plus its allowlisted Host transaction.'
      : 'Converted at the V2 loading boundary into Unified Activity operations/effects; runtime source is the Unified Registry.',
  }
  if (ability.mechanic) return {
    status: 'P1-DECLARATIVE-MECHANIC',
    migrationNeeded: true,
    target: 'Project to native Activity/Effect primitives; use one allowlisted Mechanic Handler only for the irreducible clause.',
  }
  if (abilityHasDeterministicPayload(ability)) return {
    status: 'P1-DECLARATIVE-DATA',
    migrationNeeded: true,
    target: 'Convert deterministic cost, targeting, checks, operations and effects to native Activity/Effect data.',
  }
  return {
    status: 'P2-DECLARATIVE-PASSIVE',
    migrationNeeded: true,
    target: 'Audit the passive clause and express deterministic parts as an Effect or requirement predicate.',
  }
}

function indexActivities(activities) {
  const result = new Map()
  for (const entry of activities) {
    const owner = entry.owner
    const key = `${owner.kind}:${owner.id}`
    result.set(key, [...(result.get(key) ?? []), entry])
  }
  return result
}

function linked(index, kind, id) {
  return index.get(`${kind}:${id}`) ?? []
}

function aggregateNativeContent(kind, id, automation, activityIndex) {
  const activities = linked(activityIndex, kind, id)
  if (activities.some((entry) => entry.status === 'P0-LEGACY-AUTHORITY')) return {
    status: 'P0-LEGACY-AUTHORITY', migrationNeeded: true,
    target: 'Migrate the linked authority-bound Activity first.', activities,
  }
  if (activities.length > 0) {
    const hasDmBoundary = activities.some((entry) => entry.status === 'REVIEW-DM-BOUNDARY')
    return {
      status: hasDmBoundary ? 'REVIEW-MIXED-NATIVE-DM' : 'DONE-NATIVE-ACTIVITY',
      migrationNeeded: false,
      target: hasDmBoundary
        ? 'Native deterministic operations are present; retain and review the explicit DM boundary.'
        : 'Native Activity coverage is present.',
      activities,
    }
  }
  return {
    status: declaredAutomation(automation) === 'manual' || declaredAutomation(automation) === 'reference-only'
      ? 'KEEP-DM-REFERENCE'
      : 'REVIEW-NO-NATIVE-ACTIVITY',
    migrationNeeded: declaredAutomation(automation) !== 'manual' && declaredAutomation(automation) !== 'reference-only',
    target: declaredAutomation(automation) === 'manual' || declaredAutomation(automation) === 'reference-only'
      ? 'No native Activity is expected unless a deterministic combat clause is later identified.'
      : 'Review whether deterministic combat behavior is missing a native Activity.',
    activities,
  }
}

function classifyFeatureLike(entry, kind, activityIndex) {
  const value = entry.value
  const native = aggregateNativeContent(kind, value.id, value.automation, activityIndex)
  const legacyParts = []
  if (value.declarativeAbility) legacyParts.push('declarativeAbility')
  if (hasValues(value.staticModifiers)) legacyParts.push('staticModifiers')
  if (hasValues(value.passiveEffects)) legacyParts.push('passiveEffects')
  if (
    legacyParts.length === 0 && native.status === 'REVIEW-NO-NATIVE-ACTIVITY' &&
    hasValues(value.advancements)
  ) return {
    id: value.id,
    file: entry.file,
    declaredAutomation: declaredAutomation(value.automation),
    legacyParts,
    linkedActivityIds: [],
    status: 'DONE-ADVANCEMENT',
    migrationNeeded: false,
    target: 'The deterministic clauses are character-building selections/grants and remain in the unified Advancement protocol.',
  }
  if (legacyParts.length === 0 || native.status === 'P0-LEGACY-AUTHORITY') return {
    id: value.id,
    file: entry.file,
    declaredAutomation: declaredAutomation(value.automation),
    legacyParts,
    linkedActivityIds: native.activities.map((activity) => activity.id),
    status: native.status,
    migrationNeeded: native.migrationNeeded,
    target: native.target,
  }
  if (unifiedPermanentEffectRuntime && !value.declarativeAbility) return {
    id: value.id,
    file: entry.file,
    declaredAutomation: declaredAutomation(value.automation),
    legacyParts,
    linkedActivityIds: native.activities.map((activity) => activity.id),
    status: 'DONE-UNIFIED-PERMANENT-EFFECT',
    migrationNeeded: false,
    target: 'Legacy static/passive fields are converted once at load; character and Headless snapshots read the resulting Unified Effects.',
  }
  if (unifiedDeclarativeRuntime && value.declarativeAbility) return {
    id: value.id,
    file: entry.file,
    declaredAutomation: declaredAutomation(value.automation),
    legacyParts,
    linkedActivityIds: native.activities.map((activity) => activity.id),
    status: 'DONE-UNIFIED-HOST-ACTIVITY',
    migrationNeeded: false,
    target: 'Legacy declarative data is converted at load and runtime authority is resolved from its Unified Content definition.',
  }
  return {
    id: value.id,
    file: entry.file,
    declaredAutomation: declaredAutomation(value.automation),
    legacyParts,
    linkedActivityIds: native.activities.map((activity) => activity.id),
    status: value.declarativeAbility ? 'P1-MIXED-LEGACY-FEATURE' : 'P2-LEGACY-PASSIVE-FIELDS',
    migrationNeeded: true,
    target: value.declarativeAbility
      ? 'Keep linked native Activities, then replace declarativeAbility with Activity/Effect/Handler data.'
      : 'Move deterministic static/passive fields into native Effects and requirements; keep build grants unchanged.',
  }
}

function countStatuses(groups) {
  const counts = {}
  for (const entry of groups.flat()) counts[entry.status] = (counts[entry.status] ?? 0) + 1
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)))
}

function markdownTable(headers, rows) {
  const escape = (value) => String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ')
  return [
    `| ${headers.map(escape).join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(escape).join(' | ')} |`),
  ].join('\n')
}

function objectStringProperty(node, propertyName) {
  if (!ts.isObjectLiteralExpression(node)) return undefined
  const property = node.properties.find((candidate) =>
    ts.isPropertyAssignment(candidate) && (
      (ts.isIdentifier(candidate.name) && candidate.name.text === propertyName) ||
      (ts.isStringLiteral(candidate.name) && candidate.name.text === propertyName)
    ))
  if (!property || !ts.isPropertyAssignment(property)) return undefined
  return ts.isStringLiteral(property.initializer) || ts.isNoSubstitutionTemplateLiteral(property.initializer)
    ? property.initializer.text
    : undefined
}

function typescriptArrayObjectEntries(path, variableName) {
  const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  let array
  const unwrap = (node) => {
    let current = node
    while (
      current && (
        ts.isAsExpression(current) || ts.isSatisfiesExpression(current) ||
        ts.isParenthesizedExpression(current) || ts.isTypeAssertionExpression(current)
      )
    ) current = current.expression
    return current
  }
  function visit(node) {
    if (
      ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === variableName &&
      node.initializer && ts.isArrayLiteralExpression(unwrap(node.initializer))
    ) array = unwrap(node.initializer)
    ts.forEachChild(node, visit)
  }
  visit(source)
  if (!array) throw new Error(`Unable to find ${variableName} in ${localPath(path)}`)
  return array.elements.filter(ts.isObjectLiteralExpression)
}

function hostSpellInventory() {
  const catalogPath = resolve(repositoryRoot, 'src/rulesets/dnd5e/spellCatalog.ts')
  const combatPath = resolve(repositoryRoot, 'src/rulesets/dnd5e/spells.ts')
  const activityPath = resolve(repositoryRoot, 'src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.ts')
  const spellActionPath = resolve(repositoryRoot, 'src/rulesets/dnd5e/spellAction.ts')
  const enginePath = resolve(repositoryRoot, 'src/rulesets/dnd5e/headlessCombatEngine.ts')
  const catalogSource = readFileSync(catalogPath, 'utf8')
  const catalogBlock = catalogSource.match(/const RAW_SRD_5_1_SPELL_CATALOG = `([\s\S]*?)`/u)?.[1]
  if (!catalogBlock) throw new Error('Unable to read RAW_SRD_5_1_SPELL_CATALOG')
  const catalogIds = catalogBlock.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean)
    .map((line) => line.split('|')[0]).filter(Boolean)
  if (new Set(catalogIds).size !== catalogIds.length) throw new Error('SRD spell catalog contains duplicate ids')
  const combatEntries = typescriptArrayObjectEntries(combatPath, 'DND5E_SRD_COMBAT_SPELLS')
  const combatById = new Map(combatEntries.flatMap((node) => {
    const id = objectStringProperty(node, 'id')
    return id ? [[id, { effect: objectStringProperty(node, 'effect') ?? 'structured' }]] : []
  }))
  if (combatById.size !== combatEntries.length) throw new Error('SRD combat spell definitions contain missing or duplicate ids')
  const catalogSet = new Set(catalogIds)
  const uncataloguedCombatIds = [...combatById.keys()].filter((id) => !catalogSet.has(id))
  if (uncataloguedCombatIds.length) {
    throw new Error(`SRD combat spells are absent from the catalog: ${uncataloguedCombatIds.join(', ')}`)
  }
  const activitySource = readFileSync(activityPath, 'utf8')
  const spellActionSource = readFileSync(spellActionPath, 'utf8')
  const engineSource = readFileSync(enginePath, 'utf8')
  const unifiedRuntime = activitySource.includes("kind: 'core-spell-transaction'") &&
    activitySource.includes('DND5E_SRD_COMBAT_SPELLS.map') &&
    spellActionSource.includes('getDnd5eCoreSpellRuntimeDefinitionV1(payload.spellId)') &&
    engineSource.includes('getDnd5eCoreSpellRuntimeDefinitionV1(action.spellId)')
  return catalogIds.map((id) => {
    const combat = combatById.get(id)
    return combat ? {
      id,
      file: localPath(combatPath),
      legacySchema: 'Dnd5eSrdSpellDefinition',
      effect: combat.effect,
      status: unifiedRuntime ? 'DONE-CORE-UNIFIED-SPELL' : 'P1-HOST-ADAPTER-SPELL',
      migrationNeeded: !unifiedRuntime,
      target: unifiedRuntime
        ? 'Registered as a core-spell-transaction Activity; both map preparation and Headless execution resolve it from Unified Content Registry.'
        : 'Move the source definition to native Activity/Effect data, then retire its spell adapter/special branch.',
    } : {
      id,
      file: localPath(catalogPath),
      legacySchema: 'Dnd5eSrdSpellCatalogEntry',
      status: 'KEEP-HOST-CATALOG',
      migrationNeeded: false,
      target: 'Catalog/reference spell; keep DM adjudication unless a deterministic combat clause is intentionally added.',
    }
  }).sort((left, right) => left.id.localeCompare(right.id))
}

const collection = readJson(collectionPath)
const activityFiles = asArray(collection.json?.activities).map((entry) => resolve(localRoot, entry))
const activityEntries = activityFiles.flatMap((path) => asArray(readJson(path)).map((activity) => {
  const classification = classifyActivity(activity)
  return {
    id: activity.id,
    file: localPath(path),
    owner: activityOwner(activity),
    invocation: activity.invocation?.kind ?? 'legacy-default',
    operationKinds: [...new Set(activityOperations(activity).map((operation) => operation.kind))].sort(),
    declaredAutomation: declaredAutomation(activity.automation),
    authorityExecution: activity.authorityBinding?.execution,
    ...classification,
  }
})).sort((left, right) => `${left.owner.kind}:${left.owner.id}:${left.id}`.localeCompare(`${right.owner.kind}:${right.owner.id}:${right.id}`))

const activityIndex = indexActivities(activityEntries)
const spellEntries = loadCollectionEntries(collection, 'spells').map((entry) => {
  const result = aggregateNativeContent('spell', entry.value.id, entry.value.automation, activityIndex)
  return {
    id: entry.value.id,
    file: entry.file,
    declaredAutomation: declaredAutomation(entry.value.automation),
    linkedActivityIds: result.activities.map((activity) => activity.id),
    status: result.status,
    migrationNeeded: result.migrationNeeded,
    target: result.target,
  }
}).sort((left, right) => left.id.localeCompare(right.id))
const hostSpellEntries = hostSpellInventory()

const featEntries = loadCollectionEntries(collection, 'feats')
  .map((entry) => classifyFeatureLike(entry, 'feat', activityIndex))
  .sort((left, right) => left.id.localeCompare(right.id))

const loadedRaceEntries = loadCollectionEntries(collection, 'races')
const raceGrantedFeatureIds = new Set(loadedRaceEntries.flatMap((entry) => asArray(entry.value.grantedFeatureIds)))
const racialFeatureEntries = loadCollectionEntries(collection, 'features')
  .map((entry) => {
    const classified = classifyFeatureLike(entry, 'feature', activityIndex)
    if (
      classified.status === 'REVIEW-NO-NATIVE-ACTIVITY' && raceGrantedFeatureIds.has(entry.value.id) &&
      !hasValues(entry.value.action) && !hasValues(entry.value.declarativeAbility) &&
      !hasValues(entry.value.staticModifiers) && !hasValues(entry.value.passiveEffects)
    ) return {
      ...classified,
      status: 'KEEP-RACE-GRANT-METADATA',
      migrationNeeded: false,
      target: 'Display/grant metadata only; executable innate spell or reroll authority is owned by the parent race projection.',
    }
    return classified
  })
  .sort((left, right) => left.id.localeCompare(right.id))

const raceEntries = loadedRaceEntries.map((entry) => {
  const value = entry.value
  const legacyParts = [
    ...(hasValues(value.staticModifiers) ? ['staticModifiers'] : []),
    ...(hasValues(value.savingThrowAdvantages) ? ['savingThrowAdvantages'] : []),
    ...(value.hitPointsPerLevelBonus != null ? ['hitPointsPerLevelBonus'] : []),
    ...(value.naturalOneReroll === true ? ['naturalOneReroll'] : []),
  ]
  return {
    id: value.id,
    file: entry.file,
    declaredAutomation: declaredAutomation(value.automation),
    legacyParts,
    status: legacyParts.length
      ? unifiedPermanentEffectRuntime ? 'DONE-UNIFIED-PERMANENT-EFFECT' : 'P2-LEGACY-PASSIVE-FIELDS'
      : 'KEEP-BUILD-DATA',
    migrationNeeded: legacyParts.length > 0 && !unifiedPermanentEffectRuntime,
    target: legacyParts.length
      ? unifiedPermanentEffectRuntime
        ? 'Race passives are converted once into permanent Unified Effects; build grants remain Advancement/payload data.'
        : 'Project deterministic race passives into native Effects; keep ancestry/build grants as build data.'
      : 'No combat-runtime migration required.',
  }
}).sort((left, right) => left.id.localeCompare(right.id))

const subclassEntries = loadCollectionEntries(collection, 'subclasses').flatMap((entry) =>
  asArray(entry.value.abilities).map((ability) => {
    const classification = classifyDeclarativeAbility(ability)
    return {
      id: `${entry.value.id}:${ability.id}`,
      subclassId: entry.value.id,
      abilityId: ability.id,
      file: entry.file,
      declaredAutomation: declaredAutomation(ability.automation),
      mechanicKind: ability.mechanic?.kind,
      deterministicKeys: deterministicAbilityKeys.filter((key) => hasValues(ability[key])),
      ...classification,
    }
  }),
).sort((left, right) => left.id.localeCompare(right.id))

const legacyRuntimeHotspots = [
  {
    file: 'src/rulesets/dnd5e/activities/legacyContentActivityAdapters.ts',
    concern: 'Declarative subclass, spell, item and monster data is projected at the loading boundary.',
    target: 'Reduce adapter output as native source data replaces each legacy declaration.',
  },
  {
    file: 'src/rulesets/dnd5e/activities/dnd5eActivityHeadlessAuthorityBridge.ts',
    concern: 'authorityBinding still dispatches plugin-headless-action and headless-event-engine.',
    target: 'Retain only as a compatibility adapter until P0 entries reach zero.',
  },
  {
    file: 'src/rulesets/dnd5e/pluginApi.ts',
    concern: 'Legacy Worker/Declarative entry points remain part of the loading API.',
    target: 'Keep frozen; new content must enter the Unified Content Registry as Activities/Effects.',
  },
]

const groups = {
  activities: activityEntries,
  hostSpells: hostSpellEntries,
  spells: spellEntries,
  feats: featEntries,
  racialFeatures: racialFeatureEntries,
  races: raceEntries,
  subclassAbilities: subclassEntries,
}
const statusCounts = countStatuses(Object.values(groups))
const migrationCount = Object.values(groups).flat().filter((entry) => entry.migrationNeeded).length
const report = {
  schemaVersion: 1,
  generatedBy: 'scripts/generate-dnd5e-migration-inventory.mjs',
  scope: 'local-content/phb-2014 plus Host legacy loading boundaries',
  privacy: 'IDs and structural metadata only; no rule text or official artwork is copied into this inventory.',
  definitions: {
    'P0-LEGACY-AUTHORITY': 'Direct legacy authority dispatch; migrate first.',
    'P1-*': 'Deterministic Declarative runtime content; convert to native Activity/Effect/Handler.',
    'P2-*': 'Legacy passive/static field; migrate after executable actions.',
    'DONE-*': 'Already uses the native Activity path.',
    'REVIEW-*': 'Intentional DM boundary or missing native coverage requiring review.',
    'KEEP-*': 'Build, reference or narrative data that should not be forced into an Activity.',
  },
  summary: {
    totalEntries: Object.values(groups).flat().length,
    migrationNeeded: migrationCount,
    p0LegacyAuthority: activityEntries.filter((entry) => entry.status === 'P0-LEGACY-AUTHORITY').length,
    statusCounts,
  },
  ...groups,
  legacyRuntimeHotspots,
}

writeFileSync(jsonOutputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

const markdown = `# PHB 2014 统一 Activity 迁移清单

本清单由 \`node scripts/generate-dnd5e-migration-inventory.mjs\` 从当前本地合集生成。它只记录 ID、结构字段和迁移状态，不复制规则原文或官方美术。

## 汇总

- 扫描条目：${report.summary.totalEntries}
- 需要迁移：${report.summary.migrationNeeded}
- P0 直接 Authority 绑定：${report.summary.p0LegacyAuthority}
- 原生 Activity：${activityEntries.length}
- Host SRD 法术目录：${hostSpellEntries.length}
- 本地 PHB 增量法术：${spellEntries.length}
- 子职能力：${subclassEntries.length}

${markdownTable(['状态', '数量'], Object.entries(statusCounts))}

## 执行顺序

1. **P0**：移除内容中的 \`authorityBinding\`，改成原生 operation/effect 或白名单 Mechanic Handler。
2. **P1**：迁移子职、专长和种族能力的 Declarative mechanic/data。
3. **P2**：把静态战斗修正迁移为 Effect 与资格 predicate；构筑 grant 保留在 Advancement。
4. **REVIEW**：确认 DM 边界是刻意保留，而不是遗漏自动化。
5. **KEEP**：叙事、资料和构筑条目不制造空 Activity。

## Host SRD 法术源数据

\`DONE-CORE-UNIFIED-SPELL\` 表示地图准备与 Headless 核心结算都先从 Unified Content Registry 取得权威 Activity/法术 payload；\`P1-HOST-ADAPTER-SPELL\` 才表示仍绕过统一注册表。

${markdownTable(
  ['ID', '状态', '旧效果类型', '动作'],
  hostSpellEntries.map((entry) => [entry.id, entry.status, entry.effect ?? '—', entry.target]),
)}

## 本地 PHB 增量法术

${markdownTable(
  ['ID', '状态', 'Activity', '动作'],
  spellEntries.map((entry) => [entry.id, entry.status, entry.linkedActivityIds.join(', ') || '—', entry.target]),
)}

## 专长

${markdownTable(
  ['ID', '状态', '旧字段', 'Activity', '动作'],
  featEntries.map((entry) => [entry.id, entry.status, entry.legacyParts.join(', ') || '—', entry.linkedActivityIds.join(', ') || '—', entry.target]),
)}

## 种族能力与种族被动

${markdownTable(
  ['ID', '状态', '旧字段', '动作'],
  [...racialFeatureEntries, ...raceEntries].map((entry) => [entry.id, entry.status, entry.legacyParts.join(', ') || '—', entry.target]),
)}

## 子职能力

${markdownTable(
  ['ID', '状态', 'Mechanic', '确定性字段', '动作'],
  subclassEntries.map((entry) => [entry.id, entry.status, entry.mechanicKind ?? '—', entry.deterministicKeys.join(', ') || '—', entry.target]),
)}

## 原生 Activity 结构审计

${markdownTable(
  ['所有者', 'Activity', '状态', 'Operations', '来源文件'],
  activityEntries.map((entry) => [`${entry.owner.kind}:${entry.owner.id}`, entry.id, entry.status, entry.operationKinds.join(', ') || '—', entry.file]),
)}

## Host 兼容边界

${markdownTable(
  ['文件', '当前职责', '迁移目标'],
  legacyRuntimeHotspots.map((entry) => [entry.file, entry.concern, entry.target]),
)}
`

writeFileSync(markdownOutputPath, markdown, 'utf8')
process.stdout.write(`${JSON.stringify({
  json: localPath(jsonOutputPath),
  markdown: localPath(markdownOutputPath),
  ...report.summary,
}, null, 2)}\n`)
