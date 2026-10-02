import { describe, expect, it } from 'vitest'
import { lockstep, type Frame } from './lockstep'
import { canBlastFrom } from '../sim/blast'
import { canPlaceBall } from '../sim/possession'
import { defaultConfig, initialState, step, type SimConfig, type SimInput, type SimState } from '../sim/step'
import type { PlayerId } from '../sim/pitch'

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
function match(seed: number, lag: number, ticks: number) {
  const inbox: { f: Frame; at: number }[][] = [[], []]
  let now = 0
  const peers = [1, 2].map((me, i) => lockstep((f) => inbox[1 - i].push({ f, at: now + lag }), me as PlayerId, DELAY))
  const states = [initialState(seed, config), initialState(seed, config)]
  while (states[0].tick < ticks && now < ticks * 20) {
    now++
    peers.forEach((net, i) => {
      for (const m of inbox[i].filter((m) => m.at <= now)) net.receive(m.f)
      inbox[i] = inbox[i].filter((m) => m.at > now)
      net.submit(bot(states[i], (i + 1) as PlayerId))
      const input = net.advance()
      if (input) states[i] = step(states[i], input, config).state
    })
  }
  return states
}

describe('lockstep', () => {
  it('stalls until the remote frame for the tick has arrived', () => {
    const a = lockstep(() => {}, 1, DELAY)
    for (let i = 0; i < DELAY; i++) expect(a.advance()).toEqual({})
    expect(a.advance()).toBeUndefined()
    a.receive({ t: DELAY })
    expect(a.advance()).toEqual({})
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
      seen[0].push(a.advance())
      seen[1].push(b.advance())
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
      expect(a.match.roundShots).toBeGreaterThan(0)
    }
  })

  it('latency does not change the outcome', () => {
    expect(match(5, 0, 600)[0]).toEqual(match(5, 9, 600)[0])
  })
})
