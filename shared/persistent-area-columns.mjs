/** Saved ground-following columns are geometry views of one effect, not new effects. */
export function persistentAreaHeightSlices(area) {
  if (area.vertical?.mode !== 'volume' || !area.vertical.columns) return [area]
  const cells = new Set(area.cells.map(cell => `${cell.col}:${cell.row}`))
  return area.vertical.columns.filter(column => cells.has(`${column.col}:${column.row}`)).map(column => ({
    ...area,
    cells: [{ col: column.col, row: column.row }],
    vertical: { mode: 'volume', baseElevationFeet: column.baseElevationFeet, heightFeet: column.heightFeet },
  }))
}

export function validPersistentAreaColumns(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 1024) return false
  const bandsByCell = new Map()
  return value.every(column => {
    if (!column || typeof column !== 'object' || Array.isArray(column) ||
      Object.keys(column).some(key => !['col', 'row', 'baseElevationFeet', 'heightFeet'].includes(key)) ||
      !Number.isSafeInteger(column.col) || !Number.isSafeInteger(column.row) ||
      !Number.isInteger(column.baseElevationFeet) || column.baseElevationFeet < -1000 || column.baseElevationFeet > 10000 ||
      !Number.isInteger(column.heightFeet) || column.heightFeet < 1 || column.heightFeet > 10000) return false
    const key = `${column.col}:${column.row}`
    const bands = bandsByCell.get(key) ?? []
    const bottom = column.baseElevationFeet, top = bottom + column.heightFeet
    // Repeated cells represent separated vertical remnants, never duplicate volume.
    if (bands.some(band => bottom <= band[1] && top >= band[0])) return false
    bands.push([bottom, top]); bandsByCell.set(key, bands)
    return true
  })
}

/** Remove a vertical band only from the supplied footprint; preserve every other remnant. */
export function subtractPersistentAreaColumnBand(area, cells, bottom, top) {
  if (area.vertical?.mode !== 'volume' || area.vertical.shape || area.vertical.anchorOffsetFeet != null ||
    !Number.isInteger(bottom) || !Number.isInteger(top) || bottom < -1000 || top > 10000 || top <= bottom) return undefined
  const selected = new Set(cells.map(cell => `${cell.col}:${cell.row}`))
  const source = area.vertical.columns ?? area.cells.map(cell => ({...cell,
    baseElevationFeet:area.vertical.baseElevationFeet,heightFeet:area.vertical.heightFeet}))
  const columns = source.flatMap(column => {
    const low = column.baseElevationFeet, high = low + column.heightFeet
    if (!selected.has(`${column.col}:${column.row}`) || bottom >= high || top <= low) return [{...column}]
    return [ ...(bottom > low ? [{...column,heightFeet:bottom-low}] : []),
      ...(top < high ? [{...column,baseElevationFeet:top,heightFeet:high-top}] : []) ]
  })
  if (columns.length && !validPersistentAreaColumns(columns)) return undefined
  const remaining = new Set(columns.map(column => `${column.col}:${column.row}`))
  return {...area,geometryDepleted:columns.length?undefined:true,cells:area.cells.filter(cell=>remaining.has(`${cell.col}:${cell.row}`)),
    vertical:{...area.vertical,columns:columns.length?columns:undefined}}
}
