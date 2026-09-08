export interface PlayerAiService {
  capabilities(): Record<string, unknown>
  enhanceCharacterExcel(input: {
    workbookText: string
    fileName?: string
    actorId: string
    roomId: string
  }): Promise<Record<string, unknown>>
  generateCharacterPortrait(input: {
    prompt: string
    aspect?: 'square' | 'portrait-3:4'
    background?: 'opaque' | 'transparent'
    actorId: string
    roomId: string
  }): Promise<Record<string, unknown>>
}

export function createPlayerAiService(options: Record<string, unknown>): PlayerAiService
export function createPlayerAiServiceFromPersistedConfig(options?: Record<string, unknown>): Promise<{
  service: PlayerAiService | null
  files: Record<string, string>
}>
