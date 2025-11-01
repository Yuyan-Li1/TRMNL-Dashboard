import { resolve } from "node:path"
import { config } from "dotenv"
import mongoose from "mongoose"

// Load .env.local if not already loaded (useful for standalone scripts)
if (!process.env.MONGODB_URI) {
  config({ path: resolve(process.cwd(), ".env.local") })
}

const MONGODB_URI = process.env.MONGODB_URI
if (!MONGODB_URI) {
  throw new Error("MONGODB_URI not set")
}

declare global {
  var __mongooseConn: Promise<typeof mongoose> | undefined
}

export async function connectToDB() {
  if (!global.__mongooseConn) {
    if (!MONGODB_URI) {
      throw new Error("MONGODB_URI not set")
    }
    global.__mongooseConn = mongoose.connect(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    })
  }
  return global.__mongooseConn
}
