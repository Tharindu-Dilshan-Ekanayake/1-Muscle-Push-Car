/**
 * Every tunable number in the game. Rules live in logic.js; this file is only data,
 * so balancing never means touching code.
 *
 * Shared by client (display) and server (authority): both always agree on costs and
 * multipliers because they read the same table.
 */

// --- Muscle and levels ----------------------------------------------------------------

/** Muscle one lift (click) is worth before any multiplier: the "+1". */
export const BASE_GAIN = 1
/** Lifts the server accepts per second, and how many can be banked for a burst. */
export const MAX_LIFTS_PER_SECOND = 9
export const LIFT_BURST = 12
/** Seconds between the automatic lifts you do standing in a Train Zone. */
export const TRAIN_INTERVAL = 0.8

/**
 * Your level comes from your Muscle. Level L needs LEVEL_FIRST * LEVEL_GROWTH^(L-1)
 * more Muscle than the one before (15, 19, 23, 29, 36 ... as in the reference), so
 * reaching level L takes muscleForLevel(L) in all.
 */
export const LEVEL_FIRST = 15
export const LEVEL_GROWTH = 1.25
export const muscleForLevel = (level) =>
  level <= 1 ? 0 : Math.round((LEVEL_FIRST * (LEVEL_GROWTH ** (level - 1) - 1)) / (LEVEL_GROWTH - 1))

// --- Rebirth ----------------------------------------------------------------------

/** The level you must reach to rebirth: R0 = 5, R1 = 10, R2 = 20, R3 = 30, then +10 per rebirth. */
export const levelCap = (rebirths) => (rebirths <= 0 ? 5 : 10 * rebirths)

/** Muscle multiplier from rebirths: R0 = x1, R1 = x1.5, R2 = x2 ... */
export const rebirthMultiplier = (rebirths) => 1 + 0.5 * Math.max(0, rebirths)

/**
 * Walking speed (m/s): a little quicker with every level you've ever reached - a rebirth
 * puts your level back to 1 but keeps the levels behind it, so you never slow down - up
 * to a top speed safely under the server's MAX_MOVE_SPEED (world.js).
 */
export function walkSpeed(level = 1, rebirths = 0) {
  let levels = Math.max(0, level - 1)
  for (let k = 0; k < rebirths && levels < 40; k += 1) levels += levelCap(k)
  return Math.min(13.5, 10 + 0.1 * levels)
}

/** Skipping straight to a rebirth costs this many max-level pushes' worth of Wins. */
export const REBIRTH_SKIP_RUNS = 8

// --- Train Zones ------------------------------------------------------------------

/**
 * The gym pads along the west side, south to north in world.js order. Standing on one
 * you lift automatically every TRAIN_INTERVAL, and every lift there (clicks too) is
 * worth `mult` times more. `rebirths` = rebirths needed; `product` = the SHOP pass that
 * unlocks it instead.
 */
export const TRAIN_ZONES = [
  { id: 'starter', name: 'Starter Gym', mult: 1, rebirths: 0 },
  { id: 'iron', name: 'Iron Gym', mult: 2, rebirths: 1 },
  { id: 'pro', name: 'Pro Gym', mult: 5, rebirths: 3 },
  { id: 'gold', name: 'Golden Gym', mult: 8, rebirths: 5 },
  { id: 'lava', name: 'Lava Gym', mult: 15, rebirths: 8 },
  { id: 'frost', name: 'Frost Gym', mult: 30, product: 'zoneVeryOp', tag: 'VERY OP!' },
  { id: 'galaxy', name: 'Galaxy Gym', mult: 60, product: 'zoneBest', tag: 'BEST OVERALL!' },
]

// --- Dumbbells --------------------------------------------------------------------

/**
 * What you lift with. `power` is the Muscle each lift gives before multipliers; `cost`
 * is in Wins. Bought in order from the dumbbell shop.
 *
 * Prices go with the stages (World 1's thirteen, then Mega City's seven): from the
 * Emerald on, each dumbbell costs two or three climbs to the stage it goes with, paid in
 * the Wins that stage's pad gives with the boosts a player has by then - so every new
 * stage pays for about one new dumbbell. Mega City's cost more again, since its Wins
 * stack up so fast.
 */
