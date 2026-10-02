import { showConnectScreen } from './net/connectScreen'
import { createHud } from './hud/hud'
import { follow, layout, type Camera } from './render/camera'
import { fragmentAlive, render, screenToWorld, shatter, type Fragment } from './render/render'
import { CELL_SIZE, type Point } from './sim/pitch'
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
canvas.onpointermove = (e) => ghost && (ghost = { ...ghost, at: snap(e) })
const toWorld = (e: PointerEvent) => screenToWorld(canvas, camera, e.offsetX * (canvas.width / canvas.clientWidth), e.offsetY * (canvas.height / canvas.clientHeight))
const distToSegment = (p: Point, { a, b }: Segment) => {
  const [vx, vy] = [b.x - a.x, b.y - a.y]
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / (vx * vx + vy * vy)))
  return Math.hypot(p.x - a.x - t * vx, p.y - a.y - t * vy)
}
canvas.onpointerdown = (e) => {
  if (!ghost) {
    // Dev page: with no ghost, tapping a wall damages it.
    const at = toWorld(e)
    const hit = state.objects.find((w) => wallSegments(w).some((s) => distToSegment(at, s) < 1))
    // Otherwise tap to push the ball toward the tap, harder the further away.
    const { pos } = state.ball
    pending = hit ? { damage: { wall: hit.id, at } } : { kick: { x: (at.x - pos.x) * 3, y: (at.y - pos.y) * 3 } }
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
    pending = {}
    for (const ev of r.events) if (ev.type === 'wall-destroyed') fragments.push(...shatter(ev.wall, ev.at, now))
  }

  follow(camera, state.ball.pos.y, Math.min((now - lastFrame) / 1000, 0.25), layout(canvas).visibleHeight)
  lastFrame = now
  const dpr = window.devicePixelRatio || 1
  canvas.width = canvas.clientWidth * dpr
  canvas.height = canvas.clientHeight * dpr
  fragments = fragments.filter((f) => fragmentAlive(f, now))
  render(ctx, state, camera, ghost, fragments, now)
  hud.update(
    { players: { 1: { score: 0, inventory: state.players[1].inventory }, 2: { score: 0, inventory: state.players[2].inventory } }, active: 1, round: 1, rounds: 5, clock: null, shotsLeft: 3, shotsMax: 3, phase: 'Build' },
    { width: canvas.clientWidth, height: canvas.clientHeight },
  )
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
// Connect screen is gated behind #connect so it does not cover the wall dev page.
if (location.hash === '#connect') showConnectScreen()
document.getElementById('splash')?.remove()
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js')
