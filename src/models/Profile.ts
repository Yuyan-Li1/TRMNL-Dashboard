import { Schema, model, models } from "mongoose";

const steamId = process.env.STEAM_ID;
const psnId = process.env.PSN_ID;
const xboxGamertag = process.env.XBOX_GAMERTAG;

const ProfileSchema = new Schema({
  steamId: { type: String, default: steamId ?? "" },
  psnId: { type: String, default: psnId ?? "" },
  xboxGamertag: { type: String, default: xboxGamertag ?? "" },
}, { timestamps: true });

export default models.Profile || model("Profile", ProfileSchema);