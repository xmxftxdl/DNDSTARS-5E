/**
 * Builder drafts live in localStorage across releases. New array-backed fields
 * must be restored before render because legacy/malformed values cannot safely
 * receive `.includes()`, `.filter()` or spread operations.
 */
export function restoreArrayBackedBuilderMetadata<
  TCapability extends string,
  TMetadata extends { declaredCapabilities: TCapability[] },
>(
  value: unknown,
  fallback: TMetadata,
  allowedCapabilities: readonly TCapability[],
): TMetadata {
  if (!value || typeof value !== 'object') return { ...fallback }
  const source = value as Partial<TMetadata>
  const declaredCapabilities = Array.isArray(source.declaredCapabilities)
    ? source.declaredCapabilities.filter((capability): capability is TCapability =>
        typeof capability === 'string' &&
        (allowedCapabilities as readonly string[]).includes(capability))
    : []
  return {
    ...fallback,
    ...source,
    declaredCapabilities,
  }
}
