import { describe, expect, it } from 'vitest'
import { defaultConfig as c, step, type SimState } from '../sim/step'
import { buildState } from '../sim/testkit'
import type { WallSpec } from '../sim/wall'
import { buildMenu, commit, edgeScrollDy, legal, pick, rotated, spawn, type BuildActions } from './build'

const noop = () => {}
const actions: BuildActions = { toggle: noop, spawn: noop, confirm: noop, cancel: noop, rotate: noop, remove: noop }
const wall: WallSpec = { kind: 'wall', owner: 1, shape: 'straight', rotation: 0, at: { gx: 10, gy: 40 } }
const placed = (): SimState => step(buildState(1), { placeWall: wall }, c).state
const labels = (s: SimState, v: Parameters<typeof buildMenu>[2]) => {
  const m = buildMenu(s, 1, v, actions)
  return m.kind === 'menu' ? m.items.map((i) => i.label) : m.buttons.map((b) => b.label)
}

describe('spawn', () => {
  it('lands at the view centre, clamped to the owner\'s half', () => {
    expect(spawn('L', 1, 80).spec.at).toEqual({ gx: 10, gy: 40 })
    expect(spawn('L', 1, 10).spec.at.gy).toBe(27)
    expect(spawn('steal', 2, 100).spec).toEqual({ kind: 'tower', owner: 2, power: 'steal', at: { gx: 10, gy: 26 } })
  })
})

describe('pick', () => {
  it('selects this turn\'s structure as movable, an older one as not, and misses beyond the tolerance', () => {
    const s = placed()
    expect(pick(s, 1, { x: 21, y: 80.5 }, 1)).toEqual({ spec: wall, id: 1, movable: true })
    expect(pick({ ...s, built: [] }, 1, { x: 21, y: 80.5 }, 1)?.movable).toBe(false)
    expect(pick(s, 1, { x: 21, y: 83 }, 1)).toBeUndefined()
    expect(pick(s, 2, { x: 21, y: 80.5 }, 1)).toBeUndefined()
  })
})

describe('selection', () => {
  it('moving is free; a new piece must be affordable', () => {
    const s = { ...placed(), points: { 1: 0, 2: 0 } }
    const spec = { ...wall, at: { gx: 4, gy: 40 } }
    expect(legal(s, { spec, id: 1, movable: true })).toBe(true)
    expect(legal(s, { spec, movable: true })).toBe(false)
  })
  it('✓ places a new piece or moves a structure; nothing for an older one', () => {
    expect(commit({ spec: wall, movable: true })).toEqual({ placeWall: wall })
    expect(commit({ spec: rotated({ spec: wall, movable: true }).spec, id: 1, movable: true })).toEqual({ moveStructure: { player: 1, id: 1, at: wall.at, rotation: 1 } })
    expect(commit({ spec: wall, id: 1, movable: false })).toBeUndefined()
  })
})

describe('build menu', () => {
  it('lists pieces with costs and stock when nothing is selected', () => {
    expect(labels(buildState(1), { open: true })).toEqual(['Straight 2', 'L 3', 'Repulsor ×3', 'Steal ×3'])
  })
  it('a new wall gets Rotate, cancel and confirm; a new tower no Rotate', () => {
    expect(labels(buildState(1), { open: false, selection: { spec: wall, movable: true } })).toEqual(['↻', '✕', '✓'])
    expect(labels(buildState(1), { open: false, selection: spawn('steal', 1, 80) })).toEqual(['✕', '✓'])
  })
  it('a placed structure also gets the bin; an older one only bin and cancel', () => {
    expect(labels(placed(), { open: false, selection: { spec: wall, id: 1, movable: true } })).toEqual(['🗑', '↻', '✕', '✓'])
    expect(labels(placed(), { open: false, selection: { spec: wall, id: 1, movable: false } })).toEqual(['🗑', '✕'])
  })
})

describe('edge scroll', () => {
  // A 30-high view; builder 1 owns y 54..108, builder 2 y 0..54. The edge band is the outer tenth (3).
  it('does nothing in the middle of the view', () => {
    expect(edgeScrollDy(70, 30, 1, 70, 0.1)).toBe(0)
  })
  it('scrolls toward the off-screen part of the builder\'s half', () => {
    expect(edgeScrollDy(70, 30, 1, 84, 0.1)).toBeGreaterThan(0)
    expect(edgeScrollDy(40, 30, 2, 26, 0.1)).toBeLessThan(0)
  })
  it('never scrolls past the half\'s edge', () => {
    expect(edgeScrollDy(90, 30, 1, 104, 10)).toBe(3)
    expect(edgeScrollDy(30, 30, 2, 16, 10)).toBe(-15)
  })
  it('does nothing when that edge of the half is already in view', () => {
    expect(edgeScrollDy(69, 30, 1, 55, 0.1)).toBe(0)
    expect(edgeScrollDy(93, 30, 1, 107, 0.1)).toBe(0)
  })
})
