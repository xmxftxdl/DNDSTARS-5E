export interface CharacterPortraitPresentation {
  portrait?: string
  initiativePortrait?: string
  tokenPortrait?: string
}

export interface TokenPortraitPresentation {
  portrait?: string
  tokenPortrait?: string
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
