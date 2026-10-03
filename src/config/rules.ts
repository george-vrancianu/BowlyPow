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
  startInventory: 3,
  /** Seconds per build turn online. */
  onlineBuildSeconds: 30,
  /** Blast radius is `radiusBase * ballRadius * (1 + radiusGrowth * power)`; pressure above `heavy` / `light` costs more hp. */
  blast: { radiusBase: 2, radiusGrowth: 4, heavy: 0.8, light: 0.4 },
}

/** Every rule and geometry value; derived values are computed from the base. */
export const rules = {
  ...base,
  halfHeight: base.pitchHeight / 2,
  goalLeft: (base.pitchWidth - base.goalWidth) / 2,
  goalRight: (base.pitchWidth + base.goalWidth) / 2,
  /** World y range of everything drawn: boards and nets included. */
  mapTop: -base.board - base.netDepth,
  mapHeight: base.pitchHeight + 2 * (base.board + base.netDepth),
  mapY: base.pitchHeight / 2,
}
