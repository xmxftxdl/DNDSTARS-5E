export class LockTimeoutError extends Error {
  code: 'ELOCKTIMEOUT'
  statusCode: 503
}
export function withWriteLock<T>(filePath: string, operation: () => Promise<T> | T): Promise<T>
export function retryTransientWindowsRename<T>(
  operation: () => Promise<T>,
  options?: { platform?: string; delays?: number[]; wait?: (delayMs: number) => Promise<void> },
): Promise<T>
export function atomicRename(filePath: string, body: string | Uint8Array): Promise<void>
export function atomicWriteLocked(filePath: string, body: string | Uint8Array): Promise<void>
export function atomicWriteJsonStateFreshLocked(filePath: string, body: string | Uint8Array): Promise<boolean>
export function atomicWriteImageLocked(
  imagePath: string,
  metaPath: string,
  blob: Uint8Array,
  metaBody: string | Uint8Array,
): Promise<void>
export function safeName(value: unknown): string
