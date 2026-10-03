import type { PlayerId } from '../../sim/pitch'
import type { PowerUp } from '../../sim/player'
import type { SimConfig, SimState } from '../../sim/step'

export type ButtonSpec = { label: string; onClick(): void; disabled?: boolean }

export type HudModel = {
  players: Record<PlayerId, { score: number; inventory: Record<PowerUp, number> }>
  /** Whose turn it is; their strip goes to the bottom. */
  active: PlayerId
  round: number
  rounds: number
  /** Seconds left and fraction of the clock remaining, or null when no clock runs. */
  clock: { seconds: number; fraction: number } | null
  shotsLeft: number
  shotsMax: number
  phase: string
  /** Phase buttons (Done in a build turn) shown under the shared strip; rebuilt only when labels or state change. */
  buttons?: ButtonSpec[]
  /** Breaker is armed (highlighted) and whether the active player may tap it now. */
  breaker: { armed: boolean; tappable: boolean }
}

/** What the game knows that the sim state does not. */
export type HudInputs = { active: PlayerId; buttons?: ButtonSpec[]; armed: boolean; tappable: boolean }

export function hudModel(s: SimState, c: SimConfig, v: HudInputs): HudModel {
  const b = s.match.builder
  const { score } = s.match
  const timed = b ? c.buildTime : c.shotClock
  return {
    players: { 1: { score: score[1], inventory: s.players[1].inventory }, 2: { score: score[2], inventory: s.players[2].inventory } },
    active: v.active,
    round: s.match.round,
    rounds: c.rounds,
    clock: timed ? { seconds: s.clock.left / c.tickHz, fraction: s.clock.left / (timed * c.tickHz) } : null,
    shotsLeft: s.possession.shots,
    shotsMax: c.shots,
    phase: b ? `Build · ${s.points[b]} pts` : 'Play',
    buttons: v.buttons,
    breaker: { armed: v.armed, tappable: v.tappable },
  }
}
