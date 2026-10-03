import { rules } from '../config/rules'
import { halfOf, type PlayerId, type Point } from './pitch'
import { insideTower, nearestOnWall } from './near'
import type { SimConfig, SimEvent, SimState } from './step'
import type { Structure } from './wall'

/** `live`: a shot has been fired and the ball has not come to rest yet. */
export type Possession = { shooter: PlayerId; shots: number; inHand: boolean; live: boolean }

/** The Breaker icon works only for the shooter's own play phase, before the shot, with one left. */
export const canArm = (s: SimState, p: PlayerId): boolean =>
  !s.match.builder && s.possession.shooter === p && !s.possession.inHand && !s.possession.live && s.players[p].inventory.breaker > 0

/** Who is expected to act: the builder during a build turn, else whoever owes a defence choice, else the shooter. */
export const whoActs = (s: SimState): PlayerId => s.match.builder ?? s.match.choosing ?? s.possession.shooter

export const opponent = (p: PlayerId): PlayerId => (p === 1 ? 2 : 1)

/** Own half strictly (not the line), inside the boards, clear of every wall. The no-build zone does not apply. */
export function canPlaceBall(player: PlayerId, at: Point, objects: Structure[], c: SimConfig): boolean {
  const r = c.ballRadius
  return (
    halfOf(at.y) === player &&
    at.x >= r && at.x <= rules.pitchWidth - r && at.y >= rules.board && at.y <= rules.pitchHeight - rules.board &&
    objects.every((w) => nearestOnWall(w, at).dist > r + rules.wallHalf && !insideTower(w, at))
  )
}

/** Called once the ball has come to rest after a shot: only its resting half matters. */
export function resolveRest(p: Possession, ballY: number, c: SimConfig): { possession: Possession; events: SimEvent[] } {
  const half = halfOf(ballY)
  const fresh = (shooter: PlayerId, inHand: boolean) => ({
    possession: { shooter, shots: c.shots, inHand, live: false },
    events: [{ type: 'possession-changed', shooter, inHand } as SimEvent],
  })
  if (half === opponent(p.shooter)) return fresh(half, false)
  return p.shots > 1 ? { possession: { ...p, shots: p.shots - 1, live: false }, events: [] } : fresh(opponent(p.shooter), true)
}
