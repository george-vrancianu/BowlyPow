import { describe, expect, it } from 'vitest'
import { follow, layout, MAP_Y, viewOf, viewOutline } from './camera'

describe('layout', () => {
  it('phone portrait: 40 units across, height capped at 64, letterboxed when taller', () => {
    const l = layout({ width: 400, height: 1200 })
    expect(l.scale).toBe(10)
    expect(l.visibleHeight).toBe(64)
    expect(l.pane).toEqual({ x: 0, y: 280, w: 400, h: 640 })
  })
  it('3:4 tablet portrait gets side bands, still 40 x 64 units', () => {
    const l = layout({ width: 600, height: 800 })
    expect(l.scale).toBe(12.5)
    expect(l.pane).toEqual({ x: 50, y: 0, w: 500, h: 800 })
  })
  it('wide screen gets a 10:16 pane with side bands', () => {
    const l = layout({ width: 1600, height: 800 })
    expect(l.scale).toBe(12.5)
    expect(l.pane).toEqual({ x: 550, y: 0, w: 500, h: 800 })
  })
})

describe('follow', () => {
  it('moves about 63% of the way in 150 ms and settles at rest', () => {
    const t = { y: 40 }
    follow(t, 70, 0.15, 64)
    expect(t.y).toBeCloseTo(40 + 30 * 0.632, 1)
    for (let i = 0; i < 100; i++) follow(t, 70, 1 / 60, 64)
    expect(t.y).toBeCloseTo(70, 0)
  })
  it('never shows beyond the boards', () => {
    const t = { y: 50 }
    follow(t, -500, 10, 64)
    expect(t.y).toBe(31)
    follow(t, 900, 10, 64)
    expect(t.y).toBe(77)
  })
})

describe('map camera', () => {
  const canvas = { width: 400, height: 1200 }
  it('fit keeps the aspect ratio and shows the whole pitch', () => {
    const v = viewOf(canvas, { y: MAP_Y, map: { stretch: false } })
    expect(v.sx).toBe(v.sy)
    expect(v.sx).toBe(10)
    expect(v.pane.w).toBe(400)
    expect(v.pane.h).toBeCloseTo(v.visibleHeight * 10)
  })
  it('stretch fills the canvas with different scales per axis', () => {
    const v = viewOf(canvas, { y: MAP_Y, map: { stretch: true } })
    expect(v.pane).toEqual({ x: 0, y: 0, w: 400, h: 1200 })
    expect(v.sy).toBeCloseTo(1200 / v.visibleHeight)
  })
  it('outlines the game view: full width, 64 units tall, positioned by camera y', () => {
    const map = { y: MAP_Y, map: { stretch: false } }
    const o = viewOutline(canvas, map, { y: MAP_Y })
    expect(o.w).toBe(400)
    expect(o.h).toBe(640)
    expect(o.y + o.h / 2).toBeCloseTo(600)
    expect(viewOutline(canvas, map, { y: MAP_Y + 10 }).y - o.y).toBeCloseTo(100)
  })
})
