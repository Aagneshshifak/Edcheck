const XLSX    = require('xlsx');
const bcrypt  = require('bcrypt');
const Student = require('../models/studentSchema');
const Sclass  = require('../models/sclassSchema');
const { logActivity } = require('../utils/activityLogger');
const { invalidate }  = require('../utils/cache');

/**
 * POST /Admin/bulk/students
 * Multipart: file = .xlsx or .csv
 * Body: schoolId, adminName (for activity log)
 *
 * Excel columns (case-insensitive): name, rollnum/roll, class/classname, phone/parentphone, parentname
 */
const bulkUploadStudents = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

        const { schoolId, adminName = 'Admin' } = req.body;
        if (!schoolId) return res.status(400).json({ message: 'schoolId is required' });

        // Parse workbook from buffer
        const wb   = XLSX.read(req.file.buffer, { type: 'buffer' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (!rows.length) return res.status(400).json({ message: 'File is empty or has no data rows' });

        // Fetch all classes for this school to resolve class names → IDs
        const classes = await Sclass.find({
            $or: [{ school: schoolId }, { schoolId }]
        }).lean();
        const classMap = {};
        classes.forEach(c => {
            const key = (c.sclassName || c.className || '').toLowerCase().trim();
            classMap[key] = c._id;
        });

        const results = { created: 0, skipped: 0, errors: [] };

        for (const [i, row] of rows.entries()) {
            const rowNum = i + 2; // 1-indexed + header row
            try {
                // Normalise column names
                const norm = {};
                for (const [k, v] of Object.entries(row)) {
                    norm[k.toLowerCase().replace(/\s+/g, '')] = String(v).trim();
                }

                const name        = norm['name']        || norm['studentname'] || '';
                const rollNum     = parseInt(norm['rollnum'] || norm['roll'] || norm['rollnumber'] || '0');
                const className   = (norm['class'] || norm['classname'] || norm['sclassname'] || '').toLowerCase().trim();
                const parentPhone = norm['phone'] || norm['parentphone'] || norm['parentcontact'] || '';
                const parentName  = norm['parentname'] || norm['parent'] || '';

                if (!name)      { results.errors.push(`Row ${rowNum}: name is required`);     results.skipped++; continue; }
                if (!rollNum)   { results.errors.push(`Row ${rowNum}: valid rollNum required`); results.skipped++; continue; }
                if (!className) { results.errors.push(`Row ${rowNum}: class is required`);     results.skipped++; continue; }

                const classId = classMap[className];
                if (!classId) {
                    results.errors.push(`Row ${rowNum}: class "${className}" not found`);
                    results.skipped++;
                    continue;
                }

                // Skip duplicates
                const exists = await Student.findOne({ rollNum, classId }).lean();
                if (exists) {
                    results.errors.push(`Row ${rowNum}: Roll ${rollNum} already exists in ${className}`);
                    results.skipped++;
                    continue;
                }

                const hashed = await bcrypt.hash(String(rollNum), 10);
                const student = await Student.create({
                    name, rollNum,
                    password: hashed,
                    classId, sclassName: classId,
                    schoolId, school: schoolId,
                    parentName:  parentName  || undefined,
                    parentPhone: parentPhone || undefined,
                    status: 'active',
                });

                await Sclass.findByIdAndUpdate(classId, { $addToSet: { students: student._id } });
                results.created++;
            } catch (e) {
                results.errors.push(`Row ${rowNum}: ${e.message}`);
                results.skipped++;
            }
        }

        invalidate(`students:school:${schoolId}`);

        await logActivity({
            schoolId, actorName: adminName, actorRole: 'Admin',
            action: `bulk uploaded ${results.created} students`,
            targetType: 'student',
            details: `${results.created} created, ${results.skipped} skipped`,
        });

        res.json({
            message: `Bulk upload complete: ${results.created} created, ${results.skipped} skipped`,
            ...results,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { bulkUploadStudents };
