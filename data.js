export const nounPairs = {
  "Upper Elementary": [
    ["Bridge", "Voice"],
    ["Button", "Storm"],
    ["Spoon", "Thunder"],
    ["Blanket", "Map"],
    ["Crayon", "Echo"],
    ["Shoelace", "River"],
    ["Mailbox", "Dream"],
    ["Window", "Heartbeat"],
    ["Lantern", "Mistake"],
    ["Pocket", "Moon"],
    ["Mirror", "Sand"],
    ["Kite", "Memory"],
    ["Pencil", "Cave"],
    ["Backpack", "Cloud"],
    ["Sock", "Secret"],
    ["Umbrella", "Memory"],
    ["Fence", "Song"],
    ["Staircase", "Wish"],
    ["Marble", "Promise"]
  ],
  "High School": [
    ["Bridge", "Voice"],
    ["Clock", "Ocean"],
    ["Mask", "Weather"],
    ["Cage", "Lullaby"],
    ["Archive", "Lightning"],
    ["Gravity", "Apology"],
    ["Blueprint", "Grief"],
    ["Compass", "Guilt"],
    ["Static", "Truth"],
    ["Border", "Promise"],
    ["Thread", "Argument"],
    ["Key", "Silence"],
    ["Map", "Lie"],
    ["Pillow", "War"],
    ["Language", "Currency"],
    ["Anchor", "Dream"],
    ["Threshold", "Hunger"],
    ["Rust", "Memory"],
    ["Mirror", "Weather"],
    ["River", "Mouth"]
  ]
};

export const levels = ["Upper Elementary", "High School"];

export const levelLabels = {
  "Upper Elementary": "Clear + Concrete",
  "High School": "Layered + Abstract"
};

export const randomNounPools = {
  "Upper Elementary": {
    left: [
      "Bridge",
      "Button",
      "Spoon",
      "Blanket",
      "Crayon",
      "Shoelace",
      "Mailbox",
      "Window",
      "Lantern",
      "Pocket",
      "Mirror",
      "Kite",
      "Pencil",
      "Backpack",
      "Sock",
      "Umbrella",
      "Fence",
      "Staircase",
      "Marble"
    ],
    right: [
      "Voice",
      "Storm",
      "Thunder",
      "Map",
      "Echo",
      "River",
      "Dream",
      "Heartbeat",
      "Mistake",
      "Moon",
      "Sand",
      "Memory",
      "Cave",
      "Cloud",
      "Secret",
      "Song",
      "Wish",
      "Promise"
    ]
  },
  "High School": {
    left: [
      "Bridge",
      "Clock",
      "Mask",
      "Cage",
      "Archive",
      "Gravity",
      "Blueprint",
      "Compass",
      "Static",
      "Border",
      "Thread",
      "Key",
      "Map",
      "Pillow",
      "Language",
      "Anchor",
      "Threshold",
      "Rust",
      "Mirror",
      "River"
    ],
    right: [
      "Voice",
      "Ocean",
      "Weather",
      "Lullaby",
      "Lightning",
      "Apology",
      "Grief",
      "Guilt",
      "Truth",
      "Promise",
      "Argument",
      "Silence",
      "Lie",
      "War",
      "Currency",
      "Dream",
      "Hunger",
      "Memory",
      "Mouth"
    ]
  }
};

export function randomMixedPair(level, currentPair = []) {
  const pool = randomNounPools[level] || randomNounPools["Upper Elementary"];
  const left = pool.left[Math.floor(Math.random() * pool.left.length)];
  let right = pool.right[Math.floor(Math.random() * pool.right.length)];
  if (left === right || (currentPair[0] === left && currentPair[1] === right)) {
    right = pool.right[(pool.right.indexOf(right) + 1) % pool.right.length];
  }
  return [left, right];
}
