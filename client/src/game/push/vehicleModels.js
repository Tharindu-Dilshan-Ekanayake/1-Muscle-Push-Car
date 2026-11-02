import {
  BatchedMesh,
  BoxGeometry,
  BufferAttribute,
  Color,
  CylinderGeometry,
  Euler,
  Matrix4,
  MeshLambertMaterial,
  Quaternion,
  Vector3,
} from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { VEHICLES } from '@shared/balance'

import { glowTime } from '../glow'
import { LIGHTS } from '../sceneStyle'

/**
 * Every vehicle you push up the road: a rusty hatchback in the junkyard, an old farm
 * pickup, a three-wheeler, vans, a school bus, box, container and dump trucks, and on up
 * to a giant mining truck at the top of Mega City.
 *
 * Each model is built once from boxes, rounded boxes and cylinders into one merged
 * geometry, every vertex tagged with what it's made of (`aLook.x`, a PART) and how worn
 * the vehicle is (`aLook.y`, 0 showroom-new to 1 a rust bucket). One material paints it
 * all from that in its shader, with no textures: glossy paint that fades, gets grimy and
 * rusts through as the wear goes up; tinted glass that mirrors the sky (cracked on the
 * wrecks); headlights and tail lights that glow (or have gone dark); chrome; tyres whose
 * tread you can see turning; flashing sirens.
 *
 * Every body and every wheel in the game is an instance of one BatchedMesh: one draw
 * call for all of them, whichever models are on screen.
 *
 * Vehicle space: x across (+ right), y up from the road, and forward (the way it's
 * pushed, up the track) is -z. Models are written with `f` = metres forward of the
 * middle, which the builder turns into -z. Every model fits the footprint its VEHICLES
 * entry gives (length, width, height).
 */

/** What a surface is made of, for the shader. */
export const PART = {
  PAINT: 0,
  GLASS: 1,
  HEADLIGHT: 2,
  TAILLIGHT: 3,
  RUBBER: 4,
  CHROME: 5,
  MATTE: 6,
  /** Paint pressed into ribs: container walls, box bodies, a mixer's drum. */
  RIBS: 7,
  SIREN: 8,
  NEON: 9,
  TIRE: 10,
  HUB: 11,
}

const P = PART
const GLASS = '#1c2a3a'
const TINT = '#141a24'
const HEAD = '#fff3c4'
const TAIL = '#ff2a2a'
const AMBER = '#ffaa1a'
const BLACK = '#24262b'
const DARK = '#3a3d44'
const STEEL = '#c3c9d1'
const WOOD = '#8a5a32'

const UNIT_BOX = new BoxGeometry(1, 1, 1)
const _m = new Matrix4()
const _q = new Quaternion()
const _e = new Euler()
const _v = new Vector3()
const _s = new Vector3()

/** A model under construction: parts added in vehicle space, merged by build(). */
class Shape {
  constructor(wear) {
    this.wear = wear
    this.parts = []
    /** Rounded box templates made for this model, by size. */
    this.rounded = new Map()
  }

  /** Adds `geometry` (a template, not modified) turned by `rot` [x, y, z] and moved to (x, y, f). */
  add(geometry, x, y, f, scale, color, part, rot) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone()
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name)
    _q.setFromEuler(_e.set(rot?.[0] ?? 0, rot?.[1] ?? 0, rot?.[2] ?? 0))
    g.applyMatrix4(_m.compose(_v.set(x, y, -f), _q, _s.fromArray(scale)))
    const n = g.getAttribute('position').count
    const c = new Color(color)
    const colors = new Float32Array(n * 3)
    const looks = new Float32Array(n * 2)
    for (let i = 0; i < n; i += 1) {
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
      looks[i * 2] = part
      looks[i * 2 + 1] = this.wear
    }
    g.setAttribute('color', new BufferAttribute(colors, 3))
    g.setAttribute('aLook', new BufferAttribute(looks, 2))
    this.parts.push(g)
    return this
  }

  /**
   * A box centred (x, y, f), `w` across, `h` high and `l` long. `round` > 0 rounds its
   * edges by that much (keep it under half its smallest side).
   */
  box(x, y, f, w, h, l, color, part = P.PAINT, round = 0, rot = null) {
    if (round > 0) {
      // Rounded boxes are the slow part of building a model: the same one twice (a
      // pair, say) is made once.
      const key = `${w},${h},${l},${round}`
      if (!this.rounded.has(key)) this.rounded.set(key, new RoundedBoxGeometry(w, h, l, 2, round))
      return this.add(this.rounded.get(key), x, y, f, [1, 1, 1], color, part, rot)
    }
    return this.add(UNIT_BOX, x, y, f, [w, h, l], color, part, rot)
  }

  /** The same box on both sides: at x and -x. */
  pair(x, y, f, w, h, l, color, part = P.PAINT, round = 0, rot = null) {
    this.box(x, y, f, w, h, l, color, part, round, rot)
    return this.box(-x, y, f, w, h, l, color, part, round, rot && [rot[0], -rot[1], -rot[2]])
  }

  /** A cylinder of radius r and length `len`, its axis across ('x'), up ('y') or along ('f'). */
  cyl(x, y, f, r, len, color, part = P.PAINT, axis = 'x', segments = 14, rot = null) {
    const g = new CylinderGeometry(r, r, len, segments, 1)
    const turn = axis === 'x' ? [0, 0, Math.PI / 2] : axis === 'f' ? [Math.PI / 2, 0, 0] : [0, 0, 0]
    if (rot) for (let i = 0; i < 3; i += 1) turn[i] += rot[i]
    this.add(g, x, y, f, [1, 1, 1], color, part, turn)
    g.dispose()
    return this
  }

  build() {
    const merged = mergeGeometries(this.parts, false)
    for (const part of this.parts) part.dispose()
    for (const template of this.rounded.values()) template.dispose()
    this.parts = []
    this.rounded.clear()
    merged.computeBoundingSphere()
    merged.computeBoundingBox()
    return merged
  }
}

// --- Shared details ------------------------------------------------------------------

/** Headlights on the front face (at f), `x` either side of the middle. */
function headlights(s, x, y, f, w = 0.36, h = 0.22) {
  return s.pair(x, y, f + 0.02, w, h, 0.08, HEAD, P.HEADLIGHT, Math.min(w, h) * 0.3)
}
/** Tail lights on the back face (at f, negative). */
function taillights(s, x, y, f, w = 0.3, h = 0.22) {
  return s.pair(x, y, f - 0.02, w, h, 0.08, TAIL, P.TAILLIGHT, Math.min(w, h) * 0.3)
}
/** A number plate: white, on the face at f (front > 0, back < 0). */
function plate(s, y, f) {
  return s.box(0, y, f + Math.sign(f) * 0.02, 0.56, 0.16, 0.04, '#f4f4ee', P.MATTE)
}
/** Wing mirrors, either side of a cabin `x` out, at height y, f along. */
function mirrors(s, x, y, f, color) {
  s.pair(x + 0.1, y, f, 0.16, 0.14, 0.1, color, P.PAINT, 0.03)
  return s.pair(x + 0.17, y, f - 0.02, 0.02, 0.1, 0.07, '#9fb4c8', P.CHROME)
}
/**
 * A cabin's glass: a windscreen on its front face, a back window, and `panes` windows
 * down each side between pillars. Cabin spans f0 (back) to f1 (front), y0 to y1, `w` across.
 */
function glazing(s, { f0, f1, y0, y1, w, panes = 2, color = GLASS, back = true, front = true, pillar }) {
  const h = y1 - y0 - 0.16
  const y = (y0 + y1) / 2 + 0.02
  if (front) s.box(0, y, f1 + 0.005, w - 0.18, h, 0.04, color, P.GLASS)
  if (back) s.box(0, y, f0 - 0.005, w - 0.2, h * 0.9, 0.04, color, P.GLASS)
  const len = f1 - f0 - 0.24
  const each = len / panes
  for (let k = 0; k < panes; k += 1) {
    const mid = f0 + 0.12 + each * (k + 0.5)
    s.pair(w / 2 + 0.005, y, mid, 0.04, h, each - 0.12, color, P.GLASS)
    if (pillar && k > 0) s.pair(w / 2 + 0.012, y, f0 + 0.12 + each * k, 0.04, h + 0.04, 0.12, pillar, P.PAINT)
  }
  return s
}
/** A grille on the front face: dark slats in a chrome (or body) frame. */
function grille(s, y, f, w, h, frame = STEEL, part = P.CHROME) {
  s.box(0, y, f + 0.01, w + 0.08, h + 0.08, 0.06, frame, part)
  for (let k = 0; k < 3; k += 1) s.box(0, y - h / 2 + (h * (k + 0.5)) / 3, f + 0.03, w, h / 5, 0.06, DARK, P.RUBBER)
  return s
}
/** A bumper across the whole front (f > 0) or back (f < 0). */
function bumper(s, y, f, w, color = DARK, part = P.RUBBER, h = 0.22) {
  return s.box(0, y, f, w, h, 0.18, color, part, 0.06)
}