export const DUMBBELLS = [
  { id: 'wood', name: 'Wooden Dumbbell', power: 1, cost: 0 },
  // Cheap enough for the Wins from your very first push.
  { id: 'iron', name: 'Iron Dumbbell', power: 2, cost: 3 },
  { id: 'steel', name: 'Steel Dumbbell', power: 3, cost: 20 },
  { id: 'copper', name: 'Copper Dumbbell', power: 5, cost: 60 },
  { id: 'ruby', name: 'Ruby Dumbbell', power: 8, cost: 150 },
  { id: 'emerald', name: 'Emerald Dumbbell', power: 12, cost: 1300 },
  { id: 'sapphire', name: 'Sapphire Dumbbell', power: 18, cost: 2800 },
  { id: 'gold', name: 'Golden Dumbbell', power: 27, cost: 8700 },
  { id: 'frost', name: 'Frost Dumbbell', power: 40, cost: 23000 },
  { id: 'toxic', name: 'Toxic Dumbbell', power: 60, cost: 48000 },
  { id: 'candy', name: 'Candy Dumbbell', power: 90, cost: 220000 },
  { id: 'lava', name: 'Lava Dumbbell', power: 135, cost: 470000 },
  { id: 'thunder', name: 'Thunder Dumbbell', power: 200, cost: 1200000 },
  { id: 'neon', name: 'Neon Dumbbell', power: 300, cost: 2800000 },
  { id: 'angel', name: 'Angel Dumbbell', power: 450, cost: 9000000 },
  { id: 'galaxy', name: 'Galaxy Dumbbell', power: 700, cost: 230000000 },
  { id: 'dragon', name: 'Dragon Dumbbell', power: 1000, cost: 2500000000 },
  { id: 'rainbow', name: 'Rainbow Dumbbell', power: 1500, cost: 75000000000 },
  { id: 'diamond', name: 'Diamond Dumbbell', power: 2300, cost: 1100000000000 },
  { id: 'hell', name: 'HELL DUMBBELL', power: 3500, cost: 15000000000000, tag: 'OP' },
]

// --- The road up the mountain -----------------------------------------------------

/**
 * Everything you push, one per stage: its name, and its footprint in metres - `length`
 * along the road, `width` across it and `height` - which the road, the Wins orbs, the
 * camera and the plaza's collider all go by. They grow stage by stage, from a rusty
 * hatchback in the junkyard to a giant mining truck at the very top. How each one looks
 * is the client's (client/src/game/push/vehicleModels.js).
 */
export const VEHICLES = {
  rustyHatch: { name: 'Rusty Hatchback', length: 4.0, width: 2.0, height: 1.9 },
  oldPickup: { name: 'Old Farm Pickup', length: 5.0, width: 2.2, height: 2.1 },
  threeWheeler: { name: 'Three-Wheeler', length: 3.3, width: 1.7, height: 2.2 },
  brokenVan: { name: 'Broken Minivan', length: 4.8, width: 2.2, height: 2.5 },
  sedan: { name: 'Family Sedan', length: 4.8, width: 2.1, height: 1.75 },
  jeep: { name: 'Desert Jeep', length: 4.4, width: 2.2, height: 2.3 },
  taxi: { name: 'City Taxi', length: 4.8, width: 2.1, height: 2.0 },
  deliveryVan: { name: 'Delivery Van', length: 5.6, width: 2.3, height: 2.9 },
  snowplow: { name: 'Snowplow Truck', length: 6.4, width: 2.6, height: 3.1 },
  schoolBus: { name: 'Old School Bus', length: 8.0, width: 2.5, height: 3.1 },
  boxTruck: { name: 'Box Truck', length: 7.0, width: 2.5, height: 3.4 },
  containerTruck: { name: 'Container Truck', length: 9.0, width: 2.6, height: 3.6 },
  dumpTruck: { name: 'Dump Truck', length: 7.6, width: 2.7, height: 3.6 },
  sportsCar: { name: 'Neon Sports Car', length: 4.6, width: 2.2, height: 1.45 },
  fireTruck: { name: 'Fire Truck', length: 8.4, width: 2.6, height: 3.5 },
  wreckedTanker: { name: 'Wrecked Tanker', length: 9.0, width: 2.7, height: 3.5 },
  cementMixer: { name: 'Cement Mixer', length: 8.0, width: 2.6, height: 3.8 },
  monsterTruck: { name: 'Monster Truck', length: 6.0, width: 3.0, height: 4.2 },
  goldLimo: { name: 'Golden Limo', length: 9.0, width: 2.4, height: 1.9 },
  haulTruck: { name: 'Giant Mining Truck', length: 11.0, width: 3.3, height: 5.2 },
}

