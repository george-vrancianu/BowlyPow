import { defaultSettings, MODES, SLIDERS, slidersFor, type Settings } from '../../sim/settings'
import type { ButtonSpec } from './hudModel'

export { defaultSettings, type Settings }

/** The mode picker's buttons: the chosen mode reads as pressed (aria-pressed and a filled look), not just bracketed text. */
export const modePicker = (current: Settings['mode'], pick: (mode: Settings['mode']) => void): ButtonSpec[] => MODES.map(({ mode, label }) => ({ label, pressed: mode === current, onClick: () => pick(mode) }))

export type SliderKey = Exclude<keyof Settings, 'mode'>
export type SliderRow = { key: SliderKey; label: string; min: number; max: number; value: number }

/** The sliders the chosen mode uses, with their current values. */
export const sliderRows = (s: Settings): SliderRow[] => slidersFor(s.mode).map((key) => ({ key, label: SLIDERS[key].label, min: SLIDERS[key].min, max: SLIDERS[key].max, value: s[key] }))
