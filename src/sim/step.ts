import { HALF_HEIGHT, PITCH_WIDTH, type PlayerId, type Point } from './pitch'
import { initialPlayers, type Player } from './player'
import { rollBall, type Ball } from './ball'
import { WALL_HP, damageWall, type Wall, type WallSpec } from './wall'

/** Anything that lives on the pitch (balls, walls, towers) will join this union in later tickets. */
export type SimObject = Wall

export type SimEvent =
  | { type: 'wall-cracked'; id: number; hp: number; at: Point }
  /** Carries the removed wall (hp 0) so the renderer can shatter it. */
  | { type: 'wall-destroyed'; wall: Wall; at: Point }
  | { type: 'ball-hit-wall'; wall: number; speed: number; at: Point }

export type SimState = {
  tick: number
  objects: SimObject[]
  players: Record<PlayerId, Player>
  nextId: number
  ball: Ball
}

/** Per-tick input from both players; filled out by later tickets. */
export type SimInput = { blast?: { origin: Point; power: number }; placeWall?: WallSpec; damage?: { wall: number; at: Point }; kick?: Point }

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
}

export function initialState(): SimState {
  return { tick: 0, objects: [], players: initialPlayers(), nextId: 1, ball: { pos: { x: PITCH_WIDTH / 2, y: HALF_HEIGHT }, vel: { x: 0, y: 0 }, rolled: 0 } }
}

/** Pure and deterministic: no DOM, no randomness. */
export function step(
  state: SimState,
  input: SimInput,
  config: SimConfig,
): { state: SimState; events: SimEvent[] } {
  let { objects, nextId } = state
  const events: SimEvent[] = []
  if (input.placeWall) objects = [...objects, { ...input.placeWall, id: nextId++, hp: WALL_HP }]
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
  const rolled = rollBall(ball, objects, config)
  events.push(...rolled.events)
  return { state: { ...state, tick: state.tick + 1, objects: rolled.objects, nextId, ball: rolled.ball }, events }
}
