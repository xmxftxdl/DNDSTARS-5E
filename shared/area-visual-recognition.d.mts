export interface AreaVisualRecognition { dc: number; knownTokenIds: string[]; skill?: 'perception' | 'investigation' }
export function validAreaVisualRecognition(value: unknown): value is AreaVisualRecognition