/** The vehicle pushed up stage `stage` (a WORLDS stage): its VEHICLES entry. */
export const vehicleOf = (stage) => VEHICLES[stage.vehicle]

/**
 * The worlds, each with its own road up the mountain: World 1, and Mega City through
 * the portal (WORLD_PORTALS), which takes `wins` Wins to step into the first time.
 *
 * A world's stages run bottom to top: each a slope `length` metres long with its own
 * vehicle (`vehicle`, a VEHICLES id), and between one stage and the next a flat
 * SAFEZONE SAFE_LENGTH metres long, where you walk about freely without one. The roads
 * go from a muddy junkyard and cracked old streets to smooth highways and beyond.
 *
 * Each stage is its own push: at the foot of its slope you take its vehicle (E) with
 * all your Muscle as power, and pushing it up drains the power - one for every metre
 * on World 1's first three stages, so `need` (the "Recommended") is exactly what gets you
 * to the top: 20 for the first, 200 for the second, 500 for the third. Past those the
 * vehicles get heavier: 300 m each, but more power to the metre. When the power runs
 * out the vehicle rolls back down and runs you over; reach the SAFEZONE above and your
 * power is back to full for the next one.
 *
 * Wins come only from the WINS pad in the SAFEZONE at the top of each stage, off to the
 * side: walk onto it and it pays the `wins` of every stage you've pushed up this climb,
 * and the climb's over - back to the lobby. Walk past it instead, and the next stage's
 * pad pays for that one too (the last stage's pad is at THE TOP). A stage's `wins` go
 * with how hard it is: half its `need` (a Win for every 2 m on the first three).
 */
