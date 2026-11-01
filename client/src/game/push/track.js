import { WIN_PAD } from '@shared/balance'
import { mulberry32 } from '@shared/rng'
import { TRACK_HALF_WIDTH } from '@shared/world'

import { BlockSet, toColor } from '../blocks'
import { STYLE } from '../materials'
import { addTree } from '../world/terrain'
import { isSlope, safeStart, STAGES, stageAt, stageStart, TRACK, TRACK_LENGTH } from './course'
import { RIM_X, slopeBoxPlacement, surfaceY, zAt } from './path'
import { SAFE_THEME, STAGE_THEMES } from './themes'

/**
 * The road up the mountain, generated in 40 m chunks on demand. Each chunk is a
 * BlockSet (one draw call); content is seeded by chunk index, so every client builds an
 * identical mountain and a chunk can be thrown away and rebuilt at will.
 *
 * Cross-section: a two-lane road between tall stepped cliffs of big square studs - a low
 * step, a higher one and the rim - with a ledge running out beyond the rim and scenery
 * on the steps and the ledge. Along it, each stage's slope - its surface, paint, lamps,
 * guardrails and signs as its theme's `road` says (see themes.js) - then a flat
 * light-blue SAFEZONE with its WINS pad on the right, then the next stage's slope.
 * Everything structural lies along the track (tipped on the slopes, level on the flats);
 * trees, buildings and props stand upright.
 */

export const CHUNK = 40
const HALF = TRACK_HALF_WIDTH
/**
 * The walls' steps, from the floor's edge out: [inner x, outer x, height above the floor].
 * Tall cliffs make a canyon (a junkyard's fences, a city's tower blocks, a tunnel); an
 * `open` road gets low banks instead, so you see out over the roadside as you climb.
 */
const TALL = [
  [HALF, 9, 6],
  [9, 15, 12],
  [15, RIM_X, 18],
]
const LOW = [
  [HALF, 9, 0.8],
  [9, 15, 2.2],
  [15, RIM_X, 3.6],
]
/** The steps of the stretch being built (set per stretch by buildChunk), and its rim's height. */
let STEPS = TALL
let RIM_H = TALL[2][2]
/** How far the ledge beyond the rim runs: short beside the lobby, wide after, wider still on an open road. */
const LEDGE_NEAR = RIM_X + 10
const LEDGE_FAR = 95
const LEDGE_OPEN = 170
/** The summit: a flat-topped stretch past the end of the last stage, then a wall. */
export const SUMMIT_LENGTH = 34
export const trackEnd = () => TRACK_LENGTH + SUMMIT_LENGTH
/** No scenery on the first chunk, where the lobby's mountains stand beside the track. */
const DECOR_START = 40

/** Where the track bends: the top and the foot of every slope above the first, and THE TOP. */
let bendsOf = null
let bendsList = []
function bends() {
  if (bendsOf !== TRACK) {
    bendsOf = TRACK
    bendsList = [...STAGES.slice(1).flatMap((_, k) => [safeStart(k + 1), stageStart(k + 1)]), TRACK_LENGTH]
  }
  return bendsList
}
/**
 * Past a bend from slope to flat, a flat's walls run this far back over the top of the
 * slope, filling the notch the bend would leave; and they stand a few centimetres
 * proud of the slope's, so the two never flicker where they overlap.
 */
const BACKFILL = 3.2
const PROUD = 0.05
/** Dashes down the middle: this long, one every DASH_EVERY metres. */
const DASH = 3
const DASH_EVERY = 7.5
/** Lamps down the sides, guardrail posts, signs over the road, tunnel ribs, crossings. */
const LAMP_EVERY = 24
const POST_EVERY = 4
const GANTRY_EVERY = 96
const RIB_EVERY = 10
const CROSSING_EVERY = 72

/** A colour a little lighter (`by` > 0) or darker (< 0) than `color`, made once. */
const shades = new Map()
function shade(color, by) {
  const key = `${color}${by}`
  if (!shades.has(key)) shades.set(key, toColor(color).clone().lerp(toColor(by > 0 ? '#ffffff' : '#000000'), Math.abs(by)))
  return shades.get(key)
}

