import { describe, expect, it } from 'vitest'
import { rules } from '../../config/rules'
import { Camera } from './Camera'
import { fogEdges } from './Fog'

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