export const WORLDS = [
  {
    id: 'earth',
    name: 'World 1',
    stages: [
      { id: 'junkyard', name: 'Junkyard Lane', vehicle: 'rustyHatch', need: 20, length: 20, wins: 10 },
      { id: 'dirt', name: 'Dusty Farm Road', vehicle: 'oldPickup', need: 200, length: 200, wins: 100 },
      { id: 'village', name: 'Village Road', vehicle: 'threeWheeler', need: 500, length: 500, wins: 250 },
      { id: 'cracked', name: 'Broken Old Street', vehicle: 'brokenVan', need: 1000, length: 300, wins: 500 },
      { id: 'country', name: 'Country Road', vehicle: 'sedan', need: 2000, length: 300, wins: 1000 },
      { id: 'desert', name: 'Desert Highway', vehicle: 'jeep', need: 5000, length: 300, wins: 2500 },
      { id: 'city', name: 'Downtown Street', vehicle: 'taxi', need: 10000, length: 300, wins: 5000 },
      { id: 'suburb', name: 'Suburb Avenue', vehicle: 'deliveryVan', need: 20000, length: 300, wins: 10000 },
      { id: 'snow', name: 'Snowy Pass', vehicle: 'snowplow', need: 50000, length: 300, wins: 25000 },
      { id: 'mountain', name: 'Mountain Road', vehicle: 'schoolBus', need: 100000, length: 300, wins: 50000 },
      { id: 'highway', name: 'Super Highway', vehicle: 'boxTruck', need: 200000, length: 300, wins: 100000 },
      { id: 'harbor', name: 'Harbour Docks', vehicle: 'containerTruck', need: 500000, length: 300, wins: 250000 },
      { id: 'quarry', name: 'Rock Quarry', vehicle: 'dumpTruck', need: 2000000, length: 300, wins: 1000000 },
    ],
  },
  {
    id: 'future',
    name: 'Mega City',
    wins: 1400000,
    stages: [
      { id: 'neon', name: 'Neon Boulevard', vehicle: 'sportsCar', need: 5000000, length: 300, wins: 2500000 },
      { id: 'tunnel', name: 'Highway Tunnel', vehicle: 'fireTruck', need: 50000000, length: 300, wins: 25000000 },
      { id: 'wasteland', name: 'Wasteland Road', vehicle: 'wreckedTanker', need: 500000000, length: 300, wins: 250000000 },
      { id: 'construction', name: 'Construction Zone', vehicle: 'cementMixer', need: 5000000000, length: 300, wins: 2500000000 },
      { id: 'arena', name: 'Monster Arena', vehicle: 'monsterTruck', need: 50000000000, length: 300, wins: 25000000000 },
      { id: 'skyway', name: 'Golden Skyway', vehicle: 'goldLimo', need: 500000000000, length: 300, wins: 250000000000 },
      { id: 'mega', name: 'Mega Highway', vehicle: 'haulTruck', need: 5000000000000, length: 300, wins: 2500000000000 },
    ],
  },
]
export const SAFE_LENGTH = 16
/**
 * Wins orbs up every slope: from `from` metres up it to `from` short of its top, a group
 * of `group` orbs `spacing` metres apart every `every` metres, each group on the other
 * side of the track from the last. All of a stage's together are worth `share` of its
 * Wins. Push your vehicle into one and it pays at once - once a climb.
 */
export const ORBS = { from: 6, every: 25, group: 3, spacing: 3, share: 0.2 }

/**
 * The WINS pad in each SAFEZONE: this many metres into it, and this far right of the
 * middle (on the right, as in the reference). Walking onto it pays - or jumping onto
 * it, or anywhere within `slack` of its side (client and server alike, so both see it
 * at the same moment).
 */
export const WIN_PAD = { from: 5, to: 10, minX: 1, maxX: 3.2, slack: 0.8 }
/** In a SAFEZONE, how close to the next vehicle you must be to take it. */
export const GRAB_REACH = 3

/** Where you stand when a push starts: this far before the foot of its stage's slope. */
export const PUSH_START = -2.5
/** How fast you push (m/s), until your power runs out. */
export const PUSH_SPEED = 6.5
/** The server's allowance for push speed, a little over PUSH_SPEED for lag. */
export const PUSH_SPEED_MAX = 9
/** Let go on a slope and the vehicle rolls back down (m/s), as far as the SAFEZONE below. */
export const ROLLBACK_SPEED = 3.2
/** A push with no progress report for this long is ended by the server. */
export const PUSH_TIMEOUT_MS = 30000

// --- Pets & eggs ------------------------------------------------------------------

export const RARITIES = {
  common: { name: 'Common', color: '#b9c3cf', order: 0 },
  uncommon: { name: 'Uncommon', color: '#4ade80', order: 1 },
  rare: { name: 'Rare', color: '#38bdf8', order: 2 },
  epic: { name: 'Epic', color: '#b15cff', order: 3 },
  legendary: { name: 'Legendary', color: '#ffc41f', order: 4 },
  mythic: { name: 'Mythic', color: '#ff3b6b', order: 5 },
  secret: { name: 'Secret', color: '#ff5bd8', order: 6 },
}

