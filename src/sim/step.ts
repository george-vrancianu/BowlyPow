import { goalCrossed, HALF_HEIGHT, PITCH_WIDTH, type PlayerId, type Point } from './pitch'
import { coinFlip, endRound, firstBuilder, newMatch, startingPossession, type Match } from './match'
import { initialPlayers, type Player } from './player'
import { rollBall, type Ball } from './ball'
import { blastDamage, blastPush, canBlastFrom } from './blast'
import { canPlaceBall, opponent, resolveRest, type Possession } from './possession'
import { canPlace, damageWall, maxHp, TOWER_COST, wallCost, type Structure, type StructureSpec } from './wall'

/** Anything that lives on the pitch (balls, walls, towers) will join this union in later tickets. */
export type SimObject = Structure

export type SimEvent =
  | { type: 'wall-cracked'; id: number; hp: number; at: Point }
  /** Carries the removed wall (hp 0) so the renderer can shatter it. */
  | { type: 'wall-destroyed'; wall: Structure; at: Point }
  | { type: 'ball-hit-wall'; wall: number; speed: number; at: Point }
  /** An illegal placement or demolition was dropped. */
  | { type: 'refused' }
  | { type: 'blast-fired'; player: PlayerId; origin: Point; power: number }
  | { type: 'possession-changed'; shooter: PlayerId; inHand: boolean }
  | { type: 'goal'; scorer: PlayerId; at: Point }
  /** `scorer` null = the shot cap ended the round. */
  | { type: 'round-ended'; round: number; scorer: PlayerId | null }
  | { type: 'match-ended'; winner: PlayerId }
  | { type: 'shot-clock-expired'; player: PlayerId }
  | { type: 'repulsor-fired'; tower: number; at: Point }

export type SimState = {
  tick: number
  objects: SimObject[]
  players: Record<PlayerId, Player>
  /** Wall points; demolishing spends them. */
  points: Record<PlayerId, number>
  nextId: number
  ball: Ball
  possession: Possession
  match: Match
  /** Shot clock: ticks left (frozen while a shot is live) and consecutive expiries in this possession. */
  clock: { left: number; expiries: number }
}

/** Per-tick input from both players; filled out by later tickets. `demolish.wall` is a wall id. */
export type SimInput = {
  blast?: { player: PlayerId; origin: Point; power: number }
  placeWall?: StructureSpec
  demolish?: { player: PlayerId; wall: number }
  damage?: { wall: number; at: Point }
  kick?: Point
  /** The shooter's blast charge in progress; fires at this power when the shot clock runs out. */
  charging?: { origin: Point; power: number }
  /** Confirm ball-in-hand: the shooter's ball goes to `at`. */
  /** The builder ends their build turn. */
  done?: PlayerId
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
  rounds: number
  /** Wall points per build phase. */
  wallPoints: number
  /** Shots in a round before it ends scoreless (not in sudden death). */
  shotCap: number
  /** Seconds per shot. */
  shotClock: number
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
  rounds: 5,
  wallPoints: 10,
  shotCap: 30,
  shotClock: 15,
}

export function initialState(seed = 1, config: SimConfig = defaultConfig): SimState {
  return { tick: 0, objects: [], players: initialPlayers(), points: { 1: config.wallPoints, 2: config.wallPoints }, nextId: 1, ball: { pos: { x: PITCH_WIDTH / 2, y: HALF_HEIGHT }, vel: { x: 0, y: 0 }, rolled: 0 }, possession: startingPossession(coinFlip(seed, 1), config), match: newMatch(seed), clock: { left: config.shotClock * config.tickHz, expiries: 0 } }
}

