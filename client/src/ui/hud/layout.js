import { useSyncExternalStore } from 'react'

/**
 * Which way the HUD is laid out: 'desktop' (the 1920x1080 reference layout, scaled), or
 * one of the two phone layouts - 'landscape' (a phone held sideways: short, so the menu
 * goes three across and the counters sit above the level bar) and 'portrait' (held
 * upright: narrow, so the counters go top-left, the menu under them and the action
 * buttons above the level bar).
 *
 * The same media queries pick each layout's HUD unit (--px) in index.css, so the sizes
 * there and the positions here always agree.
 */
export const PHONE_LANDSCAPE = '(orientation: landscape) and (max-height: 560px)'
export const PHONE_PORTRAIT = '(orientation: portrait) and (max-width: 1000px)'

const queries = typeof window === 'undefined' ? [] : [PHONE_LANDSCAPE, PHONE_PORTRAIT].map((q) => window.matchMedia(q))

function current() {
  if (queries[0]?.matches) return 'landscape'
  if (queries[1]?.matches) return 'portrait'
  return 'desktop'
}

function subscribe(onChange) {
  for (const q of queries) q.addEventListener('change', onChange)
  return () => {
    for (const q of queries) q.removeEventListener('change', onChange)
  }
}

/** A phone held sideways that's too narrow to fit the menu row and the name tag side by side. */
export const NARROW_LANDSCAPE = '(orientation: landscape) and (max-width: 760px)'

/** Whether `query` (a media query) matches now, updated as it changes. */
export function useMedia(query) {
  const list = typeof window === 'undefined' ? null : window.matchMedia(query)
  return useSyncExternalStore(
    (onChange) => {
      list?.addEventListener('change', onChange)
      return () => list?.removeEventListener('change', onChange)
    },
    () => Boolean(list?.matches),
    () => false,
  )
}

/** The HUD layout for this screen, updated as the phone turns. */
export function useHudLayout() {
  return useSyncExternalStore(subscribe, current, () => 'desktop')
}

/**
 * Held upright, the LIFT, jump and PUSH buttons sit this high (reference units) above
 * the bottom: over the level bar and its Muscle packs, not on them.
 */
export const PORTRAIT_ACTIONS_UP = 200

/** Picks the value for the current layout: `pick(layout, { desktop, landscape, portrait })`. */
export const pick = (layout, values) => (layout in values ? values[layout] : values.desktop)
