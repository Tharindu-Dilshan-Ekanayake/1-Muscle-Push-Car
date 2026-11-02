import { mulberry32 } from '@shared/rng'
import {
  AURA_STAND,
  PLAZA,
  PORTALS,
  POTION_STAND,
  SHOP,
  WATER_TOWER,
  ZONE_COUNT,
  ZONE_PITCH,
  zoneCenterZ,
} from '@shared/world'

import { STYLE } from '../materials'
import { PORTAL_CENTER_Y } from './portalFrame'
import { TOWN_DEPTH } from './terrain'
import { ZONE_THEMES } from './structures'

/**
 * The old town round the square: rows of old buildings facing in on every side - a
 * gym for each Train Zone on the west, the clock-towered town hall behind the
 * leaderboards on the south, the market hall behind the dumbbell sign on the east,
 * townhouses everywhere else, the water tower in the north-east corner - and in the
 * square, gas lamps down Main Street, the kiosks' striped canopies and the brick
 * archway round the portal.
 *
 * All boxes in the world's one block set: no draw calls of their own. The windows,
 * bricks, roof tiles and cobbles are the toy shader's (TOWNHOUSE, BRICK, ROOF, COBBLE),
 * not boxes. `detail` (MEDIUM and up) adds the small things: chimneys, sign lettering,
 * flower boxes, parked cars.
 */

/** How far out the town's rows run, either way along each side. */
const EDGE = PLAZA.maxX + TOWN_DEPTH
/** The houses' fronts stand back this far from the square's edge: a pavement, and room to park. */
const SETBACK = 3.2
const STOREY = 3.2

const WALLS = ['#efe2c8', '#f2d6b8', '#e8c4a8', '#d9e4d0', '#f4e6b8', '#e6d2dc', '#cfe0ea', '#e8b89a']
const ROOFS = ['#b8583a', '#a04a36', '#8a5a44', '#c26a42', '#6a5a5a']
const TRIM = '#f6f2ea'
const AWNINGS = [
  ['#d8302a', '#f6f2ea'],
  ['#2f7a4a', '#f6f2ea'],
  ['#2f5aa8', '#f6f2ea'],
  ['#e8a21a', '#5a3a22'],
]
const BRICK_RED = '#a8563e'
const DARK = '#2a2c30'
const WOOD = '#6a4428'
const LAMP = '#ffe6a0'

const pick = (rand, list) => list[Math.floor(rand() * list.length)]

/**
 * A row of buildings along one side of the square. `face` is the way their fronts look
 * ('n' -z, 's' +z, 'e' +x, 'w' -x), `front` the line their fronts stand on. at(a, d)
 * gives the world point `a` along the row and `d` back from the front (behind it, away
 * from the square); dims(along, back) a box's world size.
 */
function row(face, front) {
  const alongX = face === 'n' || face === 's'
  const out = face === 'n' || face === 'w' ? 1 : -1
  return {
    alongX,
    out,
    at: (a, d) => (alongX ? [a, front + out * d] : [front + out * d, a]),
    dims: (along, back) => (alongX ? [along, back] : [back, along]),
  }
}

/** A box `a` along the row, its front `d` back from the row's front line, sitting on y0. */
function box(b, r, a, d, y0, along, height, back, color, style = STYLE.SMOOTH) {
  const [x, z] = r.at(a, d + back / 2)
  const [sx, sz] = r.dims(along, back)
  b.addOn(x, y0, z, sx, height, sz, color, style)
}

/**
 * A slab tipped about the row's length: `along` long, `slope` up its tilt, centred `d`
 * back from the front at height y, rising `tilt` radians as it goes back from the square
 * (negative: as it comes forward).
 */
function slab(b, r, a, d, y, along, slope, thick, tilt, color, style) {
  const [x, z] = r.at(a, d)
  if (r.alongX) b.add(x, y, z, along, thick, slope, color, style, 0, tilt * r.out, 0)
  else b.add(x, y, z, slope, thick, along, color, style, 0, 0, tilt * r.out)
}

