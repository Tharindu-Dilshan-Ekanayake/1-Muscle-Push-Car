import { Color, MeshLambertMaterial } from 'three'

/**
 * The toy-brick look, done in the shader instead of with textures.
 *
 * Every block in the world shares one Lambert material whose fragment shader draws the
 * stud tiles, grass caps, windows and so on from world position. That keeps texture
 * memory at zero for the whole world and lets thousands of differently sized boxes
 * share one InstancedMesh: world-space patterns tile identically whatever the scale.
 *
 * Which pattern a surface gets is per instance (or per vertex, for merged meshes) via
 * the `aStyle` attribute, using the ids below.
 */
export const STYLE = {
  /** Rounded stud tiles. */
  STUDS: 0,
  /** Hill block: tan studded sides with a grass cap and lip. */
  TERRAIN: 1,
  /** Building wall with a window grid on the sides. */
  WINDOWS: 2,
  /** Diagonal diamond plate. */
  PLATE: 3,
  /** Plain, no pattern. */
  SMOOTH: 4,
  /** Self-lit: neon, lava glow, signs. */
  GLOW: 5,
  /** Horizontal white bands, for gate pillars. */
  STRIPES: 6,
  /** Lava: dark crust with glowing cracks. */
  LAVA: 7,
  /** Hue cycles across the surface. */
  RAINBOW: 8,
  /** Deep blue with stars. */
  GALAXY: 9,
  /** Asphalt with no studs but a fine grain. */
  ROAD: 10,
  /** Falling water: bright streaks scrolling down. */
  WATER: 11,
  /** Treadmill belt: dark rubber with ribs scrolling east along the top. */
  BELT: 12,
  /** Big square studs, as on the track's cliffs in the reference. */
  BLOCK: 13,
  /** Big square studs with a grass cap and lip: the reference's grassy cliffs. */
  BLOCK_GRASS: 14,
  /** Big floor tiles with thin seams and a faint checker: the track's floor. */
  TILES: 15,
  /** Old asphalt: cracked all over, potholed, patched. */
  CRACKED: 16,
  /** Packed dirt: blotchy, pebbly, worn into two tyre ruts down the road. */
  DIRT: 17,
  /** Corrugated sheet metal: ribs up the sides (fences, sheds, containers). */
  CORRUGATED: 18,
  /** Rusted metal: the colour, eaten through with orange-brown rust. */
  RUST: 19,
  /** Old town: rounded cobblestones in staggered rows (the square, the streets). */
  COBBLE: 20,
  /** Old town: bricks in running bond, in pale mortar. */
  BRICK: 21,
  /** Old town: a plastered house front, rows of shuttered windows up every storey. */
  TOWNHOUSE: 22,
  /** Old town: rows of clay roof tiles. */
  ROOF: 23,
}

/** Shared clock for animated styles; WorldClock advances it once per frame. */
export const toyTime = { value: 0 }

/** Cap colour for STYLE.TERRAIN blocks; the instance colour is the dirt underneath. */
export const GRASS_COLOR = new Color('#4fd93a')

const vertexHead = /* glsl */ `
  attribute float aStyle;
  varying vec3 vToyPos;
  varying vec3 vToyNormal;
  varying float vToyStyle;
  varying float vToyTop;
  varying float vToyDepth;
`

const vertexBody = /* glsl */ `
  vec4 toyWorld = vec4(transformed, 1.0);
  vec3 toyN = objectNormal;
  vec4 toyTop = vec4(0.0, 0.5, 0.0, 1.0);
  #ifdef USE_INSTANCING
    toyWorld = instanceMatrix * toyWorld;
    toyN = mat3(instanceMatrix) * toyN;
    toyTop = instanceMatrix * toyTop;
  #endif
  toyWorld = modelMatrix * toyWorld;
  vToyPos = toyWorld.xyz;
  vToyNormal = normalize(mat3(modelMatrix) * toyN);
  vToyTop = (modelMatrix * toyTop).y;
  vToyStyle = aStyle;
  #ifdef USE_INSTANCING
    // How far below a box's top, along its own up: exact even tipped up a slope.
    vToyDepth = (0.5 - transformed.y) * length(instanceMatrix[1].xyz);
  #else
    vToyDepth = vToyTop - vToyPos.y;
  #endif
`