// --- The models --------------------------------------------------------------------

/**
 * Each model: `wear` (0-1), its `wheels` ([x, f, radius, width]), where smoke rises
 * when it's broken down (`smoke`: [x, y, f, size], `soot` for black smoke), and
 * `build(shape, dims)` - dims being its VEHICLES footprint.
 */
const axle = (half, f, r, w) => [
  [half - w / 2, f, r, w],
  [-(half - w / 2), f, r, w],
]

export const MODELS = {
  // Faded cream, rusted through in patches, steaming from under the bonnet.
  rustyHatch: {
    wear: 0.95,
    wheels: [...axle(1.0, 1.25, 0.42, 0.34), ...axle(1.0, -1.25, 0.42, 0.34)],
    smoke: [[0.1, 1.15, 1.2, 1], [0.5, 0.42, -2.05, 0.6]],
    soot: true,
    build(s, { length: L, width: W }) {
      const c = '#e7dfca'
      s.box(0, 0.74, 0, W - 0.2, 0.7, L - 0.12, c, P.PAINT, 0.14)
      s.box(0, 1.46, -0.62, W - 0.36, 0.76, 2.5, c, P.PAINT, 0.12)
      glazing(s, { f0: -1.87, f1: 0.63, y0: 1.08, y1: 1.84, w: W - 0.36, pillar: c })
      headlights(s, 0.62, 0.88, L / 2 - 0.06, 0.34, 0.26)
      taillights(s, 0.7, 0.92, -L / 2 + 0.06)
      grille(s, 0.82, L / 2 - 0.06, 0.62, 0.22)
      bumper(s, 0.5, L / 2 - 0.02, W - 0.16, '#a8a49a', P.CHROME)
      bumper(s, 0.5, -L / 2 + 0.02, W - 0.16, '#a8a49a', P.CHROME)
      plate(s, 0.66, L / 2 - 0.02)
      plate(s, 0.66, -L / 2 + 0.02)
      mirrors(s, (W - 0.36) / 2, 1.2, 0.5, c)
      // A door that doesn't match: a scrapyard replacement.
      s.box(W / 2 - 0.09, 0.78, 0.1, 0.04, 0.56, 1.0, '#9ab0b8', P.PAINT)
      // Seats behind the glass.
      s.pair(0.4, 1.2, -0.2, 0.55, 0.7, 0.5, '#6a4a3a', P.MATTE)
    },
  },

  // A faded teal farm pickup with hay in the back.
  oldPickup: {
    wear: 0.75,
    wheels: [...axle(1.1, 1.55, 0.5, 0.4), ...axle(1.1, -1.55, 0.5, 0.4)],
    smoke: [[0.6, 0.45, -2.6, 0.7]],
    soot: true,
    build(s, { length: L, width: W }) {
      const c = '#4a9cb8'
      s.box(0, 0.86, 0, W - 0.2, 0.74, L - 0.1, c, P.PAINT, 0.14)
      s.box(0, 1.62, 0.25, W - 0.3, 0.84, 1.35, c, P.PAINT, 0.12)
      glazing(s, { f0: -0.42, f1: 0.92, y0: 1.2, y1: 2.04, w: W - 0.3, panes: 1 })
      // The bed: walls, tailgate and a wooden floor - a hay bale and a crate in it.
      s.pair(W / 2 - 0.16, 1.42, -1.45, 0.12, 0.4, 2.0, c, P.PAINT, 0.04)
      s.box(0, 1.42, -L / 2 + 0.08, W - 0.2, 0.4, 0.12, c, P.PAINT, 0.04)
      s.box(0, 1.25, -1.45, W - 0.44, 0.06, 1.9, WOOD, P.MATTE)
      s.box(-0.3, 1.58, -1.2, 0.9, 0.6, 1.0, '#e8c35a', P.MATTE)
      s.box(0.5, 1.5, -2.0, 0.6, 0.5, 0.6, WOOD, P.MATTE)
      grille(s, 1.0, L / 2 - 0.05, 1.0, 0.36)
      headlights(s, 0.78, 1.0, L / 2 - 0.06, 0.3, 0.3)
      taillights(s, 0.86, 1.1, -L / 2 + 0.06, 0.2, 0.3)
      bumper(s, 0.6, L / 2, W - 0.1, '#b8b4aa', P.CHROME)
      bumper(s, 0.6, -L / 2, W - 0.1, '#b8b4aa', P.CHROME)
      plate(s, 0.8, -L / 2)
      mirrors(s, (W - 0.3) / 2, 1.5, 0.75, c)
    },
  },

  // A bright red three-wheeler: a black canopy over a little cab, one wheel in front.
  threeWheeler: {
    wear: 0.15,
    wheels: [[0, 1.2, 0.34, 0.24], ...axle(0.85, -1.05, 0.36, 0.28)],
    smoke: [[0.4, 0.38, -1.7, 0.4]],
    build(s, { length: L, width: W }) {
      const c = '#d42a2a'
      const yellow = '#ffd23f'
      // Floor and the rear body over the back wheels.
      s.box(0, 0.62, -0.45, W - 0.2, 0.42, 2.2, c, P.PAINT, 0.12)
      s.box(0, 0.98, -1.15, W - 0.24, 0.5, 0.95, c, P.PAINT, 0.12)
      // The nose: a narrow cowl rising to the windscreen, the headlight in it.
      s.box(0, 0.86, 1.15, 0.82, 0.9, 0.7, c, P.PAINT, 0.18)
      s.box(0, 0.78, 1.48, 0.7, 0.14, 0.12, yellow, P.MATTE)
      s.box(0, 1.18, 1.52, 0.26, 0.24, 0.06, HEAD, P.HEADLIGHT, 0.06)
      s.box(0, 1.72, 0.86, W - 0.4, 0.68, 0.06, GLASS, P.GLASS, 0, [-0.22, 0, 0])
      // The canopy roof on its posts, and the seats under it.
      s.box(0, 2.1, -0.15, W - 0.12, 0.16, 2.5, BLACK, P.MATTE, 0.06)
      s.pair(W / 2 - 0.12, 1.55, 0.9, 0.08, 1.05, 0.08, BLACK, P.MATTE)
      s.pair(W / 2 - 0.12, 1.6, -1.35, 0.08, 1.0, 0.08, BLACK, P.MATTE)
      s.box(0, 1.6, -1.42, W - 0.24, 0.9, 0.06, BLACK, P.MATTE)
      s.box(0, 1.05, -0.6, W - 0.5, 0.36, 0.6, '#2a2a33', P.MATTE)
      s.box(0, 1.0, 0.45, 0.5, 0.3, 0.4, '#2a2a33', P.MATTE)
      // A yellow stripe round the body.
      s.pair(W / 2 - 0.09, 0.95, -0.7, 0.03, 0.08, 1.7, yellow, P.MATTE)
      taillights(s, 0.55, 1.05, -L / 2 + 0.06, 0.18, 0.16)
      plate(s, 0.85, -L / 2 + 0.05)
    },
  },

  // A faded green minivan, sagging and smoking hard.
  brokenVan: {
    wear: 0.9,
    wheels: [...axle(1.1, 1.55, 0.45, 0.38), ...axle(1.1, -1.55, 0.45, 0.38)],
    smoke: [[0, 1.4, 1.75, 1.1], [0.55, 0.45, -2.45, 0.7]],
    soot: true,
    build(s, { length: L, width: W }) {
      const c = '#86a876'
      s.box(0, 0.86, 0, W - 0.2, 0.8, L - 0.12, c, P.PAINT, 0.16)
      s.box(0, 1.84, -0.62, W - 0.26, 1.2, 3.5, c, P.PAINT, 0.18)
      glazing(s, { f0: -2.37, f1: 1.13, y0: 1.24, y1: 2.42, w: W - 0.26, panes: 3, pillar: c })
      // The sliding door's seam.
      s.pair(W / 2 - 0.08, 1.3, -0.3, 0.02, 1.4, 0.04, DARK, P.MATTE)
      grille(s, 1.0, L / 2 - 0.06, 0.9, 0.24)
      headlights(s, 0.72, 1.04, L / 2 - 0.06, 0.34, 0.24)
      taillights(s, 0.86, 1.35, -L / 2 + 0.07, 0.2, 0.5)
      bumper(s, 0.55, L / 2 - 0.02, W - 0.16)
      bumper(s, 0.55, -L / 2 + 0.02, W - 0.16)
      plate(s, 0.78, -L / 2 + 0.02)
      mirrors(s, (W - 0.26) / 2, 1.45, 1.0, c)
      // Roof rack, bent.
      s.pair(0.7, 2.5, -0.6, 0.06, 0.08, 3.0, '#6a6e74', P.CHROME, 0, [0, 0, 0.04])
    },
  },

  // A shiny blue family saloon, straight off the forecourt.
  sedan: {
    wear: 0,
    wheels: [...axle(1.05, 1.5, 0.45, 0.36), ...axle(1.05, -1.5, 0.45, 0.36)],
    smoke: [],
    build(s, { length: L, width: W }) {
      const c = '#2e6fe0'
      s.box(0, 0.74, 0, W - 0.2, 0.66, L - 0.1, c, P.PAINT, 0.2)
      s.box(0, 1.38, -0.3, W - 0.36, 0.66, 2.1, c, P.PAINT, 0.18)
      glazing(s, { f0: -1.35, f1: 0.75, y0: 1.06, y1: 1.72, w: W - 0.36, pillar: c })
      grille(s, 0.78, L / 2 - 0.05, 0.8, 0.2)
      headlights(s, 0.68, 0.86, L / 2 - 0.05, 0.42, 0.18)
      taillights(s, 0.72, 0.9, -L / 2 + 0.05, 0.42, 0.16)
      bumper(s, 0.5, L / 2 - 0.02, W - 0.14, '#2a2c30')
      bumper(s, 0.5, -L / 2 + 0.02, W - 0.14, '#2a2c30')
      plate(s, 0.62, -L / 2 + 0.02)
      mirrors(s, (W - 0.36) / 2, 1.16, 0.62, c)
      // A chrome line down each side.
      s.pair(W / 2 - 0.09, 0.95, 0, 0.03, 0.05, L - 0.6, STEEL, P.CHROME)
    },
  },

  // A sand-coloured open-top jeep: roll bar, spare wheel, lights on top. Dusty.
  jeep: {
    wear: 0.3,
    wheels: [...axle(1.1, 1.4, 0.58, 0.44), ...axle(1.1, -1.4, 0.58, 0.44)],
    smoke: [],
    build(s, { length: L, width: W }) {
      const c = '#c8a26a'
      s.box(0, 1.02, 0, W - 0.24, 0.8, L - 0.5, c, P.PAINT, 0.1)
      // Flat wings over the wheels.
      s.pair(W / 2 - 0.2, 1.32, 1.45, 0.4, 0.08, 1.4, BLACK, P.RUBBER)
      s.pair(W / 2 - 0.2, 1.32, -1.4, 0.4, 0.08, 1.4, BLACK, P.RUBBER)
      // Upright windscreen in its frame, the roll bar, seats.
      s.box(0, 1.75, 0.55, W - 0.4, 0.66, 0.06, GLASS, P.GLASS)
      s.box(0, 2.1, 0.55, W - 0.36, 0.08, 0.1, BLACK, P.MATTE)
      s.pair(W / 2 - 0.2, 1.75, 0.55, 0.08, 0.72, 0.1, BLACK, P.MATTE)
      s.pair(W / 2 - 0.2, 1.8, -0.8, 0.1, 1.0, 0.1, BLACK, P.MATTE)
      s.box(0, 2.28, -0.8, W - 0.3, 0.1, 0.1, BLACK, P.MATTE)
      s.pair(W / 2 - 0.2, 2.28, -0.15, 0.1, 0.1, 1.3, BLACK, P.MATTE)
      s.pair(0.45, 1.65, -0.2, 0.6, 0.5, 0.6, '#3a2a22', P.MATTE)
      s.box(0, 1.65, -1.15, W - 0.5, 0.5, 0.6, '#3a2a22', P.MATTE)
      for (const x of [-0.6, -0.2, 0.2, 0.6]) s.box(x, 2.38, -0.8, 0.24, 0.16, 0.12, HEAD, P.HEADLIGHT, 0.04)
      // The spare wheel on the back.
      s.cyl(0, 1.25, -L / 2 + 0.12, 0.5, 0.3, BLACK, P.RUBBER, 'f', 14)
      s.cyl(0, 1.25, -L / 2 + 0.08, 0.28, 0.32, '#8f9298', P.CHROME, 'f', 10)
      grille(s, 1.05, L / 2 - 0.25, 0.9, 0.42, BLACK, P.RUBBER)
      headlights(s, 0.66, 1.12, L / 2 - 0.25, 0.26, 0.26)
      taillights(s, 0.86, 1.18, -L / 2 + 0.25, 0.16, 0.26)
      bumper(s, 0.6, L / 2 - 0.12, W - 0.1, BLACK)
    },
  },

  // A yellow city taxi with a chequered stripe and a glowing roof sign.
  taxi: {
    wear: 0.05,
    wheels: [...axle(1.05, 1.5, 0.45, 0.36), ...axle(1.05, -1.5, 0.45, 0.36)],
    smoke: [],
    build(s, { length: L, width: W }) {
      const c = '#ffc61a'
      s.box(0, 0.74, 0, W - 0.2, 0.66, L - 0.1, c, P.PAINT, 0.2)
      s.box(0, 1.38, -0.3, W - 0.36, 0.66, 2.1, c, P.PAINT, 0.18)
      glazing(s, { f0: -1.35, f1: 0.75, y0: 1.06, y1: 1.72, w: W - 0.36, pillar: c })
      for (let k = 0; k < 14; k += 1) {
        const f = -L / 2 + 0.55 + k * 0.27
        s.pair(W / 2 - 0.09, 0.86 + (k % 2) * 0.1, f, 0.03, 0.1, 0.27, BLACK, P.MATTE)
      }
      s.box(0, 1.84, -0.3, 0.9, 0.24, 0.36, '#fff6c4', P.NEON, 0.06)
      grille(s, 0.78, L / 2 - 0.05, 0.8, 0.2, BLACK, P.RUBBER)
      headlights(s, 0.68, 0.86, L / 2 - 0.05, 0.42, 0.18)
      taillights(s, 0.72, 0.9, -L / 2 + 0.05, 0.42, 0.16)
      bumper(s, 0.5, L / 2 - 0.02, W - 0.14, BLACK)
      bumper(s, 0.5, -L / 2 + 0.02, W - 0.14, BLACK)
      plate(s, 0.62, -L / 2 + 0.02)
      mirrors(s, (W - 0.36) / 2, 1.16, 0.62, c)
    },
  },

  // A white delivery van with an orange stripe: a short cab and a tall box.
  deliveryVan: {
    wear: 0.1,
    wheels: [...axle(1.15, 1.9, 0.48, 0.4), ...axle(1.15, -1.8, 0.48, 0.4)],
    smoke: [],
    build(s, { length: L, width: W }) {
      const c = '#f4f6f8'
      const stripe = '#ff7a1a'
      s.box(0, 1.72, -0.85, W - 0.16, 2.3, 3.9, c, P.PAINT, 0.12)
      s.box(0, 1.05, 1.85, W - 0.2, 1.1, 1.9, c, P.PAINT, 0.16)
      s.box(0, 1.95, 1.3, W - 0.24, 0.9, 0.9, c, P.PAINT, 0.12)
      s.box(0, 1.95, 1.75, W - 0.44, 0.7, 0.06, GLASS, P.GLASS, 0, [-0.45, 0, 0])
      s.pair((W - 0.24) / 2 + 0.005, 1.95, 1.3, 0.04, 0.6, 0.62, GLASS, P.GLASS)
      s.pair(W / 2 - 0.07, 1.55, -0.85, 0.02, 0.36, 3.9, stripe, P.MATTE)
      s.box(0, 1.55, -L / 2 + 0.04, W - 0.16, 0.36, 0.02, stripe, P.MATTE)
      // The back doors.
      s.box(0, 1.72, -L / 2 + 0.03, 0.04, 2.1, 0.02, DARK, P.MATTE)
      s.pair(0.15, 1.7, -L / 2 + 0.03, 0.06, 0.4, 0.04, STEEL, P.CHROME)
      grille(s, 1.0, L / 2 - 0.05, 1.0, 0.26, BLACK, P.RUBBER)
      headlights(s, 0.78, 1.1, L / 2 - 0.05, 0.34, 0.24)
      taillights(s, 0.95, 1.0, -L / 2 + 0.06, 0.2, 0.5)
      bumper(s, 0.55, L / 2 - 0.02, W - 0.14, BLACK)
      bumper(s, 0.55, -L / 2 + 0.02, W - 0.14, BLACK)
      plate(s, 0.8, -L / 2 + 0.02)
      mirrors(s, (W - 0.24) / 2, 1.9, 1.6, BLACK)
    },
  },

  // A bright orange snowplough: a big yellow blade in front, a grit spreader behind.
  snowplow: {
    wear: 0.2,
    wheels: [...axle(1.3, 1.5, 0.62, 0.5), ...axle(1.3, -1.9, 0.62, 0.5)],
    smoke: [[0.9, 3.0, 0.25, 0.6]],
    build(s, { length: L, width: W }) {
      const c = '#ff7a1a'
      s.box(0, 0.95, -0.3, W - 0.6, 0.4, L - 1.0, BLACK, P.MATTE)
      s.box(0, 1.95, 1.25, W - 0.3, 1.7, 1.4, c, P.PAINT, 0.14)
      s.box(0, 1.5, 2.3, W - 0.5, 0.9, 0.9, c, P.PAINT, 0.14)
      glazing(s, { f0: 0.55, f1: 1.95, y0: 2.0, y1: 2.78, w: W - 0.3, panes: 1, back: false })
      grille(s, 1.5, 2.76, 1.1, 0.5)
      headlights(s, 0.75, 1.75, 2.74, 0.3, 0.2)
      // The spreader: a grey hopper.
      s.box(0, 1.85, -1.45, W - 0.3, 1.5, 3.2, '#6a717c', P.RIBS, 0.1)
      s.box(0, 2.62, -1.45, W - 0.4, 0.08, 3.0, '#e8ecf0', P.MATTE)
      taillights(s, 1.0, 1.4, -L / 2 + 0.33, 0.2, 0.3)
      // The blade, angled across the front, on its arms.
      s.box(0, 0.75, L / 2 - 0.2, W, 1.2, 0.14, '#ffd21f', P.PAINT, 0.05, [-0.2, 0.18, 0])
      s.pair(0.6, 0.85, 2.95, 0.12, 0.12, 0.6, BLACK, P.MATTE)
      // Beacons on the roof, an exhaust stack.
      s.pair(0.6, 2.95, 1.3, 0.24, 0.2, 0.24, AMBER, P.SIREN, 0.06)
      s.cyl(0.95, 2.4, 0.25, 0.08, 1.4, STEEL, P.CHROME, 'y', 8)
    },
  },

  // An old yellow school bus, black stripes along it, rattling and smoking.
  schoolBus: {
    wear: 0.7,
    wheels: [...axle(1.25, 2.7, 0.6, 0.5), ...axle(1.25, -2.6, 0.6, 0.5)],
    smoke: [[0, 1.85, 3.6, 1.2], [0.7, 0.5, -4.1, 0.8]],
    soot: true,
    build(s, { length: L, width: W }) {
      const c = '#f2b21b'
      s.box(0, 1.82, -0.45, W - 0.14, 2.5, L - 1.0, c, P.PAINT, 0.2)
      s.box(0, 1.15, L / 2 - 0.55, W - 0.4, 1.15, 1.1, c, P.PAINT, 0.18)
      s.pair(W / 2 - 0.06, 1.12, -0.45, 0.02, 0.1, L - 1.1, BLACK, P.MATTE)
      s.pair(W / 2 - 0.06, 1.55, -0.45, 0.02, 0.1, L - 1.1, BLACK, P.MATTE)
      for (let k = 0; k < 6; k += 1) s.pair(W / 2 - 0.06, 2.25, -3.65 + k * 1.05, 0.04, 0.68, 0.8, GLASS, P.GLASS)
      s.box(0, 2.2, 3.3, W - 0.4, 0.86, 0.04, GLASS, P.GLASS)
      s.box(0, 2.2, -L / 2 + 0.03, W - 0.6, 0.7, 0.04, GLASS, P.GLASS)
      // A stop sign folded against the driver's side.
      s.box(-W / 2 + 0.02, 1.9, 2.4, 0.04, 0.5, 0.5, '#e02020', P.MATTE)
      grille(s, 1.1, L / 2 - 0.02, 1.0, 0.5)
      headlights(s, 0.62, 1.45, L / 2 - 0.02, 0.24, 0.24)
      taillights(s, 1.0, 1.0, -L / 2 + 0.53, 0.2, 0.3)
      s.pair(0.9, 3.05, 3.2, 0.2, 0.14, 0.12, AMBER, P.TAILLIGHT, 0.04)
      bumper(s, 0.65, L / 2 + 0.04, W - 0.2, BLACK)
      bumper(s, 0.65, -L / 2 + 0.55, W - 0.14, BLACK)
      plate(s, 0.9, -L / 2 + 0.52)
      mirrors(s, (W - 0.4) / 2 + 0.1, 1.8, 3.35, BLACK)
    },
  },

  // A red cab-over with a tall white box.
  boxTruck: {
    wear: 0.05,
    wheels: [...axle(1.25, 2.6, 0.58, 0.5), ...axle(1.25, -2.3, 0.58, 0.56)],
    smoke: [],
    build(s, { length: L, width: W }) {
      const c = '#d8262b'
      s.box(0, 0.95, -0.3, W - 0.6, 0.35, L - 0.8, BLACK, P.MATTE)
      s.box(0, 1.75, 2.75, W - 0.16, 2.0, 1.5, c, P.PAINT, 0.18)
      glazing(s, { f0: 2.05, f1: 3.5, y0: 2.0, y1: 2.7, w: W - 0.16, panes: 1, back: false })
      s.box(0, 2.1, -0.85, W - 0.12, 2.6, 5.3, '#f2f4f6', P.RIBS, 0.08)
      s.pair(W / 2 - 0.05, 1.2, -0.85, 0.02, 0.18, 5.2, c, P.MATTE)
      grille(s, 1.3, L / 2 - 0.02, 1.4, 0.4)
      headlights(s, 0.85, 1.12, L / 2 - 0.02, 0.36, 0.22)
      taillights(s, 1.0, 1.0, -L / 2 + 0.06, 0.24, 0.24)
      bumper(s, 0.72, L / 2, W - 0.1, '#9aa0a8', P.CHROME)
      s.pair(0.5, 2.1, -L / 2 + 0.07, 0.06, 2.4, 0.04, STEEL, P.CHROME)
      mirrors(s, (W - 0.16) / 2, 2.2, 3.3, BLACK)
    },
  },

  // A white cab hauling a red shipping container.
  containerTruck: {
    wear: 0.1,
    wheels: [...axle(1.3, 3.55, 0.56, 0.5), ...axle(1.3, -2.55, 0.56, 0.6), ...axle(1.3, -3.7, 0.56, 0.6)],
    smoke: [],
    build(s, { length: L, width: W }) {
      const c = '#eef1f4'
      s.box(0, 0.9, -0.2, W - 0.7, 0.36, L - 0.6, BLACK, P.MATTE)
      s.box(0, 1.85, 3.75, W - 0.16, 2.25, 1.5, c, P.PAINT, 0.2)
      s.box(0, 3.05, 3.85, W - 0.3, 0.14, 1.0, c, P.PAINT, 0.05)
      glazing(s, { f0: 3.05, f1: 4.5, y0: 2.1, y1: 2.85, w: W - 0.16, panes: 1, back: false })
      s.pair(W / 2 - 0.06, 1.35, 3.75, 0.02, 0.12, 1.3, '#2fa8ff', P.MATTE)
      grille(s, 1.4, L / 2 - 0.02, 1.5, 0.5)
      headlights(s, 0.9, 1.0, L / 2 - 0.02, 0.34, 0.2)
      bumper(s, 0.72, L / 2, W - 0.1, '#9aa0a8', P.CHROME)
      // The container, its doors on the back.
      s.box(0, 2.35, -0.95, W - 0.06, 2.5, 7.1, '#c8302a', P.RIBS, 0.05)
      s.box(0, 2.35, -L / 2 + 0.03, 0.04, 2.4, 0.02, '#7a1a16', P.MATTE)
      for (const x of [-0.85, -0.3, 0.3, 0.85]) s.box(x, 2.35, -L / 2 + 0.03, 0.06, 2.3, 0.05, STEEL, P.CHROME)
      taillights(s, 1.05, 0.95, -L / 2 + 0.12, 0.24, 0.2)
      mirrors(s, (W - 0.16) / 2, 2.3, 4.3, BLACK)
      s.cyl(1.05, 2.6, 2.85, 0.09, 1.9, STEEL, P.CHROME, 'y', 8)
    },
  },

  // A yellow dump truck, dusty from the quarry, its tipper heaped with rock.
  dumpTruck: {
    wear: 0.5,
    wheels: [...axle(1.35, 2.6, 0.72, 0.56), ...axle(1.35, -1.8, 0.72, 0.6), ...axle(1.35, -3.0, 0.72, 0.6)],
    smoke: [[1.1, 3.6, 1.45, 0.7]],
    build(s, { length: L, width: W }) {
      const c = '#e6b422'
      s.box(0, 1.15, -0.2, W - 0.8, 0.45, L - 0.6, BLACK, P.MATTE)
      s.box(0, 2.25, 2.1, W - 0.3, 1.9, 1.3, c, P.PAINT, 0.16)
      s.box(0, 1.75, 3.2, W - 0.5, 1.1, 1.0, c, P.PAINT, 0.16)
      glazing(s, { f0: 1.45, f1: 2.75, y0: 2.4, y1: 3.15, w: W - 0.3, panes: 1, back: false })
      grille(s, 1.75, L / 2 - 0.1, 1.2, 0.6, BLACK, P.RUBBER)
      headlights(s, 0.85, 1.55, L / 2 - 0.1, 0.3, 0.26)
      bumper(s, 0.9, L / 2, W - 0.2, BLACK)
      // The tipper: floor, sides, front wall rising over the cab, tailgate.
      s.box(0, 1.6, -1.25, W - 0.1, 0.3, 4.9, c, P.PAINT, 0.06)
      s.pair(W / 2 - 0.1, 2.45, -1.25, 0.2, 1.5, 4.9, c, P.RIBS, 0.06)
      s.box(0, 2.6, 1.15, W - 0.1, 1.9, 0.2, c, P.PAINT, 0.06)
      s.box(0, 2.45, -L / 2 + 0.15, W - 0.1, 1.5, 0.2, c, P.PAINT, 0.06)
      s.box(0, 3.3, 1.6, W - 0.2, 0.12, 1.0, c, P.PAINT, 0.04)
      // The load of rock.
      for (const [x, f, r] of [[-0.6, -0.4, 0.6], [0.5, -1.2, 0.7], [-0.3, -2.2, 0.65], [0.6, -2.9, 0.5], [0, 0.4, 0.5]]) {
        s.box(x, 3.0 + r * 0.2, f, r * 1.4, r * 1.2, r * 1.4, '#8a8478', P.MATTE, r * 0.3, [0.3, x * 2, 0.2])
      }
      taillights(s, 1.1, 1.3, -L / 2 + 0.06, 0.2, 0.24)
      s.cyl(1.1, 2.9, 1.45, 0.1, 1.5, STEEL, P.CHROME, 'y', 8)
      mirrors(s, (W - 0.3) / 2, 2.8, 2.6, BLACK)
    },
  },

  // A low magenta sports car, a spoiler on the back and neon glowing underneath.
  sportsCar: {
    wear: 0,
    wheels: [...axle(1.1, 1.45, 0.44, 0.42), ...axle(1.1, -1.45, 0.46, 0.46)],
    smoke: [],
    build(s, { length: L, width: W }) {
      const c = '#ff2f9e'
      s.box(0, 0.6, 0, W - 0.2, 0.56, L - 0.1, c, P.PAINT, 0.24)
      s.box(0, 1.08, -0.25, W - 0.5, 0.5, 1.7, TINT, P.GLASS, 0.2)
      s.box(0, 1.3, -0.3, W - 0.7, 0.08, 1.1, c, P.PAINT, 0.03)
      // Side scoops, the spoiler on its posts, the neon underneath.
      s.pair(W / 2 - 0.09, 0.7, -0.6, 0.03, 0.2, 0.7, BLACK, P.MATTE)
      s.box(0, 1.25, -L / 2 + 0.3, W - 0.3, 0.06, 0.4, BLACK, P.MATTE)
      s.pair(0.6, 1.05, -L / 2 + 0.3, 0.06, 0.36, 0.12, BLACK, P.MATTE)
      s.box(0, 0.24, 0, W - 0.5, 0.04, L - 1.4, '#2fe8ff', P.NEON)
      s.pair(0.62, 0.7, L / 2 - 0.08, 0.5, 0.1, 0.06, HEAD, P.HEADLIGHT)
      s.box(0, 0.75, -L / 2 + 0.06, W - 0.4, 0.08, 0.05, TAIL, P.TAILLIGHT)
      s.box(0, 0.45, L / 2 - 0.02, W - 0.5, 0.16, 0.1, BLACK, P.RUBBER)
      mirrors(s, (W - 0.5) / 2, 1.05, 0.4, c)
    },
  },

  // A red fire engine: ladder on the roof, silver lockers, sirens flashing.
  fireTruck: {
    wear: 0,
    wheels: [...axle(1.3, 3.1, 0.6, 0.5), ...axle(1.3, -2.2, 0.6, 0.6), ...axle(1.3, -3.3, 0.6, 0.6)],
    smoke: [],
    build(s, { length: L, width: W }) {
      const c = '#d8201c'
      s.box(0, 0.95, -0.2, W - 0.7, 0.36, L - 0.6, BLACK, P.MATTE)
      s.box(0, 1.85, 3.3, W - 0.16, 2.1, 1.75, c, P.PAINT, 0.2)
      glazing(s, { f0: 2.45, f1: 4.17, y0: 2.0, y1: 2.8, w: W - 0.16, panes: 2, back: false, pillar: c })
      s.box(0, 1.75, -0.95, W - 0.1, 1.9, 6.4, c, P.PAINT, 0.1)
      for (let k = 0; k < 4; k += 1) s.pair(W / 2 - 0.04, 1.75, -3.5 + k * 1.55, 0.04, 1.3, 1.35, '#c8ccd2', P.RIBS)
      s.pair(W / 2 - 0.03, 1.0, -0.4, 0.04, 0.14, 7.4, '#f4f4f4', P.MATTE)
      // The ladder: two rails and rungs.
      s.pair(0.55, 2.85, -0.3, 0.1, 0.14, 7.0, STEEL, P.CHROME)
      for (let k = 0; k < 13; k += 1) s.box(0, 2.85, -3.6 + k * 0.55, 1.0, 0.06, 0.08, STEEL, P.CHROME)
      s.pair(0.55, 2.75, -3.9, 0.14, 0.2, 0.14, BLACK, P.MATTE)
      s.box(0, 3.05, 3.4, W - 0.5, 0.2, 0.4, '#ff2020', P.SIREN, 0.06)
      grille(s, 1.3, L / 2 - 0.02, 1.4, 0.5)
      headlights(s, 0.9, 1.2, L / 2 - 0.02, 0.3, 0.24)
      taillights(s, 1.05, 1.0, -L / 2 + 0.08, 0.2, 0.3)
      bumper(s, 0.72, L / 2 + 0.02, W - 0.1, '#9aa0a8', P.CHROME)
      mirrors(s, (W - 0.16) / 2, 2.3, 4.0, BLACK)
    },
  },

  // A tanker left to rot: rust all over, black smoke pouring out.
  wreckedTanker: {
    wear: 1,
    wheels: [...axle(1.35, 3.6, 0.62, 0.5), ...axle(1.35, -2.5, 0.62, 0.6), ...axle(1.35, -3.7, 0.62, 0.6)],
    smoke: [[0, 2.4, 4.3, 1.4], [0.6, 3.4, 0.5, 1.2], [-0.4, 1.0, -4.5, 0.8]],
    soot: true,
    build(s, { length: L, width: W }) {
      const c = '#b0552e'
      s.box(0, 0.95, -0.2, W - 0.7, 0.4, L - 0.6, BLACK, P.MATTE)
      s.box(0, 1.85, 3.7, W - 0.16, 2.1, 1.55, c, P.PAINT, 0.2)
      glazing(s, { f0: 2.95, f1: 4.47, y0: 2.0, y1: 2.8, w: W - 0.16, panes: 1, back: false })
      grille(s, 1.35, L / 2 - 0.02, 1.4, 0.5, '#7a6a5a')
      headlights(s, 0.9, 1.1, L / 2 - 0.02, 0.32, 0.22)
      bumper(s, 0.7, L / 2, W - 0.1, '#7a6a5a', P.CHROME)
      // The tank, its bands and the walkway along its top.
      s.cyl(0, 2.25, -0.8, 1.22, 6.9, '#b4bac2', P.CHROME, 'f', 18)
      for (const f of [-3.8, -1.8, 0.2, 2.2]) s.cyl(0, 2.25, f, 1.27, 0.14, '#6a6e74', P.CHROME, 'f', 18)
      s.box(0, 3.5, -0.8, 0.6, 0.06, 5.5, '#6a6e74', P.MATTE)
      s.box(W / 2 - 0.3, 2.25, -L / 2 + 0.4, 0.05, 0.5, 0.5, '#ffd21f', P.MATTE, 0, [0.785, 0, 0])
      taillights(s, 1.05, 0.95, -L / 2 + 0.1, 0.22, 0.2)
      mirrors(s, (W - 0.16) / 2, 2.3, 4.3, BLACK)
    },
  },

  // An orange cement mixer, its striped drum tipped up at the back.
  cementMixer: {
    wear: 0.25,
    wheels: [...axle(1.3, 3.0, 0.62, 0.5), ...axle(1.3, -1.6, 0.62, 0.6), ...axle(1.3, -2.8, 0.62, 0.6)],
    smoke: [[1.0, 3.6, 2.2, 0.6]],
    build(s, { length: L, width: W }) {
      const c = '#f07a1a'
      s.box(0, 0.95, -0.2, W - 0.7, 0.4, L - 0.6, BLACK, P.MATTE)
      s.box(0, 1.85, 3.15, W - 0.16, 2.1, 1.65, c, P.PAINT, 0.2)
      glazing(s, { f0: 2.35, f1: 3.97, y0: 2.0, y1: 2.8, w: W - 0.16, panes: 1, back: false })
      grille(s, 1.3, L / 2 - 0.02, 1.4, 0.45, BLACK, P.RUBBER)
      headlights(s, 0.9, 1.15, L / 2 - 0.02, 0.3, 0.22)
      bumper(s, 0.72, L / 2 + 0.02, W - 0.1, BLACK)
      // The drum, its cradle, and the chute at the back.
      s.cyl(0, 2.45, -1.0, 1.18, 4.4, '#eef0f2', P.RIBS, 'f', 16, [0.18, 0, 0])
      s.cyl(0, 2.08, -3.25, 0.62, 0.6, '#eef0f2', P.RIBS, 'f', 12, [0.18, 0, 0])
      s.box(0, 1.55, -1.0, 1.4, 0.5, 4.0, '#4a4e56', P.MATTE)
      s.box(0, 1.85, -L / 2 + 0.35, 0.5, 0.12, 0.8, '#4a4e56', P.MATTE, 0, [0.5, 0, 0])
      s.box(0, 2.0, 1.9, 1.6, 1.4, 0.3, c, P.PAINT, 0.06)
      taillights(s, 1.05, 0.95, -L / 2 + 0.2, 0.22, 0.2)
      s.cyl(1.05, 2.6, 2.2, 0.09, 1.9, STEEL, P.CHROME, 'y', 8)
      mirrors(s, (W - 0.16) / 2, 2.3, 3.8, BLACK)
    },
  },

  // A lime monster truck, high on giant tyres and chrome shocks.
  monsterTruck: {
    wear: 0,
    wheels: [...axle(1.5, 1.85, 1.2, 0.9), ...axle(1.5, -1.85, 1.2, 0.9)],
    smoke: [],
    build(s, { length: L, width: W }) {
      const c = '#4fdc2a'
      // Chassis, axles and shocks.
      s.box(0, 1.35, 0, 0.8, 0.4, L - 1.2, BLACK, P.MATTE)
      s.box(0, 1.2, 1.85, W - 1.6, 0.26, 0.3, BLACK, P.MATTE)
      s.box(0, 1.2, -1.85, W - 1.6, 0.26, 0.3, BLACK, P.MATTE)
      for (const f of [1.4, -1.4]) s.pair(0.55, 1.75, f, 0.16, 1.0, 0.16, STEEL, P.CHROME, 0, [0, 0, 0.3])
      // The body, up over the wheels.
      s.box(0, 2.45, 0, W - 0.5, 0.8, L - 0.4, c, P.PAINT, 0.2)
      s.box(0, 3.3, -0.2, W - 0.8, 0.9, 1.9, c, P.PAINT, 0.18)
      glazing(s, { f0: -1.15, f1: 0.75, y0: 2.85, y1: 3.75, w: W - 0.8, pillar: c })
      s.pair(W / 2 - 0.24, 2.5, 0, 0.04, 0.2, L - 0.8, '#ffd21f', P.MATTE)
      s.pair(W / 2 - 0.24, 2.3, 0.6, 0.04, 0.16, 1.6, '#ff6a1a', P.MATTE)
      for (const x of [-0.6, -0.2, 0.2, 0.6]) s.box(x, 3.85, 0.4, 0.24, 0.18, 0.14, HEAD, P.HEADLIGHT, 0.05)
      grille(s, 2.5, L / 2 - 0.2, 1.2, 0.4)
      headlights(s, 0.85, 2.55, L / 2 - 0.2, 0.3, 0.24)
      taillights(s, 0.95, 2.5, -L / 2 + 0.2, 0.24, 0.24)
      bumper(s, 2.05, L / 2 - 0.15, W - 0.6, '#9aa0a8', P.CHROME)
      bumper(s, 2.05, -L / 2 + 0.15, W - 0.6, '#9aa0a8', P.CHROME)
    },
  },

  // A long golden limousine with black glass and white-wall tyres.
  goldLimo: {
    wear: 0,
    wheels: [...axle(1.15, 3.1, 0.46, 0.38), ...axle(1.15, -3.1, 0.46, 0.38)],
    smoke: [],
    build(s, { length: L, width: W }) {
      const c = '#f0c02a'
      s.box(0, 0.76, 0, W - 0.2, 0.66, L - 0.1, c, P.CHROME, 0.22)
      s.box(0, 1.4, -0.6, W - 0.36, 0.64, 5.6, c, P.CHROME, 0.18)
      glazing(s, { f0: -3.4, f1: 2.2, y0: 1.08, y1: 1.72, w: W - 0.36, panes: 4, color: TINT, pillar: '#2a2420' })
      s.pair(W / 2 - 0.09, 0.98, 0, 0.03, 0.05, L - 0.8, '#fff6d8', P.CHROME)
      grille(s, 0.8, L / 2 - 0.05, 0.9, 0.26)
      headlights(s, 0.72, 0.9, L / 2 - 0.05, 0.36, 0.2)
      taillights(s, 0.76, 0.92, -L / 2 + 0.05, 0.38, 0.16)
      bumper(s, 0.5, L / 2 - 0.02, W - 0.14, '#fff6d8', P.CHROME)
      bumper(s, 0.5, -L / 2 + 0.02, W - 0.14, '#fff6d8', P.CHROME)
      mirrors(s, (W - 0.36) / 2, 1.18, 2.1, c)
      s.box(0, 1.76, -3.2, 0.3, 0.08, 0.3, '#ffffff', P.NEON)
    },
  },

  // A giant yellow mining truck: tyres taller than you, a cab up a ladder, a canopy over it.
  haulTruck: {
    wear: 0.3,
    wheels: [...axle(1.65, 3.6, 1.35, 0.95), ...axle(1.65, -3.0, 1.35, 1.1)],
    smoke: [[1.2, 5.2, 3.0, 1.2], [-1.2, 5.2, 3.0, 1.2]],
    build(s, { length: L, width: W }) {
      const c = '#f2c21b'
      // Frame, and the deck up over the front tyres.
      s.box(0, 1.75, 0, 1.2, 0.8, L - 1.0, BLACK, P.MATTE)
      s.box(0, 2.85, 4.0, W - 0.2, 0.25, 2.8, c, P.PAINT, 0.06)
      // The engine between the front tyres, its huge grille at the front.
      s.box(0, 2.2, 4.6, 1.3, 1.8, 1.7, c, P.PAINT, 0.12)
      grille(s, 2.2, L / 2 - 0.15, 1.1, 1.2, BLACK, P.RUBBER)
      for (const x of [-1.2, -0.85, 0.85, 1.2]) s.box(x, 3.1, L / 2 - 0.25, 0.26, 0.2, 0.1, HEAD, P.HEADLIGHT, 0.05)
      bumper(s, 1.0, L / 2 - 0.2, W - 0.4, BLACK, P.RUBBER, 0.5)
      // The cab, up on the deck on the left, and the ladder up to it in front of the tyre.
      s.box(-0.85, 3.8, 3.9, 1.4, 1.6, 1.6, c, P.PAINT, 0.12)
      glazing(s, { f0: 3.1, f1: 4.7, y0: 3.35, y1: 4.5, w: 1.4, panes: 1, back: false })
      for (let k = 0; k < 5; k += 1) s.box(1.15, 0.9 + k * 0.42, L / 2 - 0.25 - k * 0.1, 0.6, 0.06, 0.3, '#3a3d44', P.MATTE)
      s.box(1.45, 1.9, L / 2 - 0.45, 0.06, 2.3, 0.06, '#ffd21f', P.MATTE, 0, [-0.2, 0, 0])
      // The dump body over the back tyres, its canopy reaching out over the cab.
      s.box(0, 3.95, -1.4, W, 2.5, 8.1, c, P.RIBS, 0.12)
      s.box(0, 5.06, 3.5, W - 0.1, 0.28, 2.6, c, P.PAINT, 0.08)
      s.box(0, 4.0, 2.6, W - 0.2, 2.3, 0.3, c, P.PAINT, 0.06)
      s.pair(W / 2 - 0.05, 3.4, -1.4, 0.04, 0.3, 7.6, '#2a2c30', P.MATTE)
      taillights(s, 1.3, 2.4, -L / 2 + 0.2, 0.3, 0.3)
      // Exhaust stacks either side of the engine.
      s.cyl(1.2, 4.1, 3.0, 0.14, 2.0, STEEL, P.CHROME, 'y', 8)
      s.cyl(-1.2, 4.1, 3.0, 0.14, 2.0, STEEL, P.CHROME, 'y', 8)
    },
  },
}

