import type { AutomationCapability } from '../automation/automationCapability'

export const CONTENT_DEFINITION_SCHEMA_VERSION = 1 as const

export type ContentDefinitionKind =
  | 'spell'
  | 'feature'
  | 'feat'
  | 'class'
  | 'subclass'
  | 'race'
  | 'background'
  | 'item'
  | 'monster'
  | 'monster-action'
  | 'ability-generation'

export interface ContentDefinitionSource {
  packageId: string
  packageVersion: string
  contentVersion?: string
}

/**
 * Ruleset-neutral envelope for imported content.
 *
 * The payload remains a discriminated ruleset type instead of an object with
 * dozens of optional fields. This keeps a spell from accidentally claiming
 * class-only data while still giving every content kind the same identity,
 * source, automation and executable-contribution boundary.
 */
export interface ContentDefinitionEnvelope<
  Kind extends ContentDefinitionKind,
  Payload,
  Activity = never,
  Effect = never,
  Advancement = never,
> {
  schemaVersion: typeof CONTENT_DEFINITION_SCHEMA_VERSION
  id: string
  namespace: string
  version: string
  kind: Kind
  name: string
  description?: string
  source?: ContentDefinitionSource
  tags?: readonly string[]
  payload: Payload
  activities?: readonly Activity[]
  effects?: readonly Effect[]
  advancements?: readonly Advancement[]
  automation: AutomationCapability
}

const CONTENT_ID_SEGMENT = /^[a-z0-9][a-z0-9._-]{0,127}$/
const SEMVER_LIKE = /^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/

export function validateContentDefinitionIdentity(input: {
  schemaVersion: number
  id: string
  namespace: string
  version: string
  name: string
}): readonly string[] {
  const errors: string[] = []
  if (input.schemaVersion !== CONTENT_DEFINITION_SCHEMA_VERSION) {
    errors.push('unsupported content definition schema')
  }
  if (!CONTENT_ID_SEGMENT.test(input.id)) errors.push('invalid content id')
  if (!CONTENT_ID_SEGMENT.test(input.namespace)) errors.push('invalid content namespace')
  if (!SEMVER_LIKE.test(input.version)) errors.push('invalid content version')
  if (!input.name.trim() || input.name.length > 160) errors.push('invalid content name')
  return errors
}