/** A pitched roof over a building `width` along and `depth` back, its eaves at y. */
function gable(b, r, a, d0, width, depth, y, color) {
  const rise = depth * 0.32
  const tilt = Math.atan2(rise, depth / 2)
  const slope = Math.hypot(depth / 2, rise) + 0.5
  slab(b, r, a, d0 + depth * 0.25, y + rise / 2, width + 0.6, slope, 0.32, tilt, color, STYLE.ROOF)
  slab(b, r, a, d0 + depth * 0.75, y + rise / 2, width + 0.6, slope, 0.32, -tilt, color, STYLE.ROOF)
}

/** A striped awning out over a doorway, sloping down to the square. */
function awning(b, r, a, width, y, colors) {
  const strips = 6
  const w = width / strips
  for (let k = 0; k < strips; k += 1) {
    slab(b, r, a - width / 2 + w * (k + 0.5), -0.75, y, w + 0.01, 1.6, 0.1, 0.32, colors[k % 2], STYLE.SMOOTH)
  }
}

/** A shop sign on the wall over the awning: a board with a line or two of "lettering". */
function sign(b, r, a, y, width, color, detail) {
  box(b, r, a, -0.12, y, width, 0.75, 0.12, color, STYLE.SMOOTH)
  if (!detail) return
  box(b, r, a - width * 0.08, -0.16, y + 0.42, width * 0.6, 0.12, 0.04, TRIM, STYLE.GLOW)
  box(b, r, a + width * 0.12, -0.16, y + 0.18, width * 0.4, 0.1, 0.04, TRIM, STYLE.GLOW)
}

/**
 * A townhouse `width` along the row, `depth` back, `storeys` high: plastered walls with
 * their windows, a cornice, a tiled roof (or a flat one behind a parapet), a door, and
 * on the ground floor a shop with its awning and sign.
 */
function townhouse(b, r, a, width, depth, storeys, rand, detail) {
  const wall = pick(rand, WALLS)
  const h = storeys * STOREY + 0.3
  box(b, r, a, 0, -0.2, width, h + 0.2, depth, wall, STYLE.TOWNHOUSE)
  box(b, r, a, -0.15, h - 0.05, width + 0.3, 0.35, depth + 0.3, TRIM)
  if (rand() < 0.7) {
    gable(b, r, a, 0, width, depth, h + 0.3, pick(rand, ROOFS))
  } else {
    box(b, r, a, -0.15, h + 0.3, width + 0.3, 0.7, 0.3, wall)
    if (detail) box(b, r, a + width * 0.2, depth * 0.4, h + 0.3, 1.6, 1.4, 1.6, '#8a6a4a', STYLE.STRIPES)
  }
  if (detail && rand() < 0.7) box(b, r, a - width * 0.28, depth * 0.55, h, 0.8, 2.2, 0.8, BRICK_RED, STYLE.BRICK)
  // The ground floor: a door, and a shop's awning and sign over it.
  box(b, r, a + width * 0.32, -0.06, 0, 1.1, 2.3, 0.1, WOOD)
  if (rand() < 0.75) {
    awning(b, r, a - width * 0.08, width * 0.62, 2.55, pick(rand, AWNINGS))
    sign(b, r, a - width * 0.08, 3.0, width * 0.55, pick(rand, ['#2f5aa8', '#2f7a4a', '#7a2a2a', '#3a3d44', '#c88a1a']), detail)
  }
}

/** One of Gym Row's gyms, behind Train Zone `zone`: brick, wide open, its awning and lit sign in the zone's colours. */
function gym(b, r, a, width, zone, detail) {
  const theme = ZONE_THEMES[zone]
  const depth = 11
  const h = 2 * STOREY + 0.8
  box(b, r, a, 0, -0.2, width, h + 0.2, depth, BRICK_RED, STYLE.BRICK)
  box(b, r, a, -0.15, h, width + 0.3, 0.5, depth + 0.3, '#d8cfc0')
  box(b, r, a, -0.1, h + 0.5, width + 0.1, 0.6, 0.3, BRICK_RED, STYLE.BRICK)
  // The open front: the dark gym inside, a rolled-up door over it.
  box(b, r, a, -0.04, 0, width - 2.4, 3.6, 0.1, '#241e1c')
  box(b, r, a, -0.12, 3.6, width - 2.2, 0.45, 0.2, '#8a9098', STYLE.STRIPES)
  // Upstairs windows, and the sign in the gym's colour.
  for (const k of [-1, 0, 1]) {
    box(b, r, a + k * (width / 3.2), -0.05, 4.8, 1.4, 1.5, 0.1, TRIM)
    box(b, r, a + k * (width / 3.2), -0.09, 4.92, 1.15, 1.26, 0.1, '#2a3a4c')
  }
  awning(b, r, a, width - 1.6, 4.05, [theme.pad, '#f6f2ea'])
  box(b, r, a, -0.2, h - 0.2, width * 0.7, 0.9, 0.2, theme.text, STYLE.GLOW)
  if (detail) box(b, r, a, -0.26, h + 0.05, width * 0.45, 0.22, 0.06, DARK)
}

