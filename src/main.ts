import { showConnectScreen } from './net/connectScreen'
import { applyEvents, newFx, reducedMotion } from './render/feedback'
import { createScreens } from './screens/screens'
import { configFrom } from './sim/settings'
import { createHud } from './hud/hud'
import { createOverlay } from './hud/overlay'
import { advance, angle, blocking, dismiss, goalBall, newTransition, overlayView } from './hud/transition'
import type { SimEvent } from './sim/step'
import { gestureMove, gesturePower, gestureStart, type Gesture } from './input/gesture'
import { follow, layout, MAP_Y, pan, recenter, viewOutline, type Camera } from './render/camera'
import { fragmentAlive, render, screenToWorld, shatter, waveAlive, type Fragment, type Wave } from './render/render'
import { blastRadius, canBlastFrom } from './sim/blast'
import { CELL_SIZE, HALF_HEIGHT, halfOf, type Point } from './sim/pitch'
import { canPlaceBall } from './sim/possession'
import { defaultConfig, initialState, step, type SimInput, type SimState } from './sim/step'
import { canPlace, wallCost, wallSegments, type Segment, type StructureSpec, type WallShape, type WallSpec } from './sim/wall'

const canvas = document.getElementById('game') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!
let config = defaultConfig
const TICK = 1 / config.tickHz
// The stage rotates as one: canvas, HUD and overlay (the 180-degree handover flip).
const stage = document.createElement('div')
stage.style.cssText = 'position:fixed;inset:0'
canvas.before(stage)
stage.append(canvas)

