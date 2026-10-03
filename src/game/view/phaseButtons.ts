import type { ButtonSpec } from './hudModel'

/** The buttons under the shared strip: Done during the viewer's own build turn, none otherwise. */
export const phaseButtons = (building: boolean, done: () => void): ButtonSpec[] | undefined => (building ? [{ label: 'Done', onClick: done }] : undefined)
