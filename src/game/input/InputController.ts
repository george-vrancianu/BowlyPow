import { rules } from '../../config/rules'
import { visual } from '../../config/visual'
import { halfOf, type PlayerId, type Point } from '../../sim/pitch'
import { canArm, canPlaceBall } from '../../sim/possession'
import type { Aiming, SimConfig, SimInput, SimState } from '../../sim/step'
import { vertexToWorld } from '../../sim/wall'
import { layout, type Camera } from '../entities/Camera'
import type { Charge } from '../entities/Aim'
import { commit, edgeScrollDy, landed, legal, onPiece, pick, rotated, spawn, type BuildActions, type Piece, type Selection } from '../view/buildMenu'
import { chargeDir, gestureMove, gesturePower, gestureStart, type Gesture } from './gesture'

/** What the controller needs from the game that owns it. */
export type InputHost = {
  canvas: HTMLCanvasElement
  camera: Camera
  mapCam: Camera
  state(): SimState
  config(): SimConfig
  /** Whose end of the pitch is at the bottom of the screen. */
  shown(): PlayerId
  mapOpen(): boolean
  /** A flip, goal hold, turn card, reveal or REPAIRED sweep is up: the board is not the player's to act on yet. */
  blocked(): boolean
  toggleMap(open?: boolean): void
  send(input: SimInput): void
}

/** Turns canvas gestures and keys into sim inputs (through the host) and camera moves, and owns the build and aim interaction state. */
export class InputController {
  /** The builder's selection: a new piece, or one of their structures. */
  selection?: Selection
  /** A confirmed selection stays drawn until the sim has it (online it runs a few ticks later) or refuses it. */
  landing?: Selection
  menuOpen = false
  /** Ball-in-hand: the ghost ball. */
  ballGhost?: Point
  /** Breaker icon armed for the next shot; the shot carries it, cancelling just disarms. */
  armed = false

  // TEMPORARY adapter (remove in the Touch shot ticket, #70): hold on your half off the ball to charge; release shoots the ball straight away from the press.
  private charge?: { gesture: Gesture; origin: Point; player: PlayerId }
  // Grab point relative to the piece's anchor, and the pointer's last canvas position (for edge scrolling).
  // `moved` once the pointer has travelled past visual.input.dragSlopPx from the press, which is when edge scrolling may start.
  private drag?: { offset: Point; px: number; py: number; id: number; from: Point; moved: boolean }
  private draggingBall = false
  private tap?: Point
  // Pan: any drag that is not a charge or ghost drag, a charge that turned into a pan, or two fingers in any phase.
  private pointers = new Map<number, Point>()
  private panOnly = false
  private stop = new AbortController()

  constructor(private host: InputHost) {
    const { canvas } = host
    const on = (target: EventTarget, type: string, fn: (e: never) => void, passive?: boolean) => target.addEventListener(type, fn as EventListener, { signal: this.stop.signal, passive })
    // Desktop keys: M map, Space recenter, R rotate, Enter confirm, Esc close the map or cancel the selection.
    on(globalThis as unknown as EventTarget, 'keydown', (e: KeyboardEvent) => this.key(e))
    on(canvas, 'wheel', (e: WheelEvent) => (e.preventDefault(), this.panBy(-e.deltaY)), false)
    on(canvas, 'pointermove', (e: PointerEvent) => this.move(e))
    on(canvas, 'pointerup', (e: PointerEvent) => this.up(e))
    // A cancelled pointer (the browser took the gesture) ends like a release.
    on(canvas, 'pointercancel', (e: PointerEvent) => this.up(e))
    on(canvas, 'pointerdown', (e: PointerEvent) => this.down(e))
  }

  destroy(): void {
    this.stop.abort()
  }

  private get canvasPx() {
    return this.host.canvas.width / this.host.canvas.clientWidth
  }

  private pxToWorld(px: number, py: number) {
    return this.host.camera.toWorld(this.host.canvas, px * this.canvasPx, py * this.canvasPx)
  }

  confirmBall = () => {
    const { shooter } = this.host.state().possession
    if (!this.host.blocked() && !this.host.state().match.choosing && this.ballGhost && canPlaceBall(shooter, this.ballGhost, this.host.state().objects, this.host.config())) this.host.send({ placeBall: { player: shooter, at: this.ballGhost } })
  }

  /** Tap on the Breaker icon. */
  toggleArm = () => {
    const s = this.host.state()
    if (canArm(s, s.possession.shooter)) this.armed = !this.armed
  }