/** Most wheels any model has. */
export const MAX_WHEELS = Math.max(...Object.values(MODELS).map((m) => m.wheels.length))

/** Each model's rearmost and frontmost axle, metres from its middle: [rear (< 0), front]. */
const WHEELBASES = new Map(
  Object.entries(MODELS).map(([id, m]) => [id, [Math.min(...m.wheels.map((w) => w[1])), Math.max(...m.wheels.map((w) => w[1]))]]),
)
export const wheelbase = (id) => WHEELBASES.get(id)

/** The wheel every model rolls on: a treaded tyre round a spoked hub, unit radius and width, axle along x. */
function wheelGeometry(wear) {
  const s = new Shape(wear)
  s.cyl(0, 0, 0, 1, 1, '#2a2c31', P.TIRE, 'x', 18)
  s.cyl(0, 0, 0, 0.64, 1.06, wear > 0.5 ? '#9a6a4a' : '#d4d8de', P.HUB, 'x', 14)
  s.cyl(0, 0, 0, 0.16, 1.12, '#8a8e96', P.CHROME, 'x', 8)
  return s.build()
}

// --- Geometry --------------------------------------------------------------------------

/**
 * Each model's body geometry, by VEHICLES id, built the first time it's asked for: tens
 * of milliseconds each on a slow phone, so they're built one at a time as needed (see
 * createVehicleBatch) rather than all at start-up. Kept for the session once built.
 */
