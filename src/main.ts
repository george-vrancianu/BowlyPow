import { showConnectScreen } from './net/connectScreen'
import { createHud } from './hud/hud'
import { gestureMove, gesturePower, gestureStart, type Gesture } from './input/gesture'
import { follow, layout, pan, recenter, type Camera } from './render/camera'
import { fragmentAlive, render, screenToWorld, shatter, waveAlive, type Fragment, type Wave } from './render/render'
import { blastRadius, canBlastFrom } from './sim/blast'
import { CELL_SIZE, halfOf, type Point } from './sim/pitch'
import { defaultConfig, initialState, step, type SimInput } from './sim/step'
import { wallSegments, type Segment, type Wall } from './sim/wall'

const canvas = document.getElementById('game') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!
const TICK = 1 / defaultConfig.tickHz

let state = initialState()
const camera: Camera = { y: state.ball.pos.y }
// Dev page: the ghost follows the pointer; a click drops it through the sim as a placeWall input.
let ghost: Omit<Wall, 'id' | 'hp'> | undefined
let fragments: Fragment[] = []
let pending: SimInput = {}
let waves: Wave[] = []
let shake = { born: -Infinity, power: 0 }
// Dev page: hold on a legal spot to charge a blast; release fires it.
let charge: { gesture: Gesture; origin: Point; player: 1 | 2 } | undefined
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
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  if (pointers.size > 1) {
    charge = undefined
    return
  }
  if (!ghost) {
    // Dev page: with no ghost, tapping a wall damages it.
    const at = toWorld(e)
    const hit = state.objects.find((w) => wallSegments(w).some((s) => distToSegment(at, s) < 1))
    const player = halfOf(at.y)
    if (hit) pending = { damage: { wall: hit.id, at } }
    else if (player && canBlastFrom(player, at, state, defaultConfig)) {
      canvas.setPointerCapture(e.pointerId)
      charge = { gesture: gestureStart({ x: e.clientX, y: e.clientY }, performance.now()), origin: at, player }
    } else panOnly = true
    return
  }
  ghost = { ...ghost, at: snap(e) }
  pending = { placeWall: ghost }
}
const hud = createHud(document.body, { onMap: () => {}, onRecenter: () => (camera.y = state.ball.pos.y) })
let acc = 0
let last = performance.now()
let lastFrame = last

function frame(now: number) {
  acc += Math.min((now - last) / 1000, 0.25)
  last = now
  for (; acc >= TICK; acc -= TICK) {
    const r = step(state, pending, defaultConfig)
    state = r.state
    if (pending.placeWall || r.events.length) recenter(camera)
    pending = {}
    for (const ev of r.events) if (ev.type === 'wall-destroyed') fragments.push(...shatter(ev.wall, ev.at, now))
      else if (ev.type === 'blast-fired') {
        waves.push({ origin: ev.origin, radius: blastRadius(ev.power, defaultConfig), born: now })
        shake = { born: now, power: ev.power }
      }
  }

  if (!camera.held) follow(camera, state.ball.pos.y, Math.min((now - lastFrame) / 1000, 0.25), layout(canvas).visibleHeight)
  lastFrame = now
  const dpr = window.devicePixelRatio || 1
  canvas.width = canvas.clientWidth * dpr
  canvas.height = canvas.clientHeight * dpr
  fragments = fragments.filter((f) => fragmentAlive(f, now))
  hud.update(
    { players: { 1: { score: 0, inventory: state.players[1].inventory }, 2: { score: 0, inventory: state.players[2].inventory } }, active: 1, round: 1, rounds: 5, clock: null, shotsLeft: 3, shotsMax: 3, phase: 'Build' },
    { width: canvas.clientWidth, height: canvas.clientHeight },
  )
  waves = waves.filter((w) => waveAlive(w, now))
  const age = now - shake.born
  const amp = shake.power > 0.3 && age < 200 ? 4 * shake.power * (1 - age / 200) : 0
  canvas.style.transform = amp ? `translate(${Math.sin(age * 0.9) * amp}px, ${Math.cos(age * 1.3) * amp}px)` : ''
  render(ctx, state, camera, ghost, fragments, now, charge?.gesture.mode === 'charge' ? { origin: charge.origin, player: charge.player, power: gesturePower(charge.gesture, now) } : undefined, waves)
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
// Connect screen is gated behind #connect so it does not cover the wall dev page.
if (location.hash === '#connect') showConnectScreen()
document.getElementById('splash')?.remove()
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js')
