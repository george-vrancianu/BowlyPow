import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings } from '../sim/settings'
import { Game, type HudView } from './Game'

// No DOM in the test run: a canvas that is an EventTarget, a window that is one, a context that swallows every call.
class FakeCanvas extends EventTarget {
  width = 400
  height = 640
  clientWidth = 400
  clientHeight = 640
  setPointerCapture() {}
  getContext() {
    const ctx: unknown = new Proxy({ canvas: this }, { get: (t, k) => (k in t ? (t as never)[k] : () => ({ addColorStop() {} })), set: () => true })
    return ctx
  }
}

let frames: Map<number, (t: number) => void>
let nextId: number
let win: EventTarget
beforeEach(() => {
  frames = new Map()
  nextId = 1
  win = new EventTarget()
  vi.stubGlobal('addEventListener', win.addEventListener.bind(win))
  vi.stubGlobal('requestAnimationFrame', (f: (t: number) => void) => (frames.set(nextId, f), nextId++))
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
  vi.stubGlobal('window', { devicePixelRatio: 1 })
})
afterEach(() => vi.unstubAllGlobals())

const frame = (t: number) => {
  const [id, f] = [...frames][0]
  frames.delete(id)
  f(t)
}
const make = (onView?: (v: HudView) => void) => new Game(new FakeCanvas() as unknown as HTMLCanvasElement, onView)
const press = (key: string) => win.dispatchEvent(Object.assign(new Event('keydown'), { key, code: key }))

describe('Game', () => {
  it('calls onView only when the view changes', () => {
    const onView = vi.fn()
    make(onView)
    const t = performance.now()
    frame(t)
    frame(t)
    frame(t)
    expect(onView).toHaveBeenCalledTimes(1)
    press('m')
    frame(t)
    expect(onView).toHaveBeenCalledTimes(2)
    expect(onView.mock.lastCall![0].mapOpen).toBe(true)
  })

  it('destroy stops the loop and removes every listener', () => {
    const onView = vi.fn()
    const game = make(onView)
    frame(performance.now())
    expect(frames.size).toBe(1)
    game.destroy()
    expect(frames.size).toBe(0)
    onView.mockClear()
    press('m')
    game.actions.recenter()
    expect(game['mapOpen']).toBe(false)
    expect(onView).not.toHaveBeenCalled()
  })

  it('opens and closes the map through its actions', () => {
    const onView = vi.fn()
    const game = make(onView)
    const t = performance.now()
    frame(t)
    game.actions.map(true)
    frame(t)
    expect(onView.mock.lastCall![0].mapOpen).toBe(true)
    game.actions.map(false)
    frame(t)
    expect(onView.mock.lastCall![0].mapOpen).toBe(false)
  })

  it('ticks the entity clocks before the sim, and flags the entities before drawing, so effects keep their first frame', () => {
    const game = make()
    const order: string[] = []
    const spy = <T extends object>(o: T, k: keyof T, tag: string) => {
      const orig = (o[k] as (...a: unknown[]) => unknown).bind(o)
      ;(o[k] as unknown) = (...a: unknown[]) => (order.push(tag), orig(...a))
    }
    spy(game.camera, 'update', 'camera.update')
    spy(game['driver'], 'update', 'driver.update')
    spy(game.structures, 'mark', 'mark')
    spy(game.camera, 'draw', 'draw')
    frame(performance.now())
    expect(order).toEqual(['camera.update', 'driver.update', 'mark', 'draw'])
  })

  it('draws the open map with the main camera\'s shake', () => {
    const game = make()
    const t = performance.now()
    frame(t)
    game.actions.map(true)
    const draw = vi.spyOn(game.mapCam, 'draw')
    game.camera.shake(4)
    frame(t + 16)
    expect(draw.mock.lastCall![2]).toEqual(game.camera.shakeNow)
  })

  it('a Siege opening build is blind: the camera clamps to the builder\'s half and the fog hides the other', () => {
    const game = make()
    game.actions.start({ ...defaultSettings, mode: 'siege' })
    const builder = game.state.match.builder!
    expect([game.camera.blind, game.fog.blind]).toEqual([builder, builder])
    game.actions.start({ ...defaultSettings, mode: 'rounds' })
    expect(game.fog.blind).toBeUndefined()
  })

  it('a new match forgets the last one\'s visual state', () => {
    const game = make()
    game.camera.shake(4)
    game.structures.burst({ x: 0, y: 0 }, 'red', 3)
    game.actions.rematch()
    expect(game.camera.shakeNow).toEqual({ x: 0, y: 0 })
  })
})
