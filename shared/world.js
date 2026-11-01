import { PUSH_START, VEHICLES, WORLDS } from './balance.js'

/**
 * Lobby layout: every gameplay-relevant position and trigger area.
 *
 * Shared by the client (which renders it) and the server (which validates positions
 * against it), so the two can never disagree about where a Train Zone or the first car is.
 *
 * Units are roughly metres - the avatar is 1.8 tall. +X is east, -Z is north, which is
 * "forward" from spawn and the way up the mountain.
 *
 * A compact old town square, everything in sight from spawn: the first car and the road
 * climbing away straight ahead (north) up Main Street, the Train Zones down the left
 * (west) under their big TRAINING sign, the dumbbell shop on the right (east) under its
 * DUMBBELLS sign, eggs and leaderboards behind (south). The aura and potion kiosks stand
 * on the left of the road's gate, the Mega City portal on its right past the statue.
 *
 * Rects are `{ minX, maxX, minZ, maxZ }` on the ground plane.
 */

export const SPAWN = { x: 0, z: 8 }

/** The flat, walkable square. The town surrounds it on every side but the road. */
export const PLAZA = { minX: -36, maxX: 36, minZ: -30, maxZ: 30 }

// --- The road up the mountain ----------------------------------------------------------------

/**
 * The foot of the mountain: the plaza's north edge, where the track starts climbing.
 * Track metre m is m metres up the slope from here.
 */
export const TRACK_START_Z = PLAZA.minZ
/** How steeply the track climbs: about 8 degrees. */
export const SLOPE_ANGLE = 0.14
/** Half the width of the track's floor, between its walls: narrow, as in the reference. */
export const TRACK_HALF_WIDTH = 3.8

/**
 * The PUSH ZONE in front of the first car, at the foot of the track: walking onto it
 * starts a push.
 */
export const PUSH_ZONE = { minX: -3.4, maxX: 3.4, minZ: TRACK_START_Z, maxZ: TRACK_START_Z + 5 }
/** Where you're put back after a push: a little way short of the zone, facing it. */
export const PUSH_RETURN = { x: 0, z: TRACK_START_Z + 13 }
/**
 * The car waiting at the start: its middle, and half its footprint. The client draws
 * World 1's first vehicle there - PUSH_START + half its length + 0.55 up the track.
 */
const START_CAR = VEHICLES[WORLDS[0].stages[0].vehicle]
export const START_VEHICLE = {
  x: 0,
  z: TRACK_START_Z - (PUSH_START + START_CAR.length / 2 + 0.55),
  halfX: START_CAR.width / 2,
  halfZ: START_CAR.length / 2,
}

/** Walkable ground; the controller clamps the player into it. Nothing up the track. */
export const WALKABLE = [PLAZA]

// --- Train Zones ----------------------------------------------------------------------

/**
 * The gym pads line the west side of the plaza, one behind the other, nearest spawn
 * first. Each is a raised pad with a long bench down its middle: sit on it to train
 * (see BENCH_X). The gym equipment stands along its west edge.
 */
export const ZONE_COUNT = 7
export const ZONE_PITCH = 8.2
export const ZONE_HALF = { x: 5.5, z: 3.6 }
export const ZONE_X = -27.5
/** The pad's top, a step up from the plaza. */
export const ZONE_HEIGHT = 0.4
/** The row of equipment along each pad's back (west) edge. */
export const ZONE_RACK_X = ZONE_X - ZONE_HALF.x + 1.1
const ZONE0_Z = 24.6

export const zoneCenterZ = (index) => ZONE0_Z - index * ZONE_PITCH

/** The pad of Train Zone `index`: standing on it is training. */
export function zoneRect(index) {
  const cz = zoneCenterZ(index)
  return { minX: ZONE_X - ZONE_HALF.x, maxX: ZONE_X + ZONE_HALF.x, minZ: cz - ZONE_HALF.z, maxZ: cz + ZONE_HALF.z }
}

/**
 * Each Train Zone's long training bench, down the middle of its pad and facing the
 * plaza (east): you train sitting on it - anywhere along it, side by side with others -
 * and walking into it sits you down. Its seat runs BENCH_HALF either way of the pad's
 * middle, at x BENCH_X.
 */
export const BENCH_X = ZONE_X + 0.4
export const BENCH_HALF = 3.2
/** How high the seat's top is over the pad. */
export const SEAT_HEIGHT = 0.3
/** Within this of the seat's line, you're on it. */
export const SEAT_REACH = 0.6
/** Facing east, at the plaza: the way you sit on a bench (yaw 0 faces +Z). */
export const SEAT_YAW = Math.PI / 2

/** The Train Zone whose bench is at (x, z) (with `slack` to spare all round), or -1. */
export function benchAt(x, z, slack = 0) {
  if (Math.abs(x - BENCH_X) > SEAT_REACH + slack) return -1
  for (let i = 0; i < ZONE_COUNT; i += 1) {
    if (Math.abs(z - zoneCenterZ(i)) <= BENCH_HALF + slack) return i
  }
  return -1
}

