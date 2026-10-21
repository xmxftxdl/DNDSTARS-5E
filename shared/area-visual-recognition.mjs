export function validAreaVisualRecognition(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).every(key => ['dc', 'knownTokenIds', 'skill'].includes(key)) &&
    (value.skill === undefined || value.skill === 'perception' || value.skill === 'investigation') &&
    Number.isInteger(value.dc) && value.dc >= 1 && value.dc <= 40 &&
    Array.isArray(value.knownTokenIds) && value.knownTokenIds.length <= 1024 &&
    value.knownTokenIds.every(id => typeof id === 'string' && id.trim().length > 0 && id.length <= 160) &&
    new Set(value.knownTokenIds).size === value.knownTokenIds.length
}