const fragmentHead = /* glsl */ `
  uniform float uStudScale;
  uniform float uTime;
  uniform vec3 uGrass;
  varying vec3 vToyPos;
  varying vec3 vToyNormal;
  varying float vToyStyle;
  varying float vToyTop;
  varying float vToyDepth;

  float toyHash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  // Rounded stud tile: dark seams, a lit upper-left bevel and shaded lower-right.
  // Fades to its average once tiles shrink below a couple of pixels, so distant
  // ground doesn't shimmer with moire.
  float toyTile(vec2 p) {
    vec2 w = fwidth(p);
    float aa = max(max(w.x, w.y), 1e-4);
    vec2 c = fract(p) - 0.5;
    vec2 q = abs(c) - vec2(0.34);
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 0.1;
    float inside = 1.0 - smoothstep(-aa, aa, d);
    float bevel = clamp(-d * 9.0, 0.0, 1.0);
    float lit = (c.y - c.x) * (1.0 - bevel) * 0.22;
    float shade = mix(0.82, 1.0 + lit, inside);
    return mix(shade, 0.95, smoothstep(0.28, 0.6, aa));
  }

  // Diamond plate: a raised lozenge grid on the diagonals.
  float toyPlate(vec2 p) {
    vec2 r = vec2(p.x + p.y, p.x - p.y) * 0.7071 * 1.4;
    vec2 w = fwidth(r);
    float aa = max(max(w.x, w.y), 1e-4);
    vec2 f = abs(fract(r) - 0.5);
    float line = 1.0 - smoothstep(0.06 - aa, 0.06 + aa, min(f.x, f.y));
    float hl = 1.0 - smoothstep(0.1, 0.2, abs(f.x - f.y));
    float shade = 1.0 - line * 0.28 + hl * 0.06;
    return mix(shade, 0.92, smoothstep(0.2, 0.5, aa));
  }

  // Big square stud: a raised square in each cell, its bevel lit from the upper left,
  // in a dark groove. Fades to its average far off.
  float toyBlock(vec2 p) {
    vec2 w = fwidth(p);
    float aa = max(max(w.x, w.y), 1e-4);
    vec2 c = fract(p) - 0.5;
    float e = max(abs(c.x), abs(c.y));
    float seam = smoothstep(0.455 - aa, 0.455 + aa, e);
    float inner = 1.0 - smoothstep(0.3 - aa, 0.3 + aa, e);
    float bevel = clamp((c.y - c.x) / max(e, 1e-3), -1.0, 1.0) * 0.13;
    float shade = mix(1.0 + bevel, 1.05, inner) * (1.0 - seam * 0.32);
    // Each stud a shade lighter or darker than the next, so a cliff isn't one flat colour.
    float tint = 0.92 + 0.15 * toyHash(floor(p));
    return mix(shade * tint, 0.95, smoothstep(0.2, 0.5, aa));
  }

  // Big floor tile: thin seams and a faint checker.
  float toyFloor(vec2 p) {
    vec2 w = fwidth(p);
    float aa = max(max(w.x, w.y), 1e-4);
    vec2 f = abs(fract(p) - 0.5);
    float seam = smoothstep(0.475 - aa, 0.475 + aa, max(f.x, f.y));
    vec2 cell = floor(p);
    float check = mod(cell.x + cell.y, 2.0) * 0.045;
    return mix(1.0 + check - seam * 0.2, 0.99, smoothstep(0.25, 0.6, aa));
  }

  // Cobbles: staggered rows of rounded stones, each a shade of its own, in dark joints.
  float toyCobble(vec2 suv) {
    vec2 p = suv * vec2(1.25, 1.6);
    float row = floor(p.y);
    p.x += mod(row, 2.0) * 0.5;
    vec2 cell = floor(p);
    vec2 f = fract(p) - 0.5;
    vec2 w = fwidth(p);
    float aa = max(max(w.x, w.y), 1e-4);
    vec2 q = abs(f) - vec2(0.33, 0.3);
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 0.12;
    float stone = 1.0 - smoothstep(-aa, aa, d);
    float tint = 0.88 + 0.2 * toyHash(cell);
    float lit = clamp(-d * 6.0, 0.0, 1.0) * (f.y - f.x) * 0.12;
    return mix(mix(0.62, tint + lit, stone), 0.9, smoothstep(0.25, 0.6, aa));
  }

  // Smooth 2D value noise in [0, 1).
  float toyNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(toyHash(i), toyHash(i + vec2(1.0, 0.0)), f.x), mix(toyHash(i + vec2(0.0, 1.0)), toyHash(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  vec3 toyHue(float h) {
    return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  }
`

