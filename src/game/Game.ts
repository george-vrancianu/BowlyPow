import { rules } from '../config/rules'
import { visual } from '../config/visual'
import type { PlayerId } from '../sim/pitch'
import type { PowerUp } from '../sim/player'
import { canArm, canPlaceBall, whoActs } from '../sim/possession'
import { configFrom, type Settings } from '../sim/settings'
import { defaultConfig, type SimConfig, type SimEvent, type SimState } from '../sim/step'
import { LocalDriver, type Sink } from './driver'
import { Aim } from './entities/Aim'
import { Ball } from './entities/Ball'
import { Camera, viewOutline } from './entities/Camera'
import { Fog } from './entities/Fog'
import { Pitch } from './entities/Pitch'
import { Structures } from './entities/Structures'
import { routeEvents } from './events'
import { reducedMotion } from './feedback'
import { InputController } from './input/InputController'
import { buildMenu, type BuildActions, type BuildMenu } from './view/buildMenu'
import { hudModel, type HudModel } from './view/hudModel'
import { phaseButtons } from './view/phaseButtons'
import { advance, angle, blocking, dismiss, goalBall, newTransition, overlayView, type OverlayView } from './view/transition'

/** Everything the HUD and screens draw from. Data only: pushed up through `onView` when it changes, never read back. */
export type HudView = {
  size: { width: number; height: number }
  hud: HudModel
  /** The builder's floating menu, when it is their build turn and the map is closed. */
  menu?: BuildMenu
  overlay?: OverlayView
  /** Degrees the stage (canvas and in-match HUD) is rotated by the hot-seat flip. */
  angle: number
  /** Player 2 is at the bottom of the screen. */
  flipped: boolean
  /** The ball-in-hand Confirm button is up. */
  confirm: boolean
  mapOpen: boolean
  winner?: PlayerId
  score: Record<PlayerId, number>
}

/** How the HUD and screens drive the game. */
export type GameActions = {
  start(settings: Settings): void
  rematch(): void
  map(open?: boolean): void
  mapStretch(): void
  recenter(): void
  powerUp(p: PowerUp): void
  done(): void
  confirmBall(): void
  /** Tap on the turn card. */
  dismiss(): void
  build: BuildActions
}

const storedStretch = () => {
  try {
    return sessionStorage.getItem('mapStretch') === '1'
  } catch {
    return false
  }
}

/**
 * The game renderer: owns the entity tree, the input controller, the frame loop and a driver. Sim state enters only through `apply`,
 * which routes the tick's events to entity methods; inputs leave through the driver.
 */
export class Game implements Sink {
  readonly camera = new Camera(0)
  /** A second camera over the whole pitch for the map overlay; its fit/stretch choice lasts the session. */
  readonly mapCam = new Camera(rules.mapY, { stretch: storedStretch() })
  readonly pitch = new Pitch()
  readonly structures = new Structures()
  readonly ball = new Ball()
  readonly aim = new Aim()
  readonly fog = new Fog(() => (this.mapOpen ? this.mapCam : this.camera))
  readonly actions: GameActions
  state!: SimState
  private config: SimConfig = defaultConfig
  private driver = new LocalDriver(this)
  private input: InputController
  private ctx: CanvasRenderingContext2D
  private transition = newTransition(1)
  private lastBuilder: SimState["match"]["builder"] | undefined
  private mapOpen = false
  private now = performance.now()
  private last = this.now
  private raf = 0
  private dead = false
  private lastView = ''

  constructor(private canvas: HTMLCanvasElement, private onView?: (view: HudView) => void) {
    this.ctx = canvas.getContext('2d')!
    this.camera.add(this.pitch)
    this.camera.add(this.structures)
    this.camera.add(this.ball)
    this.camera.add(this.aim)
    this.input = new InputController({
      canvas,
      camera: this.camera,
      mapCam: this.mapCam,
      state: () => this.state,
      config: () => this.config,
      shown: () => this.transition.shown,
      mapOpen: () => this.mapOpen,
      toggleMap: (open) => this.toggleMap(open),
      send: (input) => this.driver.send(input),
    })
    this.actions = {
      start: (s) => ((this.config = configFrom(s)), this.newMatch()),
      rematch: () => this.newMatch(),
      map: (open) => this.toggleMap(open),
      mapStretch: () => {
        const map = this.mapCam.map!
        map.stretch = !map.stretch
        try {
          sessionStorage.setItem('mapStretch', map.stretch ? '1' : '0')
        } catch {}
      },
      recenter: () => this.camera.recenter(),
      powerUp: (p) => p === 'breaker' && this.input.toggleArm(),
      done: () => {
        const builder = this.state.match.builder
        if (builder) this.driver.send({ done: builder })
      },
      confirmBall: this.input.confirmBall,
      dismiss: () => (this.transition = dismiss(this.transition, performance.now())),
      build: this.input.build,
    }
    this.newMatch()
    this.raf = requestAnimationFrame(this.frame)
  }

  /** Stops the loop and removes every listener. */
  destroy(): void {
    this.dead = true
    cancelAnimationFrame(this.raf)
    this.input.destroy()
  }

  blocked = () => blocking(this.transition)