/** Where along Train Zone `zone`'s bench you sit, getting on at z: on the seat, not past its ends. */
export const benchSeatZ = (zone, z) =>
  Math.min(zoneCenterZ(zone) + BENCH_HALF - 0.3, Math.max(zoneCenterZ(zone) - BENCH_HALF + 0.3, z))

/** The pad and the dark rim round it: what a locked zone walls off. */
export function zoneDeckRect(index) {
  const r = zoneRect(index)
  return { minX: r.minX - 0.4, maxX: r.maxX + 0.4, minZ: r.minZ - 0.4, maxZ: r.maxZ + 0.4 }
}

// --- Dumbbell shop --------------------------------------------------------------------

/**
 * The dumbbell shop: an open-air yard east of the plaza with two display stages, the
 * first ten dumbbells on the low front one and the next ten on the higher back one, and
 * a big DUMBBELLS sign behind. Both stages are low enough to walk straight onto.
 */
export const SHOP = { minX: 13, maxX: 35, minZ: -17, maxZ: 15 }
export const SHOP_STAGES = [
  { minX: 14, maxX: 23.6, minZ: -16, maxZ: 14, height: 0.5 },
  { minX: 25, maxX: 34.4, minZ: -16, maxZ: 14, height: 1 },
]
/** The sign along the back (east) edge, facing the square, high enough to clear the labels. */
export const SHOP_SIGN = { x: 35.2, minZ: -13, maxZ: 13, top: 15 }
/** Its twin over the Train Zones: the big TRAINING sign along the west edge, facing the square. */
export const TRAIN_SIGN = { x: -35.2, minZ: -13, maxZ: 13, top: 15 }
export const PAD_SIZE = 4.4

/** Rows of display stands, nearest the plaza first: two rows on each stage. */
const PAD_ROWS_X = [16.4, 21.2, 27.4, 32]

/**
 * Twenty stands, five to a row 6 m apart. `row` (0-3, front to back) lets the labels
 * above them step up so nearer ones don't hide farther ones.
 */
export const DUMBBELL_PADS = Array.from({ length: 20 }, (_, i) => {
  const row = Math.floor(i / 5)
  return {
    index: i,
    row,
    x: PAD_ROWS_X[row],
    z: (SHOP.minZ + SHOP.maxZ) / 2 - 12 + (i % 5) * 6,
    y: SHOP_STAGES[row < 2 ? 0 : 1].height,
  }
})

export const padRect = (pad) => ({
  minX: pad.x - PAD_SIZE / 2,
  maxX: pad.x + PAD_SIZE / 2,
  minZ: pad.z - PAD_SIZE / 2,
  maxZ: pad.z + PAD_SIZE / 2,
})

// --- Eggs, stands, boards -------------------------------------------------------------

/** The egg row stands behind spawn, the leaderboards behind it. */
export const EGG_STANDS = [
  { eggId: 'basic', x: -12, z: 20 },
  { eggId: 'meadow', x: -4, z: 20 },
  { eggId: 'sunset', x: 4, z: 20 },
  { eggId: 'unicorn', x: 12, z: 20 },
  { eggId: 'demon', x: 21, z: 21, big: true },
]
export const EGG_TRIGGER_RADIUS = 4.2

/** Limited premium pet on display. */
export const SPHINX_STAND = { x: 29, z: 22 }

export const LEADERBOARDS = [
  { id: 'rebirths', x: -12, z: 27 },
  { id: 'muscle', x: 0, z: 27 },
  { id: 'height', x: 12, z: 27 },
]

/** The Mega City portal, out past the shop. Name and Wins are WORLD_PORTALS in balance.js. */
export const PORTALS = [{ id: 'future', x: 24, z: -24, radius: 3.6 }]

/**
 * The aura kiosk and the potion kiosk, side by side on the left of the road's gate,
 * facing the square: walk up to them to open their panels.
 */
export const AURA_STAND = { x: -12, z: -26.5, radius: 3 }
export const POTION_STAND = { x: -18.5, z: -26.5, radius: 3 }

/** The big buff statue by the first car, asking if you can reach the top. */
export const STATUE = { x: 9.5, z: -26 }

export const FREE_REWARD = { x: 9, z: 12, radius: 3 }

/** The old water tower over the north-east corner, outside the square. */
export const WATER_TOWER = { x: 44, z: -38 }

// --- Collision ----------------------------------------------------------------------

const box = (x, z, halfX, halfZ) => ({
  minX: x - halfX,
  maxX: x + halfX,
  minZ: z - halfZ,
  maxZ: z + halfZ,
})

