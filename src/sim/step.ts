import { HALF_HEIGHT, PITCH_WIDTH, type PlayerId, type Point } from './pitch'
import { initialPlayers, type Player } from './player'
import { rollBall, type Ball } from './ball'
import { blastDamage, blastPush, canBlastFrom } from './blast'
import { canPlaceBall, resolveRest, type Possession } from './possession'
import { canPlace, WALL_HP, damageWall, type Wall, type WallSpec } from './wall'

/** Anything that lives on the pitch (balls, walls, towers) will join this union in later tickets. */
export type SimObject = Wall

export type SimEvent =
  | { type: 'wall-cracked'; id: number; hp: number; at: Point }
  /** Carries the removed wall (hp 0) so the renderer can shatter it. */
  | { type: 'wall-destroyed'; wall: Wall; at: Point }
  | { type: 'ball-hit-wall'; wall: number; speed: number; at: Point }
  /** An illegal placement or demolition was dropped. */
  | { type: 'refused' }
  | { type: 'blast-fired'; player: PlayerId; origin: Point; power: number }
  | { type: 'possession-changed'; shooter: PlayerId; inHand: boolean }

export type SimState = {
  tick: number
  objects: SimObject[]
  players: Record<PlayerId, Player>
  /** Wall points; demolishing spends them. */
  points: Record<PlayerId, number>
  nextId: number
  ball: Ball
  possession: Possession
}

/** Per-tick input from both players; filled out by later tickets. `demolish.wall` is a wall id. */
export type SimInput = {
  blast?: { player: PlayerId; origin: Point; power: number }
  placeWall?: WallSpec
  demolish?: { player: PlayerId; wall: number }
  damage?: { wall: number; at: Point }
  kick?: Point
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
}

export function initialState(): SimState {
  return { tick: 0, objects: [], players: initialPlayers(), points: { 1: 10, 2: 10 }, nextId: 1, ball: { pos: { x: PITCH_WIDTH / 2, y: HALF_HEIGHT }, vel: { x: 0, y: 0 }, rolled: 0 }, possession: { shooter: 1, shots: defaultConfig.shots, inHand: false, live: false } }
}

/** Pure and deterministic: no DOM, no randomness. */
export function step(
  state: SimState,
  input: SimInput,
  config: SimConfig,
): { state: SimState; events: SimEvent[] } {
  let { objects, points, nextId } = state
  const events: SimEvent[] = []
  if (input.placeWall) {
    if (canPlace(objects, input.placeWall)) objects = [...objects, { ...input.placeWall, id: nextId++, hp: WALL_HP }]
    else events.push({ type: 'refused' })
  }
  const { demolish } = input
  if (demolish) {
    if (objects.find((w) => w.id === demolish.wall)?.owner === demolish.player && points[demolish.player] >= 1) {
      objects = objects.filter((w) => w.id !== demolish.wall)
      points = { ...points, [demolish.player]: points[demolish.player] - 1 }
    } else events.push({ type: 'refused' })
  }
  if (input.damage) {
    const r = damageWall(objects, input.damage.wall, input.damage.at)
    objects = r.objects
    events.push(...r.events)
  }
  let ball = state.ball
  if (input.kick) {
    const k = Math.hypot(input.kick.x, input.kick.y)
    const f = k > config.maxSpeed ? config.maxSpeed / k : 1
    ball = { ...ball, vel: { x: input.kick.x * f, y: input.kick.y * f } }
  }
  let { possession } = state
  const { placeBall } = input
  if (placeBall) {
    if (possession.inHand && placeBall.player === possession.shooter && canPlaceBall(placeBall.player, placeBall.at, objects, config)) {
      ball = { ...ball, pos: placeBall.at, vel: { x: 0, y: 0 } }
      possession = { ...possession, inHand: false }
    } else events.push({ type: 'refused' })
  }
  const { blast } = input
  if (blast) {
    if (blast.player === possession.shooter && !possession.inHand && !possession.live && canBlastFrom(blast.player, blast.origin, { objects, ball }, config)) {
      events.push({ type: 'blast-fired', ...blast })
      possession = { ...possession, live: true }
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
  const rolled = rollBall(ball, objects, config)
  events.push(...rolled.events)
  if (possession.live && !rolled.ball.vel.x && !rolled.ball.vel.y) {
    const r = resolveRest(possession, rolled.ball.pos.y, config)
    possession = r.possession
    events.push(...r.events)
  }
  return { state: { ...state, possession, tick: state.tick + 1, objects: rolled.objects, points, nextId, ball: rolled.ball }, events }
}