  /** One sim tick's state and events, from the driver. */
  apply(state: SimState, events: SimEvent[]): void {
    this.state = state
    const { camera, input } = this
    input.settle(state, events)
    if (!state.match.builder && events.length) camera.recenter()
    if (state.match.builder !== this.lastBuilder) {
      this.lastBuilder = state.match.builder
      input.resetBuild()
      if (this.lastBuilder) camera.pan(rules.halfCentre[this.lastBuilder] - camera.y)
      else camera.recenter()
    }
    this.announce(events)
    this.aim.sync(state, this.config)
    routeEvents(events, { camera, structures: this.structures, ball: this.ball, aim: this.aim, vibrate: (p) => navigator.vibrate?.(p) }, state.objects, reducedMotion())
    this.structures.sync(state.objects)
  }

  // The seed varies per match; only the sim stays deterministic.
  private newMatch(seed = (Math.random() * 2 ** 31) | 0): void {
    const s = this.driver.start(this.config, seed)
    this.transition = newTransition(s.possession.shooter)
    this.camera.recenter()
    this.camera.y = s.ball.pos.y
    this.lastBuilder = undefined
    this.apply(s, [])
  }

  private toggleMap(open = !this.mapOpen): void {
    this.mapOpen = open
  }

  private announce(events: SimEvent[]): void {
    const { state } = this
    this.transition = advance(this.transition, { handover: true, active: whoActs(state), round: state.match.round, inHand: state.possession.inHand, phase: state.match.builder ? 'Build' : 'Play', events, now: this.now, reduced: reducedMotion() })
  }

  private frame = (now: number): void => {
    if (this.dead) return
    // The sim never waits on animations; the driver just stops stepping behind a flip, goal hold or turn card.
    const dt = Math.min((now - this.last) / 1000, visual.frame.maxDtS)
    this.last = this.now = now
    this.driver.send({ charging: this.input.charging(now) })
    this.driver.update(dt)
    this.announce([])
    const { state, transition, camera } = this
    const flipping = !!transition.flip && now - transition.flip.at >= transition.flip.ms / 2
    if (!state.match.builder && (flipping || (transition.overlay?.kind === 'turn' && !transition.flip))) (camera.y = state.ball.pos.y), camera.recenter()
    this.input.edgeScroll(dt)
    if (!camera.held) camera.follow(state.ball.pos.y, dt)
    this.present()
    camera.update(dt)
    this.draw()
    this.push()
    this.raf = requestAnimationFrame(this.frame)
  }

  /** Hands the entities what this frame shows: the build overlays, the charge, the ball's ghost. */
  private present(): void {
    const { state, input, structures, mapOpen } = this
    const { builder } = state.match
    const { shooter } = state.possession
    const sel = input.selection
    structures.ghost = mapOpen || !sel?.movable ? undefined : sel.spec
    structures.landing = mapOpen ? undefined : input.landing?.spec
    structures.hidden = mapOpen ? [] : [sel?.movable ? sel.id : undefined, input.landing?.id].filter((id) => id !== undefined)
    structures.selected = !mapOpen && sel && !sel.movable ? sel.id : undefined
    structures.movable = builder && !mapOpen ? state.built : []
    this.aim.charge = mapOpen ? undefined : input.chargeView(this.now)
    structures.preview = new Map(this.aim.preview().map((h) => [h.id, h.own]))
    this.pitch.builder = builder ?? undefined
    // During the goal hold the ball rests in the net (the sim has already reset it).
    const inNet = goalBall(this.transition)
    this.ball.sync(inNet ? { ...state.ball, pos: inNet, vel: { x: 0, y: 0 } } : state.ball)
    this.ball.placement = input.ballGhost && { at: input.ballGhost, legal: canPlaceBall(shooter, input.ballGhost, state.objects, this.config), radius: this.config.ballRadius }
    this.ball.armed = input.armed || state.breaker ? shooter : undefined
  }

  private draw(): void {
    const { canvas, ctx, camera, mapCam } = this
    const dpr = window.devicePixelRatio || 1
    canvas.width = canvas.clientWidth * dpr
    canvas.height = canvas.clientHeight * dpr
    if (this.mapOpen) mapCam.draw(ctx, camera.children)
    else camera.draw(ctx)
    this.fog.draw(ctx)
    if (this.mapOpen) {
      const o = viewOutline(canvas, mapCam, camera)
      ctx.strokeStyle = visual.camera.mapOutline
      ctx.lineWidth = visual.camera.mapOutlinePx * dpr
      ctx.strokeRect(o.x, o.y, o.w, o.h)
    }
  }

  /** Calls `onView` with the HUD view, but only when it differs from the last one (functions in it are stable and not compared). */
  private push(): void {
    const { state, input, transition, now } = this
    const builder = state.match.builder
    const { shooter, inHand } = state.possession
    const view: HudView = {
      size: { width: this.canvas.clientWidth, height: this.canvas.clientHeight },
      hud: hudModel(state, this.config, { active: transition.shown, buttons: phaseButtons(!!builder, this.actions.done), armed: input.armed, tappable: canArm(state, shooter) }),
      menu: builder && !this.mapOpen ? buildMenu(state, builder, { open: input.menuOpen, selection: input.selection, landing: !!input.landing }, input.build) : undefined,
      overlay: overlayView(transition, now),
      angle: angle(transition, now),
      flipped: transition.shown === 2,
      confirm: inHand && !builder,
      mapOpen: this.mapOpen,
      winner: state.match.winner ?? undefined,
      score: state.match.score,
    }
    const key = JSON.stringify(view)
    if (key === this.lastView) return
    this.lastView = key
    this.onView?.(view)
  }
}
