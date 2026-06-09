// unlock types: "default" | "purchase" | "stage"
const AVATAR_CATALOG = [
  { id: "avatar",     unlockType: "default",  stageRequired: 0,  price: 0  },
  { id: "boy",        unlockType: "purchase", stageRequired: 0,  price: 50 },
  { id: "girl",       unlockType: "purchase", stageRequired: 0,  price: 50 },
  { id: "cat",        unlockType: "purchase", stageRequired: 0,  price: 60 },
  { id: "colorfully", unlockType: "stage",    stageRequired: 5,  price: 0  },
  { id: "dinosaur",   unlockType: "purchase", stageRequired: 0,  price: 80 },
  { id: "alien",      unlockType: "stage",    stageRequired: 10, price: 0  },
  { id: "mexican",    unlockType: "purchase", stageRequired: 0,  price: 80 },
  { id: "superman",   unlockType: "purchase", stageRequired: 0,  price: 50 },
];

const AVATAR_MAP = Object.fromEntries(AVATAR_CATALOG.map(a => [a.id, a]));

module.exports = { AVATAR_CATALOG, AVATAR_MAP };
