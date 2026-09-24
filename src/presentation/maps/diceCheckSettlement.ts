/** Only the matching roll blocks its cue; unrelated damage rolls must not. */
export function diceCheckAwaitsSettlement(rollId: string | undefined, pendingIds: readonly (string | undefined)[]): boolean {
  return !!rollId && pendingIds.some(id => id === rollId || id === `${rollId}:player-authority` || id === `${rollId}:supplement`)
}
