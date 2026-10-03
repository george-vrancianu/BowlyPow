import { describe, expect, it } from 'vitest'
import { lockstep, type Frame } from './lockstep'
import { canBlastFrom } from '../sim/blast'
import { canPlaceBall } from '../sim/possession'
import { defaultConfig, initialState, step, type SimConfig, type SimInput, type SimState } from '../sim/step'
import type { PlayerId } from '../sim/pitch'
import { roundsMatch } from '../sim/testkit'

const config: SimConfig = { ...defaultConfig, buildTime: 1 }
const DELAY = 4

/** A deterministic player: acts every 20th tick, from its own view of the state. */
function bot(s: SimState, me: PlayerId): SimInput {
  if (s.tick % 20) return {}
  if (s.match.builder === me) return { done: me }
  const { possession: p, ball } = s
  if (p.shooter !== me || s.match.builder || p.live) return {}
  if (p.inHand) {
    const at = { x: 20, y: me === 1 ? 80 : 28 }
    return canPlaceBall(me, at, s.objects, config) ? { placeBall: { player: me, at } } : {}
  }
  const origin = { x: ball.pos.x, y: ball.pos.y + (me === 1 ? 4 : -4) }
  return canBlastFrom(me, origin, s, config) ? { blast: { player: me, origin, power: 0.8 } } : {}
}

/** Two peers over a link where each frame arrives `lag` rounds late; a peer missing a frame stalls. */
function match(seed: number, lag: number, ticks: number, play: (s: SimState, me: PlayerId) => SimInput = bot, cfg: SimConfig = config, start: (seed: number) => SimState = (seed) => initialState(seed, cfg)) {
  let frames = 0
  const blasts: unknown[] = []
  const inbox: { f: Frame; at: number }[][] = [[], []]
  let now = 0
  const peers = [1, 2].map((me, i) => lockstep((f) => (frames++, inbox[1 - i].push({ f, at: now + lag })), me as PlayerId, DELAY))
  const states = [start(seed), start(seed)]
  while (states.some((s) => s.tick < ticks) && now < ticks * 20) {
    now++
    peers.forEach((net, i) => {
      for (const m of inbox[i].filter((m) => m.at <= now)) net.receive(m.f)
      inbox[i] = inbox[i].filter((m) => m.at > now)
      if (states[i].tick >= ticks) return
      net.submit(play(states[i], (i + 1) as PlayerId))
      const input = net.advance(states[i].possession.shooter)
      if (input) {
        const r = step(states[i], input, cfg)
        states[i] = r.state
        if (i === 0) blasts.push(...r.events.filter((e) => e.type === 'blast-fired'))
      }
    })
  }
  return Object.assign(states, { frames, blasts })
}

describe('lockstep', () => {
  it('stalls until the remote frame for the tick has arrived', () => {
    const a = lockstep(() => {}, 1, DELAY)
    for (let i = 0; i < DELAY; i++) expect(a.advance(1)).toEqual({})
    expect(a.advance(1)).toBeUndefined()
    a.receive({ t: DELAY })
    expect(a.advance(1)).toEqual({})
  })

  it('applies an input on the same tick on both sides, merged by player id', () => {
    const out: Frame[][] = [[], []]
    const a = lockstep((f) => out[0].push(f), 1, DELAY)
    const b = lockstep((f) => out[1].push(f), 2, DELAY)
    const placeBall = { player: 2 as const, at: { x: 1, y: 2 } }
    a.submit({ done: 1 })
    b.submit({ placeBall })
    const seen: (SimInput | undefined)[][] = [[], []]
    for (let t = 0; t <= DELAY; t++) {
      for (const f of out[0].splice(0)) b.receive(f)
      for (const f of out[1].splice(0)) a.receive(f)
      seen[0].push(a.advance(1))
      seen[1].push(b.advance(1))
    }
    expect(seen[0]).toEqual(seen[1])
    expect(seen[0][DELAY]).toEqual({ done: 1, placeBall })
  })

  it('same seed and inputs give identical states on both peers, at any latency', () => {
    for (const lag of [0, 3, 11]) {
      const [a, b] = match(5, lag, 900)
      expect(a).toEqual(b)
      expect(a.tick).toBeGreaterThanOrEqual(900)
      expect(a.match.builder).toBeNull()
      expect(roundsMatch(a).roundShots).toBeGreaterThan(0)
    }
  })

  it('sends a frame per input or promise, not one per tick', () => {
    const idle = match(5, 0, 600, () => ({}))
    expect(idle.frames).toBeLessThan(600 / 2)
  })

  it('auto-fires a charging blast on shot-clock expiry at its current power, on both peers', () => {
    // Once the build turns are over, the shooter holds a charge at power 0.6 and never releases.
    const hold = (s: SimState, me: PlayerId): SimInput => {
      if (s.match.builder === me) return { done: me }
      const { possession: p, ball } = s
      if (p.shooter !== me || s.match.builder || p.live) return {}
      if (p.inHand) return s.tick % 20 === 0 ? { placeBall: { player: me, at: { x: 20, y: me === 1 ? 80 : 28 } } } : {}
      return s.tick % 20 === 0 ? { charging: { origin: { x: ball.pos.x, y: ball.pos.y + (me === 1 ? 4 : -4) }, power: 0.6 } } : {}
    }
    const peers = match(5, 3, 1500, hold)
    expect(peers[0]).toEqual(peers[1])
    expect(peers.blasts).toContainEqual(expect.objectContaining({ type: 'blast-fired', power: 0.6 }))
  })

  describe('Siege defence choice under the build timer', () => {
    const siege: SimConfig = { ...config, mode: 'siege' }
    const wall = (id: number, owner: PlayerId, gx: number) => ({ id, kind: 'wall' as const, owner, shape: 'straight' as const, rotation: 0 as const, at: { gx, gy: owner === 1 ? 40 : 10 }, hp: 1 })
    /** Player 1's ball is about to cross into player 2's goal. */
    const scoring = (seed: number): SimState => {
      const s = initialState(seed, siege)
      return { ...s, match: { ...s.match, builder: null, opening: false } as SimState['match'], objects: [wall(1, 1, 2), wall(2, 2, 2)], nextId: 3, ball: { ...s.ball, pos: { x: 20, y: 0.5 }, vel: { x: 0, y: -60 } }, possession: { shooter: 1, shots: 1, inHand: false, live: true } }
    }
    it('an unanswered choice times out to Repair identically on both peers, at any latency', () => {
      for (const lag of [0, 3, 11]) {
        const [a, b] = match(5, lag, 400, () => ({}), siege, scoring)
        expect(a).toEqual(b)
        expect(a.match).toMatchObject({ choosing: null, builder: null })
        expect(a.objects.map((o) => o.hp)).toEqual([3, 1])
      }
    })
    it('a late Rearrange choice from the scorer lands on the same tick for both peers and its window then expires', () => {
      const late = (s: SimState, me: PlayerId): SimInput => (me === 1 && s.match.choosing === 1 && s.clock.left < 600 ? { defence: { player: 1, choice: 'rearrange' } } : {})
      const [a, b] = match(5, 3, 700, late, siege, scoring)
      expect(a).toEqual(b)
      expect(a.match).toMatchObject({ choosing: null, builder: null })
      expect(a.objects.map((o) => o.hp)).toEqual([1, 1])
    })
  })

  it('latency does not change the outcome', () => {
    expect(match(5, 0, 600)[0]).toEqual(match(5, 9, 600)[0])
  })
})
