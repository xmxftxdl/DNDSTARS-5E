/** A proposal only. The server accepts retirement solely against its private
 * witness of the completed same-parent final transaction. */
export const bountifulUnconsumedParentRows=rows=>Object.fromEntries(Object.entries(rows??{}).filter(([,row])=>!row.consumed))
