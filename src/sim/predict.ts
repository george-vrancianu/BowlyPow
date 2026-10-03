import type { Tier } from '../config/rules'
import type { Point } from './pitch'
import { step, type SimConfig, type SimInput, type SimState } from './step'

/** Where a prediction stops: after N contacts with a structure or board, or when the ball comes to rest. */
export type Until = Tier['ghost']['until']

/** The ball's predicted path from its launch position, and the points where it touched a structure or board. */
export type Path = { points: Point[]; contacts: Point[] }

/** Seconds of play a prediction may cover, a safeguard against a ball that never settles. */
const capSeconds = 60

/**
 * Pure: applies `shot` to a copy of `state` through the real `step` and records the ball's positions until `until` is met
 * (a goal ends it too). A refused shot predicts no movement. `state` is left unchanged.
 */
export function predictPath(state: SimState, shot: NonNullable<SimInput['shot']>, config: SimConfig, until: Until): Path {
  const points: Point[] = [state.ball.pos]
  const contacts: Point[] = []
  let r = step(structuredClone(state), { shot }, config)
  if (!r.events.some((e) => e.type === 'shot-fired')) return { points, contacts }
  for (let tick = 0; tick < capSeconds * config.tickHz; tick++) {
    for (const e of r.events) {
      if (e.type === 'goal') return { points: [...points, e.at], contacts }
      if (e.type !== 'ball-hit-wall' && e.type !== 'ball-hit-board') continue
      points.push(e.at)
      contacts.push(e.at)
      if (until !== 'rest' && contacts.length >= until.contacts) return { points, contacts }
    }
    points.push(r.state.ball.pos)
    if (!r.state.possession.live) break
    r = step(r.state, {}, config)
  }
  return { points, contacts }
}
