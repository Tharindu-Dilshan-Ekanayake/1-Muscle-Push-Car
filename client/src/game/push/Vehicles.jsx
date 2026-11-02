import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Color, IcosahedronGeometry, Matrix4, Quaternion, Vector3 } from 'three'

import { PUSH_START } from '@shared/balance'

import { remotePlayers } from '../../net/remotePlayers'
import { getQuality } from '../../store/quality'
import { createToyInstances, disposeBlocks, PropBuilder } from '../blocks'
import { sharedMaterials, STYLE } from '../materials'
import { runtime } from '../runtime'
import { MAX_STAGES, STAGES, stageStart } from './course'
import { feetPoint, vehicleGap, vehicleModelId, vehiclePose, vehicleSize } from './path'
import { push } from './pushControl'
import { stepRemotePushers } from './remotePush'
import { createVehicleBatch, MODELS, wheelbase } from './vehicleModels'

const MAX_REMOTES = 8
/** Each stage's, waiting at the foot of its slope; yours; and everyone else's. */
const SLOTS = MAX_STAGES + 1 + MAX_REMOTES

const _m = new Matrix4()
const _q = new Quaternion()
const _p = new Vector3()
const _one = new Vector3(1, 1, 1)
const _x = new Vector3(1, 0, 0)

/** A blob shadow under each vehicle (on presets without realtime shadows), as long as it is. */
const casters = Array.from({ length: SLOTS }, () => ({ position: new Vector3(), size: 2, aspect: 2, visible: false }))

/** How long after start-up the vehicles still to be built start being built. */
const LATER_MS = 4000

/** Where stage `stage`'s vehicle waits: just up from where you stand to take it. */
const waitingMeter = (stage) => stageStart(stage) + PUSH_START + vehicleGap(stage)

// --- Smoke -----------------------------------------------------------------------------

/** Puffs in the air at once: a fixed pool, the oldest reused when it's full. */
const PUFFS = 96
/** Broken-down vehicles further than this from the camera don't smoke. */
const SMOKE_RANGE = 70
/** Puffs a second from a broken-down vehicle sitting there, and from one being pushed. */
const IDLE_RATE = 1.6
const PUSHED_RATE = 3.5
/** Smoke drifts off to the side, out of the chase camera's way. */
const WIND = new Vector3(1.1, 0.2, -0.3)
const SOOT = [new Color('#4a494e'), new Color('#b4b4ba')]
const STEAM = [new Color('#c4c8ce'), new Color('#f2f4f8')]

const puffs = Array.from({ length: PUFFS }, () => ({ life: 0, max: 1, size: 1, pos: new Vector3(), vel: new Vector3(), soot: false }))
const smoke = { next: 0, owed: new Float32Array(SLOTS) }
const _c = new Color()

/**
 * Smoke from vehicle `id` in slot `slot`, its body at `matrix`: `rate` puffs a second
 * from its smoking points (under the bonnet, out of the exhaust), black from the wrecks.
 */
function emitSmoke(slot, id, matrix, rate, delta) {
  const points = MODELS[id].smoke
  if (points.length === 0 || rate <= 0) return
  smoke.owed[slot] += delta * rate * points.length
  while (smoke.owed[slot] >= 1) {
    smoke.owed[slot] -= 1
    const [x, y, f, size] = points[Math.floor(Math.random() * points.length)]
    const p = puffs[smoke.next]
    smoke.next = (smoke.next + 1) % PUFFS
    p.pos.set(x + (Math.random() - 0.5) * 0.3, y, -f + (Math.random() - 0.5) * 0.3).applyMatrix4(matrix)
    p.vel.set((Math.random() - 0.5) * 0.6, 1.3 + Math.random() * 0.9, (Math.random() - 0.5) * 0.6)
    p.max = 1.6 + Math.random() * 1.1
    p.life = p.max
    p.size = size * (0.32 + Math.random() * 0.2)
    p.soot = Boolean(MODELS[id].soot)
  }
}

/** Moves every puff on: rising, drifting downwind, swelling, paling, then shrinking away. */
function stepSmoke(mesh, delta, on) {
  let alive = false
  for (let i = 0; i < PUFFS; i += 1) {
    const p = puffs[i]
    if (p.life <= 0) continue
    p.life -= delta
    if (p.life <= 0 || !on) {
      p.life = 0
      mesh.setMatrixAt(i, _m.makeScale(0, 0, 0))
      continue
    }
    alive = true
    const t = 1 - p.life / p.max
    p.vel.y *= 1 - delta * 0.6
    p.pos.addScaledVector(p.vel, delta).addScaledVector(WIND, delta * t)
    const fade = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1
    _p.setScalar(p.size * (0.3 + 0.9 * t) * fade)
    mesh.setMatrixAt(i, _m.compose(p.pos, _q.identity(), _p))
    const [from, to] = p.soot ? SOOT : STEAM
    mesh.setColorAt(i, _c.copy(from).lerp(to, t))
  }
  mesh.visible = alive
  if (alive) {
    mesh.instanceMatrix.needsUpdate = true
    mesh.instanceColor.needsUpdate = true
  }
}