  // Build turn: the build menu spawns a piece; drag it by pressing on it, ✓ sends it through the sim, ✕ drops it.
  // Pressing one of this turn's structures picks it up again; an older one is only selected, to demolish it.
  build: BuildActions = {
    toggle: () => (this.menuOpen = !this.menuOpen),
    spawn: (p: Piece) => {
      const b = this.host.state().match.builder
      if (b) (this.selection = spawn(p, b, this.host.camera.y)), (this.menuOpen = false)
    },
    rotate: () => this.selection?.movable && (this.selection = rotated(this.selection)),
    cancel: () => (this.selection = undefined),
    confirm: () => {
      const { selection } = this
      const input = !this.landing && selection && legal(this.host.state(), selection) && commit(selection)
      if (input) (this.host.send(input), (this.landing = selection), (this.selection = undefined))
    },
    remove: () => {
      if (this.selection?.id !== undefined) this.host.send({ demolish: { player: this.selection.spec.owner, wall: this.selection.id } })
      this.selection = undefined
    },
  }

  /** The aim to feed the sim: the charge as a shot once the dwell is over, else none. */
  aiming(now: number): Aiming | null {
    return this.charge ? this.shotOf(this.charge, gesturePower(this.charge.gesture, now)) : null
  }

  /** A charge at `power` as a Touch shot straight away from the press; null at power 0 or with no way to go. */
  private shotOf(charge: { origin: Point }, power: number): Aiming | null {
    const dir = chargeDir(this.host.state().ball.pos, charge.origin)
    return power > 0 && dir ? { dir, tier: 0, power, ...(this.armed && { breaker: true }) } : null
  }

  /** The charge ring to draw: during the dwell too (power 0). */
  chargeView(now: number): Charge | undefined {
    return this.charge?.gesture.mode === 'charge' ? { origin: this.charge.origin, player: this.charge.player, power: gesturePower(this.charge.gesture, now) } : undefined
  }

  /** After each sim tick: drop what the new state has made stale. */
  settle(state: SimState, refused: boolean): void {
    if (!canArm(state, state.possession.shooter)) this.armed = false
    if (!state.possession.inHand || state.match.choosing) this.ballGhost = undefined
    if (this.landing && (landed(state, this.landing) || refused)) this.landing = undefined
  }

  /** Drops a ghost ball and any half-made gesture. */
  cancelGestures(): void {
    this.ballGhost = this.tap = this.charge = undefined
    this.draggingBall = false
  }

  /** The build turn changed hands or ended: a new piece is gone, a moved one never left its spot in the sim. */
  resetBuild(): void {
    this.selection = this.landing = this.drag = undefined
    this.menuOpen = false
  }

  /** While dragging near the top or bottom tenth of the view, scroll toward any of the builder's half that is off screen. */
  edgeScroll(dt: number): void {
    const builder = this.host.state().match.builder
    if (!this.drag?.moved || !builder) return
    const { visibleHeight } = layout(this.host.canvas)
    const dy = edgeScrollDy(this.host.camera.y, visibleHeight, builder, this.pxToWorld(this.drag.px, this.drag.py).y, dt)
    if (!dy) return
    this.host.camera.pan(dy)
    this.dragTo(this.drag.px, this.drag.py)
  }

  // Drags keep the grab point under the finger and snap the anchor to the grid.
  private dragTo(px: number, py: number): void {
    const { drag, selection } = this
    if (!drag || !selection) return
    const p = this.pxToWorld(px, py)
    this.drag = { ...drag, px, py, moved: drag.moved || Math.hypot(px - drag.from.x, py - drag.from.y) > visual.input.dragSlopPx }
    this.selection = { ...selection, spec: { ...selection.spec, at: { gx: Math.round((p.x - drag.offset.x) / rules.cellSize), gy: Math.round((p.y - drag.offset.y) / rules.cellSize) } } }
  }

  private panBy(dyPx: number): void {
    this.host.camera.pan(((this.host.shown() === 2 ? 1 : -1) * (dyPx * this.canvasPx)) / layout(this.host.canvas).scale)
  }

  private key(e: KeyboardEvent): void {
    const key = e.key.toLowerCase()
    if (e.code === 'Space') (e.preventDefault(), this.host.camera.recenter())
    if (key === 'm') this.host.toggleMap()
    else if (key === 'escape') this.host.mapOpen() ? this.host.toggleMap(false) : ((this.selection = this.ballGhost = undefined), (this.menuOpen = false))
    else if (key === 'r') this.build.rotate()
    else if (key === 'enter') this.host.state().match.builder ? this.build.confirm() : this.confirmBall()
  }

