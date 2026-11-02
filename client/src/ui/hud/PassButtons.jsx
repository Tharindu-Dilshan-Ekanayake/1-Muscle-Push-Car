import { SHOP } from '@shared/balance'

import { buy } from '../../net/shop'
import { useGame } from '../../store/game'
import Icon from '../Icon'
import StrokeText from '../StrokeText'
import GiftTimer from './GiftTimer'
import { Price } from './parts'
import { useClearTop } from '../../bloxity/reserved'
import { NARROW_LANDSCAPE, pick, useHudLayout, useMedia } from './layout'
import { GRADIENTS, u } from './style'

/** X2 WINS only shows where there's room for it (it's in the Store too). */
const PASSES = [
  { product: 'muscleX2', label: 'X2 MUSCLE', icon: 'muscle' },
  { product: 'winsX2', label: 'X2 WINS', icon: 'trophy', className: 'pp-tall-only' },
]

/** Rainbow rays turning slowly behind a pass's icon. */
const RAYS = 'repeating-conic-gradient(from 0deg, #ff3b5c 0deg 10deg, #ffe53b 10deg 20deg, #4ef05a 20deg 30deg, #2fc6ff 30deg 40deg, #b45cff 40deg 50deg, transparent 50deg 60deg)'

/** One pass, as in the reference: a big icon on rainbow rays, its name tilted, the price or OWNED under it. */
function PassButton({ product, label, icon, className = '' }) {
  const item = SHOP[product]
  const owned = useGame((s) => Boolean(s.profile.passes[product]))
  const afford = useGame((s) => s.profile.wins >= item.price)
  return (
    <button
      type="button"
      onClick={() => buy(product)}
      disabled={owned}
      title={item.name}
      className={`pp-btn pointer-events-auto relative flex flex-col items-center ${className}`}
      style={{ width: u(230) }}
    >
      <span className="relative flex items-center justify-center" style={{ width: u(170), height: u(150) }}>
        {!owned && (
          <span
            className="pp-spin absolute rounded-full"
            style={{ width: u(170), height: u(170), background: RAYS, opacity: 0.75, maskImage: 'radial-gradient(circle, #000 30%, transparent 70%)', WebkitMaskImage: 'radial-gradient(circle, #000 30%, transparent 70%)' }}
          />
        )}
        <Icon name={icon} size={u(150)} className="relative" />
      </span>
      <span style={{ fontSize: u(46), marginTop: u(-30), transform: 'rotate(8deg)' }}>
        <StrokeText stroke={u(10)} gradient={GRADIENTS.rainbow}>
          {label}
        </StrokeText>
      </span>
      <span className="flex items-center" style={{ transform: 'rotate(8deg)', gap: u(8), marginTop: u(-2) }}>
        {owned ? (
          <span style={{ fontSize: u(34) }}>
            <StrokeText stroke={u(8)} fill="#7dff4a">
              OWNED
            </StrokeText>
          </span>
        ) : (
          <>
            <span style={{ fontSize: u(34) }}>
              <StrokeText stroke={u(8)} fill="#7dff4a">
                ONLY
              </StrokeText>
            </span>
            <Price amount={item.price} size={34} afford={afford} />
          </>
        )}
      </span>
    </button>
  )
}

/** How big the right-hand column is against the reference: smaller, so it crowds the view less. */
const COLUMN_SCALE = 0.66

/** Down the right-hand side, as in the reference: the FREE GIFT, then the x2 passes. */
export function PassButtons() {
  const pushing = useGame((s) => s.pushing)
  const layout = useHudLayout()
  // The narrowest sideways phones are too short for the whole column: the gift only
  // (the x2 passes are in the Store).
  const short = useMedia(NARROW_LANDSCAPE)
  const clear = useClearTop(0.72, 1)
  // On a phone, smaller still: it has to stop short of the LIFT button below it. Always
  // under the top-right buttons (and Boxity's toolbar, where it reaches across).
  const { top, scale } = pick(layout, {
    desktop: { top: u(96), scale: COLUMN_SCALE },
    landscape: { top: `calc(${u(86)} + ${clear}px)`, scale: 0.5 },
    portrait: { top: `calc(${u(96)} + ${clear}px)`, scale: 0.5 },
  })
  return (
    <div
      className="pointer-events-none absolute flex flex-col items-center"
      style={{ right: u(20), top, gap: u(18), transform: `scale(${scale})`, transformOrigin: 'top right' }}
    >
      <GiftTimer />
      <div className="flex flex-col items-center" style={{ gap: u(18), visibility: pushing ? 'hidden' : 'visible', display: short ? 'none' : undefined }}>
        {PASSES.map((pass) => (
          <PassButton key={pass.product} {...pass} />
        ))}
      </div>
    </div>
  )
}

export default PassButtons
