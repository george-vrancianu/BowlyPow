import { describe, expect, it } from 'vitest'
import { rules } from '../../config/rules'
import { visual } from '../../config/visual'
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

/** A context that records the rects it fills, with the fill style each used. */
const recorder = () => {
  const fills: { style: unknown; rect: number[] }[] = []
  const ctx = {
    canvas,
    fillStyle: '' as unknown,
    save() {},
    restore() {},
    beginPath() {},
    rect() {},
    clip() {},
    translate() {},
    scale() {},
    createLinearGradient: () => ({ addColorStop() {} }),
    fillRect(...rect: number[]) {
      fills.push({ style: ctx.fillStyle, rect })
    },
  }
  return { ctx: ctx as unknown as CanvasRenderingContext2D, fills }
}

describe('blind fog', () => {
  const draw = (blind?: 1 | 2) => {
    const fog = new Fog(() => new Camera(rules.mapY, { stretch: false }), () => ({ x: 0, y: 0 }))
    fog.blind = blind
    const r = recorder()
    fog.draw(r.ctx)
    return r.fills
  }

  it('covers the opponent\'s half up to the halfway line and keeps the line', () => {
    const { top, bottom } = fogOf(1)
    const fills = draw(1)
    expect(fills[0]).toEqual({ style: visual.camera.bg, rect: [-visual.fog.bleed, top, rules.pitchWidth + 2 * visual.fog.bleed, bottom - top] })
    expect(fills[1]).toEqual({ style: visual.pitch.line, rect: [0, rules.halfHeight - visual.pitch.halfLineWidth / 2, rules.pitchWidth, visual.pitch.halfLineWidth] })
  })

  it('covers the other half for seat 2', () => {
    const { top, bottom } = fogOf(2)
    expect(draw(2)[0]!.rect.slice(1)).toEqual([top, rules.pitchWidth + 2 * visual.fog.bleed, bottom - top])
  })

  it('covers nothing once the opening build is over (the reveal)', () => {
    expect(draw(undefined)).toEqual([])
  })
})
