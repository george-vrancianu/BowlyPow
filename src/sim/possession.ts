import { BOARD, halfOf, PITCH_HEIGHT, PITCH_WIDTH, type PlayerId, type Point } from './pitch'
import { nearestOnWall, WALL_HALF } from './blast'
import type { SimConfig, SimEvent } from './step'
import type { Wall } from './wall'

/** `live`: a shot has been fired and the ball has not come to rest yet. */
export type Possession = { shooter: PlayerId; shots: number; inHand: boolean; live: boolean }

export const opponent = (p: PlayerId): PlayerId => (p === 1 ? 2 : 1)

/** Own half strictly (not the line), inside the boards, clear of every wall. The no-build zone does not apply. */
export function canPlaceBall(player: PlayerId, at: Point, objects: Wall[], c: SimConfig): boolean {
  const r = c.ballRadius
  return (
    halfOf(at.y) === player &&
    at.x >= r && at.x <= PITCH_WIDTH - r && at.y >= BOARD && at.y <= PITCH_HEIGHT - BOARD &&
    objects.every((w) => nearestOnWall(w, at).dist > r + WALL_HALF)
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
