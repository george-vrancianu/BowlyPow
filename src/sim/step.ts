import { goalCrossed, HALF_HEIGHT, PITCH_WIDTH, type PlayerId, type Point } from './pitch'
import type { GameModeName, Match } from './match'
import { modeFor, modeNamed } from './mode'
import { initialPlayers, type Player, type PowerUp } from './player'
import { rollBall, type Ball } from './ball'
import { blastDamage, blastPush, canBlastFrom } from './blast'
import { canPlaceBall, opponent, resolveRest, type Possession } from './possession'
import { canPlace, damageWall, maxHp, structureCost, type Rotation, type Structure, type StructureSpec, type Vertex } from './wall'

export type SimEvent =
  | { type: 'wall-cracked'; id: number; hp: number; at: Point }
  /** Carries the removed wall (hp 0) so the renderer can shatter it. */
  | { type: 'wall-destroyed'; wall: Structure; at: Point; /** Broken by a Breaker shot. */ breaker?: true }
  | { type: 'ball-hit-wall'; wall: number; speed: number; at: Point }
  /** An illegal placement or demolition was dropped. */
  | { type: 'refused' }
  | { type: 'blast-fired'; player: PlayerId; origin: Point; power: number; breaker?: boolean }
  | { type: 'possession-changed'; shooter: PlayerId; inHand: boolean }
  | { type: 'goal'; scorer: PlayerId; at: Point }
  /** `scorer` null = the shot cap ended the round. */
  | { type: 'round-ended'; round: number; scorer: PlayerId | null }
  | { type: 'match-ended'; winner: PlayerId }
  | { type: 'shot-clock-expired'; player: PlayerId }
  /** An opponent's ball hit a Steal tower: the ball stopped and the tower (hp 0) is gone. */
  | { type: 'steal-triggered'; tower: Structure; owner: PlayerId; at: Point }
  | { type: 'repulsor-fired'; tower: number; at: Point }

export type SimState = {
  tick: number
  objects: Structure[]
  players: Record<PlayerId, Player>
  /** Wall points; demolishing spends them. */
  points: Record<PlayerId, number>
  nextId: number
  /** Ids placed in the current build turn: they can still be moved, and demolishing them refunds them. */
  built: number[]
  ball: Ball
  possession: Possession
  match: Match
  /** Shot clock: ticks left (frozen while a shot is live) and consecutive expiries in this possession. */
  clock: { left: number; expiries: number }
  /** The shot in flight is a Breaker shot that has not broken anything yet. */
  breaker: boolean
}

/** Per-tick input from both players. `demolish.wall` is a wall id. */
export type SimInput = {
  blast?: { player: PlayerId; origin: Point; power: number; breaker?: boolean }
  placeWall?: StructureSpec
  demolish?: { player: PlayerId; wall: number }
  /** The builder moves a structure placed this build turn. */
  moveStructure?: { player: PlayerId; id: number; at: Vertex; rotation: Rotation }
  /** The shooter's blast charge in progress; fires at this power when the shot clock runs out. */
  charging?: { origin: Point; power: number; breaker?: boolean }
  /** The builder ends their build turn. */
  done?: PlayerId
  /** Confirm ball-in-hand: the shooter's ball goes to `at`. */
  placeBall?: { player: PlayerId; at: Point }
}

export type SimConfig = {
  tickHz: number
  ballRadius: number
  maxSpeed: number
  /** Seconds for ball speed to halve. */
  halfLife: number
  restSpeed: number
  restitution: number
  /** A wall hit above this fraction of maxSpeed removes 1 hp. */
  damageFraction: number
  /** Speed kept by a ball that destroys a wall mid-shot. */
  destroyedSpeedFactor: number
  /** Shots per possession. */
  shots: number
  /** Which game mode decides the match. */
  mode: GameModeName
  rounds: number
  /** Wall points per build phase. */
  wallPoints: number
  /** Shots in a round before it ends scoreless (not in sudden death). */
  shotCap: number
  /** Seconds per shot. */
  shotClock: number
  /** Seconds per build turn; 0 = no timer (hot-seat). */
  buildTime: number
}

export const defaultConfig: SimConfig = {
  tickHz: 60,
  ballRadius: 1,
  maxSpeed: 60,
  halfLife: 0.8,
  restSpeed: 0.5,
  restitution: 0.85,
  damageFraction: 0.5,
  destroyedSpeedFactor: 0.5,
  shots: 3,
  mode: 'rounds',
  rounds: 5,
  wallPoints: 10,
  shotCap: 30,
  shotClock: 15,
  buildTime: 0,
}

