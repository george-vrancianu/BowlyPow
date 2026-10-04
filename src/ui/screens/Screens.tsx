import { type CSSProperties, type ReactNode } from 'react'
import { visual } from '../../config/visual'
import type { PlayerId } from '../../game/Game'
import { expiryPicker, modePicker, sliderRows, type Settings } from '../../game/view/settings'
import { ButtonRow, FONT } from '../ButtonRow'

type Look = { className?: string; style?: CSSProperties; children?: ReactNode }

/** A full-screen layer outside the match, in the HUD's flat style. */
function Screen({ className, style, children }: Look) {
  return (
    <div className={className} style={{ ...FONT, position: 'fixed', inset: 0, zIndex: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, background: visual.tokens.bg, color: visual.hud.ink, ...style }}>
      {children}
    </div>
  )
}

const { tokens, title } = visual
const P1 = visual.player.colors[1]
const P2 = visual.player.colors[2]

/** The wordmark over the centre circle, with a wall of each colour and the ball on the halfway line. Drawn in a 390-wide frame; the halfway line runs past it to the screen edges. */
function Hero() {
  const wall = (x: number, y: number, fill: string) => <rect x={-55} y={-6.5} width={110} height={13} rx={2} fill={fill} transform={`translate(${x} ${y}) rotate(-21)`} />
  return (
    <svg role="img" aria-label="BreachBall" viewBox="0 80 390 420" overflow="visible" style={{ flex: '1 1 0', minHeight: 0, width: '100%' }}>
      <line x1={-2000} x2={2390} y1={330} y2={330} stroke={tokens.lines} strokeWidth={3} />
      <circle cx={195} cy={330} r={150} fill="none" stroke={tokens.lines} strokeWidth={3} />
      <circle cx={195} cy={330} r={110} fill="none" stroke={tokens.lines} strokeWidth={2} strokeDasharray="4 6" />
      <circle cx={195} cy={330} r={14} fill={visual.ball.fill} />
      {wall(115, 437, P1)}
      <text x={195} y={155} textAnchor="middle" fill={P1} style={{ font: `72px ${visual.hud.display}` }}>BREACH</text>
      <text x={223} y={222} textAnchor="middle" fill={P2} style={{ font: `72px ${visual.hud.display}` }}>BALL</text>
      {wall(275, 217, P2)}
      <text x={195} y={262} textAnchor="middle" fill={tokens.muted} style={{ ...FONT, fontSize: 12, letterSpacing: '0.3em' }}>Build · Shoot · Breach</text>
    </svg>
  )
}

/** Player 1's goal mouth peeking up from the bottom edge: chevrons and net lines in the player colour, posts at the sides. */
function GoalMouth() {
  return (
    <svg aria-hidden width={164} height={56} style={{ flex: 'none', display: 'block' }}>
      <defs>
        <pattern id="title-net" width={20} height={14} patternUnits="userSpaceOnUse">
          <path d="M0 12 L10 4 L20 12" fill="none" stroke={P1} strokeOpacity={0.35} strokeWidth={2} />
          <line x1={0} x2={0} y1={0} y2={14} stroke={P1} strokeOpacity={0.45} strokeWidth={2} />
        </pattern>
      </defs>
      <rect x={4} y={0} width={156} height={56} fill="url(#title-net)" />
      <rect x={0} y={0} width={4} height={56} fill={P1} />
      <rect x={160} y={0} width={4} height={56} fill={P1} />
    </svg>
  )
}

const pill = (height: number): CSSProperties => ({ width: '100%', height, borderRadius: height / 2, cursor: 'pointer' })
const ghost: CSSProperties = { ...FONT, width: title.ghostPx, height: title.ghostPx, borderRadius: '50%', border: `2px solid ${tokens.ghostBorder}`, background: 'transparent', color: tokens.ghostGlyph, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, cursor: 'pointer' }

/** Three slider tracks with their knobs. */
const SlidersGlyph = () => (
  <svg aria-hidden width={22} height={22} viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth={2}>
    {[5, 11, 17].map((y, i) => (
      <g key={y}>
        <line x1={2} x2={20} y1={y} y2={y} />
        <circle cx={[14, 7, 12][i]} cy={y} r={2.5} fill={tokens.bg} />
      </g>
    ))}
  </svg>
)

