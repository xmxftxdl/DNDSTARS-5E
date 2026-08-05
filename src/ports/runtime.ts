export interface ClockPort {
  now(): number
}

export interface RandomPort {
  integer(minInclusive: number, maxInclusive: number): number
  suffix(): string
}

export interface IdGeneratorPort {
  create(prefix?: string): string
  createNumeric(): number
}

export interface RuntimePort extends ClockPort, RandomPort, IdGeneratorPort {}
