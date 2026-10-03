import { rules, type Tier } from '../../config/rules'
import { visual } from '../../config/visual'
import type { Point } from '../../sim/pitch'
import type { Aiming } from '../../sim/step'

/** A press, in screen pixels and ms. `canShoot`: the player is the shooter, the ball is not in hand and no shot is in flight. */
export type Press = { at: Point; now: number; ball: Point; ballRadiusPx: number; canShoot: boolean }

/**
 * The aim gesture, a pure state machine over screen-pixel points. `pan` for a press that was not on the ball (or an abandoned aim);
 * `holding` while the pointer stays within the slop of the press; `aiming` once it has left it, with the tier locked.
 */
export type AimGesture = { phase: 'pan' } | { phase: 'holding' | 'aiming'; press: Point; at: Point; tier: number }

/** An aim without the Breaker flag: `dir` is the way the ball goes, opposite the drag. */
export type Aim = Omit<Aiming, 'breaker'>

const tierOf = (i: number): Tier => rules.shot.tiers[i]

export function aimPress({ at, ball, ballRadiusPx, canShoot }: Press): AimGesture {
  const onBall = Math.hypot(at.x - ball.x, at.y - ball.y) <= Math.max(ballRadiusPx, visual.aim.ballHitPx)
  return canShoot && onBall ? { phase: 'holding', press: at, at, tier: 0 } : { phase: 'pan' }
}

/** The first move past the slop locks the tier. */
export function aimMove(g: AimGesture, at: Point, _now: number): AimGesture {
  if (g.phase === 'pan') return g
  const past = Math.hypot(at.x - g.press.x, at.y - g.press.y) > visual.aim.slopPx
  return { ...g, at, phase: g.phase === 'aiming' || past ? 'aiming' : 'holding' }
}

/** What the gesture shows: its phase and tier, the tier's control radius in screen px, and the aim once there is one. */
export type GestureView = { phase: 'holding' | 'aiming'; tier: number; radiusPx: number; dir?: Point; power?: number }

export function aimViewOf(g: AimGesture): GestureView | undefined {
  if (g.phase === 'pan') return undefined
  return { phase: g.phase, tier: g.tier, radiusPx: tierOf(g.tier).radiusPx, ...aimOf(g) }
}

/** A second finger keeps the usual pinch/pan and abandons the aim. */
export const aimSecondFinger = (_g: AimGesture): AimGesture => ({ phase: 'pan' })

/** What a release does: a pan ends, a release with no aim (within the slop) cancels, anything else fires. */
export type AimResult = { type: 'pan' } | { type: 'cancelled' } | { type: 'shot'; aim: Aim }

export function aimRelease(g: AimGesture): AimResult {
  if (g.phase === 'pan') return { type: 'pan' }
  const aim = aimOf(g)
  return aim ? { type: 'shot', aim } : { type: 'cancelled' }
}

/** The aim held right now: none while panning, holding, or back within the slop. */
export function aimOf(g: AimGesture): Aim | null {
  if (g.phase !== 'aiming') return null
  const [dx, dy] = [g.press.x - g.at.x, g.press.y - g.at.y]
  const d = Math.hypot(dx, dy)
  const { slopPx } = visual.aim
  if (d <= slopPx) return null
  const tier = tierOf(g.tier)
  const t = Math.min(1, (d - slopPx) / (tier.radiusPx - slopPx))
  const [lo, hi] = tier.power
  return { dir: { x: dx / d, y: dy / d }, tier: g.tier, power: lo + (hi - lo) * t * t }
}
