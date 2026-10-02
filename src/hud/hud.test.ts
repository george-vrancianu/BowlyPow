import { describe, expect, it } from 'vitest'
import { bands } from './hud'

describe('bands', () => {
  it('puts bands above and below on a tall screen, the active one at the bottom', () => {
    const b = bands({ width: 400, height: 800 })
    expect(b.wide).toBe(false)
    expect(b.far.y).toBe(0)
    expect(b.near.y).toBeGreaterThan(b.far.y)
    expect(b.near.w).toBe(400)
  })
  it('moves to the side bands on a wide screen', () => {
    const b = bands({ width: 1200, height: 640 })
    expect(b.wide).toBe(true)
    expect(b.far.x).toBe(0)
    expect(b.near.x).toBeGreaterThan(b.far.x)
    expect(b.near.h).toBe(640)
  })
})
