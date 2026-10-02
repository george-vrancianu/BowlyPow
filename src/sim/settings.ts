import { defaultConfig, type SimConfig } from './step'

export type Settings = { shots: number; rounds: number; wallPoints: number }

export const SLIDERS = {
  shots: { label: 'Shots per possession', min: 1, max: 10, def: 3 },
  rounds: { label: 'Rounds', min: 1, max: 15, def: 5 },
  wallPoints: { label: 'Wall points', min: 1, max: 30, def: 10 },
}

const clamp = (k: keyof Settings, v: number) => Math.min(SLIDERS[k].max, Math.max(SLIDERS[k].min, Math.round(v)))

export const configFrom = (s: Settings): SimConfig => ({ ...defaultConfig, shots: clamp('shots', s.shots), rounds: clamp('rounds', s.rounds), wallPoints: clamp('wallPoints', s.wallPoints) })