/**
 * The town hall: a wide pale building, columns across its front under a pediment, and
 * its clock tower rising from the middle, a clock on every side.
 */
function townHall(b, r, a, width, detail) {
  const depth = 12
  const h = 3 * STOREY + 0.6
  box(b, r, a, 0, -0.2, width, h + 0.2, depth, '#efe4cc', STYLE.TOWNHOUSE)
  box(b, r, a, -0.2, h, width + 0.4, 0.5, depth + 0.4, TRIM)
  gable(b, r, a, 0, width, depth, h + 0.5, '#6a7a8a')
  // Steps, columns and the pediment over them.
  box(b, r, a, -2.2, 0, 12, 0.3, 2.2, '#cfc6b4')
  box(b, r, a, -1.4, 0.3, 11, 0.3, 1.4, '#ddd4c2')
  for (let k = 0; k < 6; k += 1) box(b, r, a - 5 + k * 2, -1.0, 0.6, 0.7, 7.2, 0.7, TRIM)
  box(b, r, a, -1.3, 7.8, 12, 0.8, 1.4, TRIM)
  // The tower: brick, then the clock stage, then a steep roof and a spire.
  const t = depth * 0.45
  box(b, r, a, t - 3, h, 6, 7, 6, BRICK_RED, STYLE.BRICK)
  box(b, r, a, t - 3.3, h + 7, 6.6, 4.4, 6.6, '#efe4cc')
  const [cx, cz] = r.at(a, t)
  const y = h + 9.2
  // A clock on each side: a white face (two squares an eighth apart), its hands.
  for (const [dx, dz, along] of [[0, -3.32, true], [0, 3.32, true], [-3.32, 0, false], [3.32, 0, false]]) {
    for (const turn of [0, Math.PI / 4]) {
      if (along) b.add(cx + dx, y, cz + dz, 2.6, 2.6, 0.12, '#fff8e6', STYLE.GLOW, 0, 0, turn)
      else b.add(cx + dx, y, cz + dz, 0.12, 2.6, 2.6, '#fff8e6', STYLE.GLOW, 0, turn, 0)
    }
    if (along) {
      b.add(cx + dx, y + 0.45, cz + dz * 1.03, 0.14, 0.9, 0.06, DARK)
      b.add(cx + dx + 0.3, y, cz + dz * 1.03, 0.7, 0.12, 0.06, DARK)
    } else {
      b.add(cx + dx * 1.03, y + 0.45, cz + dz, 0.06, 0.9, 0.14, DARK)
      b.add(cx + dx * 1.03, y, cz + dz + 0.3, 0.06, 0.12, 0.7, DARK)
    }
  }
  b.addOn(cx, h + 11.4, cz, 7.2, 0.4, 7.2, TRIM)
  for (let k = 0; k < 4; k += 1) b.addOn(cx, h + 11.8 + k * 1.3, cz, 6 - k * 1.45, 1.3, 6 - k * 1.45, '#6a7a8a', STYLE.ROOF)
  b.addOn(cx, h + 17, cz, 0.2, 2.4, 0.2, '#d4b04a', STYLE.SMOOTH)
  if (detail) b.add(cx, h + 19.6, cz, 0.5, 0.5, 0.5, '#ffd21f', STYLE.GLOW, 0.785, 0.6, 0)
}

