import { type PlayerId } from './pitch'
import { opponent, type Possession } from './possession'
import type { SimConfig } from './step'

/** Fields every mode shares. `builder` is whose build turn it is (null = play phase); `winner` set means the match is over; `choosing` is who owes a defence choice (play is held until they make it). */
type MatchBase = { seed: number; winner: PlayerId | null; builder: PlayerId | null; choosing: PlayerId | null }

/** `round` counts from 1 and may exceed `config.rounds` (sudden death). */
export type RoundsMatch = MatchBase & { mode: 'rounds'; round: number; score: Record<PlayerId, number>; roundShots: number }

/** Siege has no score or rounds, so it carries nothing beyond the shared fields. */
export type SiegeMatch = MatchBase & { mode: 'siege' }

/** Match state, a union keyed by `mode`: read per-mode fields only after narrowing on it. */
export type Match = RoundsMatch | SiegeMatch

export type GameModeName = Match['mode']

/** Round 1: the coin-flip loser builds first; the order alternates each round. */
export const firstBuilder = (seed: number, round: number): PlayerId => (round % 2 ? opponent(coinFlip(seed, 1)) : coinFlip(seed, 1))

/** Seeded, deterministic: who gets ball-in-hand when nobody conceded. */
export function coinFlip(seed: number, round: number): PlayerId {
  let h = Math.imul(seed ^ Math.imul(round, 0x9e3779b9), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 15), 0xc2b2ae35)
  return (h ^ (h >>> 13)) & 1 ? 1 : 2
}

export const startingPossession = (shooter: PlayerId, c: SimConfig): Possession => ({ shooter, shots: c.shots, inHand: true, live: false })

/** The seat whose own half is the only one `viewer` may see: the viewer themselves while a Siege build is on (also while waiting on the opponent's build), else undefined. Rounds stays open information. A pure function of state; hiding is view-only, so the sim stays complete. */
export const blindSeat = (m: Match, viewer: PlayerId): PlayerId | undefined => (m.mode === 'siege' && m.builder ? viewer : undefined)
