import { HALF_HEIGHT, PITCH_WIDTH, type PlayerId, type Point } from './pitch'
import { coinFlip, firstBuilder, startingPossession, type GameModeName, type Match, type RoundsMatch } from './match'
import { opponent, type Possession } from './possession'
import type { SimConfig, SimEvent } from './step'
import type { Structure } from './wall'

/** The board a hook may read when deciding: read-only, so hooks stay pure. */
export type ModeContext = { objects: readonly Structure[]; possession: Possession }

/** What a match-level hook returns. `possession` and `ball` are set only when the hook resets play (a new round). */
export type ModeResult<M extends Match = Match> = { match: M; possession?: Possession; ball?: Point; events: SimEvent[] }

/** How a build turn opens: the builder's wall points and which structures count as placed this turn (movable). */
export type BuildTurn = { points: number; built: number[] }

/**
 * A game mode: pure hooks that own the match-level transitions. The step function owns physics, possession, build turns and the shot clock,
 * and calls `winner` after every transition that returns a result.
 */
export type GameMode<M extends Match = Match> = {
  /** Fresh match state and the opening possession. */
  start(seed: number, c: SimConfig): { match: M; possession: Possession }
  /** A shot was fired or burned by the shot clock. */
  onShotFired(m: M): M
  /** A shot was consumed (rested, stolen or burned); null = nothing changes. */
  onShotConsumed(m: M, ctx: ModeContext, c: SimConfig): ModeResult<M> | null
  /** `scorer` put the ball in the opponent's goal. */
  onGoal(m: M, scorer: PlayerId, ctx: ModeContext, c: SimConfig): ModeResult<M>
  /** The builder pressed Done (or timed out): the new match state (who builds next, null = play begins) and events, or null to refuse. */
  onBuildDone(m: M, builder: PlayerId, ctx: ModeContext, c: SimConfig): ModeResult<M> | null
  /** A build turn just opened for `m.builder`. */
  onBuildStart(m: M, ctx: ModeContext, c: SimConfig): BuildTurn
  /** Who has won, if anyone; derived from state. */
  winner(m: M, ctx: ModeContext, c: SimConfig): PlayerId | null
}

const center: Point = { x: PITCH_WIDTH / 2, y: HALF_HEIGHT }

/** Ends the current round (`scorer` null = shot cap, scoreless) and sets up the next; the step function ends the match if `winner` says so. */
function endRound(m: RoundsMatch, scorer: PlayerId | null, c: SimConfig): ModeResult<RoundsMatch> {
  const score = scorer ? { ...m.score, [scorer]: m.score[scorer] + 1 } : m.score
  const round = m.round + 1
  const shooter = scorer ? opponent(scorer) : coinFlip(m.seed, round)
  return {
    match: { ...m, score, round, roundShots: 0, builder: firstBuilder(m.seed, round) },
    possession: startingPossession(shooter, c),
    ball: { ...center },
    events: [{ type: 'round-ended', round: m.round, scorer }],
  }
}

export const rounds: GameMode<RoundsMatch> = {
  start: (seed, c) => ({
    match: { mode: 'rounds', seed, round: 1, score: { 1: 0, 2: 0 }, roundShots: 0, winner: null, builder: firstBuilder(seed, 1) },
    possession: startingPossession(coinFlip(seed, 1), c),
  }),
  onShotFired: (m) => ({ ...m, roundShots: m.roundShots + 1 }),
  onShotConsumed: (m, _ctx, c) => (m.roundShots >= c.shotCap && m.round <= c.rounds ? endRound(m, null, c) : null),
  onGoal: (m, scorer, _ctx, c) => endRound(m, scorer, c),
  onBuildDone: (m, builder) => ({ match: { ...m, builder: builder === firstBuilder(m.seed, m.round) ? opponent(builder) : null }, events: [] }),
  onBuildStart: (_m, _ctx, c) => ({ points: c.wallPoints, built: [] }),
  // The last round is over and the score is not tied; a tie means sudden death.
  winner: (m, _ctx, c) => (m.round > c.rounds && m.score[1] !== m.score[2] ? (m.score[1] > m.score[2] ? 1 : 2) : null),
}

/** The mode a match is being played in, read off the match itself. */
export function modeFor(m: Match): GameMode {
  switch (m.mode) {
    case 'rounds':
      return rounds
  }
}

/** The mode a new match starts in. */
export const modeNamed = (name: GameModeName): GameMode => {
  switch (name) {
    case 'rounds':
      return rounds
  }
}