const fragmentBody = /* glsl */ `
  {
    vec3 n = normalize(vToyNormal);
    vec3 an = abs(n);
    bool isTop = n.y > 0.5;
    // Planar projection along the dominant axis keeps studs square on every face.
    vec2 suv = an.y > 0.5 ? vToyPos.xz : (an.x > 0.5 ? vToyPos.zy : vToyPos.xy);
    vec2 sp = suv * uStudScale;
    vec3 col = diffuseColor.rgb;
    float style = vToyStyle + 0.5;

  #ifdef TOY_GROUND
    col *= toyCobble(suv);
  #else
    if (style < 1.0) {
      col *= toyTile(sp);
    } else if (style < 2.0) {
      // Grass cap plus a lip a little way down the sides; tan dirt below.
      bool lip = (vToyTop - vToyPos.y) < 0.45;
      if (isTop || lip) col = uGrass * (isTop ? 1.0 : 0.88);
      col *= toyTile(sp);
    } else if (style < 3.0) {
      if (!isTop) {
        vec2 cell = vec2(suv.x / 2.2, (vToyPos.y - 0.6) / 2.6);
        vec2 f = fract(cell);
        float win = step(0.18, f.x) * step(f.x, 0.82) * step(0.22, f.y) * step(f.y, 0.86);
        float frame = step(0.12, f.x) * step(f.x, 0.88) * step(0.16, f.y) * step(f.y, 0.92);
        float lowest = step(0.0, vToyPos.y - 0.6);
        col = mix(col, vec3(0.97), frame * lowest);
        col = mix(col, vec3(0.42, 0.78, 1.0) * (0.9 + 0.2 * f.y), win * lowest);
      }
      col *= toyTile(sp * 0.5);
    } else if (style < 4.0) {
      col *= toyPlate(suv * 0.9);
    } else if (style < 5.0) {
      // Smooth: no pattern.
    } else if (style < 6.0) {
      totalEmissiveRadiance += col * 0.75;
    } else if (style < 7.0) {
      float band = step(0.5, fract(vToyPos.y * 0.5));
      col = mix(col, vec3(1.0), band);
      col *= toyTile(sp);
    } else if (style < 8.0) {
      vec2 cell = floor(suv * 0.8);
      vec2 f = fract(suv * 0.8) - 0.5;
      float crack = 1.0 - smoothstep(0.03, 0.09, min(abs(f.x), abs(f.y)) + toyHash(cell) * 0.04);
      // The instance colour is the glow; the crust is a dark, mottled version of it.
      vec3 crust = col * (0.16 + 0.12 * toyHash(cell));
      vec3 glow = min(col * 1.2, vec3(1.0));
      col = mix(crust, glow, crack);
      totalEmissiveRadiance += glow * crack * 0.9;
    } else if (style < 9.0) {
      vec3 rainbow = toyHue(fract((vToyPos.x + vToyPos.z + vToyPos.y) * 0.04));
      col = mix(rainbow, vec3(1.0), 0.25);
      col *= toyTile(sp);
      totalEmissiveRadiance += col * 0.35;
    } else if (style < 10.0) {
      vec2 cell = floor(suv * 1.5);
      float star = step(0.93, toyHash(cell));
      vec2 f = fract(suv * 1.5) - 0.5;
      star *= 1.0 - smoothstep(0.05, 0.15, length(f));
      col = mix(col, vec3(1.0), star);
      totalEmissiveRadiance += col * 0.35 + star * 0.6;
    } else if (style < 11.0) {
      col *= 0.94 + 0.06 * toyHash(floor(suv * 3.0));
    } else if (style < 12.0) {
      // Water: streaks falling down the sides, ripples on top.
      float lane = floor(suv.x * 2.0);
      float fall = fract(vToyPos.y * 0.35 + uTime * (1.2 + toyHash(vec2(lane, 1.0)) * 0.6) + toyHash(vec2(lane, 7.0)));
      float streak = isTop ? 0.5 + 0.5 * sin(vToyPos.x * 2.0 + vToyPos.z * 1.3 + uTime * 3.0) : smoothstep(0.7, 1.0, fall);
      col = mix(col, vec3(0.92, 0.98, 1.0), streak * 0.65);
      totalEmissiveRadiance += col * 0.25;
    } else if (style < 13.0) {
      if (isTop) {
        // Belt: ribs running east under the runner's feet.
        vec2 bw = fwidth(vToyPos.xz);
        float rib = smoothstep(0.72, 0.86, fract(vToyPos.x * 1.6 - uTime * 2.4));
        col = mix(col, col * 2.4 + vec3(0.07), rib * 0.8 * (1.0 - smoothstep(0.15, 0.4, bw.x)));
      }
    } else if (style < 14.0) {
      col *= toyBlock(suv * 0.62);
      // A band of light along the top edge of each block.
      if (!isTop && vToyDepth < 0.14) col *= 1.16;
    } else if (style < 15.0) {
      if (isTop || vToyDepth < 0.55) col = uGrass * (isTop ? 1.0 : 0.86);
      col *= toyBlock(suv * 0.62);
    } else if (style < 16.0) {
      col *= toyFloor(suv / 2.25);
    }
  #ifdef TOY_ROAD
    else if (style < 17.0) {
      // Cracked asphalt: grain, a web of dark cracks, the odd pothole and patched square.
      vec2 w = fwidth(suv);
      float far = smoothstep(0.08, 0.3, max(w.x, w.y));
      col *= 0.93 + 0.07 * toyHash(floor(suv * 3.0));
      col *= 1.0 + 0.1 * step(0.82, toyHash(floor(suv * 0.22) + 11.0));
      float web = abs(toyNoise(suv * 0.9) + toyNoise(suv * 2.1 + 4.0) * 0.5 - 0.75);
      col *= 1.0 - (1.0 - smoothstep(0.004, 0.014, web)) * 0.45 * (1.0 - far);
      vec2 pc = floor(suv * 0.14);
      vec2 jitter = vec2(toyHash(pc + 3.0), toyHash(pc + 5.0)) - 0.5;
      float hole = step(0.7, toyHash(pc)) * (1.0 - smoothstep(0.14, 0.19, length(fract(suv * 0.14) - 0.5 + jitter * 0.4)));
      col *= 1.0 - hole * 0.5;
    }
  #endif
  #if defined(TOY_ROAD) || defined(TOY_TOWN)
    else if (style < 18.0) {
      // Dirt: blotches and pebbles; on a road's floor, two darker tyre ruts.
      col *= 0.85 + 0.25 * toyNoise(suv * 0.8);
      col = mix(col, col * 1.3 + 0.05, step(0.93, toyHash(floor(suv * 5.0))) * 0.7);
      if (isTop) col *= 1.0 - 0.18 * (1.0 - smoothstep(0.2, 0.75, abs(abs(vToyPos.x) - 1.65)));
    }
  #endif
  #ifdef TOY_ROAD
    else if (style < 19.0) {
      // Corrugated metal: ribs up every side, a little rust streaking down.
      if (!isTop) {
        float along = an.x > 0.5 ? vToyPos.z : vToyPos.x;
        col *= 0.76 + 0.24 * smoothstep(0.1, 0.7, abs(fract(along * 1.6) - 0.5) * 2.0);
        col = mix(col, vec3(0.45, 0.24, 0.12), smoothstep(0.62, 0.9, toyNoise(vec2(along * 3.0, vToyPos.y * 0.4))) * 0.45);
      }
    } else if (style < 20.0) {
      // Rust: the colour eaten through in orange-brown blotches, flecked darker.
      float n = toyNoise(suv * 1.7) * 0.7 + toyNoise(suv * 5.0) * 0.3;
      vec3 rust = mix(vec3(0.62, 0.3, 0.12), vec3(0.36, 0.17, 0.08), toyHash(floor(suv * 9.0)));
      col = mix(col, rust, smoothstep(0.42, 0.6, n));
    }
  #endif
  #ifdef TOY_TOWN
    else if (style < 21.0) {
      col *= toyCobble(suv);
    } else if (style < 22.0) {
      // Bricks: running bond in pale mortar, each brick its own shade.
      vec2 p = vec2(suv.x * 2.2, (an.y > 0.5 ? suv.y : vToyPos.y) * 4.4);
      float row = floor(p.y);
      p.x += mod(row, 2.0) * 0.5;
      vec2 f = fract(p);
      vec2 w = fwidth(p);
      float aa = max(max(w.x, w.y), 1e-4);
      float mortar = max(1.0 - smoothstep(0.06 - aa, 0.06 + aa, f.x), 1.0 - smoothstep(0.1 - aa, 0.1 + aa, f.y));
      float tint = 0.86 + 0.24 * toyHash(floor(p));
      col = mix(col * tint, vec3(0.86, 0.82, 0.76), mortar * (1.0 - smoothstep(0.2, 0.5, aa)));
    } else if (style < 23.0) {
      // A plastered house front: per storey, windows in white frames with shutters
      // either side; on the ground floor, wider shop windows. Bare on top.
      if (!isTop) {
        float storey = 3.2;
        float level = floor(vToyPos.y / storey);
        vec2 cell = vec2(suv.x / (level < 1.0 ? 3.6 : 2.8), fract(vToyPos.y / storey));
        vec2 f = vec2(fract(cell.x), cell.y);
        float halfW = level < 1.0 ? 0.3 : 0.18;
        float x = abs(f.x - 0.5);
        float frame = step(x, halfW + 0.04) * step(0.2, f.y) * step(f.y, 0.86);
        float glass = step(x, halfW) * step(0.24, f.y) * step(f.y, 0.82);
        float shutter = step(halfW + 0.05, x) * step(x, halfW + 0.15) * step(0.24, f.y) * step(f.y, 0.82) * step(1.0, level);
        float sill = step(x, halfW + 0.07) * step(0.17, f.y) * step(f.y, 0.21);
        col *= 0.95 + 0.08 * toyNoise(suv * 1.5);
        col = mix(col, col * 0.5 + vec3(0.06, 0.12, 0.08), shutter);
        col = mix(col, vec3(0.95, 0.93, 0.88), max(frame, sill));
        vec3 pane = mix(vec3(0.16, 0.24, 0.34), vec3(0.5, 0.66, 0.8), smoothstep(0.3, 0.8, f.y));
        float bars = step(abs(f.x - 0.5), 0.012) + step(abs(f.y - 0.53), 0.01);
        col = mix(col, pane, glass * (1.0 - min(bars, 1.0) * 0.8));
      }
    } else if (style < 24.0) {
      // Clay roof tiles: rows down the slope, each tile's end showing.
      float rows = fract(vToyPos.y * 2.6);
      float seam = fract((vToyPos.x + vToyPos.z) * 1.4 + floor(vToyPos.y * 2.6) * 0.5);
      col *= (0.8 + 0.25 * smoothstep(0.0, 0.85, rows)) * (0.9 + 0.1 * smoothstep(0.0, 0.12, seam));
      col *= 0.94 + 0.12 * toyHash(floor(vec2(vToyPos.x + vToyPos.z, vToyPos.y) * vec2(1.4, 2.6)));
    }
  #endif
  #endif

    diffuseColor.rgb = col;
  }
`

