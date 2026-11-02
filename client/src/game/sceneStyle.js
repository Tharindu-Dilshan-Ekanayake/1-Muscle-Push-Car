/**
 * The scene's whole look in one place: a bright toy-brick world with a saturated blue
 * sky, an old town square of warm cobbles with brick-walled gardens, old houses round
 * it, grey voxel mountains behind and terracotta cliffs either side of the road.
 *
 * Colours are sRGB hex, exactly as you would pick them in an image editor.
 *
 * Light intensities are three.js physical units: a light of intensity PI (~3.14)
 * lights a surface facing it to its full texture colour. The hemisphere fill plus the
 * sun add up to just over that on the ground, which is what keeps the colours vivid;
 * shadowed ground only gets the fill, so shadows read as a softer, darker shade.
 */

export const SKY = {
  /** Straight up. */
  top: '#2f8ff2',
  /** At eye level. Fog uses the same colour so distant ground melts into the sky. */
  horizon: '#a6d6fb',
  /** Lower = the deep blue reaches further down towards the horizon. */
  exponent: 0.35,
}

export const FOG = {
  color: SKY.horizon,
}

export const CLOUDS = {
  /** Sunlit tops. */
  top: '#ffffff',
  /** Undersides, a cool blue-grey. */
  bottom: '#d6e5f5',
}

/** Every surface colour in the lobby. */
export const PALETTE = {
  /** The square's cobbles, warm sandstone. */
  plaza: '#dccaa4',
  /** Main Street's darker cobbles, and the pavements round the square's edge. */
  street: '#9c9184',
  pavement: '#c8b898',
  /** The gardens' low brick walls, and their grass. */
  curb: '#b4644a',
  curbEdge: '#a89878',
  lawn: '#5cc044',
  /** Paved aprons under the gyms, the push zone and the eggs, and their edging. */
  apron: '#e6d8b8',
  apronEdge: '#b8a684',
  shopFloor: '#c4b496',
  /** Grey voxel mountains, and the terracotta cliffs either side of the track. */
  rock: ['#9a9fa6', '#8a8f96', '#a9adb2'],
  cliff: '#c4774a',
  trunk: '#7c4d29',
  leaves: ['#2fc53a', '#3ad646', '#27b134'],
  white: '#f4f7fb',
  water: '#4cc3ff',
}

export const LIGHTS = {
  /** Fill from above (sky) and below (bounce off the grass). */
  hemiSky: '#ffffff',
  hemiGround: '#b9cba6',
  hemiIntensity: 2.1,

  sunColor: '#fff6e8',
  sunIntensity: 1.65,
  /**
   * Direction *towards* the sun: high and a little to the left, behind the default
   * camera, so the side of the character you look at is lit and its shadow falls
   * beside it where you can see it, not hidden behind its back.
   */
  sunDirection: [-0.35, 0.9, 0.25],
  /** 1 = shadows get no sunlight at all; lower = lighter shadows. */
  shadowIntensity: 0.7,
  /** Blur radius of shadow edges, in shadow-map texels. */
  shadowSoftness: 3,
}
