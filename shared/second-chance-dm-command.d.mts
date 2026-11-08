export interface SecondChanceDmConfirmationDocuments {
  combat?: unknown;
  characters?: unknown;
  maps?: unknown;
  geometry?: unknown;
  clock?: unknown;
}
export function authorizeSecondChanceDmConfirmationAppend(
  action: unknown,
  documents: SecondChanceDmConfirmationDocuments,
  principal: { roomId?: string; memberId?: string },
): boolean;
export function secondChanceDmAppendIdentity(action: unknown): string;

export function authorizeSecondChanceDmOwnedAppend(
  action: unknown,
  documents: SecondChanceDmConfirmationDocuments,
  principal: { roomId?: string; memberId?: string },
): boolean;