/** `mult` multiplies Muscle gains. Equipped pets stack additively (see logic.js). */
export const PETS = {
  cat: { name: 'Cat', rarity: 'common', mult: 1.2 },
  dog: { name: 'Dog', rarity: 'common', mult: 1.3 },
  bunny: { name: 'Bunny', rarity: 'uncommon', mult: 1.5 },
  bear: { name: 'Bear', rarity: 'rare', mult: 2 },
  cow: { name: 'Cow', rarity: 'uncommon', mult: 2.5 },
  parrot: { name: 'Parrot', rarity: 'rare', mult: 3 },
  fox: { name: 'Fox', rarity: 'epic', mult: 4 },
  tiger: { name: 'Tiger', rarity: 'legendary', mult: 6 },
  flamingo: { name: 'Flamingo', rarity: 'uncommon', mult: 8 },
  turtle: { name: 'Turtle', rarity: 'rare', mult: 10 },
  owl: { name: 'Owl', rarity: 'epic', mult: 14 },
  phoenix: { name: 'Phoenix', rarity: 'legendary', mult: 25 },
  pony: { name: 'Pony', rarity: 'rare', mult: 10 },
  unicorn: { name: 'Unicorn', rarity: 'epic', mult: 18 },
  pegasus: { name: 'Pegasus', rarity: 'legendary', mult: 30 },
  imp: { name: 'Imp', rarity: 'rare', mult: 20 },
  bat: { name: 'Bat', rarity: 'epic', mult: 30 },
  demon: { name: 'Demon', rarity: 'legendary', mult: 50 },
  hellhound: { name: 'Hellhound', rarity: 'mythic', mult: 80 },
  dragon: { name: 'Dragon', rarity: 'epic', mult: 6 },
  crab: { name: 'Lucky Crab', rarity: 'uncommon', mult: 1.5 },
  sphinx: { name: 'Sphinx', rarity: 'secret', mult: 150 },
}

/**
 * Eggs, bought with Wins. `pets` are [petId, weight] - weights are percentages and
 * sum to 100.
 */
export const EGGS = {
  basic: { name: 'Basic', cost: { wins: 50 }, pets: [['cat', 45], ['dog', 30], ['bunny', 20], ['bear', 5]] },
  meadow: { name: 'Grass', cost: { wins: 930 }, pets: [['cow', 45], ['parrot', 30], ['fox', 20], ['tiger', 5]] },
  sunset: { name: 'Sunset', cost: { wins: 12000 }, pets: [['flamingo', 45], ['turtle', 30], ['owl', 20], ['phoenix', 5]] },
  unicorn: { name: 'Unicorn', cost: { wins: 560000 }, pets: [['pony', 50], ['unicorn', 35], ['pegasus', 15]] },
  demon: { name: 'Demon', cost: { wins: 12000000000 }, pets: [['imp', 50], ['bat', 30], ['demon', 15], ['hellhound', 5]] },
}

export const MAX_EQUIPPED_PETS = 3
export const MAX_PET_INVENTORY = 60
/** Multi-hatch opens this many at once, for that many times the cost. */
export const MULTI_HATCH = 3

// --- Items, boosts, rewards -------------------------------------------------------

export const POTION_DURATION_MS = 5 * 60 * 1000

export const ITEMS = {
  potionMuscle: { name: 'x2 Muscle Potion', kind: 'potion', boost: 'muscle', durationMs: POTION_DURATION_MS },
  potionWins: { name: 'x2 Wins Potion', kind: 'potion', boost: 'wins', durationMs: POTION_DURATION_MS },
  eggMeadow: { name: 'Grass Egg', kind: 'egg', egg: 'meadow' },
  eggSunset: { name: 'Sunset Egg', kind: 'egg', egg: 'sunset' },
  eggUnicorn: { name: 'Unicorn Egg', kind: 'egg', egg: 'unicorn' },
  eggDemon: { name: 'Demon Egg', kind: 'egg', egg: 'demon' },
}

