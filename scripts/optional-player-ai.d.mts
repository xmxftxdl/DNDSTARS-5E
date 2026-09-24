export interface OptionalPlayerAiResult { service: unknown; files: { config?: string; playerUsage?: string }; configurationError?: boolean }
export function startOptionalPlayerAi(options?: { load?: () => Promise<OptionalPlayerAiResult>; warn?: (message: string) => void }): Promise<OptionalPlayerAiResult>
