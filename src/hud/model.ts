import type { Match } from '../sim/match'
import type { PlayerId } from '../sim/pitch'
import { opponent } from '../sim/possession'
import { blindSeat } from '../render/camera'
import type { SimConfig, SimState } from '../sim/step'
import type { Structure } from '../sim/wall'
import type { ButtonSpec, HudModel } from './hud'

/** `viewer` is the local player (online: the peer's own seat; hot-seat: whoever holds the device), not necessarily the strip shown at the bottom. */
export type HudView = { active: PlayerId; viewer: PlayerId; buttons?: ButtonSpec[]; armed: boolean; tappable: boolean }

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
  // Blind opening build: the viewer's opponent's count is a guess, not information.
  const hidden = blindSeat(s.match, v.viewer) ? opponent(v.viewer) : null
  const digitOf = (p: PlayerId) => (p === hidden ? '?' : digit?.[p] ?? null)
  const timed = b ? c.buildTime : c.shotClock
  return {
    players: { 1: { digit: digitOf(1), inventory: s.players[1].inventory }, 2: { digit: digitOf(2), inventory: s.players[2].inventory } },
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