let state = initialState()
let trans = newTransition(state.possession.shooter)
const overlay = createOverlay(stage, () => (trans = dismiss(trans, performance.now())))
const camera: Camera = { y: state.ball.pos.y }
// Map overlay: a second camera over the whole pitch; the fit/stretch choice lasts the session.
const stored = (() => { try { return sessionStorage.getItem('mapStretch') === '1' } catch { return false } })()
const mapCam: Camera = { y: MAP_Y, map: { stretch: stored } }
let mapOpen = false
// A map jump holds the camera until the next sim event or wall placement, then it returns to the ball.
const mapUi = document.getElementById('map')!
const toggleMap = (open = !mapOpen) => {
  mapOpen = open
  mapUi.style.display = open ? 'flex' : 'none'
}
document.getElementById('map-close')!.onclick = () => toggleMap(false)
document.getElementById('map-stretch')!.onclick = () => {
  mapCam.map!.stretch = !mapCam.map!.stretch
  try { sessionStorage.setItem('mapStretch', mapCam.map!.stretch ? '1' : '0') } catch {}
}
addEventListener('keydown', (e) => {
  if (e.key === 'm' || e.key === 'M') toggleMap()
  else if (e.key === 'Escape') toggleMap(false)
})
// Build turn: pick a shape, drag the ghost, Rotate, Confirm drops it through the sim as a placeWall input.
let ghost: WallSpec | undefined
let demolishing = false
let draggingGhost = false
let fragments: Fragment[] = []
const fx = newFx()
let pending: SimInput = {}
let waves: Wave[] = []
// Dev page: hold on a legal spot to charge a blast; release fires it.
let charge: { gesture: Gesture; origin: Point; player: 1 | 2 } | undefined
// Ball-in-hand: tap a point to place the ghost ball, drag it to move (dragging elsewhere pans), Confirm fixes it.
let ballGhost: Point | undefined
let draggingBall = false
let tap: Point | undefined
const confirm = document.getElementById('confirm') as HTMLButtonElement
confirm.onclick = () => {
  if (ballGhost && canPlaceBall(state.possession.shooter, ballGhost, state.objects, config)) pending = { placeBall: { player: state.possession.shooter, at: ballGhost } }
}
const snap = (e: PointerEvent) => {
  const p = screenToWorld(canvas, camera, e.offsetX * (canvas.width / canvas.clientWidth), e.offsetY * (canvas.height / canvas.clientHeight))
  return { gx: Math.round(p.x / CELL_SIZE), gy: Math.round(p.y / CELL_SIZE) }
}
const spawn = (shape: WallShape) => {
  const b = state.match.builder!
  demolishing = false
  ghost = { kind: 'wall', owner: b, shape, rotation: ghost?.rotation ?? 0, at: ghost?.at ?? { gx: 10, gy: b === 1 ? 40 : 14 } }
}
const rotate = () => ghost && (ghost = { ...ghost, rotation: ((ghost.rotation + 1) % 4) as WallSpec['rotation'] })
const confirmWall = () => {
  if (!ghost || !canPlace(state.objects, ghost) || state.points[ghost.owner] < wallCost(ghost.shape)) return
  pending = { placeWall: ghost }
  ghost = undefined
}
addEventListener('keydown', (e) => {
  if (!state.match.builder) return
  if (e.key === 'r' || e.key === 'R') rotate()
  else if (e.key === 'Enter') confirmWall()
})
// Pan: any drag that is not a charge or ghost drag, a charge that turned into a pan, or two fingers in any phase.
const pointers = new Map<number, Point>()
let panOnly = false
const canvasPx = () => canvas.width / canvas.clientWidth
const panBy = (dyPx: number) => pan(camera, (trans.shown === 2 ? 1 : -1) * (dyPx * canvasPx()) / layout(canvas).scale, layout(canvas).visibleHeight)
canvas.onwheel = (e) => (e.preventDefault(), panBy(-e.deltaY))
addEventListener('keydown', (e) => e.code === 'Space' && (e.preventDefault(), recenter(camera)))
canvas.onpointermove = (e) => {
  if (draggingBall) ballGhost = toWorld(e)
  const prev = pointers.get(e.pointerId)
  if (prev) {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const dy = e.clientY - prev.y
    if (pointers.size > 1) panBy(dy / pointers.size)
    else if (panOnly || (charge && gestureMove(charge.gesture, { x: e.clientX, y: e.clientY }, performance.now()).mode === 'pan')) panBy(dy)
  }
  if (draggingGhost && ghost) ghost = { ...ghost, at: snap(e) }
  if (charge) charge.gesture = gestureMove(charge.gesture, { x: e.clientX, y: e.clientY }, performance.now())
}
canvas.onpointerup = (e) => {
  draggingBall = false
  draggingGhost = false
  if (tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) <= 12) ballGhost = toWorld(e)
  tap = undefined
  pointers.delete(e.pointerId)
  panOnly = false
  const power = charge ? gesturePower(charge.gesture, performance.now()) : 0
  if (charge && power > 0) pending = { blast: { player: charge.player, origin: charge.origin, power } }
  charge = undefined
}
const toWorld = (e: PointerEvent) => screenToWorld(canvas, camera, e.offsetX * (canvas.width / canvas.clientWidth), e.offsetY * (canvas.height / canvas.clientHeight))
const distToSegment = (p: Point, { a, b }: Segment) => {
  const [vx, vy] = [b.x - a.x, b.y - a.y]
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / (vx * vx + vy * vy)))
  return Math.hypot(p.x - a.x - t * vx, p.y - a.y - t * vy)
}
canvas.onpointerdown = (e) => {
  if (mapOpen) {
    const px = e.offsetX * (canvas.width / canvas.clientWidth)
    const py = e.offsetY * (canvas.height / canvas.clientHeight)
    pan(camera, screenToWorld(canvas, mapCam, px, py).y - camera.y, layout(canvas).visibleHeight)
    toggleMap(false)
    return
  }
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  if (pointers.size > 1) {
    charge = undefined
    return
  }
  const builder = state.match.builder
  if (builder) {
    const at = toWorld(e)
    const near = (w: StructureSpec | undefined, r: number) => w && wallSegments(w).some((sg) => distToSegment(at, sg) < r)
    const hit = demolishing ? state.objects.find((w) => w.owner === builder && near(w, 1)) : undefined
    if (hit) pending = { demolish: { player: builder, wall: hit.id } }
    else if (!demolishing && near(ghost, 3)) {
      draggingGhost = true
      canvas.setPointerCapture(e.pointerId)
    } else panOnly = true
    return
  }
  if (state.possession.inHand) {
    const at = toWorld(e)
    if (ballGhost && Math.hypot(at.x - ballGhost.x, at.y - ballGhost.y) <= 2 * config.ballRadius) {
      draggingBall = true
      canvas.setPointerCapture(e.pointerId)
    } else {
      panOnly = true
      tap = { x: e.clientX, y: e.clientY }
    }
    return
  }
  // Dev page: tapping a wall damages it.
  {
    const at = toWorld(e)
    const hit = state.objects.find((w) => wallSegments(w).some((s) => distToSegment(at, s) < 1))
    const player = halfOf(at.y)
    if (hit) pending = { damage: { wall: hit.id, at } }
    else if (player === state.possession.shooter && !state.possession.live && canBlastFrom(player, at, state, config)) {
      canvas.setPointerCapture(e.pointerId)
      charge = { gesture: gestureStart({ x: e.clientX, y: e.clientY }, performance.now()), origin: at, player }
    } else panOnly = true
  }
}
// The seed varies per match; only the sim stays deterministic.
const newMatch = () => {
  state = initialState((Math.random() * 2 ** 31) | 0, config)
  trans = newTransition(state.possession.shooter)
  recenter(camera)
  camera.y = state.ball.pos.y
  matchShown = false
}
let matchShown = true
const screens = createScreens(document.body, {
  onStart: (s) => ((config = configFrom(s)), newMatch()),
  onRematch: newMatch,
  onMenu: () => (matchShown = true),
})
screens.title()
const hud = createHud(stage, { onMap: () => toggleMap(), onRecenter: () => recenter(camera) })
let lastBuilder: SimState['match']['builder'] | undefined
let acc = 0
let last = performance.now()
let lastFrame = last

