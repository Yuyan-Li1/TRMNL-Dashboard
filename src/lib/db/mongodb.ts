import mongoose from "mongoose";

declare global {
	// eslint-disable-next-line no-var
	var mongooseConnection: {
		conn: typeof mongoose | null;
		promise: Promise<typeof mongoose> | null;
	};
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
export async function connectToDatabase(): Promise<typeof mongoose> {
	const uri = process.env.MONGODB_URI;
	if (!uri) {
		throw new Error("Please define the MONGODB_URI environment variable");
	}

	let cached = global.mongooseConnection;
	if (!cached) {
		cached = global.mongooseConnection = { conn: null, promise: null };
	}

	if (cached.conn) {
		return cached.conn;
	}

	if (!cached.promise) {
		cached.promise = mongoose.connect(uri, {
			bufferCommands: false,
			maxPoolSize: 10,
		});
	}

	try {
		cached.conn = await cached.promise;
	} catch (e) {
		cached.promise = null;
		throw e;
	}

	return cached.conn;
}

export default connectToDatabase;
