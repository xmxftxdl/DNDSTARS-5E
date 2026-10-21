export function sharedChoiceAudience(
  requested: 'actor' | 'target' | 'dm',
  recipientOwnerId: string | undefined,
  dmMemberId: string | undefined,
): 'actor' | 'target' | 'dm' {
  return requested !== 'dm' && !!dmMemberId && recipientOwnerId === dmMemberId
    ? 'dm'
    : requested
}