// --- Vehicles ----------------------------------------------------------------------------

/**
 * Draws stage `stage`'s vehicle in slot `slot` with its middle at track metre `meter`,
 * `x` across, its wheels turned for `rolled` metres; and its shadow, and its smoke at
 * `rate` puffs a second (when it's broken down and in range). Returns the next slot.
 */
function drawVehicle(batch, slot, stage, meter, x, rolled, rate, delta, camera) {
  const id = vehicleModelId(stage)
  const [rear, front] = wheelbase(id)
  const pitch = vehiclePose(meter, x, rear, front, _p)
  batch.place(slot, id, _m.compose(_p, _q.setFromAxisAngle(_x, pitch), _one), rolled)
  const caster = casters[slot]
  const size = vehicleSize(stage)
  caster.position.copy(_p)
  caster.size = size.width * 1.25
  caster.aspect = size.length / size.width
  caster.visible = true
  if (rate > 0 && _p.distanceTo(camera.position) < SMOKE_RANGE) emitSmoke(slot, id, _m, rate, delta)
  return slot + 1
}

/**
 * Every vehicle in the world, in one draw call: each stage's waiting at the foot of its
 * slope (the first in the plaza, the rest at the top of each SAFEZONE) - except the one
 * you're pushing, which goes up the slope with you - and everyone else's, eased along
 * from what they report. Waiting ones past the view distance aren't drawn. Each gets a
 * blob shadow on presets without realtime ones; the broken-down ones smoke, on presets
 * with particles (in one more draw call, only while there's smoke).
 */
export function Vehicles() {
  const batchRef = useRef(null)
  const smokeRef = useRef(null)
  // Only the first car (in view from the lobby) is built before the game opens.
  const batch = useMemo(() => {
    const vehicles = createVehicleBatch(SLOTS)
    vehicles.prepare(STAGES[0].vehicle)
    return vehicles
  }, [])
  const smokeMesh = useMemo(() => {
    const geometry = new PropBuilder().add(new IcosahedronGeometry(1, 1), { color: '#ffffff', style: STYLE.SMOOTH }).build()
    const mesh = createToyInstances(geometry, sharedMaterials().toy, PUFFS)
    mesh.count = PUFFS
    for (let i = 0; i < PUFFS; i += 1) mesh.setMatrixAt(i, _m.makeScale(0, 0, 0))
    mesh.visible = false
    return mesh
  }, [])

  // The rest, one at a time when the page is idle - starting once the game's open, so
  // they never compete with its start-up: this world's in climbing order, then the other's.
  useEffect(() => {
    const here = STAGES.map((s) => s.vehicle)
    const id = setTimeout(() => batch.prepareLater([...here, ...Object.keys(MODELS).filter((m) => !here.includes(m))]), LATER_MS)
    return () => clearTimeout(id)
  }, [batch])

  useEffect(() => {
    for (const caster of casters) runtime.shadowCasters.add(caster)
    return () => {
      for (const caster of casters) runtime.shadowCasters.delete(caster)
      for (const p of puffs) p.life = 0
      batch.dispose()
      disposeBlocks(smokeMesh)
    }
  }, [batch, smokeMesh])

  useFrame((state, rawDelta) => {
    if (!batchRef.current) return
    const delta = Math.min(rawDelta, 0.05)
    const camera = state.camera
    stepRemotePushers(remotePlayers, state.clock.elapsedTime, delta)
    const quality = getQuality()
    const smoking = quality.particles
    const far = quality.viewDistance
    const pushing = push.active && push.phase !== 'free'
    let slot = 0

    for (let stage = 0; stage < STAGES.length; stage += 1) {
      if (pushing && push.stage === stage) {
        const rate = smoking ? PUSHED_RATE * (0.5 + push.effort + push.strain * 1.5) : 0
        slot = drawVehicle(batch, slot, stage, push.vehicleMeter, push.x, push.rolled, rate, delta, camera)
        continue
      }
      // One waiting further up shows once it's built (yours, or anyone's being pushed,
      // is built on the spot if it has to be).
      const meter = waitingMeter(stage)
      if (!batch.has(STAGES[stage].vehicle)) continue
      if (feetPoint(meter, 0, _p).distanceTo(camera.position) < far) slot = drawVehicle(batch, slot, stage, meter, 0, 0, smoking ? IDLE_RATE : 0, delta, camera)
    }

    for (const r of remotePlayers.values()) {
      if (!r.pushing || r.pushPhase !== 'push' || slot >= SLOTS) continue
      const stage = r.pushStage ?? 0
      slot = drawVehicle(batch, slot, stage, r.shownMeter + vehicleGap(stage), r.shownX, r.rolled, smoking ? PUSHED_RATE : 0, delta, camera)
    }

    for (let j = slot; j < SLOTS; j += 1) {
      casters[j].visible = false
      batch.hide(j)
    }
    if (smokeRef.current) stepSmoke(smokeRef.current, delta, smoking)
  })

  return (
    <>
      <primitive ref={batchRef} object={batch.mesh} />
      <primitive ref={smokeRef} object={smokeMesh} />
    </>
  )
}

export default Vehicles
