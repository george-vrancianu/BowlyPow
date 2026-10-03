import { describe, expect, it } from 'vitest'
import type { WallSpec } from '../../sim/wall'
import { crackLines } from './Fixture'

const spec: WallSpec = { kind: 'wall', owner: 1, shape: 'L', rotation: 0, at: { gx: 5, gy: 40 } }

describe('crackLines', () => {
  it('draws one crack per lost hp, deterministically, keeping earlier cracks', () => {
    expect(crackLines(spec, 4, 3)).toEqual([])
    const one = crackLines(spec, 4, 2)
    expect(one).toHaveLength(1)
    expect(crackLines(spec, 4, 2)).toEqual(one)
    const two = crackLines(spec, 4, 1)
    expect(two).toHaveLength(2)
    expect(two[0]).toEqual(one[0])
  })
})