/** Solid, never-changing obstacles. Locked Train Zones add their own walls at runtime. */
export const STATIC_COLLIDERS = [
  // The shop's sign, and the TRAINING sign.
  ...[SHOP_SIGN, TRAIN_SIGN].map((s) => ({ minX: s.x - 0.5, maxX: s.x + 0.5, minZ: s.minZ - 0.5, maxZ: s.maxZ + 0.5 })),
  // Egg pedestals.
  ...EGG_STANDS.map((s) => box(s.x, s.z, s.big ? 2.1 : 1.6, s.big ? 2.1 : 1.6)),
  box(SPHINX_STAND.x, SPHINX_STAND.z, 3, 3),
  ...LEADERBOARDS.map((b) => box(b.x, b.z, 4.6, 0.5)),
  box(FREE_REWARD.x, FREE_REWARD.z, 1.4, 1.4),
  // Each portal ring's base, and the brick archway's pillars round it; the swirl itself is walk-through.
  ...PORTALS.flatMap((p) => [box(p.x - p.radius, p.z, 0.6, 0.8), box(p.x + p.radius, p.z, 0.6, 0.8)]),
  ...PORTALS.flatMap((p) => [box(p.x - p.radius - 1.5, p.z, 0.8, 1), box(p.x + p.radius + 1.5, p.z, 0.8, 1)]),
  // The stands' counters.
  box(AURA_STAND.x, AURA_STAND.z - 0.6, 2.1, 0.55),
  box(AURA_STAND.x, AURA_STAND.z - 2.4, 3.1, 0.35),
  box(POTION_STAND.x, POTION_STAND.z - 0.4, 2, 0.9),
  box(STATUE.x, STATUE.z, 2.2, 2.2),
  // The car waiting at the start.
  box(START_VEHICLE.x, START_VEHICLE.z, START_VEHICLE.halfX - 0.1, START_VEHICLE.halfZ - 0.2),
  // The cliffs either side of the track's foot.
  { minX: PLAZA.minX, maxX: -TRACK_HALF_WIDTH - 1, minZ: PLAZA.minZ - 1, maxZ: PLAZA.minZ + 0.6 },
  { minX: TRACK_HALF_WIDTH + 1, maxX: PLAZA.maxX, minZ: PLAZA.minZ - 1, maxZ: PLAZA.minZ + 0.6 },
  // Each Train Zone's row of equipment.
  ...Array.from({ length: ZONE_COUNT }, (_, i) => box(ZONE_RACK_X, zoneCenterZ(i), 0.8, ZONE_HALF.z - 0.6)),
]

/** Raised floors the player stands on, as rects with a height. */
export const PLATFORMS = [
  ...SHOP_STAGES.map((s) => ({ ...s })),
  ...Array.from({ length: ZONE_COUNT }, (_, i) => ({ ...zoneDeckRect(i), height: ZONE_HEIGHT })),
]

// --- Helpers ------------------------------------------------------------------------

export const inRect = (r, x, z, margin = 0) =>
  x >= r.minX - margin && x <= r.maxX + margin && z >= r.minZ - margin && z <= r.maxZ + margin

/** Index of the Train Zone whose pad is under (x, z), or -1. */
export function zoneAt(x, z, margin = 0) {
  for (let i = 0; i < ZONE_COUNT; i += 1) {
    if (inRect(zoneRect(i), x, z, margin)) return i
  }
  return -1
}

export const inPushZone = (x, z, margin = 0) => inRect(PUSH_ZONE, x, z, margin)

/** The portal whose swirl (x, z) is in, give or take `margin`, or null. */
export function portalAt(x, z, margin = 0) {
  for (const p of PORTALS) {
    if (Math.hypot(x - p.x, z - p.z) < p.radius + margin) return p
  }
  return null
}

/**
 * Whether a move from `from` to `to` is the trip back after a push: off the push zone
 * onto PUSH_RETURN. Faster than walking, so the server's speed check lets exactly this
 * one through.
 */
export const isPushReturn = (from, to) =>
  inPushZone(from.x, from.z, 2) && Math.hypot(to.x - PUSH_RETURN.x, to.z - PUSH_RETURN.z) < 2.5

/** Index of the dumbbell pad under (x, z), or -1. */
export function padAt(x, z) {
  for (const pad of DUMBBELL_PADS) {
    if (inRect(padRect(pad), x, z)) return pad.index
  }
  return -1
}

/** The egg stand within reach of (x, z), or null. */
export function eggStandNear(x, z) {
  for (const stand of EGG_STANDS) {
    const reach = EGG_TRIGGER_RADIUS + (stand.big ? 1 : 0)
    if (Math.hypot(stand.x - x, stand.z - z) <= reach) return stand
  }
  return null
}

/** Height of the floor at (x, z): raised platforms, else the ground at 0. */
export function groundHeightAt(x, z) {
  let h = 0
  for (const p of PLATFORMS) {
    if (p.height > h && inRect(p, x, z)) h = p.height
  }
  return h
}

/** Clamps (x, z) into the walkable union, returning the nearest walkable point. */
export function clampToWalkable(x, z, out = { x: 0, z: 0 }) {
  let best = Infinity
  for (const r of WALKABLE) {
    const cx = Math.min(r.maxX, Math.max(r.minX, x))
    const cz = Math.min(r.maxZ, Math.max(r.minZ, z))
    const d = (cx - x) ** 2 + (cz - z) ** 2
    if (d < best) {
      best = d
      out.x = cx
      out.z = cz
      if (d === 0) break
    }
  }
  return out
}

/** Fastest a player can legitimately move, for the server's anti-teleport check. */
export const MAX_MOVE_SPEED = 14
