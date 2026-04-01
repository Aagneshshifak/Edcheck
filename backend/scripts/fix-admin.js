const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const Admin = require('../models/adminSchema');

async function run() {
    await mongoose.connect(process.env.MONGO_URL);
    const all = await Admin.find({}, '_id email').lean();
    console.log('All admins in DB:');
    all.forEach(a => console.log('  ' + a._id + '  ' + a.email));

    // Keep only admin@school.com
    const keep = await Admin.findOne({ email: 'admin@school.com' });
    if (!keep) { console.log('No admin@school.com found!'); process.exit(1); }

    const deleted = await Admin.deleteMany({ _id: { $ne: keep._id } });
    console.log('Deleted extra admins:', deleted.deletedCount);
    console.log('Single admin _id:', keep._id.toString());
    console.log('Login: admin@school.com / admin123');
    await mongoose.disconnect();
    process.exit(0);
}

run().catch(err => { console.error(err.message); process.exit(1); });
