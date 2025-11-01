export const scheduleSeed = () => ({
  officeDays: [2, 4],
  overrides: [], // none initially
  skincareCycleDays: 3,
  skincareStartDate: new Date().toISOString().slice(0, 10), // YYYY-MM-DD
  commute: { from: "Lidcombe", to: "Bondi Junction", lines: ["T2", "T3", "T4"] },
  medicationTimes: {
    office: ["08:00", "23:00"],
    home: ["10:00", "16:00", "23:00"],
  },
  weatherThresholds: { tempDelta: 5, uvHigh: 8 },
})

export const routinesSeed = [
  {
    type: "officeMorning",
    steps: [
      "Estrogel",
      "Cleanser",
      "Vitamin C serum",
      "Coffee",
      "Moisturiser & Sunscreen",
      "Minoxidil",
      "Perfume",
    ],
  },
  { type: "homeMorning", steps: ["Estrogel", "Cleanser", "Vitamin C serum"] },
  { type: "skincare", day: 1, steps: ["Cleanser", "BHA", "Moisturiser"] },
  { type: "skincare", day: 2, steps: ["Cleanser", "Tretinoin", "Moisturiser"] },
  { type: "skincare", day: 3, steps: ["Cleanser", "Vitamin C", "Moisturiser"] },
]

export const profileSeed = { steamId: "", psnId: "", xboxGamertag: "" }
