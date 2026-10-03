import { visual } from '../config/visual'
import { rules } from '../config/rules'
import { nearestOnWall } from '../sim/blast'
import { type PlayerId, type Point } from '../sim/pitch'
import type { SimInput, SimState } from '../sim/step'
import { canPlace, structureCost, wallCost, type Rotation, type StructureSpec, type TowerPower, type WallShape } from '../sim/wall'
import type { ButtonSpec } from './hud'

/**
 * The builder's selection: a new piece (no `id`), or one of their structures (`id`). Only this turn's structures can be
 * dragged; an older one is selected just to demolish it.
 */
export type Selection = { spec: StructureSpec; id?: number; movable: boolean }

export type Piece = WallShape | TowerPower

/** Grid rows (vertices) a piece anchored on `owner`'s half may use. */
const rows = (owner: PlayerId) => (owner === 1 ? [rules.halfHeight / rules.cellSize, rules.pitchHeight / rules.cellSize - 1] : [0, rules.halfHeight / rules.cellSize - 1])

/** A new piece at the vertex nearest the view centre, clamped to the owner's half. */
export function spawn(piece: Piece, owner: PlayerId, viewY: number): Selection {
  const [lo, hi] = rows(owner)
  const at = { gx: rules.pitchWidth / rules.cellSize / 2, gy: Math.min(Math.max(Math.round(viewY / rules.cellSize), lo), hi) }
  const spec: StructureSpec = piece === 'repulsor' || piece === 'steal' ? { kind: 'tower', owner, power: piece, at } : { kind: 'wall', owner, shape: piece, rotation: 0, at }
  return { spec, movable: true }
}

/** Whether `at` lands on `spec`, within `tolerance` world units of its segments. */
export const onPiece = (spec: StructureSpec, at: Point, tolerance: number) => nearestOnWall(spec, at).dist <= tolerance

/** The builder's own structure under `at`, nearest first, selected as it stands. */
export function pick(s: SimState, builder: PlayerId, at: Point, tolerance: number): Selection | undefined {
  const hits = s.objects.filter((o) => o.owner === builder).map((o) => ({ o, d: nearestOnWall(o, at).dist })).filter((h) => h.d <= tolerance)
  const near = hits.sort((a, b) => a.d - b.d)[0]?.o
  if (!near) return undefined
  const spec: StructureSpec = near.kind === 'wall' ? { kind: 'wall', owner: near.owner, shape: near.shape, rotation: near.rotation, at: near.at } : { kind: 'tower', owner: near.owner, power: near.power, at: near.at }
  return { spec, id: near.id, movable: s.built.includes(near.id) }
}

export const rotated = (sel: Selection): Selection => (sel.spec.kind === 'wall' ? { ...sel, spec: { ...sel.spec, rotation: ((sel.spec.rotation + 1) % 4) as Rotation } } : sel)

/** Legal where it stands (ignoring itself when moved) and, for a new piece, affordable. */
export function legal(s: SimState, sel: Selection): boolean {
  const others = s.objects.filter((o) => o.id !== sel.id)
  return canPlace(others, sel.spec) && (sel.id !== undefined || s.points[sel.spec.owner] >= structureCost(sel.spec))
}

/** How far to pan while a piece is held near the top or bottom tenth of the view: toward any of the builder's half that is off screen, never past it. */
export function edgeScrollDy(camY: number, visibleHeight: number, builder: PlayerId, pointerY: number, dt: number): number {
  const [lo, hi] = builder === 1 ? [rules.halfHeight, rules.pitchHeight] : [0, rules.halfHeight]
  const [top, bottom] = [camY - visibleHeight / 2, camY + visibleHeight / 2]
  const margin = visibleHeight / 10
  return pointerY < top + margin && top > lo ? -Math.min(visual.input.edgeScrollSpeed * dt, top - lo) : pointerY > bottom - margin && bottom < hi ? Math.min(visual.input.edgeScrollSpeed * dt, hi - bottom) : 0
}

const sameSpec = (a: StructureSpec, b: StructureSpec) =>
  a.kind === b.kind && a.owner === b.owner && a.at.gx === b.at.gx && a.at.gy === b.at.gy && (a.kind === 'tower' ? a.power === (b as typeof a).power : a.shape === (b as typeof a).shape && a.rotation === (b as typeof a).rotation)

/** A confirmed selection has reached the sim: the new piece stands among this turn's, or the moved one stands where it was put. */
export const landed = (s: SimState, sel: Selection): boolean =>
  s.objects.some((o) => (sel.id === undefined ? s.built.includes(o.id) : o.id === sel.id) && sameSpec(o, sel.spec))

/** The sim input ✓ sends: place a new piece or move a structure. Undefined when there is nothing to send. */
export function commit(sel: Selection): SimInput | undefined {
  const { spec, id } = sel
  if (id === undefined) return { placeWall: spec }
  if (!sel.movable) return undefined
  return { moveStructure: { player: spec.owner, id, at: spec.at, rotation: spec.kind === 'wall' ? spec.rotation : 0 } }
}

/** What the build menu shows: the closed or open icon, or the selection's controls. */
export type BuildMenu = { kind: 'menu'; open: boolean; items: ButtonSpec[] } | { kind: 'selected'; buttons: ButtonSpec[] }

export type BuildActions = { toggle(): void; spawn(p: Piece): void; confirm(): void; cancel(): void; rotate(): void; remove(): void }

const POWER_LABEL: Record<TowerPower, string> = { repulsor: 'Repulsor', steal: 'Steal' }

export function buildMenu(s: SimState, b: PlayerId, v: { open: boolean; selection?: Selection; /** A confirmed piece is still on its way to the sim. */ landing?: boolean }, a: BuildActions): BuildMenu {
  const sel = v.selection
  if (!sel) {
    const points = s.points[b]
    return {
      kind: 'menu',
      open: v.open,
      items: [
        ...(['straight', 'L'] as const).map((shape) => ({ label: `${shape === 'L' ? 'L' : 'Straight'} ${wallCost(shape)}`, disabled: points < wallCost(shape), onClick: () => a.spawn(shape) })),
        ...(Object.keys(POWER_LABEL) as TowerPower[]).map((power) => ({ label: `${POWER_LABEL[power]} ×${s.players[b].inventory[power]}`, disabled: s.players[b].inventory[power] < 1, onClick: () => a.spawn(power) })),
      ],
    }
  }
  return {
    kind: 'selected',
    buttons: [
      ...(sel.id !== undefined ? [{ label: '🗑', disabled: !sel.movable && s.points[b] < 1, onClick: a.remove }] : []),
      ...(sel.movable && sel.spec.kind === 'wall' ? [{ label: '↻', onClick: a.rotate }] : []),
      { label: '✕', onClick: a.cancel },
      ...(sel.movable ? [{ label: '✓', disabled: !!v.landing || !legal(s, sel), onClick: a.confirm }] : []),
    ],
  }
}
