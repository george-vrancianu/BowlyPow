import { describe, expect, it } from 'vitest'
import { halfOfCell, initialPlayers } from './player'
import { halfOf } from './pitch'

describe('players', () => {
  it('player 1 is cyan and owns the bottom half, player 2 orange and the top', () => {
    const { 1: p1, 2: p2 } = initialPlayers()
    expect([p1.id, p1.color, p2.id, p2.color]).toEqual([1, '#22d3ee', 2, '#fb923c'])
    expect(halfOf(100)).toBe(p1.id)
    expect(halfOf(8)).toBe(p2.id)
  })

  it('cells belong to the half their centre is in', () => {
    expect(halfOfCell({ cx: 3, cy: 0 })).toBe(2)
    expect(halfOfCell({ cx: 3, cy: 26 })).toBe(2)
    expect(halfOfCell({ cx: 3, cy: 27 })).toBe(1)
    expect(halfOfCell({ cx: 3, cy: 53 })).toBe(1)
  })

  it('both players start with 3 of each power-up', () => {
    for (const p of Object.values(initialPlayers())) {
      expect(p.inventory).toEqual({ breaker: 3, repulsor: 3, steal: 3 })
    }
  })
})
