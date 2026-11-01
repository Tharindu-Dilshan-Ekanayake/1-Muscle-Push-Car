import { STYLE } from '../materials'

/**
 * Per-stage look: the road's surface (`floor`, `floorStyle`) between stepped cliffs of
 * big square studs (`wall`, or `wallStyle`; BLOCK_GRASS gives them grass caps of their
 * own, otherwise they get a cap slab in `cap`), the line where the stage's slope starts
 * (`gate`), the sky up there (`stars` out in space) and the HUD's stage-name colours.
 *
 * `open` roads have low banks either side instead of tall cliffs, so the roadside shows.
 *
 * `road` is what's painted on and stands along it:
 * - `center`: the middle line - 'dash', 'solid', 'double' or none; `edge`: solid lines
 *   down both sides; `lines` their colour, `glowLines` lit up; `worn` (0-1) how much of
 *   the dashed paint has worn away.
 * - `lamp`: the lamps down both sides - 'street', 'highway', 'wood', 'broken' (leaning,
 *   dark), 'neon', 'gold', 'flood' or 'none'.
 * - `rail`: guardrails down both sides; `gantry`: big green signs over the road now
 *   and then; `tunnel`: lit ribs over it all the way; `crossing`: zebra crossings;
 *   `snow`: snow banked along the edges; `cones`: a line of cones down one side.
 *
 * Bottom to top they go from a muddy junkyard and broken streets to smooth highways
 * (World 1), then Mega City's neon boulevards, tunnels and a highway through space.
 */
