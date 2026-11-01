import { STYLE } from '../materials'
import { PALETTE } from '../sceneStyle'

/**
 * The old town's gardens, round the walkways: spawn to the car straight up Main Street,
 * the Train Zones' walkway on the west, the shop on the east. Each is a lawn inside a
 * low brick wall.
 */
export const LAWNS = [
  // Between the gyms and Main Street, south of the kiosks by the gate.
  { minX: -19, maxX: -7, minZ: -20, maxZ: -9 },
  { minX: -19, maxX: -7, minZ: -5, maxZ: 11 },
  // East of Main Street, before the shop.
  { minX: 7.5, maxX: 11, minZ: -17, maxZ: -2 },
  // Round the Mega City portal.
  { minX: 16, maxX: 34, minZ: -29, maxZ: -19 },
  // Round the Sphinx, south-east.
  { minX: 25, maxX: 35, minZ: 17, maxZ: 28 },
]

/** The walls' height and width: low enough to step over. */
const CURB_H = 0.24
const CURB_W = 0.6

/** The gardens: grass, and the brick walls round it. */
export function buildLawnCurbs(blocks) {
  for (const l of LAWNS) {
    const w = l.maxX - l.minX
    const d = l.maxZ - l.minZ
    const cx = (l.minX + l.maxX) / 2
    const cz = (l.minZ + l.maxZ) / 2
    blocks.addOn(cx, -0.1, cz, w, 0.18, d, PALETTE.lawn, STYLE.DIRT)
    for (const side of [-1, 1]) {
      blocks.addOn(cx, 0, cz + side * (d / 2 + CURB_W / 2), w + CURB_W * 2, CURB_H, CURB_W, PALETTE.curb, STYLE.BRICK)
      blocks.addOn(cx + side * (w / 2 + CURB_W / 2), 0, cz, CURB_W, CURB_H, d, PALETTE.curb, STYLE.BRICK)
    }
  }
}
