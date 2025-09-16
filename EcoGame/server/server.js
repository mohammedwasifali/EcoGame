import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Leaderboard from './models/Leaderboard.js';
import connectDB from './database/mongodb.js';

dotenv.config();

const app = express();
app.use(cors());
const PORT = 3000;

app.use(express.json());

// GET leaderboard
app.get('/api/leaderboard',async (req, res) => {
    const leaderboard = await Leaderboard.find({}).sort({ total: -1 });
    res.json(leaderboard);
});

// POST new score
app.post('/api/leaderboard', async (req, res) => {
    const { name, total } = req.body;
    if (!name || typeof total !== 'number') {
        return res.status(400).json({ error: 'Invalid data' });
    }
    try {
        const existing = await Leaderboard.findOne({ name: { $regex: `^${name}$`, $options: 'i' } });
        if (existing) {
            existing.total = Math.max(existing.total, total);
            existing.lastPlayed = Date.now();
            await existing.save();
        } else {
            await Leaderboard.create({ name, total, lastPlayed: Date.now() });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.listen(PORT, '0.0.0.0', async () => {
    console.log(`Leaderboard API running on port ${PORT}`);
    await connectDB();
});