const pick = (rand, list) => list[Math.floor(rand() * list.length)]
/** A steady pseudo-random 0-1 for a metre along the track: the same on every client. */
const hashM = (m) => {
  const x = Math.sin(m * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

/** A box lying on the slope: centred x across, h off the floor, metre m, lean about its length. */
function slab(b, m, x, h, sx, sy, sz, color, style = STYLE.STUDS, lean = 0) {
  const [px, py, pz, rotX] = slopeBoxPlacement(m, x, h)
  b.add(px, py, pz, sx, sy, sz, color, style, 0, rotX, lean)
}

/** Height of a step's top (or the ledge, at RIM_H) under world z, for standing props on it. */
const topY = (z, h) => surfaceY(z, h + 0.5)

/**
 * A prop turned `yaw` about its own base point (x, y, z): returns put(dx, dy, dz, ...box),
 * which adds a box `dx` across, `dy` up (to its centre) and `dz` along, turned with it.
 */
function turned(b, x, y, z, yaw) {
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  return (dx, dy, dz, sx, sy, sz, color, style = STYLE.STUDS, rotX = 0, rotZ = 0) =>
    b.add(x + dx * c + dz * s, y + dy, z - dx * s + dz * c, sx, sy, sz, color, style, yaw, rotX, rotZ)
}

// --- The road ------------------------------------------------------------------------

/** Stepped cliffs on both sides, of `look`, for metres [m0, m0 + len) about `mid`. */
function cliffs(b, mid, len, look, proud) {
  const style = look.wallStyle ?? STYLE.BLOCK
  for (const side of [-1, 1]) {
    for (const [stepInner, outer, h] of STEPS) {
      const inner = stepInner - proud
      const x = (side * (inner + outer)) / 2
      slab(b, mid, x, h / 2 - 2, outer - inner, h + 4, len, look.wall, style)
      if (look.cap) slab(b, mid, x, h + 0.25, outer - inner + 0.1, 0.5, len, look.cap, look.capStyle ?? STYLE.BLOCK)
    }
  }
}

/** The paint on the road for metres [a, c): lines down its edges, and down its middle. */
function markings(b, a, c, road) {
  if (!road.center && !road.edge) return
  const color = road.lines ?? '#f4f4ea'
  const style = road.glowLines ? STYLE.GLOW : STYLE.SMOOTH
  const len = c - a
  const mid = (a + c) / 2
  if (road.edge) for (const side of [-1, 1]) slab(b, mid, side * (HALF - 0.75), 0.02, 0.14, 0.04, len, color, style)
  if (road.center === 'solid') slab(b, mid, 0, 0.02, 0.16, 0.04, len, color, style)
  if (road.center === 'double') for (const side of [-1, 1]) slab(b, mid, side * 0.15, 0.02, 0.12, 0.04, len, color, style)
  if (road.center !== 'dash') return
  for (let m = Math.ceil(a / DASH_EVERY) * DASH_EVERY; m + DASH <= c; m += DASH_EVERY) {
    if (road.worn && hashM(m) < road.worn * 0.65) continue
    slab(b, m + DASH / 2, 0, 0.02, 0.16, 0.04, DASH * (road.worn ? 0.5 + hashM(m + 1) * 0.5 : 1), color, style)
  }
}

/** A lamp at metre m on side `side` (-1 left, 1 right), of kind `kind`, lit in `glow`. */
function lamp(b, m, side, kind, glow) {
  const [px, py, pz] = slopeBoxPlacement(m, side * (HALF - 0.3), 0)
  const inward = -side
  if (kind === 'wood') {
    // A wooden pole, a crossbar, a little bulb.
    b.addOn(px, py - 0.2, pz, 0.24, 5, 0.24, '#6a4a2a', STYLE.SMOOTH)
    b.add(px, py + 4.5, pz, 1.4, 0.12, 0.12, '#6a4a2a', STYLE.SMOOTH)
    b.add(px + inward * 0.45, py + 4.25, pz, 0.26, 0.3, 0.26, '#ffe0a0', STYLE.GLOW)
    return
  }
  if (kind === 'flood') {
    // A tall mast with a bank of floodlights turned on the road.
    b.addOn(px, py - 0.2, pz, 0.3, 8.6, 0.3, '#4a4e56', STYLE.SMOOTH)
    b.add(px + inward * 0.3, py + 8.4, pz, 0.4, 1.0, 2.0, '#2a2c30', STYLE.SMOOTH)
    b.add(px + inward * 0.52, py + 8.4, pz, 0.06, 0.8, 1.8, '#fff6dc', STYLE.GLOW)
    return
  }
  const broken = kind === 'broken'
  const pole = kind === 'neon' ? '#1c2030' : kind === 'gold' ? '#ffd23f' : '#5a606a'
  const tall = kind === 'highway' ? 6.4 : 5.4
  // A pole, an arm out over the road and the lamp head on it; leaning and dark if broken.
  const lean = broken ? side * (0.08 + hashM(m) * 0.12) : 0
  b.add(px + Math.sin(lean) * tall * 0.5, py + tall / 2 - 0.2, pz, 0.18, tall, 0.18, pole, STYLE.SMOOTH, 0, 0, -lean)
  if (broken && hashM(m + 3) < 0.5) return
  const top = py + tall - 0.3
  const tipX = px + Math.sin(lean) * tall
  b.add(tipX + inward * 0.75, top, pz, 1.5, 0.12, 0.12, pole, STYLE.SMOOTH)
  b.add(tipX + inward * 1.4, top - 0.12, pz, 0.62, 0.16, 0.34, pole, STYLE.SMOOTH)
  b.add(tipX + inward * 1.4, top - 0.24, pz, 0.5, 0.08, 0.26, broken ? '#555a62' : glow, broken ? STYLE.SMOOTH : STYLE.GLOW)
}

/** A big green sign over the road at metre m, on its gantry: posts, a beam, two boards with "writing". */
function gantry(b, m, theme) {
  const [, py, pz] = slopeBoxPlacement(m, 0, 0)
  const steel = '#8a9098'
  for (const side of [-1, 1]) b.addOn(side * (HALF - 0.25), py - 0.4, pz, 0.36, 7.6, 0.36, steel, STYLE.SMOOTH)
  b.add(0, py + 6.9, pz, HALF * 2 + 0.2, 0.3, 0.3, steel, STYLE.SMOOTH)
  for (const side of [-1, 1]) {
    const x = side * 1.75
    b.add(x, py + 7.6, pz + 0.1, 3.1, 1.5, 0.12, '#1f8a4a', STYLE.SMOOTH)
    b.add(x, py + 7.6, pz + 0.17, 2.9, 1.3, 0.02, '#f4f4f4', STYLE.SMOOTH)
    b.add(x, py + 7.6, pz + 0.19, 2.8, 1.2, 0.02, '#1f8a4a', STYLE.SMOOTH)
    for (const [dy, w] of [[0.3, 2.0], [-0.05, 1.4], [-0.35, 0.9]]) b.add(x - 0.2, py + 7.6 + dy, pz + 0.21, w, 0.14, 0.02, '#ffffff', STYLE.GLOW)
    b.add(x + 1.05, py + 7.25, pz + 0.21, 0.24, 0.5, 0.02, theme.gate, STYLE.GLOW)
  }
}

/**
 * Road, stepped cliffs, the ledge beyond and, up a slope, the theme's paint, lamps,
 * guardrails and signs, for metres [a, c). `kind` is 'slope', 'safe' (a SAFEZONE:
 * light blue, whatever the stage) or 'summit'.
 */
function walls(b, a, c, theme, wide, kind) {
  const len = c - a
  const mid = (a + c) / 2
  const flat = kind !== 'slope'
  const back = flat && bends().includes(a) ? BACKFILL : 0
  const wallLen = len + back
  const wallMid = mid - back / 2
  const look = kind === 'safe' ? SAFE_THEME : theme
  const floorStyle = look.floorStyle ?? STYLE.TILES
  slab(b, mid, 0, -0.5, HALF * 2 + 2, 1, len, look.floor, floorStyle)
  cliffs(b, wallMid, wallLen, look, flat ? PROUD : 0)
  for (const side of [-1, 1]) {
    // A darker kerb down each side of the road, framing it.
    slab(b, mid, side * (HALF - 0.4), 0.03, 0.8, 0.06, len, shade(look.floor, -0.18), floorStyle)
    // A lighter trim along the lip of every step (grassy cliffs have their grass instead).
    if ((look.wallStyle ?? STYLE.BLOCK) !== STYLE.BLOCK_GRASS) {
      const proud = flat ? PROUD : 0
      for (const [inner, , h] of STEPS) slab(b, wallMid, side * (inner - proud - 0.06), h - 0.16, 0.3, 0.32, wallLen, shade(look.wall, 0.3), STYLE.SMOOTH)
    }
  }
  // The ledge beyond the rim, as solid ground down to below the floor: the stage's own,
  // even beside a SAFEZONE.
  const style = theme.wallStyle ?? STYLE.BLOCK
  const far = wide ? (theme.open ? LEDGE_OPEN : LEDGE_FAR) : LEDGE_NEAR
  const width = far - RIM_X
  for (const side of [-1, 1]) {
    const x = side * (RIM_X + width / 2)
    slab(b, wallMid, x, RIM_H / 2 - 4, width, RIM_H + 8, wallLen, theme.wall, style)
    if (theme.cap) slab(b, wallMid, x, RIM_H + 0.25, width, 0.5, wallLen, theme.cap, theme.capStyle ?? STYLE.BLOCK)
  }
  if (kind !== 'slope') return

  const road = theme.road ?? {}
  markings(b, a, c, road)
  // Snow banked up along both edges.
  if (road.snow) for (const side of [-1, 1]) slab(b, mid, side * (HALF - 0.25), 0.2, 0.5, 0.4, len, '#f4f8fc', STYLE.SMOOTH)
  // Guardrails: a steel rail on short posts down both sides.
  if (road.rail) {
    for (const side of [-1, 1]) {
      slab(b, mid, side * (HALF - 0.12), 0.62, 0.08, 0.3, len, '#c3c9d1', STYLE.PLATE)
      for (let m = Math.ceil(a / POST_EVERY) * POST_EVERY + 1; m < c - 0.2; m += POST_EVERY) {
        const [px, py, pz] = slopeBoxPlacement(m, side * (HALF - 0.08), 0)
        b.addOn(px, py - 0.1, pz, 0.12, 0.72, 0.12, '#7a8088', STYLE.SMOOTH)
      }
    }
  }
  // Lamps down both sides, in the stage's colour or warm white.
  const kindOfLamp = road.lamp ?? 'street'
  if (kindOfLamp !== 'none') {
    const glow = kindOfLamp === 'neon' || kindOfLamp === 'gold' ? theme.gate : '#fff2c8'
    // Left and right in turn, LAMP_EVERY apart on each side.
    const half = LAMP_EVERY / 2
    for (let m = Math.ceil(a / half) * half + 4; m < c - 1; m += half) lamp(b, m, Math.floor(m / half) % 2 ? 1 : -1, kindOfLamp, glow)
  }
  // A line of traffic cones down the right, round the roadworks.
  if (road.cones) {
    for (let m = Math.ceil(a / 5) * 5 + 2; m < c - 0.5; m += 5) {
      if (hashM(m) < 0.35) continue
      const [px, py, pz] = slopeBoxPlacement(m, HALF - 0.55, 0)
      cone(b, px, py, pz)
    }
  }
  // Big green signs over the highway; lit ribs all the way through a tunnel.
  if (road.gantry) for (let m = Math.ceil(a / GANTRY_EVERY) * GANTRY_EVERY + GANTRY_EVERY / 2; m < c - 1; m += GANTRY_EVERY) gantry(b, m, theme)
  if (road.tunnel) {
    for (let m = Math.ceil(a / RIB_EVERY) * RIB_EVERY + 5; m < c - 0.5; m += RIB_EVERY) {
      const [, py, pz] = slopeBoxPlacement(m, 0, 0)
      for (const side of [-1, 1]) b.addOn(side * (HALF + 0.2), py - 0.6, pz, 0.9, 8.4, 0.9, '#c8ccd2', STYLE.TILES)
      b.addOn(0, py + 7.4, pz, HALF * 2 + 2.2, 0.9, 1.0, '#c8ccd2', STYLE.TILES)
      b.add(0, py + 7.32, pz, HALF * 2 - 0.4, 0.14, 0.4, theme.gate, STYLE.GLOW)
    }
  }
  // Zebra crossings now and then.
  if (road.crossing) {
    for (let m = Math.ceil(a / CROSSING_EVERY) * CROSSING_EVERY + 30; m + 3 <= c; m += CROSSING_EVERY) {
      for (let k = -3; k <= 3; k += 1) slab(b, m + 1.5, k * 0.95, 0.025, 0.5, 0.05, 3, '#f4f4f4', STYLE.SMOOTH)
    }
  }
}

/**
 * The SAFEZONE below stage `i` (its look is walls'): a glowing line across where it
 * starts, the WINS pad on the right (its label is Push's), and a line in the next
 * stage's colour where the next slope starts.
 */
function safezone(b, i) {
  const a = safeStart(i)
  const line = (m, color) => {
    const [x, y, z] = slopeBoxPlacement(m, 0, 0.05)
    b.add(x, y, z, HALF * 2 - 0.2, 0.1, 0.5, color, STYLE.GLOW)
  }
  line(a + 0.4, '#e8f7ff')
  line(stageStart(i) - 0.4, STAGE_THEMES[STAGES[i].id].gate)
  // The WINS pad: a white frame with the glowing gold pad raised in it.
  const padMid = a + (WIN_PAD.from + WIN_PAD.to) / 2
  const padLen = WIN_PAD.to - WIN_PAD.from
  const padX = (WIN_PAD.minX + WIN_PAD.maxX) / 2
  const padW = WIN_PAD.maxX - WIN_PAD.minX
  const [fx, fy, fz] = slopeBoxPlacement(padMid, padX, 0.05)
  b.add(fx, fy, fz, padW + 0.5, 0.1, padLen + 0.5, '#ffffff', STYLE.SMOOTH)
  const [px, py, pz] = slopeBoxPlacement(padMid, padX, 0.1)
  b.add(px, py, pz, padW, 0.12, padLen, '#ffc61a', STYLE.GLOW)
}

/** THE TOP: a golden platform, a giant trophy on a plinth, and the mountain's end wall. */
function summit(b, theme) {
  const m = TRACK_LENGTH + SUMMIT_LENGTH * 0.62
  const [px, py, pz, rotX] = slopeBoxPlacement(TRACK_LENGTH + SUMMIT_LENGTH / 2, 0, 0.06)
  b.add(px, py, pz, HALF * 2 - 0.4, 0.12, SUMMIT_LENGTH - 1, '#ffd21f', STYLE.PLATE, 0, rotX)
  const z = zAt(m)
  const base = surfaceY(z, 0)
  const gold = '#ffc61a'
  b.addOn(0, base - 0.5, z, 6, 2, 6, '#f4f7fb')
  b.addOn(0, base + 1.5, z, 5, 0.5, 5, gold, STYLE.GLOW)
  // The cup: a stem, a bowl stepping out, and two handles.
  b.addOn(0, base + 2, z, 1.2, 2.6, 1.2, gold, STYLE.GLOW)
  for (let i = 0; i < 5; i += 1) b.addOn(0, base + 4.6 + i * 0.9, z, 2.2 + i * 0.7, 0.9, 2.2 + i * 0.7, gold, STYLE.GLOW)
  for (const side of [-1, 1]) {
    b.add(side * 3.6, base + 7.4, z, 0.6, 3, 0.6, gold, STYLE.GLOW, 0, 0, side * 0.35)
    b.add(side * 3.1, base + 8.9, z, 1.4, 0.6, 0.6, gold, STYLE.GLOW)
  }
  b.add(0, base + 10.2, z, 1.4, 1.4, 1.4, '#ffffff', STYLE.GLOW, 0.785, 0.6, 0)
  // The end wall, closing the road off.
  const wz = zAt(trackEnd())
  b.addOn(0, surfaceY(wz, 0) - 1, wz - 2, RIM_X * 2, RIM_H + 6, 4, theme.wall, theme.wallStyle ?? STYLE.BLOCK)
}

// --- Props -------------------------------------------------------------------------

/** Car colours, and the rust-browns and faded tones of the wrecks. */
const PAINTS = ['#d8262b', '#2e6fe0', '#ffc61a', '#3fbf5a', '#f4f6f8', '#ff7a1a', '#7a4ad8', '#2a2c30']
const RUSTY = ['#8a4a2a', '#6a5a4a', '#9a6a3a', '#5a6a72', '#7a3a2a', '#a89878', '#4a6a5a']

function rock(b, x, y, z, s, color) {
  b.addOn(x, y - 0.3, z, 2.4 * s, 1.6 * s, 2 * s, color, STYLE.STUDS, s * 0.7)
  b.addOn(x + 0.5 * s, y + 0.9 * s, z, 1.3 * s, 0.9 * s, 1.2 * s, color, STYLE.STUDS, s * 1.3)
}

function bush(b, x, y, z, s, color) {
  b.addOn(x, y - 0.2, z, 2.2 * s, 1.3 * s, 2.2 * s, color)
  b.addOn(x + 0.3 * s, y + 0.8 * s, z - 0.2 * s, 1.4 * s, 0.9 * s, 1.4 * s, color)
}

function snowPine(b, x, y, z, s, rand) {
  b.addOn(x, y - 0.3, z, 0.8 * s, 2.7 * s, 0.8 * s, '#6b3f22')
  const green = pick(rand, ['#2d7a45', '#24683a'])
  let top = y + 1.8 * s
  for (const w of [5, 4, 3, 2]) {
    b.addOn(x, top, z, w * s, 1.5 * s, w * s, green)
    b.addOn(x, top + 1.5 * s, z, (w - 0.6) * s, 0.25 * s, (w - 0.6) * s, '#ffffff')
    top += 1.4 * s
  }
}

function snowman(b, x, y, z) {
  b.addOn(x, y - 0.2, z, 2.2, 2.2, 2.2, '#ffffff')
  b.addOn(x, y + 2, z, 1.6, 1.5, 1.6, '#ffffff')
  b.addOn(x, y + 3.5, z, 1.1, 1.1, 1.1, '#ffffff')
  b.addOn(x, y + 3.95, z + 0.75, 0.25, 0.25, 0.6, '#ff8a1e', STYLE.SMOOTH)
  b.addOn(x, y + 4.6, z, 1.3, 0.2, 1.3, '#1d1f24', STYLE.SMOOTH)
  b.addOn(x, y + 4.8, z, 0.8, 0.8, 0.8, '#1d1f24', STYLE.SMOOTH)
}

function cactus(b, x, y, z, h, rand) {
  b.addOn(x, y - 0.3, z, 0.9, h + 0.3, 0.9, '#3fa34d')
  const armY = y + h * (0.4 + rand() * 0.2)
  b.addOn(x + 0.9, armY, z, 1, 0.6, 0.6, '#3fa34d')
  b.addOn(x + 1.2, armY, z, 0.6, 1.8, 0.6, '#3fa34d')
  if (rand() < 0.6) {
    b.addOn(x - 0.9, armY + 0.8, z, 1, 0.6, 0.6, '#3fa34d')
    b.addOn(x - 1.2, armY + 0.8, z, 0.6, 1.4, 0.6, '#3fa34d')
  }
  if (rand() < 0.4) b.addOn(x, y + h, z, 0.5, 0.35, 0.5, '#ff6fa8')
}

/** A flat-topped mesa of red rock, in layers. */
function mesa(b, x, y, z, size, rand) {
  const h = size * (0.5 + rand() * 0.4)
  for (let i = 0; i < 4; i += 1) {
    const w = size * (1 - i * 0.12)
    b.addOn(x, y - 1 + (i * h) / 4, z, w, h / 4 + 0.05, w * 0.8, i % 2 ? '#c8703e' : '#b8603a')
  }
}

/** A palm tree: a leaning, ringed trunk under a crown of long leaves. */
function palm(b, x, y, z, s, rand) {
  const lean = (rand() - 0.5) * 0.5
  for (let i = 0; i < 6; i += 1) b.addOn(x + lean * i * 0.5 * s, y - 0.3 + i * 0.9 * s, z, 0.6 * s, 0.95 * s, 0.6 * s, i % 2 ? '#a8783e' : '#8f6532')
  const top = y + 5.2 * s
  const tx = x + lean * 3 * s
  for (let k = 0; k < 5; k += 1) b.add(tx, top, z, 3.6 * s, 0.25, 0.9 * s, '#3fbf3a', STYLE.SMOOTH, (k / 5) * Math.PI, 0, 0.35)
  b.add(tx, top - 0.3, z, 0.6 * s, 0.6 * s, 0.6 * s, '#7a4a22', STYLE.SMOOTH)
}

/** A dead tree: a bare dark trunk with crooked branches. */
function deadTree(b, x, y, z, s, rand) {
  b.addOn(x, y - 0.3, z, 0.7 * s, 5 * s, 0.7 * s, '#2a2230')
  for (let k = 0; k < 3; k += 1) {
    const side = rand() < 0.5 ? -1 : 1
    b.add(x + side * 0.9 * s, y + (2.2 + k * 1.1) * s, z, 1.8 * s, 0.3 * s, 0.3 * s, '#2a2230', STYLE.SMOOTH, rand() * 3, 0, side * 0.5)
  }
}

/** A neon skyscraper: lit windows, neon strips up its corners and round its top. */
function tower(b, x, y, z, s, rand) {
  const h = (14 + rand() * 18) * s
  const w = (4 + rand() * 3) * s
  const neon = pick(rand, ['#ff3fd0', '#2fe8ff', '#b06bff', '#ffe14a'])
  b.addOn(x, y - 1, z, w, h, w, pick(rand, ['#2a2d52', '#22264a', '#30285a']), STYLE.WINDOWS)
  b.addOn(x, y - 1 + h, z, w + 0.3, 0.4, w + 0.3, neon, STYLE.GLOW)
  b.addOn(x - w / 2, y - 1, z - w / 2, 0.25, h, 0.25, neon, STYLE.GLOW)
  b.addOn(x + w / 2, y - 1, z + w / 2, 0.25, h, 0.25, neon, STYLE.GLOW)
}

/** A daytime office block: windows all the way up, a roof slab and plant on top. */
function officeBlock(b, x, y, z, s, rand, colors = ['#8aa0c0', '#a8b8c8', '#6a8ab0', '#c8d0d8', '#5a7090']) {
  const h = (16 + rand() * 26) * s
  const w = (6 + rand() * 4) * s
  const d = (6 + rand() * 4) * s
  b.addOn(x, y - 1, z, w, h, d, pick(rand, colors), STYLE.WINDOWS)
  b.addOn(x, y - 1 + h, z, w + 0.3, 0.5, d + 0.3, '#d4dae2', STYLE.SMOOTH)
  b.addOn(x + w * 0.2, y - 0.5 + h, z, w * 0.3, 1.2, d * 0.3, '#8a9098', STYLE.PLATE)
  if (rand() < 0.4) b.addOn(x - w * 0.25, y - 0.5 + h, z, 0.15, 4, 0.15, '#c3c9d1', STYLE.SMOOTH)
}

/** A light pylon: a dark post with a glowing bar. */
function pylon(b, x, y, z, s, rand) {
  const c = pick(rand, ['#2fe8ff', '#ff3fd0'])
  b.addOn(x, y - 0.3, z, 0.5 * s, 6 * s, 0.5 * s, '#1c2a3e', STYLE.SMOOTH)
  b.addOn(x, y + 5.5 * s, z, 2.4 * s, 0.4 * s, 0.4 * s, c, STYLE.GLOW)
}

/** A floating hologram cube, turned. */
function holo(b, x, y, z, s, rand) {
  const c = pick(rand, ['#2fe8ff', '#ff3fd0', '#7dff9a'])
  b.add(x, y + 4 * s, z, 2 * s, 2 * s, 2 * s, c, STYLE.GLOW, rand() * 3, 0.6, 0.4)
}

function crystal(b, x, y, z, s, rand) {
  const c = pick(rand, ['#c08bff', '#7fe2ff', '#ff7ad9', '#9b6bff'])
  b.add(x, y + 1.8 * s, z, 1.2 * s, 4.2 * s, 1.2 * s, c, STYLE.GLOW, rand() * 3, 0, 0.2)
  b.add(x + 1 * s, y + 1 * s, z + 0.4 * s, 0.8 * s, 2.6 * s, 0.8 * s, c, STYLE.GLOW, rand() * 3, 0, -0.4)
  b.add(x - 0.9 * s, y + 0.8 * s, z - 0.3 * s, 0.7 * s, 2 * s, 0.7 * s, c, STYLE.GLOW, rand() * 3, 0.3, 0.3)
}

function planet(b, x, y, z, r, color, ring) {
  b.add(x, y, z, r * 2, r * 1.4, r * 1.4, color, STYLE.GLOW)
  b.add(x, y, z, r * 1.4, r * 2, r * 1.4, color, STYLE.GLOW)
  b.add(x, y, z, r * 1.4, r * 1.4, r * 2, color, STYLE.GLOW)
  if (ring) b.add(x, y, z, r * 3.6, 0.3, r * 3.6, ring, STYLE.GLOW, 0.3, 0.2, 0)
}

/** A rusty barrel leaking glowing green slime. */
function toxicBarrel(b, x, y, z, s) {
  b.addOn(x, y - 0.2, z, 1.2 * s, 1.6 * s, 1.2 * s, '#6a6f3a', STYLE.STRIPES)
  b.addOn(x, y + 1.35 * s, z, 1 * s, 0.12 * s, 1 * s, '#8aff3a', STYLE.GLOW)
  b.addOn(x + 0.9 * s, y - 0.35, z, 1.6 * s, 0.2, 1.2 * s, '#8aff3a', STYLE.GLOW)
}

/** A fluffy cloud: three white lumps, turned a little. */
function cloudPuff(b, x, y, z, s, rand) {
  const turn = rand() * 3
  b.add(x, y, z, 5 * s, 1.6 * s, 3 * s, '#ffffff', STYLE.SMOOTH, turn)
  b.add(x + 1.2 * s, y + 0.8 * s, z, 3 * s, 1.6 * s, 2.4 * s, '#ffffff', STYLE.SMOOTH, turn)
  b.add(x - 1.4 * s, y + 0.5 * s, z, 2.4 * s, 1.3 * s, 2 * s, '#f2f7ff', STYLE.SMOOTH, turn)
}

/** A white column with gold at its foot and top, holding up a glowing orb. */
function goldColumn(b, x, y, z, h) {
  b.addOn(x, y - 0.3, z, 1.8, 0.5, 1.8, '#ffd23f', STYLE.SMOOTH)
  b.addOn(x, y + 0.2, z, 1.2, h, 1.2, '#f4f7fb', STYLE.SMOOTH)
  b.addOn(x, y + 0.2 + h, z, 1.7, 0.4, 1.7, '#ffd23f', STYLE.SMOOTH)
  b.add(x, y + 1.1 + h, z, 0.9, 0.9, 0.9, '#fff3a0', STYLE.GLOW, 0.785, 0.6, 0)
}

/** A traffic cone: an orange base, the cone and its white band. */
function cone(b, x, y, z) {
  b.addOn(x, y - 0.02, z, 0.6, 0.08, 0.6, '#ff6a14', STYLE.SMOOTH)
  b.addOn(x, y + 0.05, z, 0.4, 0.4, 0.4, '#ff6a14', STYLE.SMOOTH)
  b.addOn(x, y + 0.45, z, 0.26, 0.36, 0.26, '#ff6a14', STYLE.SMOOTH)
  b.addOn(x, y + 0.38, z, 0.34, 0.1, 0.34, '#ffffff', STYLE.SMOOTH)
}

/** A cube of crushed car, painted once. */
function carCube(b, x, y, z, s, color, yaw) {
  b.addOn(x, y, z, 2.1 * s, 0.85 * s, 1.5 * s, color, STYLE.RUST, yaw)
}

/** Crushed cars stacked two to four high, each a little askew. */
function crushedStack(b, x, y, z, s, rand) {
  let top = y - 0.2
  const n = 2 + Math.floor(rand() * 3)
  for (let k = 0; k < n; k += 1) {
    carCube(b, x + (rand() - 0.5) * 0.4, top, z + (rand() - 0.5) * 0.4, s, pick(rand, [...RUSTY, ...PAINTS]), (rand() - 0.5) * 0.5)
    top += 0.86 * s
  }
}

/** A wrecked car left to rust: body, cabin, dark windows, and whatever wheels it has left. */
function wreck(b, x, y, z, s, rand) {
  const put = turned(b, x, y - 0.1, z, rand() * Math.PI)
  const c = pick(rand, RUSTY)
  put(0, 0.75 * s, 0, 1.9 * s, 0.8 * s, 4 * s, c, STYLE.RUST)
  put(0, 1.45 * s, -0.3 * s, 1.7 * s, 0.65 * s, 2 * s, c, STYLE.RUST)
  put(0, 1.45 * s, -0.3 * s, 1.74 * s, 0.4 * s, 1.6 * s, '#26303a', STYLE.SMOOTH)
  for (const [dx, dz] of [[-0.9, 1.3], [0.9, 1.3], [-0.9, -1.3], [0.9, -1.3]]) {
    if (rand() < 0.3) continue
    put(dx * s, 0.35 * s, dz * s, 0.3 * s, 0.7 * s, 0.7 * s, '#2a2a2e', STYLE.SMOOTH)
  }
}

/** A little parked car, the kind on a street: a body, a cabin and its windows. */
function parkedCar(b, x, y, z, s, rand, yaw) {
  const put = turned(b, x, y - 0.1, z, yaw)
  const c = pick(rand, PAINTS)
  put(0, 0.7 * s, 0, 1.9 * s, 0.75 * s, 4.2 * s, c, STYLE.SMOOTH)
  put(0, 1.38 * s, -0.25 * s, 1.7 * s, 0.62 * s, 2.1 * s, c, STYLE.SMOOTH)
  put(0, 1.38 * s, -0.25 * s, 1.74 * s, 0.4 * s, 1.8 * s, '#26303a', STYLE.SMOOTH)
  for (const [dx, dz] of [[-0.9, 1.35], [0.9, 1.35], [-0.9, -1.35], [0.9, -1.35]]) put(dx * s, 0.35 * s, dz * s, 0.32 * s, 0.7 * s, 0.7 * s, '#2a2a2e', STYLE.SMOOTH)
}

/** Tyres stacked up, each turned a little more than the last. */
function tireStack(b, x, y, z, rand) {
  const n = 2 + Math.floor(rand() * 4)
  for (let k = 0; k < n; k += 1) b.add(x, y + 0.05 + k * 0.42, z, 1.15, 0.4, 1.15, '#26272b', STYLE.SMOOTH, k * 0.4)
}

/** An oil drum: banded, in a colour; `fire` sets a blaze glowing on top. */
function drum(b, x, y, z, rand, fire = false) {
  b.addOn(x, y - 0.2, z, 0.9, 1.3, 0.9, pick(rand, ['#2f6ab0', '#c8302a', '#3a7a3a', '#8a4a2a']), STYLE.STRIPES)
  if (fire) {
    b.add(x, y + 1.3, z, 0.7, 0.5, 0.7, '#ff8a1e', STYLE.GLOW, rand() * 3)
    b.add(x, y + 1.65, z, 0.4, 0.4, 0.4, '#ffd21f', STYLE.GLOW, rand() * 3)
  }
}

function hayBale(b, x, y, z, rand) {
  b.addOn(x, y - 0.2, z, 1.7, 1.1, 1.1, '#e8c35a', STYLE.SMOOTH, rand() * 3)
}

/** A run of wooden fence along the track, `len` long. */
function fence(b, x, y, z, len) {
  for (let k = 0; k <= len; k += 2) b.addOn(x, y - 0.3, z - len / 2 + k, 0.22, 1.5, 0.22, '#8a5a32', STYLE.SMOOTH)
  b.add(x, y + 0.5, z, 0.1, 0.16, len, '#a8743e', STYLE.SMOOTH)
  b.add(x, y + 0.95, z, 0.1, 0.16, len, '#a8743e', STYLE.SMOOTH)
}

/** A house: painted walls, a pitched roof, a door, windows and a chimney. */
function house(b, x, y, z, s, rand) {
  const put = turned(b, x, y - 0.2, z, Math.floor(rand() * 4) * (Math.PI / 2))
  const wall = pick(rand, ['#f4e2c0', '#bfe0f0', '#f2c4c4', '#d8f0c0', '#fff4b0', '#e8d0f0'])
  const roof = pick(rand, ['#c8503a', '#5a6a8a', '#8a5a3a', '#3a7a5a'])
  const w = 5 * s
  const d = 4.4 * s
  const h = 3.2 * s
  put(0, h / 2, 0, w, h, d, wall, STYLE.SMOOTH)
  for (const side of [-1, 1]) put(side * w * 0.27, h + 0.8 * s, 0, w * 0.6, 0.3 * s, d + 0.5, roof, STYLE.SMOOTH, 0, -side * 0.55)
  put(0, h + 1.25 * s, 0, 0.3 * s, 0.3 * s, d + 0.5, roof, STYLE.SMOOTH)
  put(0, 0.85 * s, d / 2 + 0.03, 0.9 * s, 1.7 * s, 0.08, '#8a5a32', STYLE.SMOOTH)
  for (const side of [-1, 1]) put(side * 1.5 * s, 1.9 * s, d / 2 + 0.03, 0.9 * s, 0.8 * s, 0.08, '#9fd8ff', STYLE.SMOOTH)
  put(w * 0.3, h + 1.4 * s, -d * 0.2, 0.6 * s, 1.4 * s, 0.6 * s, '#8a6a5a', STYLE.SMOOTH)
}

/** A red barn: white trim, a big door, a dark roof. */
function barn(b, x, y, z, s) {
  const w = 7 * s
  b.addOn(x, y - 0.2, z, w, 4.5 * s, 6 * s, '#c8302a', STYLE.SMOOTH)
  for (const side of [-1, 1]) b.add(x + side * w * 0.27, y + 5.1 * s, z, w * 0.6, 0.35 * s, 6.4 * s, '#5a2a22', STYLE.SMOOTH, 0, 0, -side * 0.55)
  b.add(x + (x > 0 ? -w / 2 - 0.05 : w / 2 + 0.05), y + 1.6 * s, z, 0.1, 3.2 * s, 2.8 * s, '#f4f4f4', STYLE.SMOOTH)
  b.add(x + (x > 0 ? -w / 2 - 0.1 : w / 2 + 0.1), y + 1.6 * s, z, 0.1, 2.9 * s, 2.5 * s, '#a82a22', STYLE.SMOOTH)
}

/** A road sign on a post: a green board, a yellow warning diamond, or a blue round one. */
function roadSign(b, x, y, z, rand) {
  b.addOn(x, y - 0.3, z, 0.14, 3.2, 0.14, '#9aa0a8', STYLE.SMOOTH)
  const kind = Math.floor(rand() * 3)
  if (kind === 0) {
    b.add(x, y + 2.7, z, 0.1, 0.9, 1.8, '#1f8a4a', STYLE.SMOOTH)
    b.add(x + (x > 0 ? -0.06 : 0.06), y + 2.75, z, 0.02, 0.14, 1.3, '#ffffff', STYLE.SMOOTH)
  } else if (kind === 1) {
    b.add(x, y + 2.7, z, 0.1, 1.0, 1.0, '#ffd21f', STYLE.SMOOTH, 0, 0.785, 0)
  } else {
    b.add(x, y + 2.7, z, 0.1, 1.0, 1.0, '#2f6ad8', STYLE.SMOOTH)
    b.add(x + (x > 0 ? -0.06 : 0.06), y + 2.7, z, 0.02, 0.5, 0.16, '#ffffff', STYLE.SMOOTH)
  }
}

/** A billboard on two legs, its board in bright panels (lit up, on the night stages). */
function billboard(b, x, y, z, s, rand, lit = false) {
  for (const dz of [-2.2, 2.2]) b.addOn(x, y - 0.3, z + dz * s, 0.3, 5 * s, 0.3, '#5a606a', STYLE.SMOOTH)
  const style = lit ? STYLE.GLOW : STYLE.SMOOTH
  b.add(x, y + 6 * s, z, 0.3, 3.4 * s, 7 * s, '#f4f4f4', STYLE.SMOOTH)
  const face = x > 0 ? -0.18 : 0.18
  b.add(x + face, y + 6 * s, z - 1.6 * s, 0.06, 3 * s, 3.4 * s, pick(rand, ['#ff3b5c', '#2fc6ff', '#ffd21f', '#4ef05a', '#b15cff']), style)
  b.add(x + face, y + 6.6 * s, z + 1.8 * s, 0.06, 1.4 * s, 3 * s, pick(rand, ['#ff7a1a', '#2e6fe0', '#ff5bd8']), style)
  b.add(x + face, y + 5.3 * s, z + 1.8 * s, 0.06, 0.8 * s, 3 * s, '#2a2c30', STYLE.SMOOTH)
}

/** A shipping container, or a stack of them, end-on or along. */
function containers(b, x, y, z, rand) {
  const n = 1 + Math.floor(rand() * 3)
  const yaw = rand() < 0.5 ? 0 : Math.PI / 2
  for (let k = 0; k < n; k += 1) {
    const color = pick(rand, ['#c8302a', '#2f6ab0', '#3a8a4a', '#e8a21a', '#7a4ad8', '#e8eaee', '#d8601a'])
    b.addOn(x, y - 0.2 + k * 2.6, z, 2.5, 2.6, 6.1, color, STYLE.CORRUGATED, yaw + (rand() - 0.5) * 0.06)
  }
}

/** A dockside crane: four striped legs, a long beam, its trolley and cables. */
function portCrane(b, x, y, z, s) {
  const h = 16 * s
  for (const dx of [-4, 4]) for (const dz of [-3, 3]) b.addOn(x + dx * s, y - 0.3, z + dz * s, 0.8, h, 0.8, '#e8a21a', STYLE.STRIPES)
  b.add(x, y + h, z, 30 * s, 1.4 * s, 1.6 * s, '#e8a21a', STYLE.SMOOTH)
  b.add(x + (x > 0 ? -9 : 9) * s, y + h - 1.2 * s, z, 2 * s, 1.2 * s, 2 * s, '#3a3d44', STYLE.SMOOTH)
  b.add(x + (x > 0 ? -9 : 9) * s, y + h - 5 * s, z, 0.08, 7 * s, 0.08, '#2a2c30', STYLE.SMOOTH)
  b.add(x + 4 * s, y + h + 1.5 * s, z, 2.4 * s, 2 * s, 2.4 * s, '#3a3d44', STYLE.WINDOWS)
}

/** A tower crane: a striped mast, a long jib with its counterweight, the cab. */
function towerCrane(b, x, y, z, s) {
  const h = 26 * s
  b.addOn(x, y - 0.3, z, 1.2 * s, h, 1.2 * s, '#ffcc1a', STYLE.STRIPES)
  const toward = x > 0 ? -1 : 1
  b.add(x + toward * 9 * s, y + h, z, 22 * s, 0.9 * s, 0.9 * s, '#ffcc1a', STYLE.STRIPES)
  b.add(x - toward * 4 * s, y + h - 0.6 * s, z, 3 * s, 1.6 * s, 1.6 * s, '#5a606a', STYLE.SMOOTH)
  b.add(x + toward * 1.2 * s, y + h - 1.4 * s, z, 1.8 * s, 1.6 * s, 1.8 * s, '#3a3d44', STYLE.WINDOWS)
  b.add(x + toward * 14 * s, y + h - 6 * s, z, 0.08, 11 * s, 0.08, '#2a2c30', STYLE.SMOOTH)
  b.add(x + toward * 14 * s, y + h - 11.6 * s, z, 3 * s, 0.3 * s, 0.3 * s, '#8a5a32', STYLE.SMOOTH)
}

/** An excavator: tracks, a yellow body and cab, its arm raised. */
function excavator(b, x, y, z, s, rand) {
  const put = turned(b, x, y - 0.2, z, rand() * Math.PI * 2)
  for (const side of [-1, 1]) put(side * 1.3 * s, 0.5 * s, 0, 0.8 * s, 1.0 * s, 4.2 * s, '#2a2c30', STYLE.BELT)
  put(0, 1.5 * s, 0, 2.8 * s, 1.1 * s, 3.2 * s, '#f2b21b', STYLE.SMOOTH)
  put(-0.6 * s, 2.6 * s, 0.6 * s, 1.3 * s, 1.3 * s, 1.4 * s, '#f2b21b', STYLE.WINDOWS)
  put(0.6 * s, 3.2 * s, 2.4 * s, 0.5 * s, 0.5 * s, 3.6 * s, '#f2b21b', STYLE.SMOOTH, -0.7)
  put(0.6 * s, 3.4 * s, 4.6 * s, 0.45 * s, 0.45 * s, 2.6 * s, '#f2b21b', STYLE.SMOOTH, 0.9)
  put(0.6 * s, 1.9 * s, 5.4 * s, 1.0 * s, 0.8 * s, 0.8 * s, '#3a3d44', STYLE.SMOOTH)
}

/** Steel girders and bags of cement, stacked on pallets. */
function girders(b, x, y, z, rand) {
  for (let k = 0; k < 3; k += 1) b.addOn(x, y - 0.2 + k * 0.4, z, 0.5, 0.4, 6, '#c8501a', STYLE.RUST, (rand() - 0.5) * 0.1)
  b.addOn(x + (x > 0 ? 1.4 : -1.4), y - 0.2, z + 1, 1.2, 0.2, 1.2, '#8a5a32', STYLE.SMOOTH)
  for (let k = 0; k < 3; k += 1) b.addOn(x + (x > 0 ? 1.4 : -1.4), y + k * 0.3, z + 1, 1.0, 0.3, 0.6, '#e8e2d0', STYLE.SMOOTH, k * 0.3)
}

/** A concrete road barrier. */
function jersey(b, x, y, z) {
  b.addOn(x, y - 0.1, z, 0.8, 0.35, 2.2, '#c8ccd2', STYLE.SMOOTH)
  b.addOn(x, y + 0.25, z, 0.45, 0.55, 2.2, '#c8ccd2', STYLE.SMOOTH)
  b.addOn(x, y + 0.65, z, 0.47, 0.12, 2.22, '#ff3a3a', STYLE.STRIPES)
}

/** Stadium stands rising away from the arena, packed with a crowd in every colour. */
function stands(b, x, y, z, rand) {
  const away = x > 0 ? 1 : -1
  for (let k = 0; k < 6; k += 1) {
    const rx = x + away * k * 1.6
    b.addOn(rx, y - 0.2, z, 1.6, 0.6 + k * 0.9, 8, '#5a6070', STYLE.BLOCK)
    for (let j = 0; j < 5; j += 1) {
      if (rand() < 0.25) continue
      b.addOn(rx, y + 0.4 + k * 0.9, z - 3.2 + j * 1.6, 0.6, 0.7, 0.6, pick(rand, PAINTS), STYLE.SMOOTH)
    }
  }
}

/** A floodlight tower: a tall mast with a bank of lights turned on the arena. */
function floodlight(b, x, y, z, s) {
  b.addOn(x, y - 0.3, z, 0.7 * s, 18 * s, 0.7 * s, '#4a4e56', STYLE.PLATE)
  b.add(x, y + 18.5 * s, z, 1.2 * s, 2.6 * s, 4.4 * s, '#2a2c30', STYLE.SMOOTH)
  b.add(x + (x > 0 ? -0.62 : 0.62) * s, y + 18.5 * s, z, 0.1, 2.2 * s, 4 * s, '#fff6dc', STYLE.GLOW)
}

/** A village shop: a little house with a striped awning out front. */
function shop(b, x, y, z, rand) {
  const color = pick(rand, ['#4fb4ff', '#ff7a5a', '#7ad04f', '#ffd23f'])
  b.addOn(x, y - 0.2, z, 3.6, 2.8, 4, '#f4ead8', STYLE.SMOOTH)
  b.addOn(x, y + 2.6, z, 3.9, 0.3, 4.3, color, STYLE.SMOOTH)
  b.add(x + (x > 0 ? -2.2 : 2.2), y + 2.0, z, 1.2, 0.12, 4, color, STYLE.STRIPES, 0, 0, x > 0 ? 0.35 : -0.35)
  b.add(x + (x > 0 ? -1.82 : 1.82), y + 1.0, z, 0.06, 1.8, 1.4, '#6a4a2a', STYLE.SMOOTH)
}

// --- Scenery -----------------------------------------------------------------------

/**
 * Calls `place(m, side)` along metres [m0, m1) about every `spacing` metres, on one or
 * both sides.
 */
function along(m0, m1, spacing, rand, density, place) {
  for (let m = m0 + spacing * rand(); m < m1; m += spacing * (0.8 + rand() * 0.6)) {
    if (m < DECOR_START || rand() > density) continue
    for (const side of [-1, 1]) if (rand() < 0.85) place(m, side)
  }
}

/** A spot `out` metres beyond the rim at metre m, on the ledge. */
const ledge = (m, side, out) => {
  const z = zAt(m)
  return [side * (RIM_X + out), topY(z, RIM_H), z]
}
/** A spot on the middle step's top at metre m, seen from the road below (`offset` out from its middle). */
const step = (m, side, offset = 0) => {
  const z = zAt(m)
  return [side * ((STEPS[1][0] + STEPS[1][1]) / 2 + offset), topY(z, STEPS[1][2]), z]
}
/** A spot on the low step's top at metre m. */
const lowStep = (m, side) => {
  const z = zAt(m)
  return [(side * (STEPS[0][0] + STEPS[0][1])) / 2 + side * 0.6, topY(z, STEPS[0][2]), z]
}

const DECOR = {
  junkyard(b, m0, m1, rand, density) {
    along(m0, m1, 7, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 3 + rand() * 36)
      if (rand() < 0.55) crushedStack(b, x, y, z, 1 + rand() * 0.3, rand)
      else wreck(b, x, y, z, 1 + rand() * 0.3, rand)
    })
    along(m0, m1, 10, rand, density, (m, side) => {
      const [x, y, z] = step(m, side, (rand() - 0.5) * 2)
      const r = rand()
      if (r < 0.4) tireStack(b, x, y, z, rand)
      else if (r < 0.7) drum(b, x, y, z, rand, rand() < 0.3)
      else wreck(b, x, y, z, 0.8, rand)
    })
  },
  dirt(b, m0, m1, rand, density) {
    along(m0, m1, 8, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 3 + rand() * 40)
      if (rand() < 0.75) addTree(b, x, y - 0.3, z, 0.9 + rand() * 0.6, rand)
      else hayBale(b, x, y, z, rand)
    })
    along(m0, m1, 70, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 12 + rand() * 20)
      barn(b, x, y, z, 1 + rand() * 0.3)
    })
    along(m0, m1, 14, rand, density, (m, side) => {
      const [x, y, z] = step(m, side)
      if (rand() < 0.5) fence(b, x, y, z, 6)
      else hayBale(b, x, y, z, rand)
    })
  },
  village(b, m0, m1, rand, density) {
    along(m0, m1, 8, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 2 + rand() * 30)
      palm(b, x, y, z, 0.9 + rand() * 0.5, rand)
    })
    along(m0, m1, 16, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 8 + rand() * 30)
      house(b, x, y, z, 0.9 + rand() * 0.3, rand)
    })
    along(m0, m1, 16, rand, density, (m, side) => {
      const [x, y, z] = step(m, side)
      if (rand() < 0.5) shop(b, x, y, z, rand)
      else bush(b, x, y, z, 0.8 + rand() * 0.5, '#3fbf3a')
    })
  },
  cracked(b, m0, m1, rand, density) {
    along(m0, m1, 13, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 6 + rand() * 40)
      officeBlock(b, x, y, z, 0.7 + rand() * 0.4, rand, ['#7a7672', '#8a8478', '#6a6a70', '#9a8a7a'])
    })
    along(m0, m1, 10, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 2 + rand() * 6)
      wreck(b, x, y, z, 1, rand)
    })
    along(m0, m1, 9, rand, density, (m, side) => {
      const [x, y, z] = step(m, side, (rand() - 0.5) * 2)
      const r = rand()
      if (r < 0.35) drum(b, x, y, z, rand, rand() < 0.4)
      else if (r < 0.65) tireStack(b, x, y, z, rand)
      else deadTree(b, x, y, z, 0.7 + rand() * 0.3, rand)
    })
  },
  country(b, m0, m1, rand, density) {
    along(m0, m1, 8, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 3 + rand() * 40)
      addTree(b, x, y - 0.3, z, 0.9 + rand() * 0.6, rand)
    })
    along(m0, m1, 90, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 14 + rand() * 20)
      barn(b, x, y, z, 1.1)
    })
    along(m0, m1, 12, rand, density, (m, side) => {
      const [x, y, z] = step(m, side)
      if (rand() < 0.45) fence(b, x, y, z, 8)
      else bush(b, x, y, z, 0.8 + rand() * 0.5, '#3fbf3a')
    })
  },
  desert(b, m0, m1, rand, density) {
    along(m0, m1, 8, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 2 + rand() * 30)
      cactus(b, x, y, z, 3 + rand() * 3, rand)
    })
    along(m0, m1, 55, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 35 + rand() * 25)
      mesa(b, x, y, z, 16 + rand() * 14, rand)
    })
    along(m0, m1, 20, rand, density, (m, side) => {
      const [x, y, z] = lowStep(m, side)
      if (rand() < 0.5) roadSign(b, x, y, z, rand)
      else cactus(b, x, y, z, 1.6 + rand() * 1.5, rand)
    })
  },
  city(b, m0, m1, rand, density) {
    along(m0, m1, 9, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 6 + rand() * 40)
      officeBlock(b, x, y, z, 0.9 + rand() * 0.5, rand)
    })
    along(m0, m1, 30, rand, density, (m, side) => {
      const [x, y, z] = step(m, side)
      billboard(b, x, y, z, 0.8, rand)
    })
    along(m0, m1, 11, rand, density, (m, side) => {
      const [x, y, z] = lowStep(m, side)
      parkedCar(b, x, y, z, 0.9, rand, 0)
    })
  },
  suburb(b, m0, m1, rand, density) {
    along(m0, m1, 12, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 4 + rand() * 30)
      house(b, x, y, z, 1 + rand() * 0.3, rand)
    })
    along(m0, m1, 8, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 2 + rand() * 40)
      addTree(b, x, y - 0.3, z, 0.8 + rand() * 0.5, rand)
    })
    along(m0, m1, 13, rand, density, (m, side) => {
      const [x, y, z] = step(m, side)
      if (rand() < 0.5) parkedCar(b, x, y, z, 0.95, rand, rand() < 0.5 ? 0 : Math.PI)
      else bush(b, x, y, z, 0.8 + rand() * 0.5, '#3fbf3a')
    })
  },
  snow(b, m0, m1, rand, density) {
    along(m0, m1, 7, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 3 + rand() * 40)
      snowPine(b, x, y, z, 0.8 + rand() * 0.6, rand)
    })
    along(m0, m1, 22, rand, density, (m, side) => {
      const [x, y, z] = step(m, side)
      if (rand() < 0.5) snowman(b, x, y, z)
      else snowPine(b, x, y, z, 0.6, rand)
    })
  },
  mountain(b, m0, m1, rand, density) {
    along(m0, m1, 8, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 3 + rand() * 40)
      if (rand() < 0.6) snowPine(b, x, y, z, 0.8 + rand() * 0.6, rand)
      else rock(b, x, y, z, 1 + rand() * 1.2, '#8a8a8e')
    })
    along(m0, m1, 16, rand, density, (m, side) => {
      const [x, y, z] = step(m, side)
      if (rand() < 0.5) rock(b, x, y, z, 0.6 + rand() * 0.4, '#7a7a80')
      else addTree(b, x, y - 0.3, z, 0.6, rand)
    })
  },
  highway(b, m0, m1, rand, density) {
    along(m0, m1, 40, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 3 + rand() * 8)
      billboard(b, x, y, z, 1.1, rand)
    })
    along(m0, m1, 14, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 30 + rand() * 30)
      officeBlock(b, x, y, z, 1 + rand() * 0.5, rand)
    })
    along(m0, m1, 10, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 14 + rand() * 14)
      addTree(b, x, y - 0.3, z, 0.8 + rand() * 0.4, rand)
    })
  },
  harbor(b, m0, m1, rand, density) {
    along(m0, m1, 6, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 3 + rand() * 40)
      containers(b, x, y, z, rand)
    })
    along(m0, m1, 70, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 18 + rand() * 10)
      portCrane(b, x, y, z, 1)
    })
    along(m0, m1, 12, rand, density, (m, side) => {
      const [x, y, z] = step(m, side, (rand() - 0.5) * 2)
      if (rand() < 0.5) drum(b, x, y, z, rand)
      else containers(b, x, y, z, () => 0)
    })
  },
  quarry(b, m0, m1, rand, density) {
    along(m0, m1, 8, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 3 + rand() * 40)
      rock(b, x, y, z, 1 + rand() * 1.4, pick(rand, ['#b08a68', '#9a8a7a', '#c8a07a']))
    })
    along(m0, m1, 36, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 8 + rand() * 20)
      excavator(b, x, y, z, 1.2, rand)
    })
    along(m0, m1, 14, rand, density, (m, side) => {
      const [x, y, z] = step(m, side)
      if (rand() < 0.5) rock(b, x, y, z, 0.6 + rand() * 0.4, '#a88a68')
      else tireStack(b, x, y, z, rand)
    })
  },
  neon(b, m0, m1, rand, density) {
    along(m0, m1, 12, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 6 + rand() * 40)
      tower(b, x, y, z, 0.8 + rand() * 0.6, rand)
    })
    along(m0, m1, 26, rand, density, (m, side) => {
      const [x, y, z] = step(m, side)
      billboard(b, x, y, z, 0.8, rand, true)
    })
  },
  tunnel(b, m0, m1, rand, density) {
    along(m0, m1, 14, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 4 + rand() * 30)
      pylon(b, x, y, z, 1, rand)
    })
  },
  wasteland(b, m0, m1, rand, density) {
    along(m0, m1, 9, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 2 + rand() * 34)
      if (rand() < 0.5) deadTree(b, x, y, z, 0.9 + rand() * 0.6, rand)
      else wreck(b, x, y, z, 1.1, rand)
    })
    along(m0, m1, 12, rand, density, (m, side) => {
      const [x, y, z] = step(m, side, (rand() - 0.5) * 2)
      const r = rand()
      if (r < 0.4) drum(b, x, y, z, rand, true)
      else if (r < 0.7) toxicBarrel(b, x, y, z, 0.8 + rand() * 0.3)
      else tireStack(b, x, y, z, rand)
    })
  },
  construction(b, m0, m1, rand, density) {
    along(m0, m1, 50, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 10 + rand() * 20)
      towerCrane(b, x, y, z, 1)
    })
    along(m0, m1, 12, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 3 + rand() * 30)
      if (rand() < 0.5) girders(b, x, y, z, rand)
      else excavator(b, x, y, z, 1, rand)
    })
    along(m0, m1, 8, rand, density, (m, side) => {
      const [x, y, z] = lowStep(m, side)
      if (rand() < 0.6) jersey(b, x, y, z)
      else cone(b, x, y, z)
    })
  },
  arena(b, m0, m1, rand, density) {
    along(m0, m1, 8, rand, Math.max(density, 0.6), (m, side) => {
      const [x, y, z] = ledge(m, side, 1)
      stands(b, x, y, z, rand)
    })
    along(m0, m1, 30, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 12)
      floodlight(b, x, y, z, 1)
    })
    along(m0, m1, 11, rand, density, (m, side) => {
      const [x, y, z] = step(m, side)
      if (rand() < 0.5) crushedStack(b, x, y, z, 1, rand)
      else tireStack(b, x, y, z, rand)
    })
  },
  skyway(b, m0, m1, rand, density) {
    along(m0, m1, 8, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 4 + rand() * 40)
      cloudPuff(b, x, y + 1 + rand() * 6, z, 0.9 + rand() * 0.8, rand)
    })
    along(m0, m1, 16, rand, density, (m, side) => {
      const [x, y, z] = step(m, side)
      goldColumn(b, x, y, z, 2.5 + rand() * 1.5)
    })
  },
  mega(b, m0, m1, rand, density) {
    along(m0, m1, 9, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 2 + rand() * 35)
      if (rand() < 0.6) crystal(b, x, y, z, 0.8 + rand() * 0.8, rand)
      else holo(b, x, y, z, 1 + rand() * 0.6, rand)
    })
    along(m0, m1, 16, rand, density, (m, side) => {
      const [x, y, z] = step(m, side)
      pylon(b, x, y, z, 0.8, rand)
    })
    if (rand() < 0.7 * density) {
      const m = m0 + rand() * CHUNK
      const z = zAt(m)
      const color = pick(rand, ['#ff7ad9', '#7fe2ff', '#ffb14a', '#9b6bff'])
      planet(b, (rand() < 0.5 ? -1 : 1) * (60 + rand() * 40), topY(z, RIM_H) + 20 + rand() * 30, z, 6 + rand() * 8, color, '#ffe45c')
    }
  },
}

