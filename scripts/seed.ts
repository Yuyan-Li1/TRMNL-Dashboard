import { connectToDB } from "@dashboard/lib/db"
import Profile from "@dashboard/models/Profile"
import Routine from "@dashboard/models/Routine"
import Schedule from "@dashboard/models/Schedule"
import { profileSeed, routinesSeed, scheduleSeed } from "./seed-data"

async function main() {
  await connectToDB()

  // Schedule (single doc)
  const sched = scheduleSeed()
  await Schedule.updateOne({}, { $setOnInsert: sched }, { upsert: true })
  console.log("✓ Schedule upserted")

  // Routines (ensure unique type/day combos)
  for (const r of routinesSeed) {
    const query: { type: string; day?: number } = { type: r.type }
    if (r.day) query.day = r.day
    await Routine.updateOne(query, { $setOnInsert: r }, { upsert: true })
  }
  console.log("✓ Routines upserted")

  // Profile (single doc)
  await Profile.updateOne({}, { $setOnInsert: profileSeed }, { upsert: true })
  console.log("✓ Profile upserted")

  console.log("Seed complete.")
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    // biome-ignore lint/suspicious/noConsole: console error
    console.error(e)
    process.exit(1)
  })