/** The market hall behind the dumbbell sign: long and brick, with a sawtooth roof of skylights. */
function marketHall(b, r, a, width) {
  const depth = 12
  const h = 9
  box(b, r, a, 0, -0.2, width, h + 0.2, depth, '#9a5040', STYLE.BRICK)
  box(b, r, a, -0.1, h, width + 0.2, 0.4, depth + 0.2, '#d8cfc0')
  const teeth = 4
  for (let k = 0; k < teeth; k += 1) {
    const d = (depth / teeth) * (k + 0.5)
    slab(b, r, a, d, h + 1.4, width, depth / teeth + 0.6, 0.3, 0.75, '#6a5a5a', STYLE.ROOF)
  }
}

/** A little old car parked by the kerb, nose along the row. */
function parkedCar(b, r, a, d, rand) {
  const color = pick(rand, ['#c8302a', '#2e6fe0', '#e8c35a', '#3a8a5a', '#f4f6f8', '#7a4a8a'])
  box(b, r, a, d, 0.35, 4, 0.75, 1.9, color)
  box(b, r, a - 0.3, d + 0.12, 1.1, 2.1, 0.62, 1.66, color)
  box(b, r, a - 0.3, d + 0.1, 1.2, 1.8, 0.4, 1.7, '#26303a')
  for (const k of [-1.3, 1.3]) box(b, r, a + k, d - 0.05, 0, 0.72, 0.72, 2.0, DARK)
}

// --- The square's own things ------------------------------------------------------------

/** A gas lamp: a dark post on a stepped foot, the lantern lit warm, its little roof. */
function gasLamp(b, x, z) {
  b.addOn(x, 0, z, 0.5, 0.35, 0.5, DARK)
  b.addOn(x, 0.35, z, 0.18, 3.1, 0.18, DARK)
  b.addOn(x, 3.45, z, 0.5, 0.12, 0.5, DARK)
  b.addOn(x, 3.57, z, 0.4, 0.5, 0.4, LAMP, STYLE.GLOW)
  b.addOn(x, 4.07, z, 0.62, 0.14, 0.62, DARK)
  b.addOn(x, 4.21, z, 0.3, 0.18, 0.3, DARK)
}

/** A striped canopy on four posts over a kiosk, `w` across and `l` long, its eaves at y. */
function canopy(b, x, z, w, l, y, colors) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.addOn(x + sx * (w / 2 - 0.2), 0, z + sz * (l / 2 - 0.2), 0.22, y, 0.22, DARK)
  const strips = 8
  const tilt = 0.32
  const slope = w / 2 / Math.cos(tilt) + 0.3
  for (let k = 0; k < strips; k += 1) {
    const sz = z - l / 2 + (l / strips) * (k + 0.5)
    for (const side of [-1, 1]) {
      b.add(x + side * (w / 4), y + Math.tan(tilt) * (w / 4), sz, slope, 0.12, l / strips + 0.01, colors[k % 2], STYLE.SMOOTH, 0, 0, -side * tilt)
    }
  }
}

/** A brick archway round the portal: two pillars and an arch beam with a lit band. */
function archway(b, portal) {
  const { x, z, radius } = portal
  // Its beam clears the ring (whose top blocks reach 0.6 over its radius).
  const top = PORTAL_CENTER_Y + radius + 2.2
  for (const side of [-1, 1]) {
    b.addOn(x + side * (radius + 1.5), 0, z, 1.6, top, 2, BRICK_RED, STYLE.BRICK)
    b.addOn(x + side * (radius + 1.5), top, z, 2, 0.4, 2.4, '#d8cfc0')
  }
  b.addOn(x, top - 1.4, z, (radius + 2.3) * 2, 1.4, 2, BRICK_RED, STYLE.BRICK)
  b.addOn(x, top - 0.9, z + 1.02, radius * 2, 0.4, 0.06, '#3fd0ff', STYLE.GLOW)
}

