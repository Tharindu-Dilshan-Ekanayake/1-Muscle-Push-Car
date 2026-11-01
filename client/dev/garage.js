import { Color, DirectionalLight, HemisphereLight, Matrix4, Mesh, MeshLambertMaterial, PerspectiveCamera, PlaneGeometry, Scene, Vector3, WebGLRenderer } from 'three'

import { VEHICLES } from '@shared/balance'

import { LIGHTS } from '../src/game/sceneStyle'
import { createVehicleBatch, MODELS } from '../src/game/push/vehicleModels'

/**
 * The garage: every vehicle model lined up in a grid, lit like the game, for looking
 * them over while designing them. Dev only (served by `npm run dev` at /garage.html;
 * the production build never includes it). `?view=front|back|side|top` picks the
 * camera, `?only=a,b` shows just those models.
 */
const params = new URLSearchParams(location.search)
const view = params.get('view') ?? 'front'
const only = params.get('only')?.split(',')
const ids = Object.keys(MODELS).filter((id) => !only || only.includes(id))

const renderer = new WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(2, devicePixelRatio))
renderer.setSize(innerWidth, innerHeight)
document.body.appendChild(renderer.domElement)

const scene = new Scene()
scene.background = new Color('#8fc8f4')
scene.add(new HemisphereLight('#dff1ff', '#8a7a62', 1.4))
const sun = new DirectionalLight(LIGHTS.sunColor, LIGHTS.sunIntensity)
sun.position.set(...LIGHTS.sunDirection).multiplyScalar(50)
scene.add(sun)
const ground = new Mesh(new PlaneGeometry(400, 400), new MeshLambertMaterial({ color: '#7d8088' }))
ground.rotation.x = -Math.PI / 2
scene.add(ground)

const COLS = Math.min(5, ids.length)
const batch = createVehicleBatch(ids.length)
scene.add(batch.mesh)
const m = new Matrix4()
let maxX = 0
let maxZ = 0
ids.forEach((id, i) => {
  const x = (i % COLS) * 6.5 - ((COLS - 1) * 6.5) / 2
  const z = Math.floor(i / COLS) * 15
  maxX = Math.max(maxX, Math.abs(x))
  maxZ = Math.max(maxZ, z)
  batch.place(i, id, m.makeTranslation(x, 0, z), 0)

})

const camera = new PerspectiveCamera(only ? 35 : 40, innerWidth / innerHeight, 0.5, 600)
const mid = new Vector3(0, 1.5, maxZ / 2)
const longest = Math.max(...ids.map((id) => VEHICLES[id].length))
const reach = Math.max(maxX * 1.5 + longest * 0.9, maxZ * 1.2, 8)
const at = {
  front: [reach * 0.35, reach * 0.4, -reach * 0.75],
  back: [-reach * 0.35, reach * 0.4, maxZ + reach * 0.75],
  side: [reach * 1.1, reach * 0.35, maxZ / 2 - reach * 0.15],
  top: [0, reach * 1.2, maxZ / 2 + 0.01],
}[view]
camera.position.set(...at)
camera.lookAt(mid)

renderer.setAnimationLoop(() => renderer.render(scene, camera))
window.__garageReady = true
