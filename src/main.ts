import { showConnectScreen } from './net/connectScreen'
import { lockstep } from './net/lockstep'
import type { Peer } from './net/peer'
import { applyEvents, newFx, reducedMotion, STEAL_MS } from './render/feedback'
import { createScreens } from './screens/screens'
import { configFrom, defaultSettings } from './sim/settings'
import { createHud } from './hud/hud'
import { hudModel } from './hud/model'
import { buildMenu, commit, edgeScrollDy, landed, legal, onPiece, pick, rotated, spawn, type Piece, type Selection } from './hud/build'
import { createFab } from './hud/fab'
import { createOverlay } from './hud/overlay'
import { advance, angle, blocking, dismiss, goalBall, newTransition, overlayView } from './hud/transition'
import type { SimEvent } from './sim/step'
import { gestureMove, gesturePower, gestureStart, type Gesture } from './input/gesture'
import { follow, layout, MAP_Y, pan, recenter, viewOutline, type Camera } from './render/camera'
import { fragmentAlive, render, screenToWorld, shatter, waveAlive, type Fragment, type Wave } from './render/render'
import { blastRadius, canBlastFrom } from './sim/blast'
import { CELL_SIZE, HALF_HEIGHT, halfOf, type Point } from './sim/pitch'
import { canArm, canPlaceBall, whoActs } from './sim/possession'
import type { PlayerId } from './sim/pitch'
import { defaultConfig, initialState, step, type SimInput, type SimState } from './sim/step'

const canvas = document.getElementById('game') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!
let config = defaultConfig
const TICK = 1 / config.tickHz
// The stage rotates as one: canvas, HUD and overlay (the 180-degree handover flip).
const stage = document.createElement('div')
stage.style.cssText = 'position:fixed;inset:0'
canvas.before(stage)
stage.append(canvas)

