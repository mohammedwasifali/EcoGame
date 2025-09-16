import mongoose from "mongoose";

const leaderboardSchema = new mongoose.Schema({
    name: { type: String, required: true },
    total: { type: Number, required: true },
    lastPlayed: { type: Date, default: Date.now }
});

const Leaderboard = mongoose.model("Leaderboard", leaderboardSchema);

export default Leaderboard;