export const STAGE_THEMES = {
  // Rusty corrugated fences round a muddy yard of wrecks.
  junkyard: {
    floor: '#86765f',
    floorStyle: STYLE.DIRT,
    wall: '#9a6a46',
    wallStyle: STYLE.CORRUGATED,
    cap: '#6a4a32',
    capStyle: STYLE.RUST,
    gate: '#ff8a1e',
    sky: ['#4f8fd0', '#ead6ae'],
    name: ['#fff0d6', '#ffb35a', '#c8641e'],
    road: { lamp: 'wood' },
  },
  // A dusty farm track between grassy banks.
  dirt: {
    open: true,
    floor: '#c09060',
    floorStyle: STYLE.DIRT,
    wall: '#a8744a',
    wallStyle: STYLE.BLOCK_GRASS,
    gate: '#ffd21f',
    sky: ['#3f9af2', '#c4e6ff'],
    name: ['#fffbe0', '#ffe066', '#d8a21a'],
    road: { lamp: 'wood' },
  },
  // A patched village road under palms, its paint half gone.
  village: {
    open: true,
    floor: '#7a7c80',
    floorStyle: STYLE.CRACKED,
    wall: '#c08454',
    wallStyle: STYLE.BLOCK_GRASS,
    gate: '#ff5a3c',
    sky: ['#2fa0f0', '#c8f0ff'],
    name: ['#fff0e6', '#ff9a7a', '#e2401c'],
    road: { center: 'dash', lines: '#f2f0e4', worn: 0.5, lamp: 'wood' },
  },
  // A broken old street: cracks, potholes, leaning lamps that don't light.
  cracked: {
    floor: '#6a6c70',
    floorStyle: STYLE.CRACKED,
    wall: '#8c8a86',
    cap: '#6a6866',
    gate: '#ff9c3c',
    sky: ['#6488aa', '#d4d8dc'],
    name: ['#f4f4f4', '#c8ccd2', '#7a8088'],
    road: { center: 'dash', edge: true, lines: '#e6e2c8', worn: 0.75, lamp: 'broken', cones: true },
  },
  // Fresh tarmac through green fields.
  country: {
    open: true,
    floor: '#4a4d55',
    floorStyle: STYLE.ROAD,
    wall: '#c98a6e',
    wallStyle: STYLE.BLOCK_GRASS,
    gate: '#ffd21f',
    sky: ['#2f8ff2', '#a6d6fb'],
    name: ['#e6ffb0', '#8dff4f', '#2fd12f'],
    road: { center: 'dash', edge: true, lines: '#ffd21f', lamp: 'street' },
  },
  // A long straight highway through sandstone, double yellow down the middle.
  desert: {
    open: true,
    floor: '#57565b',
    floorStyle: STYLE.ROAD,
    wall: '#d29a62',
    cap: '#ecb87e',
    gate: '#ff9c3c',
    sky: ['#3a9ef0', '#ffe2b0'],
    name: ['#fff3d6', '#ffcf8a', '#e8913a'],
    road: { center: 'double', edge: true, lines: '#ffcc22', lamp: 'none' },
  },
  // Downtown: tower blocks either side, crossings, lamps.
  city: {
    floor: '#3d4048',
    floorStyle: STYLE.ROAD,
    wall: '#8094ae',
    wallStyle: STYLE.WINDOWS,
    cap: '#d4dce8',
    gate: '#2fc6ff',
    sky: ['#3a8ae8', '#cfe6ff'],
    name: ['#e6f6ff', '#7fd4ff', '#1a8ae8'],
    road: { center: 'double', edge: true, lines: '#ffd21f', lamp: 'street', crossing: true },
  },
  // A leafy avenue of houses.
  suburb: {
    open: true,
    floor: '#4a4d55',
    floorStyle: STYLE.ROAD,
    wall: '#b98c6a',
    wallStyle: STYLE.BLOCK_GRASS,
    gate: '#ff7a1a',
    sky: ['#3f9af2', '#d6f0ff'],
    name: ['#fff0e0', '#ffb070', '#ff6a1a'],
    road: { center: 'dash', lines: '#ffffff', lamp: 'street', crossing: true },
  },
  // A ploughed road over a snowy pass, banks of snow along it.
  snow: {
    open: true,
    floor: '#5a5e66',
    floorStyle: STYLE.ROAD,
    wall: '#dcecf8',
    cap: '#ffffff',
    gate: '#5cc8ff',
    sky: ['#57aef0', '#e4f4ff'],
    name: ['#ffffff', '#c9f1ff', '#5cc8ff'],
    road: { center: 'dash', edge: true, lines: '#ffd21f', lamp: 'street', rail: true, snow: true },
  },
  // A winding mountain road: guardrails, grey rock, snow on the tops.
  mountain: {
    open: true,
    floor: '#4c4f56',
    floorStyle: STYLE.ROAD,
    wall: '#8a8a8e',
    cap: '#f2f6fa',
    gate: '#ffcc1a',
    sky: ['#3a8ee8', '#d8ecff'],
    name: ['#fffbe6', '#ffe066', '#e8a81a'],
    road: { center: 'double', edge: true, lines: '#ffd21f', lamp: 'none', rail: true },
  },
  // Smooth tarmac between grassy verges, big green signs overhead.
  highway: {
    open: true,
    floor: '#3a3d44',
    floorStyle: STYLE.ROAD,
    wall: '#b08e6a',
    wallStyle: STYLE.BLOCK_GRASS,
    gate: '#2fe86a',
    sky: ['#2f8ff2', '#bfe0ff'],
    name: ['#e6fff0', '#7dffaa', '#1ac85a'],
    road: { center: 'dash', edge: true, lines: '#ffffff', lamp: 'highway', rail: true, gantry: true },
  },
  // Concrete quays among stacked containers, the sea over the cliff tops.
  harbor: {
    floor: '#8e949c',
    floorStyle: STYLE.TILES,
    wall: '#2f6ab0',
    wallStyle: STYLE.CORRUGATED,
    cap: '#3fd0ff',
    capStyle: STYLE.WATER,
    gate: '#ffcc1a',
    sky: ['#2fa8ff', '#c4f2ff'],
    name: ['#e6f8ff', '#7fe0ff', '#2fa8ff'],
    road: { center: 'solid', edge: true, lines: '#ffcc1a', lamp: 'street' },
  },
  // A dusty haul road down into the quarry.
  quarry: {
    open: true,
    floor: '#a88a68',
    floorStyle: STYLE.DIRT,
    wall: '#c49a6a',
    cap: '#dcb688',
    gate: '#ffb31a',
    sky: ['#4a9ae8', '#f0dcc0'],
    name: ['#fff6d6', '#ffd27a', '#e89a1a'],
    road: { lamp: 'flood', cones: true },
  },

  // Mega City: lit-up towers at night, neon along every edge and down the road.
  neon: {
    floor: '#1d1f3a',
    floorStyle: STYLE.ROAD,
    wall: '#2a2d52',
    wallStyle: STYLE.WINDOWS,
    cap: '#ff3fd0',
    capStyle: STYLE.GLOW,
    gate: '#ff3fd0',
    sky: ['#120a3a', '#5a2a8a'],
    name: ['#ffe6ff', '#ff7ae8', '#c03fff'],
    road: { center: 'dash', edge: true, lines: '#2fe8ff', glowLines: true, lamp: 'neon' },
  },
  // Tiled tunnel walls, a lit rib over the road every few metres.
  tunnel: {
    floor: '#3a3d44',
    floorStyle: STYLE.ROAD,
    wall: '#d8dce2',
    wallStyle: STYLE.TILES,
    cap: '#b8bcc4',
    gate: '#ffd21f',
    sky: ['#2a2f3a', '#6a7488'],
    name: ['#fff6d0', '#ffd21f', '#e89a1a'],
    road: { center: 'dash', edge: true, lines: '#ffffff', lamp: 'none', tunnel: true },
  },
  // A ruined road through a burnt-out wasteland, lava glowing on the cliff tops.
  wasteland: {
    floor: '#6a4c3c',
    floorStyle: STYLE.CRACKED,
    wall: '#5a3a2a',
    cap: '#ff5a1c',
    capStyle: STYLE.LAVA,
    gate: '#ff4a1c',
    sky: ['#5a2a2a', '#d8865a'],
    name: ['#ffd0b0', '#ff7a3c', '#e2240c'],
    road: { center: 'dash', lines: '#d8d0b0', worn: 0.85, lamp: 'broken' },
  },
  // Dirt and steel: cranes, barriers and cones.
  construction: {
    open: true,
    floor: '#7e6852',
    floorStyle: STYLE.DIRT,
    wall: '#8a8e96',
    cap: '#9a8466',
    capStyle: STYLE.DIRT,
    gate: '#ffcc1a',
    sky: ['#3a8ee8', '#e8dcc0'],
    name: ['#fff6d0', '#ffd21f', '#e89a1a'],
    road: { lamp: 'flood', cones: true },
  },
  // A muddy arena floor under floodlights, the stands packed either side.
  arena: {
    open: true,
    floor: '#7a5034',
    floorStyle: STYLE.DIRT,
    wall: '#4a4f5c',
    gate: '#4fdc2a',
    sky: ['#14183a', '#4a4a8a'],
    name: ['#e6ffd0', '#8dff4f', '#2fd12f'],
    road: { lamp: 'flood' },
  },
  // A road of gold over the clouds.
  skyway: {
    open: true,
    floor: '#f4e2a0',
    floorStyle: STYLE.TILES,
    wall: '#eef4ff',
    cap: '#ffffff',
    capStyle: STYLE.SMOOTH,
    gate: '#ffd23f',
    sky: ['#5ab4ff', '#fff4d6'],
    name: ['#fffbe6', '#ffe066', '#e8a81a'],
    road: { center: 'double', edge: true, lines: '#ffffff', lamp: 'gold' },
  },
  // The last road: a highway through space, neon down it, planets overhead.
  mega: {
    open: true,
    floor: '#2a1a5a',
    floorStyle: STYLE.GALAXY,
    wall: '#1a1240',
    wallStyle: STYLE.GALAXY,
    cap: '#2a1a5a',
    capStyle: STYLE.GALAXY,
    gate: '#ff7ad9',
    sky: ['#05021a', '#3a1a6a'],
    stars: true,
    name: ['#fff0ff', '#ff9bea', '#a03fff'],
    road: { center: 'dash', edge: true, lines: '#ff7ad9', glowLines: true, lamp: 'neon' },
  },
}

/** Each world's lobby sky (and stars), by world index; World 1's is the scene's own. */
export const WORLD_SKIES = [null, { sky: ['#1a1050', '#8a6ad8'], stars: true }]

/** Every SAFEZONE, whatever the stage: light blue studs, floor and cliffs alike. */
export const SAFE_THEME = { floor: '#a6dbff', floorStyle: STYLE.STUDS, wall: '#7ab9ec', cap: '#d8efff', gate: '#5cc8ff' }
