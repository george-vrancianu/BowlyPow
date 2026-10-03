import { describe, expect, it } from 'vitest'
import { follow, fogOf, layout, pan, recenter, viewOf, viewOutline } from './camera'
import { rules } from '../config/rules'


describe('manual pan', () => {
  it('moves the view and holds it until recentered', () => {
    const cam = { y: 54, held: false }
    pan(cam, -10, 64)
    expect(cam).toEqual({ y: 44, held: true })
    recenter(cam)
    expect(cam.held).toBe(false)
  })
  it('stays inside the boards', () => {
    const cam = { y: 54, held: false }
    pan(cam, 1000, 64)
    expect(cam.y).toBe(77)
  })
})

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
    const v = viewOf(canvas, { y: rules.mapY, map: { stretch: false } })
    expect(v.sx).toBe(v.sy)
    expect(v.sx).toBe(10)
    expect(v.pane.w).toBe(400)
    expect(v.pane.h).toBeCloseTo(v.visibleHeight * 10)
  })
  it('stretch fills the canvas with different scales per axis', () => {
    const v = viewOf(canvas, { y: rules.mapY, map: { stretch: true } })
    expect(v.pane).toEqual({ x: 0, y: 0, w: 400, h: 1200 })
    expect(v.sy).toBeCloseTo(1200 / v.visibleHeight)
  })
  it('outlines the game view: full width, 64 units tall, positioned by camera y', () => {
    const map = { y: rules.mapY, map: { stretch: false } }
    const o = viewOutline(canvas, map, { y: rules.mapY })
    expect(o.w).toBe(400)
    expect(o.h).toBe(640)
    expect(o.y + o.h / 2).toBeCloseTo(600)
    expect(viewOutline(canvas, map, { y: rules.mapY + 10 }).y - o.y).toBeCloseTo(100)
  })
})

describe('blind build', () => {
  it('pan stays on the bottom viewer\'s half: the view bottom rests on the far board', () => {
    const cam = { y: 77 }
    pan(cam, -1000, 64, 1)
    expect(cam.y).toBe(77)
    pan(cam, 1000, 64, 1)
    expect(cam.y).toBe(77)
  })
  it('pan stays on the top viewer\'s half: the view top rests on the far board', () => {
    const cam = { y: 31 }
    pan(cam, 1000, 64, 2)
    expect(cam.y).toBe(31)
    pan(cam, -1000, 64, 2)
    expect(cam.y).toBe(31)
  })
  it('a view shorter than the half can move within it, never past the halfway line', () => {
    const cam = { y: 80 }
    pan(cam, -1000, 20, 1)
    expect(cam.y - 10).toBe(54)
    pan(cam, 1000, 20, 1)
    expect(cam.y + 10).toBe(109)
  })
  it('follow is clamped the same way', () => {
    const cam = { y: 77 }
    follow(cam, 0, 10, 64, 1)
    expect(cam.y).toBe(77)
  })
  it('fogs the opponent\'s half up to the halfway line, boards and net included', () => {
    expect(fogOf(1)).toEqual({ top: -4, bottom: 54 })
    expect(fogOf(2)).toEqual({ top: 54, bottom: 112 })
  })
})
