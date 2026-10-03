import { describe, expect, it } from 'vitest'
import { aimMove, aimOf, aimPress, aimRelease, aimSecondFinger, aimViewOf } from './gesture'

const p = (x = 0, y = 0) => ({ x, y })
// A small ball at (100, 300) on screen; Touch is the tier a press starts in.
const press = (at = p(100, 300), over: { ballRadiusPx?: number; canShoot?: boolean } = {}) => aimPress({ at, now: 0, ball: p(100, 300), ballRadiusPx: 4, canShoot: true, ...over })

describe('aim gesture press', () => {
  it('pans when the press is off the ball', () => {
    expect(press(p(100, 400)).phase).toBe('pan')
  })
  it('counts a press within 28 px of a small ball', () => {
    expect([press(p(127, 300)).phase, press(p(129, 300)).phase]).toEqual(['holding', 'pan'])
  })
  it('counts a press anywhere on a ball drawn bigger than 28 px', () => {
    expect([press(p(100, 339), { ballRadiusPx: 40 }).phase, press(p(100, 341), { ballRadiusPx: 40 }).phase]).toEqual(['holding', 'pan'])
  })
  it('pans when the player cannot shoot, even on the ball', () => {
    expect(press(p(100, 300), { canShoot: false }).phase).toBe('pan')
  })
})

// Touch: radius 220 px, power [0.15, 0.5], slop 8 px, eased (quadratic) direct curve.
const dragTo = (x: number, y: number) => aimMove(press(), p(x, y), 100)

describe('aim gesture drag', () => {
  it('aims opposite the drag', () => {
    const { dir } = aimOf(dragTo(100 + 60, 300 + 80))!
    expect(dir.x).toBeCloseTo(-0.6)
    expect(dir.y).toBeCloseTo(-0.8)
  })
  it('starts at the bottom of the tier\'s range just past the slop', () => {
    expect(aimOf(dragTo(100, 308.001))!.power).toBeCloseTo(0.15)
  })
  it('reaches the top of the range at the control radius', () => {
    expect(aimOf(dragTo(100, 300 + 220))!.power).toBeCloseTo(0.5)
  })
  it('eases in between: halfway along the drag is a quarter of the way up the range', () => {
    expect(aimOf(dragTo(100, 300 + 8 + 106))!.power).toBeCloseTo(0.2375)
  })
  it('keeps steering at the edge power past the control radius', () => {
    const aim = aimOf(dragTo(100 - 600, 300))!
    expect(aim.power).toBeCloseTo(0.5)
    expect(aim.dir).toEqual({ x: 1, y: 0 })
  })
  it('is a Touch aim', () => {
    expect(aimOf(dragTo(100, 400))!.tier).toBe(0)
  })
  it('has no aim within the slop', () => {
    expect(aimOf(dragTo(105, 305))).toBeNull()
  })
})

describe('aim gesture release', () => {
  it('fires the aim held at release', () => {
    const r = aimRelease(dragTo(100, 520))
    expect(r.type).toBe('shot')
    expect(r.type === 'shot' && r.aim.dir).toEqual({ x: 0, y: -1 })
  })
  it('cancels a release without having dragged', () => {
    expect(aimRelease(aimMove(press(), p(103, 304), 100)).type).toBe('cancelled')
  })
  it('cancels a release after dragging back within the slop', () => {
    expect(aimRelease(aimMove(dragTo(100, 450), p(102, 302), 200)).type).toBe('cancelled')
  })
  it('a pan stays a pan', () => {
    expect(aimRelease(aimMove(press(p(0, 0)), p(200, 200), 100)).type).toBe('pan')
  })
})

describe('aim gesture view', () => {
  it('shows nothing for a pan', () => {
    expect(aimViewOf(press(p(0, 0)))).toBeUndefined()
  })
  it('shows the Touch control radius and no direction before the drag', () => {
    expect(aimViewOf(press())).toEqual({ phase: 'holding', tier: 0, radiusPx: 220, ghost: { until: { contacts: 1 }, scale: 1 } })
  })
  it('shows the aim once dragging', () => {
    const v = aimViewOf(dragTo(100, 520))
    expect(v).toMatchObject({ phase: 'aiming', tier: 0, radiusPx: 220, dir: { x: 0, y: -1 } })
    expect(v?.power).toBeCloseTo(0.5)
  })
})

describe('aim gesture second finger', () => {
  it('abandons the aim and pans', () => {
    const g = aimSecondFinger(dragTo(100, 450))
    expect([g.phase, aimOf(g), aimRelease(g).type]).toEqual(['pan', null, 'pan'])
  })
})
