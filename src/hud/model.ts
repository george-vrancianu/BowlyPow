import type { PlayerId } from '../sim/pitch'
import type { SimConfig, SimState } from '../sim/step'
import { canPlace, structureCost, wallCost, type StructureSpec, type TowerPower, type WallShape } from '../sim/wall'
import type { ButtonSpec, HudModel } from './hud'

const POWER_LABEL: Record<TowerPower, string> = { repulsor: 'Repulsor', steal: 'Steal' }

/** What the build palette reads and does; the shell owns the live ghost and the actions. */
export type Palette = {
  ghost?: StructureSpec
  demolishing: boolean
  spawn(piece: WallShape | TowerPower): void
  rotate(): void
  confirm(): void
  toggleDemolish(): void
  done(): void
}

/** Build-turn buttons for builder `b`: pieces, Rotate, Confirm, Demolish, Done. */
export function paletteButtons(s: SimState, b: PlayerId, p: Palette): ButtonSpec[] {
  const { ghost } = p
  const points = s.points[b]
  return [
    ...(['straight', 'L'] as const).map((shape) => ({ label: `${shape === 'L' ? 'L' : 'Straight'} ${wallCost(shape)}`, selected: ghost?.kind === 'wall' && ghost.shape === shape, disabled: points < wallCost(shape), onClick: () => p.spawn(shape) })),
    ...(Object.keys(POWER_LABEL) as TowerPower[]).map((power) => ({ label: `${POWER_LABEL[power]} ×${s.players[b].inventory[power]}`, selected: ghost?.kind === 'tower' && ghost.power === power, disabled: s.players[b].inventory[power] < 1, onClick: () => p.spawn(power) })),
    { label: 'Rotate', disabled: ghost?.kind !== 'wall', onClick: p.rotate },
    { label: 'Confirm', disabled: !ghost || !canPlace(s.objects, ghost) || points < structureCost(ghost), onClick: p.confirm },
    { label: 'Demolish 1', selected: p.demolishing, disabled: points < 1, onClick: p.toggleDemolish },
    { label: 'Done', onClick: p.done },
  ]
}

export type HudView = { active: PlayerId; buttons?: ButtonSpec[]; armed: boolean; tappable: boolean }

export function hudModel(s: SimState, c: SimConfig, v: HudView): HudModel {
  const b = s.match.builder
  const { score } = s.match
  const timed = b ? c.buildTime : c.shotClock
  return {
    players: { 1: { score: score[1], inventory: s.players[1].inventory }, 2: { score: score[2], inventory: s.players[2].inventory } },
    active: v.active,
    round: s.match.round,
    rounds: c.rounds,
    clock: timed ? { seconds: s.clock.left / c.tickHz, fraction: s.clock.left / (timed * c.tickHz) } : null,
    shotsLeft: s.possession.shots,
    shotsMax: c.shots,
    phase: b ? `Build · ${s.points[b]} pts` : 'Play',
    buttons: v.buttons,
    breaker: { armed: v.armed, tappable: v.tappable },
  }
}
