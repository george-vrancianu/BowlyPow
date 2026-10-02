import { describe, expect, it } from 'vitest'
import { defaultConfig, step, type SimState } from './step'
import { buildState, place } from './testkit'
import type { TowerSpec } from './wall'

const repulsor = (owner: 1 | 2 = 1): TowerSpec => ({ kind: 'tower', owner, power: 'repulsor', at: { gx: 10, gy: owner === 1 ? 40 : 14 } })
// P1 tower spans x 20..22, y 80..82. Ball rolls in from the left at 30 u/s.
const shot = (s: SimState, y = 81): SimState => ({ ...s, ball: { ...s.ball, pos: { x: 15, y }, vel: { x: 30, y: 0 } }, possession: { ...s.possession, live: true } })
const run = (s: SimState, ticks: number) => {
  const events: string[] = []
  for (let i = 0; i < ticks; i++) {
    const r = step(s, {}, defaultConfig)
    s = r.state
    events.push(...r.events.map((e) => e.type))
  }
  return { s, events }
}

describe('repulsor placement', () => {
  it('costs no points, consumes one from inventory and refuses at zero', () => {
    const b = buildState(1)
    const r = step(b, { placeWall: repulsor() }, defaultConfig)
    expect(r.state.objects).toHaveLength(1)
    expect(r.state.points[1]).toBe(b.points[1])
    expect(r.state.players[1].inventory.repulsor).toBe(2)
    const empty = { ...b, players: { ...b.players, 1: { ...b.players[1], inventory: { ...b.players[1].inventory, repulsor: 0 } } } }
    const x = step(empty, { placeWall: repulsor() }, defaultConfig)
    expect(x.state.objects).toHaveLength(0)
    expect(x.events).toEqual([{ type: 'refused' }])
  })
  it('has 3 hit points', () => expect(place(repulsor()).state.objects[0].hp).toBe(3))
})

describe('repulsor firing', () => {
  it('fires the ball away at max speed once, with an event', () => {
    let s = shot(place(repulsor()).state)
    const all: string[] = []
    for (let i = 0; i < 30; i++) {
      const r = step(s, {}, defaultConfig)
      s = r.state
      all.push(...r.events.map((e) => e.type))
      if (r.events.some((e) => e.type === 'repulsor-fired')) {
        // Left at max speed (one tick of friction aside), back the way it came.
        expect(Math.hypot(s.ball.vel.x, s.ball.vel.y)).toBeGreaterThan(defaultConfig.maxSpeed * 0.9)
        expect(s.ball.vel.x).toBeLessThan(0)
      }
    }
    expect(all.filter((e) => e === 'repulsor-fired')).toHaveLength(1)
  })
  it('acts as a plain wall afterwards, and resets at rest', () => {
    let { s } = run(shot(place(repulsor()).state), 20)
    expect(s.objects[0]).toMatchObject({ spent: true })
    const again = run({ ...s, ball: { ...s.ball, pos: { x: 15, y: 81 }, vel: { x: 30, y: 0 } } }, 30)
    expect(again.events).not.toContain('repulsor-fired')
    s = { ...again.s, ball: { ...again.s.ball, vel: { x: 0, y: 0 } } }
    expect(run(s, 1).s.objects[0]).toMatchObject({ spent: false })
  })
  it('triggers for either shooter', () => {
    const s = place(repulsor(2)).state
    const { events } = run({ ...shot(s, 29), possession: { ...s.possession, shooter: 1, live: true } }, 30)
    expect(events).toContain('repulsor-fired')
  })
})