const bodies = new Map()
function bodyGeometry(id) {
  if (!bodies.has(id)) {
    const shape = new Shape(MODELS[id].wear)
    MODELS[id].build(shape, VEHICLES[id])
    bodies.set(id, shape.build())
  }
  return bodies.get(id)
}
let wheels = null
/** The two wheels: clean, and rusted for the wrecks. */
function wheelGeometries() {
  wheels ??= { clean: wheelGeometry(0), worn: wheelGeometry(0.85) }
  return wheels
}

// --- The material ------------------------------------------------------------------------

const vertexHead = /* glsl */ `
  attribute vec2 aLook;
  varying vec3 vVObj;
  varying vec3 vVNrm;
  varying vec2 vVLook;
`
const vertexBody = /* glsl */ `
  vVObj = position;
  vVNrm = normal;
  vVLook = aLook;
`

const fragmentHead = /* glsl */ `
  uniform float uVTime;
  uniform vec3 uVSun;
  varying vec3 vVObj;
  varying vec3 vVNrm;
  varying vec2 vVLook;
  // How much the surface mirrors the sky, and the tint its reflections take (metal
  // reflects in its own colour): set by the look, read after lighting.
  float vGloss = 0.0;
  vec3 vTint = vec3(1.0);

  float vHash(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
  }
  float vNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(vHash(i), vHash(i + vec3(1, 0, 0)), f.x), mix(vHash(i + vec3(0, 1, 0)), vHash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(vHash(i + vec3(0, 0, 1)), vHash(i + vec3(1, 0, 1)), f.x), mix(vHash(i + vec3(0, 1, 1)), vHash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
  // Rust: orange-brown, in darker and lighter patches.
  vec3 vRust(vec3 p) {
    vec3 c = mix(vec3(0.7, 0.34, 0.12), vec3(0.42, 0.19, 0.08), smoothstep(0.3, 0.7, vNoise(p * 5.0)));
    return mix(c, vec3(0.86, 0.52, 0.24), smoothstep(0.65, 0.85, vNoise(p * 11.0 + 7.0)) * 0.5);
  }
`

