import { blindSeat, type Match } from '../sim/match'
import { buildPhase } from '../sim/mode'
import type { PlayerId } from '../sim/pitch'
import { STARTING_INVENTORY } from '../sim/player'
import { opponent } from '../sim/possession'
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
  const inventoryOf = (p: PlayerId) => (p === hidden ? STARTING_INVENTORY : s.players[p].inventory)
  const digitOf = (p: PlayerId) => (p === hidden ? '?' : digit?.[p] ?? null)
  const timed = b ? c.buildTime : c.shotClock
  return {
    players: { 1: { digit: digitOf(1), inventory: inventoryOf(1) }, 2: { digit: digitOf(2), inventory: inventoryOf(2) } },
    active: v.active,
    round,
    rounds: c.rounds,
    clock: timed ? { seconds: s.clock.left / c.tickHz, fraction: s.clock.left / (timed * c.tickHz) } : null,
    shotsLeft: s.possession.shots,
    shotsMax: c.shots,
    // Waiting on a blind opponent's build, the spent points would show what they placed.
    phase: buildPhase(s.match) === 'Rearrange' ? 'Rearrange' : b ? (b === hidden ? 'Build' : `Build · ${s.points[b]} pts`) : 'Play',
    buttons: v.buttons,
    breaker: { armed: v.armed, tappable: v.tappable },
  }
}
