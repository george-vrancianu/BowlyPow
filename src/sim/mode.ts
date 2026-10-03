import { HALF_HEIGHT, PITCH_WIDTH, type PlayerId, type Point } from './pitch'
import { coinFlip, firstBuilder, startingPossession, type GameModeName, type Match, type RoundsMatch } from './match'
import { opponent, type Possession } from './possession'
import type { SimConfig, SimEvent } from './step'

/** What a match-level hook returns. `possession` and `ball` are set only when the hook resets play (a new round). */
export type ModeResult<M extends Match = Match> = { match: M; possession?: Possession; ball?: Point; events: SimEvent[] }

/** A game mode: pure hooks that own the match-level transitions. The step function owns physics, possession, build turns and the shot clock. */
export type GameMode<M extends Match = Match> = {
  /** Fresh match state and the opening possession. */
  start(seed: number, c: SimConfig): { match: M; possession: Possession }
  /** A shot was fired or burned by the shot clock. */
  onShotFired(m: M): M
  /** A shot was consumed (rested, stolen or burned); null = nothing changes. */
  onShotConsumed(m: M, c: SimConfig): ModeResult<M> | null
  /** `scorer` put the ball in the opponent's goal. */
  onGoal(m: M, scorer: PlayerId, c: SimConfig): ModeResult<M>
  /** The builder pressed Done (or timed out): who builds next, null = play begins. */
  onBuildDone(m: M, builder: PlayerId): PlayerId | null
  /** Who has won, if anyone. */
  winner(m: M, c: SimConfig): PlayerId | null
}

const center: Point = { x: PITCH_WIDTH / 2, y: HALF_HEIGHT }

/** Ends the current round (`scorer` null = shot cap, scoreless) and sets up the next, or the winner. */
function endRound(m: RoundsMatch, scorer: PlayerId | null, c: SimConfig): ModeResult<RoundsMatch> {
  const score = scorer ? { ...m.score, [scorer]: m.score[scorer] + 1 } : m.score
  const round = m.round + 1
  const next: RoundsMatch = { ...m, score, round, roundShots: 0 }
  const winner = rounds.winner(next, c)
  const shooter = scorer ? opponent(scorer) : coinFlip(m.seed, round)
  const events: SimEvent[] = [{ type: 'round-ended', round: m.round, scorer }]
  if (winner) events.push({ type: 'match-ended', winner })
  return {
    match: { ...next, winner, builder: winner ? null : firstBuilder(m.seed, round) },
    possession: startingPossession(shooter, c),
    ball: center,
    events,
  }
}

export const rounds: GameMode<RoundsMatch> = {
  start: (seed, c) => ({
    match: { mode: 'rounds', seed, round: 1, score: { 1: 0, 2: 0 }, roundShots: 0, winner: null, builder: firstBuilder(seed, 1) },
    possession: startingPossession(coinFlip(seed, 1), c),
  }),
  onShotFired: (m) => ({ ...m, roundShots: m.roundShots + 1 }),
  onShotConsumed: (m, c) => (m.roundShots >= c.shotCap && m.round <= c.rounds ? endRound(m, null, c) : null),
  onGoal: (m, scorer, c) => endRound(m, scorer, c),
  onBuildDone: (m, builder) => (builder === firstBuilder(m.seed, m.round) ? opponent(builder) : null),
  // The last round is over and the score is not tied; a tie means sudden death.
  winner: (m, c) => (m.round > c.rounds && m.score[1] !== m.score[2] ? (m.score[1] > m.score[2] ? 1 : 2) : null),
}

const MODES: { [K in GameModeName]: GameMode<Extract<Match, { mode: K }>> } = { rounds }

/** The hooks for `name`. Callers hold a `Match` of that mode, so the widening here is safe. */
export const modeFor = (name: GameModeName): GameMode => MODES[name] as GameMode