  private move(e: PointerEvent): void {
    const now = performance.now()
    if (this.draggingBall) this.ballGhost = this.pxToWorld(e.offsetX, e.offsetY)
    const prev = this.pointers.get(e.pointerId)
    if (prev) {
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      const dy = e.clientY - prev.y
      if (this.pointers.size > 1) this.panBy(dy / this.pointers.size)
      else if (this.panOnly || (this.charge && gestureMove(this.charge.gesture, { x: e.clientX, y: e.clientY }, now).mode === 'pan')) this.panBy(dy)
    }
    if (this.drag?.id === e.pointerId) this.dragTo(e.offsetX, e.offsetY)
    if (this.charge) this.charge.gesture = gestureMove(this.charge.gesture, { x: e.clientX, y: e.clientY }, now)
  }

  private up(e: PointerEvent): void {
    this.draggingBall = false
    if (this.drag?.id === e.pointerId) this.drag = undefined
    if (this.tap && Math.hypot(e.clientX - this.tap.x, e.clientY - this.tap.y) <= visual.input.tapSlopPx) this.ballGhost = this.pxToWorld(e.offsetX, e.offsetY)
    this.tap = undefined
    this.pointers.delete(e.pointerId)
    this.panOnly = false
    const aim = this.charge && this.shotOf(this.charge, gesturePower(this.charge.gesture, performance.now()))
    if (this.charge && aim) this.host.send({ shot: { player: this.charge.player, ...aim } })
    else if (this.charge) this.armed = false
    this.charge = undefined
  }

  private down(e: PointerEvent): void {
    const { canvas, camera, mapCam } = this.host
    // The Map and Close buttons still work; everything else is ignored behind a blocking hold, so a tap there cannot carry into the next player's turn.
    if (this.host.blocked() && !this.host.mapOpen()) return
    if (this.host.mapOpen()) {
      camera.pan(mapCam.toWorld(canvas, e.offsetX * this.canvasPx, e.offsetY * this.canvasPx).y - camera.y)
      this.host.toggleMap(false)
      return
    }
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (this.pointers.size > 1) {
      this.charge = this.drag = undefined
      return
    }
    const state = this.host.state()
    const builder = state.match.builder
    if (builder) {
      this.menuOpen = false
      const at = this.pxToWorld(e.offsetX, e.offsetY)
      // On the piece: half a cell, or a 44px touch target.
      const tolerance = Math.max(rules.cellSize / 2, (visual.input.touchTargetPx * this.canvasPx) / layout(canvas).scale)
      if (!this.selection) this.selection = pick(state, builder, at, tolerance)
      const sel = this.selection
      if (sel?.movable && onPiece(sel.spec, at, tolerance)) {
        const anchor = vertexToWorld(sel.spec.at)
        this.drag = { offset: { x: at.x - anchor.x, y: at.y - anchor.y }, px: e.offsetX, py: e.offsetY, id: e.pointerId, from: { x: e.offsetX, y: e.offsetY }, moved: false }
        canvas.setPointerCapture(e.pointerId)
      } else this.panOnly = true
      return
    }
    // A defence choice is pending: the board is for looking at, not for placing the ball.
    if (state.match.choosing) {
      this.panOnly = true
      return
    }
    // Ball-in-hand: tap a point to place the ghost ball, drag it to move (dragging elsewhere pans), Confirm fixes it.
    if (state.possession.inHand) {
      const at = this.pxToWorld(e.offsetX, e.offsetY)
      if (this.ballGhost && Math.hypot(at.x - this.ballGhost.x, at.y - this.ballGhost.y) <= 2 * this.host.config().ballRadius) {
        this.draggingBall = true
        canvas.setPointerCapture(e.pointerId)
      } else {
        this.panOnly = true
        this.tap = { x: e.clientX, y: e.clientY }
      }
      return
    }
    const at = this.pxToWorld(e.offsetX, e.offsetY)
    const player = halfOf(at.y)
    const { ball } = state
    if (player === state.possession.shooter && !state.possession.live && Math.hypot(at.x - ball.pos.x, at.y - ball.pos.y) > this.host.config().ballRadius) {
      canvas.setPointerCapture(e.pointerId)
      this.charge = { gesture: gestureStart({ x: e.clientX, y: e.clientY }, performance.now()), origin: at, player }
    } else this.panOnly = true
  }
}
