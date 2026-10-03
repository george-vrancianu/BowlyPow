import { describe, expect, it } from 'vitest'
import { rules } from '../../config/rules'
import { Camera, fogOf } from './Camera'
import { Fog, fogEdges } from './Fog'

const canvas = { width: 400, height: 640 }

describe('fogEdges', () => {
  it('fades the top once the view has scrolled off the top board, and the bottom while more pitch lies below', () => {
    expect(fogEdges(new Camera(-rules.board + 32), canvas)).toEqual({ top: false, bottom: true })
    expect(fogEdges(new Camera(54), canvas)).toEqual({ top: true, bottom: true })
    expect(fogEdges(new Camera(rules.pitchHeight + rules.board - 32), canvas)).toEqual({ top: true, bottom: false })
  })

  it('fades nothing on the map, which shows the whole pitch', () => {
    expect(fogEdges(new Camera(rules.mapY, { stretch: false }), canvas)).toEqual({ top: false, bottom: false })
  })
})

describe('blind fog', () => {
  const fog = (blind?: 1 | 2) => Object.assign(new Fog(() => new Camera(54), () => ({ x: 0, y: 0 })), { blind })

  it('covers the opponent\'s half, up to the halfway line', () => {
    expect(fog(1).covered).toEqual(fogOf(1))
    expect(fog(2).covered).toEqual(fogOf(2))
    expect(fogOf(1).bottom).toBe(rules.halfHeight)
  })

  it('covers nothing once the opening build is over (the reveal)', () => {
    expect(fog(undefined).covered).toBeUndefined()
  })
})
