import { render } from './render/render'
import { defaultConfig, initialState, step } from './sim/step'

const canvas = document.getElementById('game') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!
const TICK = 1 / defaultConfig.tickHz

let state = initialState()
let acc = 0
let last = performance.now()

function frame(now: number) {
  acc += Math.min((now - last) / 1000, 0.25)
  last = now
  for (; acc >= TICK; acc -= TICK) state = step(state, {}, defaultConfig).state

  const dpr = window.devicePixelRatio || 1
  canvas.width = canvas.clientWidth * dpr
  canvas.height = canvas.clientHeight * dpr
  render(ctx, state)
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
document.getElementById('splash')?.remove()
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js')