/** Pure and deterministic: no DOM, no randomness. */
export function step(
  state: SimState,
  input: SimInput,
  config: SimConfig,
): { state: SimState; events: SimEvent[] } {
  if (state.match.winner) return { state, events: [] }
  let { objects, points, nextId } = state
  let { match } = state
  const events: SimEvent[] = []
  const building = match.builder !== null
  let { players } = state
  const { placeWall, demolish } = input
  if (placeWall) {
    const cost = placeWall.kind === 'wall' ? wallCost(placeWall.shape) : TOWER_COST
    const power = placeWall.kind === 'tower' ? placeWall.power : undefined
    const stocked = !power || players[placeWall.owner].inventory[power] > 0
    if (placeWall.owner === match.builder && stocked && points[placeWall.owner] >= cost && canPlace(objects, placeWall)) {
      if (power) players = { ...players, [placeWall.owner]: { ...players[placeWall.owner], inventory: { ...players[placeWall.owner].inventory, [power]: players[placeWall.owner].inventory[power] - 1 } } }
      objects = [...objects, { ...placeWall, id: nextId++, hp: maxHp(placeWall) }]
      points = { ...points, [placeWall.owner]: points[placeWall.owner] - cost }
    } else events.push({ type: 'refused' })
  }
  if (demolish) {
    if (demolish.player === match.builder && objects.find((w) => w.id === demolish.wall)?.owner === demolish.player && points[demolish.player] >= 1) {
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
    if (!building && possession.inHand && placeBall.player === possession.shooter && canPlaceBall(placeBall.player, placeBall.at, objects, config)) {
      ball = { ...ball, pos: placeBall.at, vel: { x: 0, y: 0 } }
      possession = { ...possession, inHand: false }
    } else events.push({ type: 'refused' })
  }
  let { clock } = state
  const expired = !building && !possession.live && clock.left <= 1
  if (!building && !possession.live) clock = { ...clock, left: clock.left - 1 }
  const { charging } = input
  const blast = input.blast ?? (expired && charging && canBlastFrom(possession.shooter, charging.origin, { objects, ball }, config) ? { player: possession.shooter, ...charging } : undefined)
  if (blast) {
    if (!building && blast.player === possession.shooter && !possession.inHand && !possession.live && canBlastFrom(blast.player, blast.origin, { objects, ball }, config)) {
      events.push({ type: 'blast-fired', ...blast })
      possession = { ...possession, live: true }
      match = { ...match, roundShots: match.roundShots + 1 }
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
  if (expired) {
    const shooter = possession.shooter
    events.push({ type: 'shot-clock-expired', player: shooter })
    if (!possession.live) {
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
  const { done } = input
  if (done) {
    if (done === match.builder) match = { ...match, builder: done === firstBuilder(match.seed, match.round) ? opponent(done) : null }
    else events.push({ type: 'refused' })
  }
  const rolled = rollBall(ball, objects, config)
  events.push(...rolled.events)
  let out = rolled.ball
  // A Repulsor rearms when the ball rests.
  if (!out.vel.x && !out.vel.y && rolled.objects.some((o) => o.kind === 'tower' && o.spent)) rolled.objects = rolled.objects.map((o) => (o.kind === 'tower' && o.spent ? { ...o, spent: false } : o))
  const conceder = goalCrossed(ball.pos, out.pos)
  let rested = false
  if (conceder) events.push({ type: 'goal', scorer: opponent(conceder), at: out.pos })
  else if (possession.live && !out.vel.x && !out.vel.y) {
    rested = true
    const r = resolveRest(possession, out.pos.y, config)
    possession = r.possession
    events.push(...r.events)
  }
  const ended = conceder || (rested && match.roundShots >= config.shotCap && match.round <= config.rounds)
  if (ended) {
    const e = endRound(match, conceder && opponent(conceder), config)
    match = e.match
    possession = e.possession
    out = { ...out, pos: e.ball, vel: { x: 0, y: 0 } }
    events.push(...e.events)
  }
  if (match.builder && match.builder !== state.match.builder) points = { ...points, [match.builder]: config.wallPoints }
  if (!match.builder && state.match.builder) clock = { left: config.shotClock * config.tickHz, expiries: 0 }
  if (possession.shooter !== state.possession.shooter || fired || ended) clock = { ...clock, expiries: 0 }
  if (expired || fired || ended || (state.possession.live && !possession.live) || possession.shooter !== state.possession.shooter) clock = { ...clock, left: config.shotClock * config.tickHz }
  return { state: { ...state, players, possession, match, clock, tick: state.tick + 1, objects: rolled.objects, points, nextId, ball: out }, events }
}
