import type { Match } from '../sim/match'
import type { PlayerId } from '../sim/pitch'
import type { SimConfig, SimState } from '../sim/step'
import type { ButtonSpec, HudModel } from './hud'

export type HudView = { active: PlayerId; buttons?: ButtonSpec[]; armed: boolean; tappable: boolean }

/** What the HUD reads off the match, per mode. A new mode adds a case; the missing return makes the compiler point at this spot. */
function matchView(m: Match): { score: Record<PlayerId, number>; round: number } {
  switch (m.mode) {
    case 'rounds':
      return { score: m.score, round: m.round }
  }
}

export function hudModel(s: SimState, c: SimConfig, v: HudView): HudModel {
  const b = s.match.builder
  const { score, round } = matchView(s.match)
  const timed = b ? c.buildTime : c.shotClock
  return {
    players: { 1: { score: score[1], inventory: s.players[1].inventory }, 2: { score: score[2], inventory: s.players[2].inventory } },
    active: v.active,
    round,
    rounds: c.rounds,
    clock: timed ? { seconds: s.clock.left / c.tickHz, fraction: s.clock.left / (timed * c.tickHz) } : null,
    shotsLeft: s.possession.shots,
    shotsMax: c.shots,
    phase: b ? `Build · ${s.points[b]} pts` : 'Play',
    buttons: v.buttons,
    breaker: { armed: v.armed, tappable: v.tappable },
  }
}