/** Each surface's look, by its PART (vVLook.x) and the vehicle's wear (vVLook.y). */
const LOOK_GLSL = /* glsl */ `
  {
    vec3 p = vVObj;
    vec3 nO = normalize(vVNrm);
    float part = vVLook.x + 0.5;
    float wear = vVLook.y;
    vec3 base = diffuseColor.rgb;
    vec3 col = base;
    vec3 glow = vec3(0.0);
    float n = vNoise(p * 1.9) * 0.6 + vNoise(p * 4.3) * 0.3 + vNoise(p * 9.7) * 0.1;
    if (part < 1.0 || (part > 7.0 && part < 8.0)) {
      // Paint: glossy when new; faded, grimy and rusting through as it wears.
      if (part > 7.0 && abs(nO.y) < 0.5) {
        // Pressed ribs, upright down the sides and ends.
        float along = abs(nO.x) > 0.5 ? p.z : p.x;
        col *= 0.8 + 0.2 * smoothstep(0.2, 0.6, abs(fract(along * 2.6) - 0.5) * 2.0);
      }
      col = mix(col, vec3(dot(col, vec3(0.3, 0.5, 0.2))) * 1.05 + 0.06, wear * wear * 0.5);
      float rust = smoothstep(0.7 - wear * 0.22, 0.76 - wear * 0.22, n + (0.3 - p.y * 0.12) * wear * 0.3) * step(0.2, wear);
      col = mix(col, vRust(p), rust);
      // Grime splashed up from the road.
      col *= 1.0 - wear * 0.4 * (1.0 - smoothstep(0.1, 1.3, p.y));
      vGloss = (1.0 - rust) * (1.0 - wear * 0.85);
    } else if (part < 2.0) {
      // Glass: dark and tinted, mirroring the sky; grimy, and cracked on the wrecks.
      float crack = 1.0 - smoothstep(0.0, 0.012, abs(vNoise(p * 4.5) - 0.5));
      col = mix(col, vec3(0.36, 0.32, 0.26), wear * 0.35 * n);
      col = mix(col, vec3(0.8), crack * step(0.6, wear) * 0.55);
      vGloss = 1.2 * (1.0 - wear * 0.5);
    } else if (part < 3.0) {
      // Headlights: lit, unless this one's smashed on a wreck.
      float on = 1.0 - step(0.6, wear) * step(0.0, p.x);
      col = mix(base * 0.35, base, on);
      glow = base * 0.85 * on;
      vGloss = 1.0;
    } else if (part < 4.0) {
      glow = base * 0.55 * (1.0 - wear * 0.6);
      vGloss = 0.8;
    } else if (part < 5.0) {
      // Rubber and black plastic.
      col *= 0.9 + 0.2 * n;
      vGloss = 0.12;
    } else if (part < 6.0) {
      // Chrome (and gold): bright and mirror-like, rusting on the wrecks.
      float rust = smoothstep(0.72 - wear * 0.25, 0.78 - wear * 0.25, n) * step(0.2, wear);
      col = mix(base, vRust(p), rust);
      vGloss = 2.0 * (1.0 - rust) * (1.0 - wear * 0.6);
      vTint = mix(vec3(1.0), base * 1.25, 0.85);
    } else if (part < 7.0) {
      // Matte: canvas, wood, seats, decals.
      col *= 0.92 + 0.14 * n;
    } else if (part < 9.0) {
      // Sirens and beacons: the left and right flash in turn.
      float flash = step(0.0, sin(uVTime * 9.0 + step(0.0, p.x) * 3.14159));
      glow = base * (0.2 + 1.1 * flash);
      vGloss = 0.6;
    } else if (part < 10.0) {
      // Neon: a steady glow, breathing a little.
      glow = base * (0.85 + 0.15 * sin(uVTime * 3.0 + p.z));
    } else if (part < 11.0) {
      // Tyre: tread grooves round the rolling face (wheel space, so they turn), worn grey.
      if (abs(nO.x) < 0.5) {
        float groove = step(0.55, fract(atan(p.y, p.z) * 2.865));
        col *= mix(1.0, 0.45, groove);
      } else {
        col *= 1.0 + 0.25 * smoothstep(0.86, 0.92, length(p.yz));
      }
      col = mix(col, vec3(0.34, 0.32, 0.3), wear * 0.5);
      vGloss = 0.15;
    } else {
      // Hub: five spokes and a rim, turning with the wheel; rusty on the wrecks.
      if (abs(nO.x) > 0.5) {
        float r = length(p.yz);
        float spoke = smoothstep(0.55, 0.85, cos(atan(p.y, p.z) * 5.0));
        float lit = max(max(spoke, step(0.5, r)), 1.0 - step(0.2, r));
        col = mix(base * 0.28, base, lit);
      }
      col = mix(col, vRust(p * 3.0), wear * smoothstep(0.4, 0.6, n));
      vGloss = 1.4 * (1.0 - wear);
    }
    diffuseColor.rgb = col;
    totalEmissiveRadiance += glow;
  }
`

