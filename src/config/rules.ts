const base = {
  pitchWidth: 40,
  pitchHeight: 108,
  cellSize: 2,
  goalWidth: 10,
  noBuildRadius: 15,
  /** Board and net thickness around the pitch. */
  board: 1,
  netDepth: 3,
  wallHp: 3,
  towerHp: 3,
  /** A Steal tower is fragile. */
  stealHp: 1,
  /** Wall points a tower costs; it spends inventory instead. */
  towerCost: 0,
  wallCost: { straight: 2, L: 3 },
  /** Half the drawn wall thickness; a blast cannot start on it. */
  wallHalf: 0.35,
  /** Each arm is a run of cells from the pivot, before rotation. */
  arms: { straight: [[4, 0]], L: [[3, 0], [0, 3]] } as Record<'straight' | 'L', [number, number][]>,
  /** Wall points it costs to demolish a piece placed in an earlier turn. */
  demolishCost: 1,
  startInventory: 3,
  /** Where a timed-out blind opening build drops its piece for P1, in grid vertices; P2's mirrors across the halfway line. */
  fallbackPiece: { gx: 10, gy: 40 },
  /** Blast radius is `radiusBase * ballRadius * (1 + radiusGrowth * power)`; pressure above `heavy` / `light` costs more hp. */
  blast: { radiusBase: 2, radiusGrowth: 4, heavy: 0.8, light: 0.4 },
} as const

const mapTop = -base.board - base.netDepth
const mapHeight = base.pitchHeight + 2 * (base.board + base.netDepth)

/** Every rule and geometry value; derived values are computed from the base. */
export const rules = {
  ...base,
  halfHeight: base.pitchHeight / 2,
  /** Grid rows (vertices) from goal line to goal line. */
  gridRows: base.pitchHeight / base.cellSize,
  /** Grid columns (vertices) across the pitch. */
  gridCols: base.pitchWidth / base.cellSize,
  /** The middle of each player's half, where their ball goes and the build view starts. */
  halfCentre: { 1: (3 * base.pitchHeight) / 4, 2: base.pitchHeight / 4 } as Record<1 | 2, number>,
  goalLeft: (base.pitchWidth - base.goalWidth) / 2,
  goalRight: (base.pitchWidth + base.goalWidth) / 2,
  /** World y range of everything drawn: boards and nets included, and its centre. */
  mapTop,
  mapHeight,
  mapY: mapTop + mapHeight / 2,
} as const