/** 7-day cycle; day N unlocks N x 24h after the cycle started. */
export const DAILY_INTERVAL_MS = 24 * 60 * 60 * 1000
export const DAILY_REWARDS = [
  { label: 'x2 Wins', icon: 'potionWins', sub: '5m', grant: { item: 'potionWins' } },
  { label: 'Dragon', icon: 'pet:dragon', sub: 'x1', grant: { pet: 'dragon' } },
  { label: 'x2 Muscle', icon: 'potionMuscle', sub: '5m', grant: { item: 'potionMuscle' } },
  { label: 'Unicorn Egg', icon: 'egg:unicorn', sub: 'x1', grant: { item: 'eggUnicorn' } },
  { label: 'x2 Muscle', icon: 'potionMuscle', sub: '5m', grant: { item: 'potionMuscle' } },
  { label: 'x2 Wins', icon: 'potionWins', sub: '5m', grant: { item: 'potionWins' } },
  { label: 'Demon Egg', icon: 'egg:demon', sub: 'x1', grant: { item: 'eggDemon' } },
]

/** Claimable once each per session, after this many minutes played. */
export const PLAYTIME_REWARDS = [
  { minutes: 5, label: '+50 Wins', icon: 'trophy', grant: { wins: 50 } },
  { minutes: 10, label: 'x2 Muscle', icon: 'potionMuscle', grant: { item: 'potionMuscle' } },
  { minutes: 15, label: 'Grass Egg', icon: 'egg:meadow', grant: { item: 'eggMeadow' } },
  { minutes: 30, label: 'x2 Wins', icon: 'potionWins', grant: { item: 'potionWins' } },
  { minutes: 45, label: '+1K Wins', icon: 'trophy', grant: { wins: 1000 } },
  { minutes: 60, label: 'Sunset Egg', icon: 'egg:sunset', grant: { item: 'eggSunset' } },
]

/** The stand by spawn: a pet the first time, a potion on later sessions. */
export const FREE_REWARD = { firstTime: { pet: 'crab' }, repeat: { item: 'potionMuscle' } }

/** Offline training: a quarter of your Train Zone's rate, for up to 8 hours away. */
export const OFFLINE_RATE = 0.25
export const OFFLINE_MAX_MS = 8 * 60 * 60 * 1000
export const OFFLINE_MIN_MS = 60 * 1000

/**
 * The world portals (placed by PORTALS in world.js): the world each takes you to (and
 * back from), its name, and the Wins needed to step through the first time. Stepping
 * through earns the badge of the same id.
 */
export const WORLD_PORTALS = {
  future: { world: 1, name: WORLDS[1].name, wins: WORLDS[1].wins },
}

// --- Auras ------------------------------------------------------------------------

/**
 * Auras: a glow round your character that multiplies the Wins you earn. Bought from the
 * SHOP (`product`); the one you bought last is worn.
 */
export const AURAS = {
  lightning: { name: 'Lightning Aura', wins: 1.25, color: '#7fe0ff', product: 'auraLightning' },
  galaxy: { name: 'Galaxy Aura', wins: 1.5, color: '#b66bff', product: 'auraGalaxy' },
  water: { name: 'Water Aura', wins: 2, color: '#2fb4ff', product: 'auraWater' },
  fire: { name: 'Fire Aura', wins: 3, color: '#ff6a1e', product: 'auraFire' },
  rainbow: { name: 'Rainbow Aura', wins: 5, color: '#ff7ad9', product: 'auraRainbow' },
}

// --- Shop -------------------------------------------------------------------------

/**
 * The shop. Wins are the game's only currency: everything here, like dumbbells and
 * eggs, is bought with them. `pass` = permanent unlock; `consumable` = grants every time.
 * Priced like the dumbbells: a few climbs to the stage each belongs to.
 */
