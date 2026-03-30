const dotenv = require("dotenv");
const path = require("path");
dotenv.config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const Student = require("../models/studentSchema");

async function diagnose() {
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔍 DIAGNOSTIC REPORT");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    // 1. Check MONGO_URL
    const url = process.env.MONGO_URL;
    console.log("1️⃣  MONGO_URL:", url ? `${url.substring(0, 40)}...` : "❌ NOT SET");

    // 2. Connect
    try {
        await mongoose.connect(url);
        console.log("2️⃣  DB Connection: ✅ Connected\n");
    } catch (err) {
        console.error("2️⃣  DB Connection: ❌ FAILED →", err.message);
        process.exit(1);
    }

    // 3. Count all students
    const total = await Student.countDocuments();
    console.log(`3️⃣  Total students in DB: ${total}`);

    if (total === 0) {
        console.log("\n❌ NO STUDENTS FOUND — run: cd backend && npm run seed\n");
        await mongoose.disconnect();
        process.exit(0);
    }

    // 4. List all students with exact field values
    const students = await Student.find({}, "name rollNum school sclassName");
    console.log("\n4️⃣  Students in DB:");
    students.forEach(s => {
        console.log(`   name: "${s.name}" | rollNum: ${s.rollNum} (type: ${typeof s.rollNum}) | _id: ${s._id}`);
    });

    // 5. Simulate the exact login query
    console.log("\n5️⃣  Simulating login query: rollNum=1, name='Aagnesh Shifak'");
    const byBoth = await Student.findOne({ rollNum: 1, name: "Aagnesh Shifak" });
    console.log("   Result:", byBoth ? `✅ Found → ${byBoth.name}` : "❌ Not found");

    // 6. Try rollNum only
    const byRoll = await Student.findOne({ rollNum: 1 });
    console.log("\n6️⃣  Query rollNum=1 only:", byRoll ? `✅ Found → name="${byRoll.name}"` : "❌ Not found");

    // 7. Try name only
    const byName = await Student.findOne({ name: "Aagnesh Shifak" });
    console.log("7️⃣  Query name='Aagnesh Shifak' only:", byName ? `✅ Found` : "❌ Not found");

    // 8. Try case-insensitive name
    const byNameCI = await Student.findOne({ name: /aagnesh shifak/i });
    console.log("8️⃣  Case-insensitive name search:", byNameCI ? `✅ Found → "${byNameCI.name}"` : "❌ Not found");

    // 9. Show raw first student
    const first = await Student.findOne({});
    console.log("\n9️⃣  Raw first student document:");
    console.log("   name:", JSON.stringify(first.name));
    console.log("   rollNum:", first.rollNum, "(type:", typeof first.rollNum + ")");

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    await mongoose.disconnect();
}

diagnose().catch(err => {
    console.error("❌ Diagnostic failed:", err.message);
    process.exit(1);
});
