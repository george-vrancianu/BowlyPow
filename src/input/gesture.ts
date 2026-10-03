import { visual } from '../config/visual'
import type { Point } from '../sim/pitch'

/** `charge` while still, `pan` once moved during the dwell (camera ticket), `dead` once moved during the ramp. */
export type Gesture = { start: Point; t0: number; mode: 'charge' | 'pan' | 'dead' }

/** Pointer positions are in screen pixels, times in ms. */
export const gestureStart = (start: Point, now: number): Gesture => ({ start, t0: now, mode: 'charge' })

export function gestureMove(g: Gesture, at: Point, now: number): Gesture {
  if (g.mode !== 'charge' || Math.hypot(at.x - g.start.x, at.y - g.start.y) <= visual.input.slopPx) return g
  return { ...g, mode: now - g.t0 < visual.aim.dwellMs ? 'pan' : 'dead' }
}

/** 0 during the dwell and for a moved gesture; otherwise the eased ramp, held at 1. Release fires iff this is above 0. */
export function gesturePower(g: Gesture, now: number): number {
  if (g.mode !== 'charge') return 0
  const t = Math.min(1, Math.max(0, (now - g.t0 - visual.aim.dwellMs) / visual.aim.rampMs))
  return t * t
}
