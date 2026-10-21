/** Persisted core fighter resources predate the lowercase module identifier format. */
export function isDnd5eLegacyCoreResourceId(value: unknown): value is string {
  return value === 'fighterSecondWind' || value === 'fighterActionSurge' || value === 'fighterIndomitable'
}
