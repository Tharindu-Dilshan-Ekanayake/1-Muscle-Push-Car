import {
  BufferAttribute,
  CanvasTexture,
  ClampToEdgeWrapping,
  LinearMipmapLinearFilter,
  NearestFilter,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three'

import {
  AURA_STAND,
  EGG_STANDS,
  FREE_REWARD,
  LEADERBOARDS,
  PORTALS,
  POTION_STAND,
  PLAZA,
  PUSH_ZONE,
  SHOP,
  TRACK_START_Z,
  ZONE_COUNT,
  zoneDeckRect,
} from '@shared/world'

import { STYLE } from '../materials'
import { PALETTE } from '../sceneStyle'
import { TOWN_DEPTH } from './terrain'

/**
 * The town's floor: one big plane of cobbles (the toy shader's COBBLE) whose colours
 * come from a tiny "ground map" texture painted at one texel per world unit: the square,
 * Main Street round the fountain, the pavements, the aprons under the gyms and stands.
 * The whole floor is a single draw call however many painted regions it has.
 */

const MAP = { minX: PLAZA.minX - TOWN_DEPTH, maxX: PLAZA.maxX + TOWN_DEPTH, minZ: PLAZA.minZ, maxZ: PLAZA.maxZ + TOWN_DEPTH }
const MAP_W = MAP.maxX - MAP.minX
const MAP_H = MAP.maxZ - MAP.minZ

/** Where the ground plane ends to the north: the track's own floor takes over there. */
export const GROUND_NORTH_EDGE = TRACK_START_Z

function painter(ctx) {
  const rect = (r, color) => {
    ctx.fillStyle = color
    ctx.fillRect(
      Math.round(r.minX - MAP.minX),
      Math.round(r.minZ - MAP.minZ),
      Math.round(r.maxX - r.minX),
      Math.round(r.maxZ - r.minZ),
    )
  }
  const bordered = (r, fill, edge) => {
    rect(r, edge)
    rect({ minX: r.minX + 1, maxX: r.maxX - 1, minZ: r.minZ + 1, maxZ: r.maxZ - 1 }, fill)
  }
  const disc = (x, z, radius, color) => {
    ctx.fillStyle = color
    for (let dz = -radius; dz < radius; dz += 1) {
      for (let dx = -radius; dx < radius; dx += 1) {
        if ((dx + 0.5) ** 2 + (dz + 0.5) ** 2 <= radius * radius) {
          ctx.fillRect(Math.floor(x + dx - MAP.minX), Math.floor(z + dz - MAP.minZ), 1, 1)
        }
      }
    }
  }
  return { rect, bordered, disc }
}

export function createGroundMap(maxTexture) {
  const canvas = document.createElement('canvas')
  canvas.width = MAP_W
  canvas.height = MAP_H
  const ctx = canvas.getContext('2d')
  const { rect, bordered, disc } = painter(ctx)

  // The town's streets round the square, then the square, then Main Street straight up
  // its middle from the eggs to the road.
  rect(MAP, PALETTE.street)
  bordered({ minX: PLAZA.minX - 3, maxX: PLAZA.maxX + 3, minZ: PLAZA.minZ, maxZ: PLAZA.maxZ + 3 }, PALETTE.pavement, PALETTE.apronEdge)
  rect(PLAZA, PALETTE.plaza)
  rect({ minX: -4.5, maxX: 4.5, minZ: PLAZA.minZ, maxZ: PLAZA.maxZ }, PALETTE.street)
  for (const side of [-1, 1]) rect({ minX: side * 4.5 - 0.5, maxX: side * 4.5 + 0.5, minZ: PLAZA.minZ, maxZ: PLAZA.maxZ }, PALETTE.apronEdge)

  // A paved apron under the Train Zones, and one at the foot of the track.
  const first = zoneDeckRect(0)
  const last = zoneDeckRect(ZONE_COUNT - 1)
  bordered({ minX: first.minX - 2, maxX: first.maxX + 3, minZ: last.minZ - 2, maxZ: first.maxZ + 2 }, PALETTE.apron, PALETTE.apronEdge)
  bordered({ minX: PUSH_ZONE.minX - 3, maxX: PUSH_ZONE.maxX + 3, minZ: TRACK_START_Z, maxZ: PUSH_ZONE.maxZ + 4 }, PALETTE.apron, PALETTE.apronEdge)

  // Egg plaza and the shop yard.
  const eggsZ = EGG_STANDS[0].z
  bordered({ minX: -17, maxX: 25, minZ: eggsZ - 4, maxZ: LEADERBOARDS[0].z - 1 }, PALETTE.apron, PALETTE.apronEdge)
  rect({ minX: SHOP.minX, maxX: SHOP.maxX, minZ: SHOP.minZ, maxZ: SHOP.maxZ }, PALETTE.shopFloor)

  for (const p of PORTALS) {
    disc(p.x, p.z, 6, PALETTE.apronEdge)
    disc(p.x, p.z, 5, PALETTE.apron)
  }
  for (const stand of [AURA_STAND, POTION_STAND]) {
    disc(stand.x, stand.z, 4, PALETTE.apronEdge)
    disc(stand.x, stand.z, 3.3, PALETTE.apron)
  }
  disc(FREE_REWARD.x, FREE_REWARD.z, 4, PALETTE.apronEdge)


  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.magFilter = NearestFilter
  texture.minFilter = LinearMipmapLinearFilter
  texture.wrapS = ClampToEdgeWrapping
  texture.wrapT = ClampToEdgeWrapping
  texture.anisotropy = maxTexture > 512 ? 4 : 1
  return texture
}

/**
 * The ground plane, with UVs computed from world position so the map lands exactly
 * on the world grid. Outside the map, clamp-to-edge repeats the plaza colour.
 */
export function createGroundGeometry() {
  const minX = -280
  const maxX = 280
  const minZ = GROUND_NORTH_EDGE
  const maxZ = 280
  const geometry = new PlaneGeometry(maxX - minX, maxZ - minZ)
  geometry.rotateX(-Math.PI / 2)
  geometry.translate((minX + maxX) / 2, 0, (minZ + maxZ) / 2)

  const position = geometry.getAttribute('position')
  const uv = geometry.getAttribute('uv')
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i)
    const z = position.getZ(i)
    uv.setXY(i, (x - MAP.minX) / MAP_W, 1 - (z - MAP.minZ) / MAP_H)
  }
  uv.needsUpdate = true
  geometry.setAttribute('aStyle', new BufferAttribute(new Float32Array(position.count).fill(STYLE.COBBLE), 1))
  return geometry
}
