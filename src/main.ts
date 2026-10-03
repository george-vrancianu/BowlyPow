import { Game, type HudView } from './game/Game'
import { createFab } from './hud/fab'
import { createHud } from './hud/hud'
import { createOverlay } from './hud/overlay'
import { createScreens } from './screens/screens'

const canvas = document.getElementById('game') as HTMLCanvasElement
// The stage rotates as one: canvas, HUD and overlay (the 180-degree handover flip).
const stage = document.createElement('div')
stage.style.cssText = 'position:fixed;inset:0'
canvas.before(stage)
stage.append(canvas)

const confirm = document.getElementById('confirm') as HTMLButtonElement
const mapUi = document.getElementById('map')!
const overlay = createOverlay(stage, () => game.actions.dismiss())
const fab = createFab(stage)
const hud = createHud(stage, { onMap: () => game.actions.map(), onRecenter: () => game.actions.recenter(), onPowerUp: (p) => game.actions.powerUp(p) })
let matchShown = true
const screens = createScreens(document.body, {
  onStart: (s) => ((matchShown = false), game.actions.start(s)),
  onRematch: () => ((matchShown = false), game.actions.rematch()),
  onMenu: () => (matchShown = true),
})

// The HUD and screens are fed only from the game's view.
const game = new Game(canvas, (v: HudView) => {
  stage.style.transform = `rotate(${v.angle}deg)`
  overlay.update(v.overlay)
  hud.update(v.hud, v.size)
  fab.update(v.menu, game.actions.build.toggle, v.size, v.flipped)
  confirm.hidden = !v.confirm
  mapUi.style.display = v.mapOpen ? 'flex' : 'none'
  if (v.winner && !matchShown) (matchShown = true, screens.matchEnd(v.winner, v.result))
})
confirm.onclick = game.actions.confirmBall
document.getElementById('map-close')!.onclick = () => game.actions.map(false)
document.getElementById('map-stretch')!.onclick = game.actions.mapStretch
screens.title()
document.getElementById('splash')?.remove()
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js')