/**
 * Which styles each kind of toy material draws: only those its meshes use, so its shader
 * is no bigger than it needs to be - shaders compile while the game loads, and every
 * style is more to compile. The lobby's has the town's (BRICK, TOWNHOUSE, ROOF, COBBLE,
 * DIRT); the road's has the road's (CRACKED, DIRT, CORRUGATED, RUST), compiled in the
 * background once the lobby's up; the ground's is just its cobbles. All have the rest.
 */
const STYLE_SETS = {
  lobby: { TOY_TOWN: '' },
  road: { TOY_ROAD: '' },
  ground: { TOY_GROUND: '' },
}

/**
 * One material per variant (instanced or vertex-coloured, and its `styles`: see
 * STYLE_SETS), shared by every mesh of that kind. Program code is identical across toy
 * materials of a variant, so three compiles it once per variant however many there are.
 *
 * @param {{ instanced?: boolean, vertexColors?: boolean, map?: import('three').Texture,
 *           studScale?: number, styles?: 'lobby' | 'road' | 'ground' }} [options]
 *   `studScale` is studs per world unit. Non-instanced meshes default to vertex colours.
 */
export function createToyMaterial({
  instanced = true,
  vertexColors = !instanced,
  map = null,
  studScale = 2,
  styles = 'lobby',
} = {}) {
  const material = new MeshLambertMaterial({ color: 0xffffff, vertexColors, map })
  material.defines = { ...STYLE_SETS[styles] }

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uStudScale = { value: studScale }
    shader.uniforms.uTime = toyTime
    shader.uniforms.uGrass = { value: GRASS_COLOR }
    material.userData.shader = shader

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${vertexHead}`)
      .replace('#include <project_vertex>', `#include <project_vertex>\n${vertexBody}`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${fragmentHead}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${fragmentBody}`)
  }
  // The stud scale is a uniform, so materials differing only in it share a program.
  material.customProgramCacheKey = () => `toy-v6-${styles}`
  return material
}

/**
 * The shared toy materials: instanced, with vertex colours and instance colours.
 * Everything toy-styled in the lobby - blocks, props, pets, arrows, trophies, other
 * players, confetti - is drawn as instances through `toy`, so it compiles to a single
 * shader program however many systems use it; the road up the mountain through `roads`,
 * its own program with the road's styles, compiled when the road first loads. (The
 * ground, which needs a texture map, has its own variant too.)
 *
 * Created lazily; `blocks` and `props` are `toy` under the names the systems know it by.
 */
let shared = null
export function sharedMaterials() {
  if (!shared) {
    const toy = createToyMaterial({ instanced: true, vertexColors: true, studScale: 2 })
    const roads = createToyMaterial({ instanced: true, vertexColors: true, studScale: 2, styles: 'road' })
    shared = { toy, blocks: toy, props: toy, roads }
  }
  return shared
}
