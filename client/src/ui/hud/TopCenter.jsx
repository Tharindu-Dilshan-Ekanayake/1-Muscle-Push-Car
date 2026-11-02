import { TUTORIAL } from '@shared/balance'
import { formatNumber } from '@shared/format'

import { useClearTop } from '../../bloxity/reserved'
import { useGame } from '../../store/game'
import StrokeText from '../StrokeText'
import { pick, useHudLayout } from './layout'
import { u } from './style'

const BANNER_GRADIENT = 'linear-gradient(180deg, #fff6a8 0%, #ffd52a 45%, #ff9c00 100%)'
const touch = typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0)

/**
 * What the guide tells a new player right now - its step, with the Muscle to train up
 * to where it asks for some, and how to take the car when you're at it - until the
 * guide's done; after that, nothing. (Max level has its own call to rebirth, up top:
 * RebirthNotice.)
 */
function useHint() {
  const step = useGame((s) => s.profile.tutorialStep)
  const muscle = useGame((s) => Math.floor(s.profile.muscle))
  const atVehicle = useGame((s) => s.zone.pushZone)
  const current = TUTORIAL[step]
  if (!current) return null
  if (atVehicle) return { key: 'grab', text: touch ? 'Hold PUSH to push the car!' : 'Hold E to push the car!' }
  if (current.muscle && muscle < current.muscle) return { key: current.text, text: `${current.text} ${formatNumber(muscle)}/${current.muscle}` }
  return { key: current.text, text: current.text }
}

/**
 * The big hint under the level bar, as in the reference. A tutorial step stays up until
 * it's done; any other hint shows for about three seconds and fades (pp-hint), so it's
 * never in the way of playing. Keyed on the hint, so a new one starts it again. Paused
 * while the HUD is out of sight (pushing, a panel open), so a hint is never used up
 * unseen.
 */
export function TopCenter() {
  const hint = useHint()
  const hidden = useGame((s) => s.pushing || s.panel !== null)
  const clear = useClearTop(0.25, 0.75)
  const layout = useHudLayout()
  if (!hint) return null
  // On a phone, in the clear middle of the screen - never over the buttons down either
  // side - in smaller letters, wrapping onto a second line if it must.
  const box = pick(layout, {
    desktop: { top: `max(${u(196)}, ${clear + 8}px)`, size: 60 },
    landscape: { top: '27%', size: 38, left: 'calc(50% + 20px)', width: '56vw' },
    portrait: { top: '61%', size: 36, width: '84vw' },
  })

  return (
    <div
      className="pointer-events-none absolute flex -translate-x-1/2 flex-col items-center text-center"
      style={{ top: box.top, left: box.left ?? '50%', width: box.width, lineHeight: 1.15 }}
    >
      <div key={hint.key} className="pp-pet" style={{ fontSize: u(box.size), animationPlayState: hidden ? 'paused' : 'running' }}>
        <StrokeText stroke={u(layout === 'desktop' ? 12 : 9)} gradient={BANNER_GRADIENT} className={layout === 'desktop' ? '' : 'pp-text-wrap'}>
          {hint.text}
        </StrokeText>
      </div>
    </div>
  )
}

export default TopCenter