/** The old water tower: four legs and their braces, a wooden tank, a pointed roof. */
function waterTower(b) {
  const { x, z } = WATER_TOWER
  const legs = 12
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.addOn(x + sx * 2.4, 0, z + sz * 2.4, 0.4, legs, 0.4, '#5a4a3a')
  for (const y of [4, 8]) {
    b.add(x, y, z - 2.4, 4.8, 0.2, 0.2, '#5a4a3a')
    b.add(x, y, z + 2.4, 4.8, 0.2, 0.2, '#5a4a3a')
    b.add(x - 2.4, y, z, 0.2, 0.2, 4.8, '#5a4a3a')
    b.add(x + 2.4, y, z, 0.2, 0.2, 4.8, '#5a4a3a')
  }
  for (const turn of [0, Math.PI / 4]) b.addOn(x, legs, z, 6, 5, 6, '#8a7a6a', STYLE.PLATE, turn)
  b.addOn(x, legs + 2, z, 6.3, 0.3, 6.3, '#5a4a3a')
  for (let k = 0; k < 3; k += 1) b.addOn(x, legs + 5 + k * 1, z, 6.4 - k * 2, 1, 6.4 - k * 2, '#6a5a5a', STYLE.ROOF, Math.PI / 4)
}

/** Gas lamps down both sides of Main Street, from the eggs to the road. */
const LAMPS = [24, 14, 0, -12, -24].flatMap((z) => [[-6, z], [6, z]])

/** Builds the town into `blocks`. */
export function buildTown(blocks, { detail = true } = {}) {
  const b = blocks
  const rand = mulberry32(1907)

  // South: townhouses either side of the town hall (behind the leaderboards).
  const south = row('n', PLAZA.maxZ + SETBACK)
  townHall(b, south, 0, 28, detail)
  for (const [from, to] of [[-EDGE, -14.5], [14.5, EDGE]]) fillRow(b, south, from, to, rand, detail, 2, 4)

  // West: Gym Row, a gym behind each Train Zone, and townhouses past either end.
  const west = row('e', PLAZA.minX - SETBACK)
  for (let i = 0; i < ZONE_COUNT; i += 1) gym(b, west, zoneCenterZ(i), ZONE_PITCH - 0.4, i, detail)
  fillRow(b, west, PLAZA.minZ - 3, zoneCenterZ(ZONE_COUNT - 1) - ZONE_PITCH / 2, rand, detail, 2, 3)

  // East: the market hall behind the dumbbell sign, townhouses either side of it.
  const east = row('w', PLAZA.maxX + SETBACK)
  marketHall(b, east, (SHOP.minZ + SHOP.maxZ) / 2, SHOP.maxZ - SHOP.minZ + 2)
  fillRow(b, east, PLAZA.minZ - 3, SHOP.minZ - 1.5, rand, detail, 2, 3)
  fillRow(b, east, SHOP.maxZ + 1.5, PLAZA.maxZ + 0.5, rand, detail, 2, 3)

  // North: either side of the road's gate - the water tower on the east.
  const north = row('s', PLAZA.minZ - SETBACK)
  fillRow(b, north, -EDGE, -37, rand, detail, 2, 3)
  waterTower(b)

  // Cars parked along the kerbs.
  if (detail) {
    for (const [r, a] of [[south, -24], [south, 30], [south, 44], [east, 22], [east, -32], [north, -44]]) parkedCar(b, r, a, -2.3, rand)
  }

  // The square.
  for (const [x, z] of LAMPS) gasLamp(b, x, z)
  canopy(b, AURA_STAND.x, AURA_STAND.z - 0.4, 6.2, 5.8, 4.7, ['#7a4ad8', '#f6f2ea'])
  canopy(b, POTION_STAND.x, POTION_STAND.z - 0.4, 4.6, 2.8, 3.9, ['#d8302a', '#f6f2ea'])
  for (const portal of PORTALS) archway(b, portal)
}

/**
 * Fills a row from `from` to `to` (along it) with townhouses side by side, each its own
 * width, colour and height (`low` to `high` storeys).
 */
function fillRow(b, r, from, to, rand, detail, low, high) {
  let a = from
  while (to - a > 4) {
    const width = Math.min(to - a, 6.5 + rand() * 4)
    const storeys = low + Math.floor(rand() * (high - low + 1))
    townhouse(b, r, a + width / 2, width - 0.1, 9 + rand() * 2, storeys, rand, detail)
    a += width
  }
}