/**
 * Builds chunk `index` (metres [index*CHUNK, (index+1)*CHUNK)).
 * @param {{ density?: number }} options 0-1 scenery density (quality)
 */
export function buildChunk(index, { density = 1 } = {}) {
  const b = new BlockSet()
  const rand = mulberry32(index * 7919 + 13)
  const m0 = index * CHUNK
  const m1 = Math.min(m0 + CHUNK, trackEnd())
  if (m0 >= trackEnd()) return b
  // The first chunk stands beside the lobby's mountains; past it the ledges run out wide.
  const wide = index > 0

  // Split the chunk at the bends, so each part is all slope or all flat, in its own colours.
  const cuts = [m0, ...bends().filter((m) => m > m0 && m < m1), m1]

  for (let i = 0; i < cuts.length - 1; i += 1) {
    const a = cuts[i]
    const c = cuts[i + 1]
    const mid = (a + c) / 2
    const kind = mid > TRACK_LENGTH ? 'summit' : isSlope(mid) ? 'slope' : 'safe'
    // A SAFEZONE looks like the stage whose top it is; a slope like its own.
    const stage = STAGES[kind === 'safe' ? stageAt(mid) - 1 : stageAt(mid)]
    // Beside the lobby the cliffs are always tall, to meet its mountains.
    STEPS = STAGE_THEMES[stage.id].open && wide ? LOW : TALL
    RIM_H = STEPS[2][2]
    walls(b, a, c, STAGE_THEMES[stage.id], wide, kind)
    DECOR[stage.id](b, a, c, rand, density)
  }

  for (let i = 1; i < STAGES.length; i += 1) {
    if (safeStart(i) >= m0 && safeStart(i) < m1) safezone(b, i)
  }
  STEPS = TALL
  RIM_H = TALL[2][2]
  if (TRACK_LENGTH >= m0 && TRACK_LENGTH < m1) summit(b, STAGE_THEMES[STAGES[STAGES.length - 1].id])
  return b
}

/** Every chunk there is. */
export const chunkCount = () => Math.ceil(trackEnd() / CHUNK)
