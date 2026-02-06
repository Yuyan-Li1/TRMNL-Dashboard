import mongoose, { type Document, type Model, Schema } from "mongoose";
import type { Service, TokenStatus } from "@/types";

// Token health tracking document
export interface ITokenHealth extends Document {
	service: Service;
	status: TokenStatus;
	lastChecked: Date;
	lastSuccess?: Date;
	expiresAt?: Date;
	refreshToken?: string; // For PSN — encrypt before storing (see note below)
	accessToken?: string; // For PSN — encrypt before storing (see note below)
	accessTokenExpiresAt?: Date;
	errorMessage?: string;
	errorCount: number;
	createdAt: Date;
	updatedAt: Date;
}

const TokenHealthSchema = new Schema<ITokenHealth>(
	{
		service: {
			type: String,
			enum: ["psn", "xbox", "steam", "google", "tfnsw"],
			required: true,
			unique: true,
		},
		status: {
			type: String,
			enum: ["healthy", "expiring_soon", "expired", "error"],
			default: "healthy",
		},
		lastChecked: {
			type: Date,
			default: Date.now,
		},
		lastSuccess: Date,
		expiresAt: Date,
		// PSN-specific token storage
		refreshToken: String,
		accessToken: String,
		accessTokenExpiresAt: Date,
		errorMessage: String,
		errorCount: {
			type: Number,
			default: 0,
		},
	},
	{
		timestamps: true,
	},
);

TokenHealthSchema.index({ status: 1 });

// TODO: For production, encrypt refreshToken and accessToken before storage.
// Use crypto.createCipheriv with a secret from env vars (e.g., TOKEN_ENCRYPTION_KEY).
// The current implementation stores them in plaintext for simplicity.

export const TokenHealth: Model<ITokenHealth> =
	mongoose.models.TokenHealth ||
	mongoose.model<ITokenHealth>("TokenHealth", TokenHealthSchema);
