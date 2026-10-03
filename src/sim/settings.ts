import type { GameModeName } from './match'
import { defaultConfig, type SimConfig } from './step'

export type Settings = { mode: GameModeName; shots: number; rounds: number; wallPoints: number }
type SliderKey = Exclude<keyof Settings, 'mode'>

export const SLIDERS: Record<SliderKey, { label: string; min: number; max: number; def: number }> = {
  shots: { label: 'Shots per possession', min: 1, max: 10, def: 3 },
  rounds: { label: 'Rounds', min: 1, max: 15, def: 5 },
  wallPoints: { label: 'Wall points', min: 1, max: 30, def: 10 },
}

/** Modes in picker order. */
export const MODES: { mode: GameModeName; label: string }[] = [
  { mode: 'siege', label: 'Siege' },
  { mode: 'rounds', label: 'Rounds' },
]

/** The sliders a mode uses; Siege has no rounds. */
export const slidersFor = (mode: GameModeName): SliderKey[] => {
  switch (mode) {
    case 'rounds':
      return ['shots', 'rounds', 'wallPoints']
    case 'siege':
      return ['shots', 'wallPoints']
  }
}

/** What the settings screen starts with: Siege is the default mode. */
export const defaultSettings: Settings = { mode: 'siege', shots: SLIDERS.shots.def, rounds: SLIDERS.rounds.def, wallPoints: SLIDERS.wallPoints.def }

const clamp = (k: SliderKey, v: number) => Math.min(SLIDERS[k].max, Math.max(SLIDERS[k].min, Math.round(v)))

export const configFrom = (s: Settings): SimConfig => ({ ...defaultConfig, mode: s.mode, shots: clamp('shots', s.shots), rounds: clamp('rounds', s.rounds), wallPoints: clamp('wallPoints', s.wallPoints) })
