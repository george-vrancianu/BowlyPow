import { rules } from '../config/rules'
import { type PlayerId, type Point } from './pitch'
import { opponent, type Possession } from './possession'
import type { SimConfig, SimEvent } from './step'

/** `round` counts from 1 and may exceed `config.rounds` (sudden death). `winner` set means the match is over. `builder` is whose build turn it is; null = play phase. */
export type Match = { seed: number; round: number; score: Record<PlayerId, number>; roundShots: number; winner: PlayerId | null; builder: PlayerId | null }

/** Round 1: the coin-flip loser builds first; the order alternates each round. */
export const firstBuilder = (seed: number, round: number): PlayerId => (round % 2 ? opponent(coinFlip(seed, 1)) : coinFlip(seed, 1))

export const newMatch = (seed: number): Match => ({ seed, round: 1, score: { 1: 0, 2: 0 }, roundShots: 0, winner: null, builder: firstBuilder(seed, 1) })

/** Seeded, deterministic: who gets ball-in-hand when nobody conceded. */
export function coinFlip(seed: number, round: number): PlayerId {
  let h = Math.imul(seed ^ Math.imul(round, 0x9e3779b9), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 15), 0xc2b2ae35)
  return (h ^ (h >>> 13)) & 1 ? 1 : 2
}

export const startingPossession = (shooter: PlayerId, c: SimConfig): Possession => ({ shooter, shots: c.shots, inHand: true, live: false })

/** Ends the current round (`scorer` null = shot cap, scoreless) and sets up the next, or the winner. */
export function endRound(m: Match, scorer: PlayerId | null, c: SimConfig): { match: Match; possession: Possession; ball: Point; events: SimEvent[] } {
  const score = scorer ? { ...m.score, [scorer]: m.score[scorer] + 1 } : m.score
  const winner = m.round >= c.rounds && score[1] !== score[2] ? (score[1] > score[2] ? 1 : 2) : null
  const round = m.round + 1
  const shooter = scorer ? opponent(scorer) : coinFlip(m.seed, round)
  const events: SimEvent[] = [{ type: 'round-ended', round: m.round, scorer }]
  if (winner) events.push({ type: 'match-ended', winner })
  return {
    match: { ...m, score, round, roundShots: 0, winner, builder: winner ? null : firstBuilder(m.seed, round) },
    possession: startingPossession(shooter, c),
    ball: { x: rules.pitchWidth / 2, y: rules.halfHeight },
    events,
  }
}