/**
 * The shine: paint, glass and chrome mirror the sky (more at a glancing angle) and catch
 * a highlight from the sun, each as much as its gloss.
 */
const GLOSS_GLSL = /* glsl */ `
  {
    vec3 V = normalize(vViewPosition);
    vec3 N = normalize(normal);
    vec3 R = reflect(-V, N);
    float up = dot(R, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz));
    vec3 sky = mix(vec3(0.8, 0.9, 1.0), vec3(0.42, 0.64, 0.95), smoothstep(0.15, 0.9, up));
    vec3 env = mix(vec3(0.3, 0.29, 0.28), sky, smoothstep(-0.12, 0.08, up));
    float fresnel = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);
    float k = clamp(vGloss, 0.0, 2.0);
    outgoingLight = mix(outgoingLight, env * vTint, clamp(k * (0.07 + 0.4 * fresnel), 0.0, 0.85));
    float sun = pow(max(dot(R, normalize((viewMatrix * vec4(uVSun, 0.0)).xyz)), 0.0), 60.0);
    outgoingLight += vec3(1.0, 0.97, 0.9) * vTint * sun * k * 0.7;
  }
`

let sharedMaterial = null
const SUN = new Vector3(...LIGHTS.sunDirection).normalize()

/** The one material every vehicle and wheel is drawn with. */
export function vehicleMaterial() {
  if (!sharedMaterial) {
    sharedMaterial = new MeshLambertMaterial({ color: 0xffffff, vertexColors: true })
    sharedMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uVTime = glowTime
      shader.uniforms.uVSun = { value: SUN }
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${vertexHead}`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n${vertexBody}`)
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${fragmentHead}`)
        .replace('#include <color_fragment>', `#include <color_fragment>\n${LOOK_GLSL}`)
        .replace('#include <opaque_fragment>', `${GLOSS_GLSL}\n#include <opaque_fragment>`)
    }
    sharedMaterial.customProgramCacheKey = () => 'vehicle-v1'
  }
  return sharedMaterial
}