/** The Title screen: the wordmark over the dot grid, then Play (a hot-seat match), Online, and the settings and help circles. */
export function TitleScreen({ onPlay, onOnline, onSettings, onHelp, ...look }: { onPlay(): void; onOnline(): void; onSettings(): void; onHelp(): void } & Look) {
  const grid = { backgroundImage: `radial-gradient(circle, ${tokens.pitchDots} ${title.dotPx}px, transparent ${title.dotPx + 0.5}px)`, backgroundSize: `${title.gridPx}px ${title.gridPx}px` }
  return (
    <Screen {...look} style={{ ...grid, justifyContent: 'flex-start', gap: 16, ...look.style }}>
      <Hero />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: `min(80vw, ${title.pillMaxPx}px)` }}>
        <button onClick={onPlay} style={{ ...pill(title.playPx), border: 'none', background: P1, color: tokens.bg, font: `24px ${visual.hud.display}`, textTransform: 'uppercase', boxShadow: title.halo }}>Play</button>
        <button onClick={onOnline} style={{ ...FONT, ...pill(title.onlinePx), border: `2px solid ${visual.hud.ink}`, background: visual.hud.panel, color: visual.hud.ink, fontSize: 13, letterSpacing: '0.1em' }}>Online</button>
        <div style={{ display: 'flex', gap: 24 }}>
          <button aria-label="Settings" onClick={onSettings} style={ghost}><SlidersGlyph /></button>
          <button aria-label="Help" onClick={onHelp} style={ghost}>?</button>
        </div>
      </div>
      <GoalMouth />
      {look.children}
    </Screen>
  )
}

/** 🧪 A static how-to-play page, reachable from the Title screen (and later the Side menu). The copy is a first draft. */
const HELP: [string, string][] = [
  ['The goal', 'Two players share one phone. Each defends the goal behind their half and shoots at the other.'],
  ['Build', 'In a build turn, spend Credits on walls and towers on your own half (Siege spends wall points). In Rounds, unspent Credits carry over.'],
  ['Shoot', 'Press on the ball, drag back and release. Drag at once for a precise Touch shot, or hold still for a second first for a Power shot. Each shot uses a Move point; stop the ball on the other half, or run out, and the ball passes over.'],
  ['Breach', 'Walls crack and break when hit. Break through and put the ball in the goal.'],
  ['Refund', 'Rounds only. Tap a Move point you will not need to trade it for Credits, or hold one to keep just one. Refunding the last one hands the ball over.'],
  ['Modes', 'Rounds: most goals after the last round wins. Siege: one build, then a goal earns a Repair or a Rearrange; wipe out every structure to win.'],
]

export function HelpScreen({ onBack, ...look }: { onBack(): void } & Look) {
  return (
    <Screen {...look} style={{ justifyContent: 'flex-start', overflowY: 'auto', padding: '32px 24px', boxSizing: 'border-box', gap: 16, ...look.style }}>
      <h1 style={{ margin: 0, font: `32px ${visual.hud.display}`, color: P1 }}>How to play</h1>
      {HELP.map(([head, body]) => (
        <section key={head} style={{ width: 'min(100%, 420px)' }}>
          <h2 style={{ margin: '0 0 4px', fontSize: 14, letterSpacing: '0.08em' }}>{head}</h2>
          <p style={{ margin: 0, fontWeight: 500, textTransform: 'none', color: tokens.muted, lineHeight: 1.4 }}>{body}</p>
        </section>
      ))}
      <button onClick={onBack} style={{ ...FONT, ...pill(title.onlinePx), width: `min(80vw, ${title.pillMaxPx}px)`, flex: 'none', border: `2px solid ${visual.hud.ink}`, background: visual.hud.panel, color: visual.hud.ink, fontSize: 13, letterSpacing: '0.1em' }}>Back</button>
      {look.children}
    </Screen>
  )
}

/** The mode picker, then the sliders that mode uses, then the On time out toggle, then Start. */
export function SettingsScreen({ settings, onChange, onStart, ...look }: { settings: Settings; onChange(s: Settings): void; onStart(): void } & Look) {
  return (
    <Screen {...look}>
      <div style={{ fontSize: 28 }}>Settings</div>
      <ButtonRow specs={modePicker(settings.mode, (mode) => onChange({ ...settings, mode }))} />
      {sliderRows(settings).map(({ key, label, min, max, value }) => (
        <label key={key} style={{ display: 'block', width: 'min(80vw,320px)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{label}</span>
            <span>{value}</span>
          </div>
          <input type="range" min={min} max={max} step={1} value={value} aria-label={label} style={{ width: '100%', minHeight: 44 }} onChange={(e) => onChange({ ...settings, [key]: e.currentTarget.valueAsNumber })} />
        </label>
      ))}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <span>On time out</span>
        <ButtonRow specs={expiryPicker(settings.expiry, (expiry) => onChange({ ...settings, expiry }))} />
      </div>
      <ButtonRow specs={[{ label: 'Start', onClick: onStart }]} />
      {look.children}
    </Screen>
  )
}

export function MatchEndScreen({ winner, result, onRematch, onMenu, ...look }: { winner: PlayerId; result: string; onRematch(): void; onMenu(): void } & Look) {
  return (
    <Screen {...look}>
      <div style={{ fontSize: 32, color: visual.player.colors[winner] }}>{`Player ${winner} wins`}</div>
      <div style={{ fontSize: 48 }}>{result}</div>
      <ButtonRow specs={[{ label: 'Rematch', onClick: onRematch }, { label: 'Menu', onClick: onMenu }]} />
      {look.children}
    </Screen>
  )
}
