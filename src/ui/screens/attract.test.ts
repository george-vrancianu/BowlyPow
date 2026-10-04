import { describe, expect, it } from 'vitest'
import { visual } from '../../config/visual'
import { createAttract, position, step, type Attract, type AttractEvent } from './attract'

const { attract: cfg } = visual
const DT = 1 / 60

/** Runs `seconds` of the loop and returns the final state with every event in order. */
function run(seed: number, seconds: number, from = createAttract(seed)) {
  let state = from
  const events: AttractEvent[] = []
  for (let t = 0; t < seconds; t += DT) {
    const out = step(state, DT)
    state = out.state
    events.push(...out.events)
  }
  return { state, events }
}

const live = (a: Attract) => a.pieces.filter((p) => !p.gone)

/** The events of each shot, from `shot` up to its `returned`. */
function shots(events: AttractEvent[]): AttractEvent[][] {
  const out: AttractEvent[][] = []
  let current: AttractEvent[] | undefined
  for (const e of events) {
    if (e.type === 'shot') current = []
    current?.push(e)
    if (e.type === 'returned' && current) {
      out.push(current)
      current = undefined
    }
  }
  return out
}

describe('Attract loop', () => {
  it('replays identically from the same seed', () => {
    const a = run(7, 30)
    const b = run(7, 30)
    expect(b.state).toEqual(a.state)
    expect(b.events).toEqual(a.events)
  })

  it('keeps between two and four live pieces on the ring', () => {
    let state = createAttract(3)
    const counts = new Set<number>()
    for (let t = 0; t < 90; t += DT) {
      state = step(state, DT).state
      counts.add(live(state).length)
    }
    expect(Math.min(...counts)).toBeGreaterThanOrEqual(cfg.min)
    expect(Math.max(...counts)).toBeLessThanOrEqual(cfg.max)
    for (const p of live(state)) expect(Math.hypot(position(p).x, position(p).y)).toBeCloseTo(cfg.ring, 5)
  })

  it('circles Player 1 pieces clockwise and Player 2 pieces the other way, one lap in about lapSec', () => {
    const before = createAttract(11)
    const after = step(before, 1).state
    for (const p of live(before)) {
      const later = after.pieces.find((q) => q.id === p.id)!
      const turned = later.angle - p.angle
      expect(Math.sign(turned)).toBe(p.side === 1 ? 1 : -1)
      expect(Math.abs(turned)).toBeGreaterThan(((2 * Math.PI) / cfg.lapSec) * (1 - cfg.jitter) * 0.99)
      expect(Math.abs(turned)).toBeLessThan(((2 * Math.PI) / cfg.lapSec) * (1 + cfg.jitter) * 1.01)
    }
  })

  it('fires a shot after a rest and every shot hits a piece before the ball comes home', () => {
    const { events } = run(5, 60)
    const all = shots(events)
    expect(all.length).toBeGreaterThanOrEqual(10)
    for (const shot of all) expect(shot.some((e) => e.type === 'hit' || e.type === 'deflected')).toBe(true)
  })

  it('a wall deflects the ball once and shatters; towers end the chain', () => {
    const { events } = run(9, 120)
    const deflected = events.flatMap((e) => (e.type === 'deflected' ? [e.id] : []))
    expect(new Set(deflected).size).toBe(deflected.length)
    for (const shot of shots(events)) {
      const hits = shot.filter((e) => e.type === 'hit' || e.type === 'deflected')
      hits.slice(0, -1).forEach((e) => expect(e.type).toBe('deflected'))
      expect(shot.filter((e) => e.type === 'deflected').length).toBeLessThanOrEqual(cfg.bounces)
    }
    // Something of every kind was reached over two minutes, so the rules above were exercised.
    const reached = new Set(events.flatMap((e) => (e.type === 'hit' || e.type === 'deflected' ? [e.kind] : [])))
    expect([...reached].sort()).toEqual(['repulsor', 'steal', 'wall'])
  })

  it('after a Steal swallows the ball it reappears at the centre, after a Repulsor it bounces home', () => {
    const { events } = run(13, 120)
    const towerHits = shots(events).filter((shot) => shot.some((e) => e.type === 'hit'))
    expect(towerHits.length).toBeGreaterThan(0)
    for (const shot of towerHits) expect(shot[shot.length - 1].type).toBe('returned')
    // The ball is back at the centre at every `returned`.
    let state = createAttract(13)
    for (let t = 0; t < 60; t += DT) {
      const out = step(state, DT)
      state = out.state
      if (out.events.some((e) => e.type === 'returned')) {
        expect(Math.hypot(state.ball.x, state.ball.y)).toBeLessThan(0.01)
        expect(state.ball.scale).toBe(1)
      }
    }
  })
})
