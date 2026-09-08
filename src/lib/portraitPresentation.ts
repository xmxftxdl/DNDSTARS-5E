export interface CharacterPortraitPresentation {
  portrait?: string
  initiativePortrait?: string
  tokenPortrait?: string
}

export interface TokenPortraitPresentation {
  portrait?: string
  tokenPortrait?: string
}

export interface SharedTokenPortraitPresentation {
  portraitImageId?: string
  tokenPortraitImageId?: string
}

/** Compact/circular surfaces must mirror the actual map Token crop. */
export function resolveCompactPortraitImageId(
  token?: SharedTokenPortraitPresentation,
): string | undefined {
  return token?.tokenPortraitImageId ?? token?.portraitImageId
}

/** Initiative surfaces prefer their crop, but never fall back to catalogue art
 * when the room only has a custom Token crop available. */
export function resolveInitiativePortraitImageId(
  token?: SharedTokenPortraitPresentation,
): string | undefined {
  return token?.portraitImageId ?? token?.tokenPortraitImageId
}

/** Resolve the compact circular/square portrait used by map-token surfaces. */
export function resolveMapTokenPortrait(
  character?: CharacterPortraitPresentation,
  token?: TokenPortraitPresentation,
): string | undefined {
  return character?.tokenPortrait ?? token?.tokenPortrait ?? character?.portrait
}

/** Resolve the wider portrait used by initiative and turn-order surfaces. */
export function resolveInitiativePortrait(
  character?: CharacterPortraitPresentation,
  token?: TokenPortraitPresentation,
): string | undefined {
  return character?.initiativePortrait ?? character?.portrait ?? token?.portrait
}

/** Pick the first usable portrait candidate after browser image-load failures. */
export function resolveAvailablePortraitSource(
  preferred: string | undefined,
  shared: string | undefined,
  failedSources: readonly string[],
): string | undefined {
  return [preferred, shared].find((candidate) => candidate && !failedSources.includes(candidate))
}
