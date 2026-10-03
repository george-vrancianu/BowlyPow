import { describe, expect, it } from 'vitest'
import { coinFlip, firstBuilder } from './match'
import { opponent } from './possession'
import type { Structure } from './wall'
import { defaultConfig, initialState, step, type SimConfig, type SimState } from './step'

const siege: SimConfig = { ...defaultConfig, mode: 'siege' }
const playing = (seed = 1): SimState => {
  const s = initialState(seed, siege)
  return { ...s, match: { ...s.match, builder: null } }
}
const shot = (s: SimState, shooter: 1 | 2, y: number, vy: number): SimState => ({ ...s, ball: { ...s.ball, pos: { x: 20, y }, vel: { x: 0, y: vy } }, possession: { ...s.possession, shooter, inHand: false, live: true } })

describe('Siege', () => {
  it('opens with one build per player in the Rounds order, then never builds again', () => {
    let s = initialState(1, siege)
    const first = firstBuilder(1, 1)
    expect(s.match).toMatchObject({ mode: 'siege', builder: first })
    expect(s.possession).toMatchObject({ shooter: coinFlip(1, 1), inHand: true })
    s = step(s, { done: first }, siege).state
    expect(s.match.builder).toBe(opponent(first))
    expect(s.points[opponent(first)]).toBe(siege.wallPoints)
    s = step(s, { done: opponent(first) }, siege).state
    expect(s.match.builder).toBeNull()
  })

  it('a goal scores nothing and hands the conceder ball-in-hand at the center with a fresh counter', () => {
    const before = shot(playing(), 1, 0.5, -60)
    const r = step({ ...before, possession: { ...before.possession, shots: 1 } }, {}, siege)
    expect(r.events).toContainEqual({ type: 'goal', scorer: 1, at: expect.anything() })
    expect(r.events.some((e) => e.type === 'round-ended')).toBe(false)
    expect(r.state.match).toMatchObject({ mode: 'siege', builder: null, winner: null })
    expect(r.state.possession).toEqual({ shooter: 2, shots: siege.shots, inHand: true, live: false })
    expect(r.state.ball.pos).toEqual({ x: 20, y: 54 })
    expect(r.state.ball.vel).toEqual({ x: 0, y: 0 })
  })

  it('an own goal counts for the opponent', () => {
    const r = step(shot(playing(), 1, 107.5, 60), {}, siege)
    expect(r.events).toContainEqual({ type: 'goal', scorer: 2, at: expect.anything() })
    expect(r.state.possession).toMatchObject({ shooter: 1, inHand: true })
  })

  it('shots never end anything: no shot cap, no round-ended, no build', () => {
    let s = playing()
    for (let i = 0; i < siege.shotCap + 5; i++) {
      s = { ...s, possession: { ...s.possession, shooter: 1, shots: siege.shots, inHand: false, live: false }, ball: { ...s.ball, pos: { x: 20, y: 80 }, vel: { x: 0, y: 0 } } }
      s = step(s, { blast: { player: 1, origin: { x: 20, y: 85 }, power: 0.2 } }, siege).state
      for (let t = 0; t < 2000 && s.possession.live; t++) {
        const r = step(s, {}, siege)
        expect(r.events.some((e) => e.type === 'round-ended')).toBe(false)
        s = r.state
      }
      expect(s.match.builder).toBeNull()
    }
    expect(s.match.winner).toBeNull()
  })
})

describe('Siege defence turn: Repair', () => {
  const wall = (owner: 1 | 2, id: number, hp: number, gx: number): Structure => ({ kind: 'wall', owner, shape: 'straight', rotation: 0, at: { gx, gy: owner === 1 ? 40 : 10 }, id, hp })
  /** Player 1 has just scored: the sim waits on their choice. */
  const scored = (): SimState => {
    const s = playing()
    const base = { ...s, objects: [wall(1, 1, 1, 2), wall(1, 2, 3, 10), wall(2, 3, 1, 2)], nextId: 4 }
    const before = shot(base, 1, 0.5, -60)
    return step({ ...before, possession: { ...before.possession, shots: 1 } }, {}, siege).state
  }
  const repair = (player: 1 | 2) => ({ defence: { player, choice: 'repair' as const } })

  it('waits for the scorer: blasts and ball placement are refused, and the clock does not run', () => {
    let s = scored()
    expect(s.match).toMatchObject({ choosing: 1 })
    for (const input of [{ blast: { player: 2 as const, origin: { x: 20, y: 70 }, power: 0.3 } }, { placeBall: { player: 2 as const, at: { x: 20, y: 80 } } }]) {
      const r = step(s, input, siege)
      expect(r.events).toContainEqual({ type: 'refused' })
      expect(r.state.possession.inHand).toBe(true)
    }
    for (let i = 0; i < siege.shotClock * siege.tickHz + 5; i++) s = step(s, {}, siege).state
    expect(s.match).toMatchObject({ choosing: 1 })
    expect(s.possession).toMatchObject({ shooter: 2, inHand: true, shots: siege.shots })
  })

  it("Repair restores the scorer's surviving structures to full HP and emits one repaired event each", () => {
    const r = step(scored(), repair(1), siege)
    expect(r.state.objects.map((o) => [o.id, o.hp])).toEqual([[1, 3], [2, 3], [3, 1]])
    expect(r.events.filter((e) => e.type === 'repaired')).toEqual([{ type: 'repaired', id: 1 }, { type: 'repaired', id: 2 }])
  })

  it('does not bring destroyed structures back', () => {
    const s = scored()
    const r = step({ ...s, objects: s.objects.filter((o) => o.id !== 1) }, repair(1), siege)
    expect(r.state.objects.map((o) => o.id)).toEqual([2, 3])
  })

  it('then the conceder has ball-in-hand at center with a fresh counter, and play goes on', () => {
    let s = step(scored(), repair(1), siege).state
    expect(s.match).toMatchObject({ choosing: null, builder: null })
    expect(s.possession).toEqual({ shooter: 2, shots: siege.shots, inHand: true, live: false })
    expect(s.ball.pos).toEqual({ x: 20, y: 54 })
    s = step(s, { placeBall: { player: 2, at: { x: 20, y: 30 } } }, siege).state
    expect(s.possession.inHand).toBe(false)
  })

  it('refuses a choice from the conceder, or outside the window', () => {
    const conceder = step(scored(), repair(2), siege)
    expect(conceder.events).toEqual([{ type: 'refused' }])
    expect(conceder.state.match).toMatchObject({ choosing: 1 })
    expect(step(playing(), repair(1), siege).events).toContainEqual({ type: 'refused' })
    const again = step(step(scored(), repair(1), siege).state, repair(1), siege)
    expect(again.events).toContainEqual({ type: 'refused' })
  })

  it("an own goal offers the choice to the shooter's opponent", () => {
    const s = step(shot(playing(), 1, 107.5, 60), {}, siege).state
    expect(s.match).toMatchObject({ choosing: 2 })
    expect(step(s, repair(1), siege).events).toContainEqual({ type: 'refused' })
    const r = step(s, repair(2), siege)
    expect(r.state.possession).toMatchObject({ shooter: 1, inHand: true })
  })
})