// --- The batch ---------------------------------------------------------------------------

/** Vertex room the batch starts with; it doubles whenever a model needs more. */
const START_VERTICES = 16384
/** Building the models still to come: one per idle moment, so none of it holds up a frame for long. */
const requestIdle = (fn) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 60))
const cancelIdle = (id) => (typeof cancelIdleCallback === 'function' ? cancelIdleCallback(id) : clearTimeout(id))

/**
 * Room for `slots` vehicles, every body and wheel in one BatchedMesh (one draw call).
 * A model's body is built and added the first time it's needed - prepare(id) does it
 * now, prepareLater(ids) one at a time in idle moments - so start-up only pays for the
 * first car.
 *
 * Returns { mesh, prepare, prepareLater, place, hide, dispose }: place(slot, id, matrix,
 * rolled) draws model `id` in slot `slot` with its body at `matrix` and its wheels
 * turned for `rolled` metres travelled; hide(slot) takes it away. Both are cheap enough
 * to call every frame (once the model's been prepared).
 */
export function createVehicleBatch(slots) {
  const mesh = new BatchedMesh(slots * (1 + MAX_WHEELS), START_VERTICES, 0, vehicleMaterial())
  mesh.sortObjects = false
  mesh.frustumCulled = false
  mesh.castShadow = true
  let room = START_VERTICES
  let used = 0
  /** Adds a geometry to the batch, growing its buffers first if it won't fit. */
  function addGeometry(geometry) {
    const count = geometry.getAttribute('position').count
    if (used + count > room) {
      while (used + count > room) room *= 2
      mesh.setGeometrySize(room, 0)
    }
    used += count
    return mesh.addGeometry(geometry)
  }
  const { clean, worn } = wheelGeometries()
  const wheelId = addGeometry(clean)
  const wornWheelId = addGeometry(worn)
  /** Each model's geometry id in the batch, once prepared. */
  const bodyIds = new Map()

  /** Per slot: its body instance, its wheel instances, and the model shown. */
  const slotState = Array.from({ length: slots }, () => {
    const body = mesh.addInstance(wheelId)
    mesh.setVisibleAt(body, false)
    const wheels = Array.from({ length: MAX_WHEELS }, () => {
      const w = mesh.addInstance(wheelId)
      mesh.setVisibleAt(w, false)
      return w
    })
    return { body, wheels, model: null, visible: false }
  })

  const wheelMatrix = new Matrix4()
  const turn = new Quaternion()
  const at = new Vector3()
  const size = new Vector3()
  const X = new Vector3(1, 0, 0)
  let idle = 0
  const queue = []

  /** Makes sure model `id` is in the batch, building it now if need be. */
  function prepare(id) {
    if (!bodyIds.has(id)) bodyIds.set(id, addGeometry(bodyGeometry(id)))
  }

  /** Builds the next queued model, then waits for the next idle moment for the one after. */
  function buildNext() {
    idle = 0
    while (queue.length > 0 && bodyIds.has(queue[0])) queue.shift()
    if (queue.length === 0) return
    prepare(queue.shift())
    idle = requestIdle(buildNext)
  }

  /** Puts model `id` in a slot (hidden until placed), if it isn't already. */
  function show(state, id) {
    if (state.model === id) return
    prepare(id)
    const model = MODELS[id]
    mesh.setVisibleAt(state.body, false)
    mesh.setGeometryIdAt(state.body, bodyIds.get(id))
    const geometry = model.wear > 0.5 ? wornWheelId : wheelId
    for (let k = 0; k < state.wheels.length; k += 1) {
      mesh.setVisibleAt(state.wheels[k], false)
      if (k < model.wheels.length) mesh.setGeometryIdAt(state.wheels[k], geometry)
    }
    state.model = id
    state.visible = false
  }

  return {
    mesh,
    prepare,
    /** Builds models `ids` (in that order) one at a time, whenever the page is idle. */
    prepareLater(ids) {
      queue.push(...ids)
      if (!idle) idle = requestIdle(buildNext)
    },
    place(slot, id, matrix, rolled) {
      const state = slotState[slot]
      show(state, id)
      const model = MODELS[id]
      mesh.setMatrixAt(state.body, matrix)
      // A plain loop: this runs every frame for every vehicle drawn.
      for (let k = 0; k < model.wheels.length; k += 1) {
        const [x, f, r, w] = model.wheels[k]
        turn.setFromAxisAngle(X, -rolled / r)
        wheelMatrix.compose(at.set(x, r, -f), turn, size.set(w, r, r)).premultiply(matrix)
        mesh.setMatrixAt(state.wheels[k], wheelMatrix)
      }
      if (!state.visible) {
        state.visible = true
        mesh.setVisibleAt(state.body, true)
        for (let k = 0; k < model.wheels.length; k += 1) mesh.setVisibleAt(state.wheels[k], true)
      }
    },
    /** Whether model `id` is in the batch yet (place() would otherwise build it on the spot). */
    has: (id) => bodyIds.has(id),
    hide(slot) {
      const state = slotState[slot]
      if (!state.visible) return
      state.visible = false
      mesh.setVisibleAt(state.body, false)
      for (const w of state.wheels) mesh.setVisibleAt(w, false)
    },
    dispose() {
      if (idle) cancelIdle(idle)
      // The geometries and material are shared and stay; the batch's own buffers go.
      mesh.dispose()
    },
  }
}