// Online: the sim runs on both peers from the same seed; `me` sits at the bottom and only my own inputs are sent.
const ONLINE_BUILD_SECONDS = 30
let net: { me: PlayerId; peer: Peer; sync: ReturnType<typeof lockstep> } | undefined
const mine = (p: PlayerId | null | undefined) => !net || p === net.me
const canvasPx = () => canvas.width / canvas.clientWidth
const toWorld = (e: PointerEvent) => screenToWorld(canvas, camera, e.offsetX * canvasPx(), e.offsetY * canvasPx())
let state = initialState()
let transition = newTransition(state.possession.shooter)
const overlay = createOverlay(stage, () => (transition = dismiss(transition, performance.now())))
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
// Build turn: the floating menu spawns a piece; drag it by pressing on it, ✓ sends it through the sim, ✕ drops it.
// Pressing one of this turn's structures picks it up again; an older one is only selected, to demolish it.
let selection: Selection | undefined
// A confirmed selection stays drawn until the sim has it (online it runs a few ticks later) or refuses it.
let landing: Selection | undefined
let menuOpen = false
// Grab point relative to the piece's anchor, and the pointer's last canvas position (for edge scrolling).
// `moved` once the pointer has travelled past DRAG_SLOP from the press, which is when edge scrolling may start.
let drag: { offset: Point; px: number; py: number; id: number; from: Point; moved: boolean } | undefined
const DRAG_SLOP = 6
let fragments: Fragment[] = []
const fx = newFx()
let pending: SimInput = {}
let waves: Wave[] = []
// Dev page: hold on a legal spot to charge a blast; release fires it.
// Breaker icon armed for the next blast; the blast carries it, cancelling just disarms.
let armed = false
let charge: { gesture: Gesture; origin: Point; player: 1 | 2 } | undefined
// Ball-in-hand: tap a point to place the ghost ball, drag it to move (dragging elsewhere pans), Confirm fixes it.
let ballGhost: Point | undefined
let draggingBall = false
let tap: Point | undefined
const confirm = document.getElementById('confirm') as HTMLButtonElement
const confirmBall = () => {
  const { shooter } = state.possession
  if (mine(shooter) && ballGhost && canPlaceBall(shooter, ballGhost, state.objects, config)) pending = { placeBall: { player: shooter, at: ballGhost } }
}
confirm.onclick = confirmBall
const pxToWorld = (px: number, py: number) => screenToWorld(canvas, camera, px * canvasPx(), py * canvasPx())
// Drags keep the grab point under the finger and snap the anchor to the grid.
const dragTo = (px: number, py: number) => {
  if (!drag || !selection) return
  const p = pxToWorld(px, py)
  drag = { ...drag, px, py, moved: drag.moved || Math.hypot(px - drag.from.x, py - drag.from.y) > DRAG_SLOP }
  selection = { ...selection, spec: { ...selection.spec, at: { gx: Math.round((p.x - drag.offset.x) / CELL_SIZE), gy: Math.round((p.y - drag.offset.y) / CELL_SIZE) } } }
}
const build = {
  toggle: () => (menuOpen = !menuOpen),
  spawn: (p: Piece) => {
    const b = state.match.builder
    if (b && mine(b)) (selection = spawn(p, b, camera.y)), (menuOpen = false)
  },
  rotate: () => selection?.movable && (selection = rotated(selection)),
  cancel: () => (selection = undefined),
  confirm: () => {
    const input = !landing && selection && legal(state, selection) && commit(selection)
    if (input) (pending = input), (landing = selection), (selection = undefined)
  },
  remove: () => {
    if (selection?.id !== undefined) pending = { demolish: { player: selection.spec.owner, wall: selection.id } }
    selection = undefined
  },
}
// Desktop keys: M map, Space recenter, R rotate, Enter confirm, Esc close the map or cancel the selection.
addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase()
  if (key === 'm') toggleMap()
  else if (key === 'escape') mapOpen ? toggleMap(false) : ((selection = ballGhost = undefined), (menuOpen = false))
  else if (key === 'r') build.rotate()
  else if (key === 'enter') state.match.builder ? build.confirm() : confirmBall()
})
// Pan: any drag that is not a charge or ghost drag, a charge that turned into a pan, or two fingers in any phase.
const pointers = new Map<number, Point>()
let panOnly = false
const panBy = (dyPx: number) => pan(camera, (transition.shown === 2 ? 1 : -1) * (dyPx * canvasPx()) / layout(canvas).scale, layout(canvas).visibleHeight)
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
  if (drag?.id === e.pointerId) dragTo(e.offsetX, e.offsetY)
  if (charge) charge.gesture = gestureMove(charge.gesture, { x: e.clientX, y: e.clientY }, performance.now())
}
// A cancelled pointer (the browser took the gesture) ends like a release.
canvas.onpointercancel = (e) => canvas.onpointerup!(e)
canvas.onpointerup = (e) => {
  draggingBall = false
  if (drag?.id === e.pointerId) drag = undefined
  if (tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) <= 12) ballGhost = toWorld(e)
  tap = undefined
  pointers.delete(e.pointerId)
  panOnly = false
  const power = charge ? gesturePower(charge.gesture, performance.now()) : 0
  if (charge && power > 0) pending = { blast: { player: charge.player, origin: charge.origin, power, breaker: armed } }
  else if (charge) armed = false
  charge = undefined
}
canvas.onpointerdown = (e) => {
  if (mapOpen) {
    pan(camera, screenToWorld(canvas, mapCam, e.offsetX * canvasPx(), e.offsetY * canvasPx()).y - camera.y, layout(canvas).visibleHeight)
    toggleMap(false)
    return
  }
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  if (pointers.size > 1) {
    charge = drag = undefined
    return
  }
  const builder = state.match.builder
  if (builder) {
    if (!mine(builder)) {
      panOnly = true
      return
    }
    menuOpen = false
    const at = toWorld(e)
    // On the piece: half a cell, or a 44px touch target.
    const tolerance = Math.max(CELL_SIZE / 2, (22 * canvasPx()) / layout(canvas).scale)
    if (!selection) selection = pick(state, builder, at, tolerance)
    if (selection?.movable && onPiece(selection.spec, at, tolerance)) {
      const anchor = { x: selection.spec.at.gx * CELL_SIZE, y: selection.spec.at.gy * CELL_SIZE }
      drag = { offset: { x: at.x - anchor.x, y: at.y - anchor.y }, px: e.offsetX, py: e.offsetY, id: e.pointerId, from: { x: e.offsetX, y: e.offsetY }, moved: false }
      canvas.setPointerCapture(e.pointerId)
    } else panOnly = true
    return
  }
  if (state.possession.inHand) {
    if (!mine(state.possession.shooter)) {
      panOnly = true
      return
    }
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
  const at = toWorld(e)
  const player = halfOf(at.y)
  if (player === state.possession.shooter && mine(player) && !state.possession.live && canBlastFrom(player, at, state, config)) {
    canvas.setPointerCapture(e.pointerId)
    charge = { gesture: gestureStart({ x: e.clientX, y: e.clientY }, performance.now()), origin: at, player }
  } else panOnly = true
}
// The seed varies per match; only the sim stays deterministic.
const newMatch = (seed = (Math.random() * 2 ** 31) | 0) => {
  state = initialState(seed, config)
  transition = newTransition(net ? net.me : state.possession.shooter)
  recenter(camera)
  camera.y = state.ball.pos.y
  matchShown = false
}
let matchShown = true
const screens = createScreens(document.body, {
  onStart: (s) => ((config = configFrom(s)), newMatch()),
  onRematch: () => newMatch(),
  onMenu: () => (matchShown = true),
  onOnline: () => showConnectScreen(onLink),
})
// Host is player 1 and picks the seed; the guest starts when it arrives. A drop mid-match ends it with a message.
function startOnline(peer: Peer, me: PlayerId, seed: number) {
  config = { ...configFrom(defaultSettings), buildTime: ONLINE_BUILD_SECONDS }
  net = { me, peer, sync: lockstep((f) => peer.send({ type: 'frame', ...f }), me) }
  screens.hide()
  newMatch(seed)
}
function onLink(peer: Peer, hosting: boolean, status: 'connected' | 'disconnected') {
  if (status === 'disconnected') {
    if (net && !state.match.winner) (net = undefined, matchShown = true, screens.notice('Opponent disconnected'))
    return
  }
  peer.onMessage = (m) => (m.type === 'start' ? startOnline(peer, 2, m.seed) : net?.sync.receive(m))
  if (hosting) {
    const seed = (Math.random() * 2 ** 31) | 0
    peer.send({ type: 'start', seed })
    startOnline(peer, 1, seed)
  }
}
screens.title()
const fab = createFab(stage)
// While dragging near the top or bottom tenth of the view, scroll toward any of the builder's half that is off screen.
function edgeScroll(builder: PlayerId, dt: number) {
  const { visibleHeight } = layout(canvas)
  const dy = edgeScrollDy(camera.y, visibleHeight, builder, pxToWorld(drag!.px, drag!.py).y, dt)
  if (!dy) return
  pan(camera, dy, visibleHeight)
  dragTo(drag!.px, drag!.py)
}
const hud = createHud(stage, { onMap: () => toggleMap(), onRecenter: () => recenter(camera), onPowerUp: (p) => p === 'breaker' && mine(state.possession.shooter) && canArm(state, state.possession.shooter) && (armed = !armed) })
// Online: the charge last submitted, in 1/CHARGE_STEPS of full power.
const CHARGE_STEPS = 20
let sentCharge = 0
let lastBuilder: SimState['match']['builder'] | undefined
let acc = 0
let last = performance.now()
let lastFrame = last

const roundOf = (m: SimState['match']): number | undefined => {
  switch (m.mode) {
    case 'rounds':
      return m.round
    case 'siege':
      return undefined
    default:
      return m satisfies never
  }
}

const showMatchEnd = (m: SimState['match'], winner: PlayerId) => {
  switch (m.mode) {
    case 'rounds':
      return screens.matchEnd(winner, m.score, !!net)
    case 'siege':
      return // no end condition yet
    default:
      return m satisfies never
  }
}

function frame(now: number) {
  acc += Math.min((now - last) / 1000, 0.25)
  last = now
  // The sim never waits on animations; the shell just stops stepping behind a flip, goal hold or turn card.
  const phase = state.match.builder ? 'Build' : 'Play'
  const announce = (events: SimEvent[]) => (transition = advance(transition, { handover: !net, active: net ? net.me : whoActs(state), round: roundOf(state.match), inHand: state.possession.inHand, phase, events, now, reduced: reducedMotion() }))
  for (; acc >= TICK; acc -= TICK) {
    if (blocking(transition)) {
      pending = {}
      continue
    }
    const power = charge?.gesture.mode === 'charge' ? gesturePower(charge.gesture, now) : 0
    let input = power > 0 && charge && !net ? { charging: { origin: charge.origin, power }, ...pending } : pending
    if (net) {
      // Only changes in the charge (in steps) go over the wire; the lockstep holds it for the shot-clock auto-fire.
      const steps = charge ? Math.round(power * CHARGE_STEPS) : 0
      if (steps !== sentCharge) pending = { ...pending, charging: { origin: charge?.origin ?? { x: 0, y: 0 }, power: steps / CHARGE_STEPS } }
      sentCharge = steps
      net.sync.submit(pending)
      pending = {}
      const merged = net.sync.advance(state.possession.shooter)
      if (!merged) {
        acc = Math.min(acc, TICK)
        break
      }
      input = merged
    }
    const tick = step(state, input, config)
    state = tick.state
    if (!canArm(state, state.possession.shooter)) armed = false
    if (!state.possession.inHand) ballGhost = undefined
    if (!state.match.builder && tick.events.length) recenter(camera)
    if (state.match.builder !== lastBuilder) {
      // Done or the build timer drops the selection: a new piece is gone, a moved one never left its spot in the sim.
      lastBuilder = state.match.builder
      selection = landing = drag = undefined
      menuOpen = false
      if (lastBuilder) pan(camera, (lastBuilder === 1 ? 1.5 : 0.5) * HALF_HEIGHT - camera.y, layout(canvas).visibleHeight)
      else recenter(camera)
    }
    if (landing && (landed(state, landing) || tick.events.some((ev) => ev.type === 'refused'))) landing = undefined
    pending = {}
    announce(tick.events)
    applyEvents(fx, tick.events, state.objects, now)
    for (const ev of tick.events) if (ev.type === 'wall-destroyed') fragments.push(...shatter(ev.wall, ev.at, now))
      else if (ev.type === 'steal-triggered') fragments.push(...shatter(ev.tower, ev.at, now + STEAL_MS))
      else if (ev.type === 'blast-fired') {
        waves.push({ origin: ev.origin, radius: blastRadius(ev.power, config), born: now })
      }
  }

  announce([])
  const flipping = !!transition.flip && now - transition.flip.at >= transition.flip.ms / 2
  if (!state.match.builder && (flipping || (transition.overlay?.kind === 'turn' && !transition.flip))) (camera.y = state.ball.pos.y), recenter(camera)
  stage.style.transform = `rotate(${angle(transition, now)}deg)`
  overlay.update(overlayView(transition, now))
  if (drag?.moved && state.match.builder) edgeScroll(state.match.builder, Math.min((now - lastFrame) / 1000, 0.25))
  if (!camera.held) follow(camera, state.ball.pos.y, Math.min((now - lastFrame) / 1000, 0.25), layout(canvas).visibleHeight)
  lastFrame = now
  if (state.match.winner && !matchShown) (matchShown = true, showMatchEnd(state.match, state.match.winner))
  confirm.hidden = !state.possession.inHand || !!state.match.builder || !mine(state.possession.shooter)
  const dpr = window.devicePixelRatio || 1
  canvas.width = canvas.clientWidth * dpr
  canvas.height = canvas.clientHeight * dpr
  fragments = fragments.filter((f) => fragmentAlive(f, now))
  const b = state.match.builder
  const shooter = state.possession.shooter
  const size = { width: canvas.clientWidth, height: canvas.clientHeight }
  const building = b && mine(b) ? b : undefined
  // The defence turn: the scorer is offered Repair once the GOAL banner is gone (#39 adds Rearrange here).
  const choosing = state.match.choosing && mine(state.match.choosing) && !blocking(transition) ? state.match.choosing : undefined
  hud.update(hudModel(state, config, { active: transition.shown, buttons: (building && [{ label: 'Done', onClick: () => (pending = { done: building }) }]) || (choosing && [{ label: 'Repair', onClick: () => (pending = { defence: { player: choosing, choice: 'repair' } }) }]), armed, tappable: mine(shooter) && canArm(state, shooter) }), size)
  fab.update(building && !mapOpen ? buildMenu(state, building, { open: menuOpen, selection, landing: !!landing }, build) : undefined, build.toggle, size, transition.shown === 2)
  waves = waves.filter((w) => waveAlive(w, now))
  const inNet = goalBall(transition)
  render(ctx, inNet ? { ...state, ball: { ...state.ball, pos: inNet, vel: { x: 0, y: 0 } } } : state, mapOpen ? mapCam : camera, {
    ghost: mapOpen || !selection?.movable ? undefined : selection.spec,
    landing: mapOpen ? undefined : landing?.spec,
    hidden: mapOpen ? [] : [selection?.movable ? selection.id : undefined, landing?.id].filter((id) => id !== undefined),
    selected: !mapOpen && selection && !selection.movable ? selection.id : undefined,
    movable: building && !mapOpen ? state.built : undefined,
    fragments,
    now,
    charge: !mapOpen && charge?.gesture.mode === 'charge' ? { origin: charge.origin, player: charge.player, power: gesturePower(charge.gesture, now) } : undefined,
    waves,
    fx,
    ballGhost: ballGhost && { at: ballGhost, legal: canPlaceBall(shooter, ballGhost, state.objects, config) },
    armed: armed || state.breaker ? shooter : undefined,
  })
  if (mapOpen) {
    const o = viewOutline(canvas, mapCam, camera)
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2 * dpr
    ctx.strokeRect(o.x, o.y, o.w, o.h)
  }
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
document.getElementById('splash')?.remove()
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js')
