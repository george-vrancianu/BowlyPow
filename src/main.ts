import { showConnectScreen } from './net/connectScreen'
import { render, screenToWorld } from './render/render'
import { CELL_SIZE } from './sim/pitch'
import { defaultConfig, initialState, step, type SimInput } from './sim/step'
import type { Wall } from './sim/wall'

const canvas = document.getElementById('game') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!
const TICK = 1 / defaultConfig.tickHz

let state = initialState()
// Dev page: the ghost follows the pointer; a click drops it through the sim as a placeWall input.
let ghost: Wall | undefined
let pending: SimInput = {}
const snap = (e: PointerEvent) => {
  const p = screenToWorld(canvas, e.offsetX * (canvas.width / canvas.clientWidth), e.offsetY * (canvas.height / canvas.clientHeight))
  return { gx: Math.round(p.x / CELL_SIZE), gy: Math.round(p.y / CELL_SIZE) }
}
const spawn = (shape: Wall['shape']) => (ghost = { kind: 'wall', owner: ghost?.owner ?? 1, shape, rotation: ghost?.rotation ?? 0, at: ghost?.at ?? { gx: 10, gy: 27 } })
document.querySelectorAll<HTMLButtonElement>('[data-shape]').forEach((b) => (b.onclick = () => spawn(b.dataset.shape as Wall['shape'])))
document.getElementById('rotate')!.onclick = () => ghost && (ghost = { ...ghost, rotation: ((ghost.rotation + 1) % 4) as Wall['rotation'] })
const ownerBtn = document.getElementById('owner')!
ownerBtn.onclick = () => {
  const owner = ghost?.owner === 2 ? 1 : 2
  ownerBtn.textContent = `Owner: ${owner}`
  if (ghost) ghost = { ...ghost, owner }
}
canvas.onpointermove = (e) => ghost && (ghost = { ...ghost, at: snap(e) })
canvas.onpointerdown = (e) => {
  if (!ghost) return
  ghost = { ...ghost, at: snap(e) }
  pending = { placeWall: ghost }
}
let acc = 0
let last = performance.now()

function frame(now: number) {
  acc += Math.min((now - last) / 1000, 0.25)
  last = now
  for (; acc >= TICK; acc -= TICK) {
    state = step(state, pending, defaultConfig).state
    pending = {}
  }

  const dpr = window.devicePixelRatio || 1
  canvas.width = canvas.clientWidth * dpr
  canvas.height = canvas.clientHeight * dpr
  render(ctx, state, ghost)
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
// Connect screen is gated behind #connect so it does not cover the wall dev page.
if (location.hash === '#connect') showConnectScreen()
document.getElementById('splash')?.remove()
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js')
