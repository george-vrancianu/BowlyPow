import { describe, expect, it } from 'vitest'
import { advance, angle, blocking, dismiss, goalBall, newTransition, overlayView, type Frame, type Transition } from './transition'

const base: Frame = { active: 1, round: 1, inHand: true, phase: 'Play', events: [], now: 0, reduced: false }
const go = (t: Transition, o: Partial<Frame>) => advance(t, { ...base, ...o })
/** A started match whose opening turn overlay has been dismissed. */
const open = () => dismiss(go(go(newTransition(1), {}), { now: 1000 }), 1000)

describe('handover', () => {
  it('opens with a turn overlay for the starting player, blocking the sim', () => {
    const t = go(newTransition(2), { active: 2 })
    expect(overlayView(t, 0)?.text).toBe("Player 2's turn")
    expect(blocking(t)).toBe(true)
    expect(angle(t, 0)).toBe(180)
  })
  it('flips 180 degrees over 400 ms on a possession change, overlay fading in the second half', () => {
    let t = open()
    t = go(t, { now: 2000, active: 2 })
    expect(angle(t, 2000)).toBe(0)
    expect(angle(t, 2200)).toBeCloseTo(90)
    expect(angle(t, 2400)).toBe(180)
    expect(overlayView(t, 2100)!.opacity).toBe(0)
    expect(overlayView(t, 2300)!.opacity).toBeCloseTo(0.5)
    t = go(t, { now: 2400, active: 2 })
    expect(t.shown).toBe(2)
  })
  it('cuts instantly under reduced motion', () => {
    let t = open()
    t = go(t, { now: 2000, active: 2, reduced: true })
    expect(angle(t, 2000)).toBe(180)
    expect(overlayView(t, 2000)!.opacity).toBe(1)
  })
  it('only dismisses by tap after 1 s', () => {
    const t = go(go(newTransition(1), {}), { now: 500 })
    expect(dismiss(t, 999).overlay).toBeDefined()
    expect(dismiss(t, 1000).overlay).toBeUndefined()
    expect(blocking(dismiss(t, 1000))).toBe(false)
  })
  it('carries hints in round 1 only', () => {
    expect(overlayView(go(newTransition(1), { inHand: true }), 0)!.hint).toMatch(/ball/i)
    expect(overlayView(go(newTransition(1), { inHand: false }), 0)!.hint).toMatch(/charge/i)
    expect(overlayView(go(newTransition(1), { round: 2 }), 0)!.hint).toBeUndefined()
  })
})

describe('goal', () => {
  const scored = (now: number) =>
    go(open(), {
      now,
      active: 2,
      events: [
        { type: 'goal', scorer: 1, at: { x: 20, y: 110 } },
        { type: 'round-ended', round: 1, scorer: 1 },
      ],
    })
  it('holds 1.5 s with a banner and the ball in the net, then hands over', () => {
    let t = scored(5000)
    expect(overlayView(t, 5000)!.text).toBe('GOAL')
    expect(goalBall(t)).toEqual({ x: 20, y: 110 })
    expect(blocking(t)).toBe(true)
    t = go(t, { now: 6499, active: 2 })
    expect(overlayView(t, 6499)!.text).toBe('GOAL')
    t = go(t, { now: 6500, active: 2 })
    expect(overlayView(t, 6500)!.text).toBe("Player 2's turn")
    expect(goalBall(t)).toBeUndefined()
    expect(angle(t, 6700)).toBeCloseTo(90)
  })
})

describe('phase sweep', () => {
  it('sweeps a label for 1 s at a phase change without blocking', () => {
    let t = open()
    t = go(t, { now: 2000, phase: 'Build' })
    expect(overlayView(t, 2500)).toMatchObject({ text: 'BUILD', progress: 0.5 })
    expect(blocking(t)).toBe(false)
    t = go(t, { now: 3000, phase: 'Build' })
    expect(t.overlay).toBeUndefined()
  })
})

describe('repaired sweep', () => {
  it('sweeps REPAIRED once without blocking, however many structures were repaired', () => {
    const t = go(open(), { now: 2000, events: [{ type: 'repaired', id: 1 }, { type: 'repaired', id: 2 }] })
    expect(overlayView(t, 2500)).toMatchObject({ kind: 'sweep', text: 'REPAIRED', progress: 0.5 })
    expect(blocking(t)).toBe(false)
    expect(go(t, { now: 3000 }).overlay).toBeUndefined()
  })
})

describe('repaired sweep in hot-seat', () => {
  it('holds the handover until the sweep ends, even when the active player changes in the same frame', () => {
    let t = go(open(), { now: 2000, active: 2, events: [{ type: 'repaired', id: 1 }] })
    expect(overlayView(t, 2500)).toMatchObject({ kind: 'sweep', text: 'REPAIRED' })
    expect(t.flip).toBeUndefined()
    t = go(t, { now: 2600, active: 2 })
    expect(overlayView(t, 2600)?.text).toBe('REPAIRED')
    t = go(t, { now: 3000, active: 2 })
    expect(t.flip).toBeDefined()
    expect(overlayView(t, 3000)?.text).toBe("Player 2's turn")
  })
})

describe('online (no handover)', () => {
  const online = (t: Transition, o: Partial<Frame>) => go(t, { active: 2, handover: false, ...o })
  it('never flips or opens a turn card, and the screen stays with the local player', () => {
    let t = online(newTransition(2), {})
    expect(t.overlay).toBeUndefined()
    expect(blocking(t)).toBe(false)
    t = online(t, { now: 100, events: [{ type: 'round-ended', round: 1, scorer: 1 }] })
    expect(t.flip).toBeUndefined()
    expect(angle(t, 100)).toBe(180)
  })
  it('still holds on a goal and sweeps on a phase change', () => {
    let t = online(newTransition(2), { phase: 'Play' })
    t = online(t, { now: 10, phase: 'Build', events: [{ type: 'goal', scorer: 1, at: { x: 20, y: 0 } }] })
    expect(blocking(t)).toBe(true)
    t = online(t, { now: 1600, phase: 'Build' })
    expect(blocking(t)).toBe(false)
    expect(overlayView(t, 1600)?.text).toBe('BUILD')
  })
})
