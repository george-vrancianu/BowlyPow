import { visual } from '../config/visual'
import { rules } from '../config/rules'
import { cellToWorld, halfOf, type Cell, type PlayerId } from './pitch'

export type PowerUp = 'breaker' | 'repulsor' | 'steal'

export type Player = {
  id: PlayerId
  color: string
  inventory: Record<PowerUp, number>
}

/** Stock every player starts with; what the HUD shows for a hidden opponent. */
export const STARTING_INVENTORY: Readonly<Record<PowerUp, number>> = Object.freeze({ breaker: rules.startInventory, repulsor: rules.startInventory, steal: rules.startInventory })

export function initialPlayers(): Record<PlayerId, Player> {
  const make = (id: PlayerId): Player => ({ id, color: visual.player.colors[id], inventory: { ...STARTING_INVENTORY } })
  return { 1: make(1), 2: make(2) }
}

/** Cells never straddle the halfway line, so a cell's centre decides its owner. */
export function halfOfCell(cell: Cell): PlayerId {
  return halfOf(cellToWorld(cell).y)!
}