export function initialState(seed = 1, config: SimConfig = defaultConfig): SimState {
  const start = modeNamed(config.mode).start(seed, config)
  return { tick: 0, objects: [], players: initialPlayers(), points: { 1: config.wallPoints, 2: config.wallPoints }, nextId: 1, built: [], ball: { pos: { x: PITCH_WIDTH / 2, y: HALF_HEIGHT }, vel: { x: 0, y: 0 }, rolled: 0 }, possession: start.possession, match: start.match, clock: { left: (config.buildTime || config.shotClock) * config.tickHz, expiries: 0 }, breaker: false }
}

const spend = (players: SimState['players'], id: PlayerId, power: PowerUp, n = 1): SimState['players'] => ({ ...players, [id]: { ...players[id], inventory: { ...players[id].inventory, [power]: players[id].inventory[power] - n } } })

/** Pure and deterministic: no DOM, no randomness. */
export function step(
  state: SimState,
  input: SimInput,
  config: SimConfig,
): { state: SimState; events: SimEvent[] } {
  if (state.match.winner) return { state, events: [] }
  let { objects, points, nextId, players, built } = state
  let { match } = state
  const mode = modeFor(match)
  const events: SimEvent[] = []
  const building = match.builder !== null
  const { placeWall, demolish, moveStructure: move } = input
  if (placeWall) {
    const cost = structureCost(placeWall)
    const stocked = placeWall.kind === 'wall' || players[placeWall.owner].inventory[placeWall.power] > 0
    if (placeWall.owner === match.builder && stocked && points[placeWall.owner] >= cost && canPlace(objects, placeWall)) {
      if (placeWall.kind === 'tower') players = spend(players, placeWall.owner, placeWall.power)
      built = [...built, nextId]
      objects = [...objects, { ...placeWall, id: nextId++, hp: maxHp(placeWall) }]
      points = { ...points, [placeWall.owner]: points[placeWall.owner] - cost }
    } else events.push({ type: 'refused' })
  }
  if (move) {
    const it = objects.find((o) => o.id === move.id)
    const others = objects.filter((o) => o.id !== move.id)
    const moved = it && (it.kind === 'wall' ? { ...it, at: move.at, rotation: move.rotation } : { ...it, at: move.at })
    if (moved && move.player === match.builder && it.owner === move.player && built.includes(move.id) && canPlace(others, moved)) objects = objects.map((o) => (o.id === move.id ? moved : o))
    else events.push({ type: 'refused' })
  }
  if (demolish) {
    const it = objects.find((w) => w.id === demolish.wall)
    const fresh = built.includes(demolish.wall)
    if (it && demolish.player === match.builder && it.owner === demolish.player && (fresh || points[demolish.player] >= 1)) {
      objects = objects.filter((w) => w.id !== demolish.wall)
      // This turn's items come back in full; older ones cost a point to clear.
      points = { ...points, [demolish.player]: points[demolish.player] + (fresh ? structureCost(it) : -1) }
      if (fresh && it.kind === 'tower') players = spend(players, it.owner, it.power, -1)
      built = built.filter((id) => id !== demolish.wall)
    } else events.push({ type: 'refused' })
  }
  let ball = state.ball
  let { possession } = state
  const { placeBall } = input
  if (placeBall) {
    if (!building && possession.inHand && placeBall.player === possession.shooter && canPlaceBall(placeBall.player, placeBall.at, objects, config)) {
      ball = { ...ball, pos: placeBall.at, vel: { x: 0, y: 0 } }
      possession = { ...possession, inHand: false }
    } else events.push({ type: 'refused' })
  }
  let { clock } = state
  const buildExpired = building && config.buildTime > 0 && clock.left <= 1
  if (building && config.buildTime > 0) clock = { ...clock, left: clock.left - 1 }
  const expired = !building && !possession.live && clock.left <= 1
  if (!building && !possession.live) clock = { ...clock, left: clock.left - 1 }
  const { charging } = input
  const blast = input.blast ?? (expired && charging && canBlastFrom(possession.shooter, charging.origin, { objects, ball }, config) ? { player: possession.shooter, ...charging } : undefined)
  if (blast) {
    if (!building && blast.player === possession.shooter && !possession.inHand && !possession.live && canBlastFrom(blast.player, blast.origin, { objects, ball }, config) && (!blast.breaker || players[blast.player].inventory.breaker > 0)) {
      if (blast.breaker) players = spend(players, blast.player, 'breaker')
      events.push({ type: 'blast-fired', ...blast })
      possession = { ...possession, live: true }
      match = mode.onShotFired(match)
      const vel = blastPush(ball.pos, blast.origin, blast.power, blast.player, config)
      if (vel) ball = { ...ball, vel }
      for (const { wall, loss, at } of blastDamage(objects, blast.origin, blast.power, blast.player, config)) {
        for (let i = 0; i < loss; i++) {
          const r = damageWall(objects, wall.id, at)
          objects = r.objects
          events.push(...r.events)
        }
      }
    } else events.push({ type: 'refused' })
  }
  const fired = possession.live && !state.possession.live
  // A shot is consumed when it rests, is stolen, or is burned by the clock; the round cap is checked then.
  let consumed = false
  if (expired) {
    const shooter = possession.shooter
    events.push({ type: 'shot-clock-expired', player: shooter })
    if (!possession.live) {
      consumed = true
      match = mode.onShotFired(match)
      if (clock.expiries >= 1) {
        possession = { shooter: opponent(shooter), shots: config.shots, inHand: true, live: false }
        events.push({ type: 'possession-changed', shooter: possession.shooter, inHand: true })
      } else {
        if (possession.inHand) {
          ball = { ...ball, pos: { x: PITCH_WIDTH / 2, y: shooter === 1 ? 1.5 * HALF_HEIGHT : HALF_HEIGHT / 2 }, vel: { x: 0, y: 0 } }
          possession = { ...possession, inHand: false }
        }
        const r = resolveRest(possession, ball.pos.y, config)
        possession = r.possession
        events.push(...r.events)
        clock = { ...clock, expiries: clock.expiries + 1 }
      }
    }
  }
  const breaker = state.breaker || (fired && !!blast?.breaker)
  const done = input.done ?? (buildExpired ? match.builder : null)
  if (done) {
    const r = done === match.builder ? mode.onBuildDone(match, done, { objects, possession }, config) : null
    if (r) {
      match = r.match
      events.push(...r.events)
    } else events.push({ type: 'refused' })
  }
  const rolled = rollBall(ball, objects, config, breaker, possession.shooter)
  events.push(...rolled.events)
  let landed = rolled.ball
  const stolen = rolled.events.find((e) => e.type === 'steal-triggered')
  if (stolen) {
    consumed = true
    possession = { shooter: stolen.owner, shots: config.shots, inHand: true, live: false }
    events.push({ type: 'possession-changed', shooter: stolen.owner, inHand: true })
  }
  // A Repulsor rearms when the ball rests.
  if (!landed.vel.x && !landed.vel.y && rolled.objects.some((o) => o.kind === 'tower' && o.spent)) rolled.objects = rolled.objects.map((o) => (o.kind === 'tower' && o.spent ? { ...o, spent: false } : o))
  const conceder = goalCrossed(ball.pos, landed.pos)
  if (conceder) events.push({ type: 'goal', scorer: opponent(conceder), at: landed.pos })
  else if (possession.live && !landed.vel.x && !landed.vel.y) {
    consumed = true
    const r = resolveRest(possession, landed.pos.y, config)
    possession = r.possession
    events.push(...r.events)
  }
  const ctx = { objects: rolled.objects, possession }
  const turn = conceder ? mode.onGoal(match, opponent(conceder), ctx, config) : consumed ? mode.onShotConsumed(match, ctx, config) : null
  const ended = !!turn
  if (turn) {
    match = turn.match
    if (turn.possession) possession = turn.possession
    if (turn.ball) landed = { ...landed, pos: turn.ball, vel: { x: 0, y: 0 } }
    events.push(...turn.events)
    const winner = mode.winner(match, { objects: rolled.objects, possession }, config)
    if (winner && !match.winner) {
      match = { ...match, winner, builder: null }
      events.push({ type: 'match-ended', winner })
    }
  }
  if (match.builder !== state.match.builder) built = []
  if (match.builder && match.builder !== state.match.builder) {
    const t = mode.onBuildStart(match, { objects: rolled.objects, possession }, config)
    built = t.built
    points = { ...points, [match.builder]: t.points }
    if (config.buildTime) clock = { left: config.buildTime * config.tickHz, expiries: 0 }
  }
  if (!match.builder && state.match.builder) clock = { left: config.shotClock * config.tickHz, expiries: 0 }
  if (possession.shooter !== state.possession.shooter || fired || ended) clock = { ...clock, expiries: 0 }
  if (expired || fired || ended || (state.possession.live && !possession.live) || possession.shooter !== state.possession.shooter) clock = { ...clock, left: config.shotClock * config.tickHz }
  return { state: { ...state, possession, match, clock, tick: state.tick + 1, players, breaker: rolled.breaker && possession.live, objects: rolled.objects, points, nextId, built, ball: landed }, events }
}
