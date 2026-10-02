import { showConnectScreen } from './net/connectScreen'
import { applyEvents, newFx } from './render/feedback'
import { createHud } from './hud/hud'
import { gestureMove, gesturePower, gestureStart, type Gesture } from './input/gesture'
import { follow, layout, MAP_Y, pan, recenter, viewOutline, type Camera } from './render/camera'
import { fragmentAlive, render, screenToWorld, shatter, waveAlive, type Fragment, type Wave } from './render/render'
import { blastRadius, canBlastFrom } from './sim/blast'
import { CELL_SIZE, halfOf, type Point } from './sim/pitch'
import { canPlaceBall } from './sim/possession'
import { defaultConfig, initialState, step, type SimInput } from './sim/step'
import { wallSegments, type Segment, type Wall } from './sim/wall'

const canvas = document.getElementById('game') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!
const TICK = 1 / defaultConfig.tickHz

let state = initialState()
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
// Dev page: the ghost follows the pointer; a click drops it through the sim as a placeWall input.
let ghost: Omit<Wall, 'id' | 'hp'> | undefined
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
  if (ballGhost && canPlaceBall(state.possession.shooter, ballGhost, state.objects, defaultConfig)) pending = { placeBall: { player: state.possession.shooter, at: ballGhost } }
}
const snap = (e: PointerEvent) => {
  const p = screenToWorld(canvas, camera, e.offsetX * (canvas.width / canvas.clientWidth), e.offsetY * (canvas.height / canvas.clientHeight))
  return { gx: Math.round(p.x / CELL_SIZE), gy: Math.round(p.y / CELL_SIZE) }
}
const spawn = (shape: Wall['shape']) => (ghost = { kind: 'wall', owner: ghost?.owner ?? 1, shape, rotation: ghost?.rotation ?? 0, at: ghost?.at ?? { gx: 10, gy: 27 } })
document.querySelectorAll<HTMLButtonElement>('[data-shape]').forEach((b) => (b.onclick = () => spawn(b.dataset.shape as Wall['shape'])))
document.getElementById('rotate')!.onclick = () => ghost && (ghost = { ...ghost, rotation: ((ghost.rotation + 1) % 4) as Wall['rotation'] })
document.getElementById('damage')!.onclick = () => (ghost = undefined)
const ownerBtn = document.getElementById('owner')!
ownerBtn.onclick = () => {
  const owner = ghost?.owner === 2 ? 1 : 2
  ownerBtn.textContent = `Owner: ${owner}`
  if (ghost) ghost = { ...ghost, owner }
}
// Pan: any drag that is not a charge or ghost drag, a charge that turned into a pan, or two fingers in any phase.
const pointers = new Map<number, Point>()
let panOnly = false
const canvasPx = () => canvas.width / canvas.clientWidth
const panBy = (dyPx: number) => pan(camera, -(dyPx * canvasPx()) / layout(canvas).scale, layout(canvas).visibleHeight)
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
  if (ghost) ghost = { ...ghost, at: snap(e) }
  if (charge) charge.gesture = gestureMove(charge.gesture, { x: e.clientX, y: e.clientY }, performance.now())
}
canvas.onpointerup = (e) => {
  draggingBall = false
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
  if (state.possession.inHand && !ghost) {
    const at = toWorld(e)
    if (ballGhost && Math.hypot(at.x - ballGhost.x, at.y - ballGhost.y) <= 2 * defaultConfig.ballRadius) {
      draggingBall = true
      canvas.setPointerCapture(e.pointerId)
    } else {
      panOnly = true
      tap = { x: e.clientX, y: e.clientY }
    }
    return
  }
  if (!ghost) {
    // Dev page: with no ghost, tapping a wall damages it.
    const at = toWorld(e)
    const hit = state.objects.find((w) => wallSegments(w).some((s) => distToSegment(at, s) < 1))
    const player = halfOf(at.y)
    if (hit) pending = { damage: { wall: hit.id, at } }
    else if (player === state.possession.shooter && !state.possession.live && canBlastFrom(player, at, state, defaultConfig)) {
      canvas.setPointerCapture(e.pointerId)
      charge = { gesture: gestureStart({ x: e.clientX, y: e.clientY }, performance.now()), origin: at, player }
    } else panOnly = true
    return
  }
  ghost = { ...ghost, at: snap(e) }
  pending = { placeWall: ghost }
  recenter(camera)
}
const hud = createHud(document.body, { onMap: () => toggleMap(), onRecenter: () => recenter(camera) })
let acc = 0
let last = performance.now()
let lastFrame = last

function frame(now: number) {
  acc += Math.min((now - last) / 1000, 0.25)
  last = now
  for (; acc >= TICK; acc -= TICK) {
    const r = step(state, pending, defaultConfig)
    state = r.state
    if (!state.possession.inHand) ballGhost = undefined
    if (pending.placeWall || r.events.length) recenter(camera)
    pending = {}
    applyEvents(fx, r.events, state.objects, now)
    for (const ev of r.events) if (ev.type === 'wall-destroyed') fragments.push(...shatter(ev.wall, ev.at, now))
      else if (ev.type === 'blast-fired') {
        waves.push({ origin: ev.origin, radius: blastRadius(ev.power, defaultConfig), born: now })
      }
  }

  if (!camera.held) follow(camera, state.ball.pos.y, Math.min((now - lastFrame) / 1000, 0.25), layout(canvas).visibleHeight)
  lastFrame = now
  confirm.hidden = !state.possession.inHand
  const dpr = window.devicePixelRatio || 1
  canvas.width = canvas.clientWidth * dpr
  canvas.height = canvas.clientHeight * dpr
  fragments = fragments.filter((f) => fragmentAlive(f, now))
  hud.update(
    { players: { 1: { score: 0, inventory: state.players[1].inventory }, 2: { score: 0, inventory: state.players[2].inventory } }, active: 1, round: 1, rounds: 5, clock: null, shotsLeft: 3, shotsMax: 3, phase: 'Build' },
    { width: canvas.clientWidth, height: canvas.clientHeight },
  )
  waves = waves.filter((w) => waveAlive(w, now))
  render(ctx, state, mapOpen ? mapCam : camera, mapOpen ? undefined : ghost, fragments, now, !mapOpen && charge?.gesture.mode === 'charge' ? { origin: charge.origin, player: charge.player, power: gesturePower(charge.gesture, now) } : undefined, waves, fx, ballGhost && { at: ballGhost, legal: canPlaceBall(state.possession.shooter, ballGhost, state.objects, defaultConfig) })
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
