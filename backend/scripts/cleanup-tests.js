require('dotenv').config();
const mongoose = require('mongoose');
const Test = require('../models/testSchema');

const MONGODB_URI = process.env.MONGO_URL || 'mongodb://localhost:27017/edcheck';

async function run() {
    try {
        await mongoose.connect(MONGODB_URI);
        const result = await Test.deleteMany({ title: { $regex: 'Comprehensive' } });
        console.log(`Deleted ${result.deletedCount} old comprehensive tests.`);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
