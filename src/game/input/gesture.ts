import { rules, type Tier } from '../../config/rules'
import { visual } from '../../config/visual'
import type { Point } from '../../sim/pitch'
import type { Aiming } from '../../sim/step'

/** The canvas, in screen px, for the edge-cancel zone. */
export type Size = { w: number; h: number }

/** A press, in screen pixels and ms. `canShoot`: the player is the shooter, the ball is not in hand and no shot is in flight. */
export type Press = { at: Point; now: number; ball: Point; ballRadiusPx: number; canShoot: boolean; size: Size }

/**
 * The aim gesture, a pure state machine over screen-pixel points. `pan` for a press that was not on the ball (or an abandoned aim);
 * `holding` while the pointer stays within the slop of the press; `aiming` once it has left it, with the tier locked.
 * Either is cancel-armed while the pointer is in the edge zone (see `cancelArmed`).
 */
export type AimGesture = { phase: 'pan' } | { phase: 'holding' | 'aiming'; press: Point; at: Point; tier: number; size: Size }

/** An aim without the Breaker flag: `dir` is the way the ball goes, opposite the drag. */
export type Aim = Omit<Aiming, 'breaker'>

const tierOf = (i: number): Tier => rules.shot.tiers[i]

export function aimPress({ at, ball, ballRadiusPx, canShoot, size }: Press): AimGesture {
  const onBall = Math.hypot(at.x - ball.x, at.y - ball.y) <= Math.max(ballRadiusPx, visual.aim.ballHitPx)
  return canShoot && onBall ? { phase: 'holding', press: at, at, tier: 0, size } : { phase: 'pan' }
}

/** The first move past the slop locks the tier. */
export function aimMove(g: AimGesture, at: Point, _now: number): AimGesture {
  if (g.phase === 'pan') return g
  const past = Math.hypot(at.x - g.press.x, at.y - g.press.y) > visual.aim.slopPx
  return { ...g, at, phase: g.phase === 'aiming' || past ? 'aiming' : 'holding' }
}

/** Within `edgeCancelPx` of any canvas edge: releasing cancels, moving back out re-arms the same shot. */
export function cancelArmed(g: AimGesture): boolean {
  if (g.phase === 'pan') return false
  const e = visual.aim.edgeCancelPx
  const { at, size } = g
  return at.x < e || at.y < e || at.x > size.w - e || at.y > size.h - e
}

/**
 * What the gesture shows: its phase and tier, the tier's control radius in screen px and Ghost config, and the aim once there is one.
 * `cancel` while cancel-armed: the aim is still shown (greyed) though none is held.
 */
export type GestureView = { phase: 'holding' | 'aiming'; tier: number; radiusPx: number; ghost: Tier['ghost']; dir?: Point; power?: number; cancel?: true }

export function aimViewOf(g: AimGesture): GestureView | undefined {
  if (g.phase === 'pan') return undefined
  const { radiusPx, ghost } = tierOf(g.tier)
  return { phase: g.phase, tier: g.tier, radiusPx, ghost, ...dragAim(g), ...(cancelArmed(g) && { cancel: true }) }
}

/** A second finger keeps the usual pinch/pan and abandons the aim. */
export const aimSecondFinger = (_g: AimGesture): AimGesture => ({ phase: 'pan' })

/** What a release does: a pan ends, a release with no aim (within the slop or the edge zone) cancels, anything else fires. */
export type AimResult = { type: 'pan' } | { type: 'cancelled' } | { type: 'shot'; aim: Aim }

export function aimRelease(g: AimGesture): AimResult {
  if (g.phase === 'pan') return { type: 'pan' }
  const aim = aimOf(g)
  return aim ? { type: 'shot', aim } : { type: 'cancelled' }
}

/** The aim held right now: none while panning, holding, back within the slop, or cancel-armed. */
export function aimOf(g: AimGesture): Aim | null {
  return cancelArmed(g) ? null : dragAim(g)
}

/** The aim the drag points at, cancel-armed or not. */
function dragAim(g: AimGesture): Aim | null {
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
