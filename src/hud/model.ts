import type { Match } from '../sim/match'
import type { PlayerId } from '../sim/pitch'
import type { SimConfig, SimState } from '../sim/step'
import type { Structure } from '../sim/wall'
import type { ButtonSpec, HudModel } from './hud'

export type HudView = { active: PlayerId; buttons?: ButtonSpec[]; armed: boolean; tappable: boolean }

/** What the HUD reads off the match, per mode. A new mode adds a case; the missing return makes the compiler point at this spot. */
/** `null` = the mode has no such thing, so the HUD drops it. */
function matchView(m: Match, objects: readonly Structure[]): { digit: Record<PlayerId, string> | null; round: number | null } {
  switch (m.mode) {
    case 'rounds':
      return { digit: { 1: String(m.score[1]), 2: String(m.score[2]) }, round: m.round }
    case 'siege':
      // Every structure counts, towers included; derived from the board so repairs and rearranging need no extra state.
      return { digit: { 1: String(objects.filter((o) => o.owner === 1).length), 2: String(objects.filter((o) => o.owner === 2).length) }, round: null }
  }
}

export function hudModel(s: SimState, c: SimConfig, v: HudView): HudModel {
  const b = s.match.builder
  const { digit, round } = matchView(s.match, s.objects)
  const timed = b ? c.buildTime : c.shotClock
  return {
    players: { 1: { digit: digit?.[1] ?? null, inventory: s.players[1].inventory }, 2: { digit: digit?.[2] ?? null, inventory: s.players[2].inventory } },
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