function frame(now: number) {
  acc += Math.min((now - last) / 1000, 0.25)
  last = now
  // The sim never waits on animations; the shell just stops stepping behind a flip, goal hold or turn card.
  const phase = state.match.builder ? 'Build' : 'Play'
  const turn = (events: SimEvent[]) => (trans = advance(trans, { active: state.match.builder ?? state.possession.shooter, round: state.match.round, inHand: state.possession.inHand, phase, events, now, reduced: reducedMotion() }))
  for (; acc >= TICK; acc -= TICK) {
    if (blocking(trans)) {
      pending = {}
      continue
    }
    const power = charge?.gesture.mode === 'charge' ? gesturePower(charge.gesture, now) : 0
    const r = step(state, power > 0 && charge ? { charging: { origin: charge.origin, power }, ...pending } : pending, config)
    state = r.state
    if (!state.possession.inHand) ballGhost = undefined
    if (!state.match.builder && r.events.length) recenter(camera)
    if (state.match.builder !== lastBuilder) {
      lastBuilder = state.match.builder
      ghost = undefined
      demolishing = false
      if (lastBuilder) pan(camera, (lastBuilder === 1 ? 1.5 : 0.5) * HALF_HEIGHT - camera.y, layout(canvas).visibleHeight)
      else recenter(camera)
    }
    pending = {}
    turn(r.events)
    applyEvents(fx, r.events, state.objects, now)
    for (const ev of r.events) if (ev.type === 'wall-destroyed') fragments.push(...shatter(ev.wall, ev.at, now))
      else if (ev.type === 'blast-fired') {
        waves.push({ origin: ev.origin, radius: blastRadius(ev.power, config), born: now })
      }
  }

  turn([])
  const flipping = !!trans.flip && now - trans.flip.at >= trans.flip.ms / 2
  if (!state.match.builder && (flipping || (trans.overlay?.kind === 'turn' && !trans.flip))) (camera.y = state.ball.pos.y), recenter(camera)
  stage.style.transform = `rotate(${angle(trans, now)}deg)`
  overlay.update(overlayView(trans, now))
  if (!camera.held) follow(camera, state.ball.pos.y, Math.min((now - lastFrame) / 1000, 0.25), layout(canvas).visibleHeight)
  lastFrame = now
  if (state.match.winner && !matchShown) (matchShown = true, screens.matchEnd(state.match.winner, state.match.score))
  confirm.hidden = !state.possession.inHand || !!state.match.builder
  const dpr = window.devicePixelRatio || 1
  canvas.width = canvas.clientWidth * dpr
  canvas.height = canvas.clientHeight * dpr
  fragments = fragments.filter((f) => fragmentAlive(f, now))
  const b = state.match.builder
  const buttons = b
    ? [
        ...(['straight', 'L'] as const).map((shape) => ({ label: `${shape === 'L' ? 'L' : 'Straight'} ${wallCost(shape)}`, selected: ghost?.shape === shape, disabled: state.points[b] < wallCost(shape), onClick: () => spawn(shape) })),
        { label: 'Rotate', disabled: !ghost, onClick: rotate },
        { label: 'Confirm', disabled: !ghost || !canPlace(state.objects, ghost) || state.points[b] < wallCost(ghost.shape), onClick: confirmWall },
        { label: 'Demolish 1', selected: demolishing, disabled: state.points[b] < 1, onClick: () => ((demolishing = !demolishing), (ghost = undefined)) },
        { label: 'Done', onClick: () => (pending = { done: b }) },
      ]
    : undefined
  const { score } = state.match
  hud.update(
    { players: { 1: { score: score[1], inventory: state.players[1].inventory }, 2: { score: score[2], inventory: state.players[2].inventory } }, active: trans.shown, round: state.match.round, rounds: config.rounds, clock: b ? null : { seconds: state.clock.left / config.tickHz, fraction: state.clock.left / (config.shotClock * config.tickHz) }, shotsLeft: state.possession.shots, shotsMax: config.shots, phase: b ? `Build · ${state.points[b]} pts` : phase, buttons },
    { width: canvas.clientWidth, height: canvas.clientHeight },
  )
  waves = waves.filter((w) => waveAlive(w, now))
  const net = goalBall(trans)
  render(ctx, net ? { ...state, ball: { ...state.ball, pos: net, vel: { x: 0, y: 0 } } } : state, mapOpen ? mapCam : camera, mapOpen ? undefined : ghost, fragments, now, !mapOpen && charge?.gesture.mode === 'charge' ? { origin: charge.origin, player: charge.player, power: gesturePower(charge.gesture, now) } : undefined, waves, fx, ballGhost && { at: ballGhost, legal: canPlaceBall(state.possession.shooter, ballGhost, state.objects, config) })
  if (mapOpen) {
    const o = viewOutline(canvas, mapCam, camera)
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2 * dpr
    ctx.strokeRect(o.x, o.y, o.w, o.h)
  }
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
// Connect screen is gated behind #connect so it does not cover the wall dev page.
if (location.hash === '#connect') showConnectScreen()
document.getElementById('splash')?.remove()
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js')
