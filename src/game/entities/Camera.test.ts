import { describe, expect, it } from 'vitest'
import { Camera, clampY, fogOf, layout, viewOf, viewOutline } from './Camera'
import { rules } from '../../config/rules'

describe('manual pan', () => {
  it('moves the view and holds it until recentered', () => {
    const cam = new Camera(54)
    cam.pan(-10)
    expect([cam.y, cam.held]).toEqual([44, true])
    cam.recenter()
    expect(cam.held).toBe(false)
  })
  it('stays inside the boards', () => {
    const cam = new Camera(54)
    cam.pan(1000)
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
    const t = new Camera(40)
    t.follow(70, 0.15)
    expect(t.y).toBeCloseTo(40 + 30 * 0.632, 1)
    for (let i = 0; i < 100; i++) t.follow(70, 1 / 60)
    expect(t.y).toBeCloseTo(70, 0)
  })
  it('never shows beyond the boards', () => {
    const t = new Camera(50)
    t.follow(-500, 10)
    expect(t.y).toBe(31)
    t.follow(900, 10)
    expect(t.y).toBe(77)
  })
})

describe('shake', () => {
  it('never exceeds its amplitude and is gone after 200 ms', () => {
    const cam = new Camera(54)
    cam.shake(4)
    for (let i = 0; i < 28; i++) {
      cam.update(0.007)
      expect(Math.abs(cam.shakeNow.x)).toBeLessThanOrEqual(4)
      expect(Math.abs(cam.shakeNow.y)).toBeLessThanOrEqual(4)
    }
    cam.update(0.01)
    expect(cam.shakeNow).toEqual({ x: 0, y: 0 })
  })
  it('decays linearly: 5% of the amplitude is left at 190 ms', () => {
    const cam = new Camera(54)
    cam.shake(4)
    cam.update(0.19)
    expect(Math.abs(cam.shakeNow.x)).toBeLessThanOrEqual(0.2 + 1e-9)
    expect(Math.abs(cam.shakeNow.y)).toBeLessThanOrEqual(0.2 + 1e-9)
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
  it('converts canvas pixels back to world units', () => {
    const cam = new Camera(54)
    expect(cam.toWorld(canvas, 200, 600)).toEqual({ x: 20, y: 54 })
  })
  it('converts world units to canvas pixels', () => {
    const cam = new Camera(54)
    expect(cam.toCanvas(canvas, { x: 20, y: 54 })).toEqual({ x: 200, y: 600 })
    expect(cam.toCanvas(canvas, { x: 30, y: 64 })).toEqual({ x: 300, y: 700 })
  })
})

describe('blind build', () => {
  it('pan stays on the bottom viewer\'s half: the view bottom rests on the far board', () => {
    const cam = new Camera(77)
    cam.blind = 1
    cam.pan(-1000)
    expect(cam.y).toBe(77)
    cam.pan(1000)
    expect(cam.y).toBe(77)
  })
  it('pan stays on the top viewer\'s half: the view top rests on the far board', () => {
    const cam = new Camera(31)
    cam.blind = 2
    cam.pan(1000)
    expect(cam.y).toBe(31)
    cam.pan(-1000)
    expect(cam.y).toBe(31)
  })
  it('a view shorter than the half can move within it, never past the halfway line', () => {
    expect(clampY(0, 20, 1) - 10).toBe(54)
    expect(clampY(1000, 20, 1) + 10).toBe(109)
  })
  it('follow is clamped the same way', () => {
    const cam = new Camera(77)
    cam.blind = 1
    cam.follow(0, 10)
    expect(cam.y).toBe(77)
  })
  it('fogs the opponent\'s half up to the halfway line, boards and net included', () => {
    expect(fogOf(1)).toEqual({ top: -4, bottom: 54 })
    expect(fogOf(2)).toEqual({ top: 54, bottom: 112 })
  })
})

describe('reset', () => {
  it('ends a shake, the hold and the blind clamp', () => {
    const cam = new Camera(54)
    cam.shake(4)
    cam.pan(1)
    cam.blind = 1
    cam.reset()
    expect([cam.shakeNow, cam.held, cam.blind]).toEqual([{ x: 0, y: 0 }, false, undefined])
  })
})
