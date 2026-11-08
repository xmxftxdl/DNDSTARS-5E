/** Full execution-parent identity. Other resource/token IDs keep their own narrower contracts.
 * This validates a bounded identity only; it never issues source authority. */
export const mastermindExecutionParentId=value=>typeof value==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,1999}$/.test(value)