export const SHOP = {
  muscleX2: { name: 'x2 Muscle', price: 3700, kind: 'pass' },
  winsX2: { name: 'x2 Wins', price: 73000, kind: 'pass' },
  muscleX3: { name: 'x3 Muscle', price: 230000000, kind: 'pass' },
  winsX3: { name: 'x3 Wins', price: 2500000000, kind: 'pass' },
  vip: { name: 'VIP', price: 75000000000, kind: 'pass' },
  zoneVeryOp: { name: 'VERY OP! Gym', price: 3300000, kind: 'pass' },
  zoneBest: { name: 'BEST OVERALL! Gym', price: 2500000000, kind: 'pass' },
  auraLightning: { name: 'Lightning Aura', price: 6500, kind: 'pass', aura: 'lightning' },
  auraGalaxy: { name: 'Galaxy Aura', price: 7200000, kind: 'pass', aura: 'galaxy' },
  auraWater: { name: 'Water Aura', price: 1100000000000, kind: 'pass', aura: 'water' },
  auraFire: { name: 'Fire Aura', price: 20000000000000, kind: 'pass', aura: 'fire' },
  auraRainbow: { name: 'Rainbow Aura', price: 750000000000000, kind: 'pass', aura: 'rainbow' },
  potionsMuscle: { name: '3 Muscle Potions', price: 4400, kind: 'consumable', grant: { item: 'potionMuscle', amount: 3 } },
  potionsWins: { name: '3 Wins Potions', price: 12000, kind: 'consumable', grant: { item: 'potionWins', amount: 3 } },
  eggsSunset: { name: '3 Sunset Eggs', price: 30000, kind: 'consumable', grant: { item: 'eggSunset', amount: 3 } },
  eggsUnicorn: { name: '3 Unicorn Eggs', price: 1400000, kind: 'consumable', grant: { item: 'eggUnicorn', amount: 3 } },
  eggsDemon: { name: '3 Demon Eggs', price: 30000000000, kind: 'consumable', grant: { item: 'eggDemon', amount: 3 } },
  sphinx: { name: 'Sphinx', price: 20000000000000, kind: 'consumable', grant: { pet: 'sphinx' }, stock: 1000 },
}

/** Sphinx stock shown before the server reports the live count. */
export const SPHINX_STOCK_DEFAULT = 954

/**
 * The three Muscle packs under the level bar (green, orange, pink, as in the
 * reference). They grow with you: each gives `share` of the Muscle your next level
 * needs, for `runs` max pushes' worth of Wins at that Muscle.
 */
export const MUSCLE_PACKS = [
  { share: 1, runs: 0.6 },
  { share: 6, runs: 3 },
  { share: 25, runs: 10 },
]

// --- Tutorial & badges ------------------------------------------------------------

/**
 * The guide for brand-new players - all of it: train on a bench in the FREE Train Zone
 * until strong enough for the first car, push it up the first stage and take its
 * Wins on the WINS pad (which brings you back to the lobby), and spend them on a
 * dumbbell. After that, no more guides. Each step completes when its event fires (with
 * at least `muscle` Muscle, where given: what the first stage needs).
 */
export const TUTORIAL = [
  { text: 'Sit on a bench in the FREE Train Zone to train!', event: 'train', target: 'zone0', muscle: 20 },
  { text: 'Push the car up the first road!', event: 'cashIn', target: 'push' },
  { text: 'Buy the Iron Dumbbell with your Wins!', event: 'buyDumbbell', target: 'dumbbells' },
]

/**
 * The game's Boxity leaderboards, shown on its Boxity page and behind the trophy button
 * in the game. Ids and settings are permanent once Boxity has seen them (later changes
 * are made in the Boxity dashboard). The client declares them; the server reports the
 * scores, from its own state.
 */
export const BOXITY_BOARDS = [
  { id: 'muscle', label: 'Strongest', order: 'desc', mode: 'best', format: 'compact', reset: 'none' },
  { id: 'rebirths', label: 'Most Rebirths', order: 'desc', mode: 'best', format: 'number', reset: 'weekly' },
  { id: 'wins', label: 'Most Wins', order: 'desc', mode: 'sum', format: 'compact', reset: 'weekly' },
]

export const BADGES = {
  firstPush: { name: 'First Push' },
  firstRebirth: { name: 'First Rebirth' },
  firstPet: { name: 'Pet Owner' },
  frozenPeak: { name: 'Frozen Peak' },
  top: { name: 'Reached the Top' },
  future: { name: 'Time Traveller' },
}
