const bcrypt = require('bcrypt');
const Student = require('../models/studentSchema.js');
const Subject = require('../models/subjectSchema.js');
const { createNotifications } = require('./notification-controller');
const { withCache, invalidate } = require('../utils/cache.js');
const { signToken } = require('../middleware/auth.js');

const studentRegister = async (req, res) => {
    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPass = await bcrypt.hash(req.body.password, salt);

        const existingStudent = await Student.findOne({
            rollNum: req.body.rollNum,
            school: req.body.adminID,
            sclassName: req.body.sclassName,
        });

        if (existingStudent) {
            res.send({ message: 'Roll Number already exists' });
        }
        else {
            const student = new Student({
                ...req.body,
                school: req.body.adminID,
                password: hashedPass
            });

            let result = await student.save();

            result.password = undefined;
            invalidate(`students:school:${req.body.adminID || req.body.schoolId}`);
            res.send(result);
        }
    } catch (err) {
        res.status(500).json(err);
    }
};

const studentLogIn = async (req, res) => {
    try {
        const rollNum = Number(req.body.rollNum);
        const studentName = req.body.studentName;

        let student = await Student.findOne({ rollNum, name: studentName });
        if (student) {
            const validated = await bcrypt.compare(req.body.password, student.password);
            if (validated) {
                student = await student.populate("school", "schoolName");
                student = await student.populate("sclassName", "sclassName");
                const token = signToken(student);
                student.password = undefined;
                student.examResult = undefined;
                student.attendance = undefined;
                res.send({ ...student.toObject(), token });
            } else {
                res.send({ message: "Invalid password" });
            }
        } else {
            res.send({ message: "Student not found" });
        }
    } catch (err) {
        res.status(500).json(err);
    }
};

// GET /Students/:id  — cursor-based pagination with .lean()
// Query params: cursor (last _id), limit (default 20), classId, status
const getStudents = async (req, res) => {
    try {
        const schoolQ = { $or: [{ school: req.params.id }, { schoolId: req.params.id }] };
        const limit   = Math.min(parseInt(req.query.limit) || 20, 100);
        const cursor  = req.query.cursor || null;
        const classId = req.query.classId || null;
        const status  = req.query.status  || null;

        const filter = { ...schoolQ };
        if (cursor)  filter._id    = { $gt: cursor };
        if (classId) filter.$or    = [{ classId }, { sclassName: classId }];
        if (status)  filter.status = status;

        // When filtering by class, we can't use the simple schoolQ $or alongside classId $or
        // so rebuild the filter properly
        const baseFilter = cursor ? { _id: { $gt: cursor } } : {};
        if (classId) {
            baseFilter.$and = [
                schoolQ,
                { $or: [{ classId }, { sclassName: classId }] },
            ];
        } else {
            Object.assign(baseFilter, schoolQ);
        }
        if (status) baseFilter.status = status;

        const [students, total] = await Promise.all([
            Student.find(baseFilter)
                .sort({ _id: 1 })
                .limit(limit + 1)
                .select('-password -attendance -examResult -learningFlags -conceptMastery')
                .populate('sclassName', 'sclassName')
                .lean(),
            Student.countDocuments(classId
                ? { $and: [schoolQ, { $or: [{ classId }, { sclassName: classId }] }], ...(status ? { status } : {}) }
                : { ...schoolQ, ...(status ? { status } : {}) }
            ),
        ]);

        const hasMore    = students.length > limit;
        const page       = hasMore ? students.slice(0, limit) : students;
        const nextCursor = hasMore ? String(page[page.length - 1]._id) : null;

        res.json({ students: page, nextCursor, hasMore, total });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const getStudentDetail = async (req, res) => {
    try {
        let student = await Student.findById(req.params.id)
            .populate("school", "schoolName")
            .populate("sclassName", "sclassName")
            .populate("examResult.subjectId", "subName subjectName")
            .populate("attendance.subjectId", "subName subjectName sessions");
        if (student) {
            student.password = undefined;
            res.send(student);
        } else {
            res.send({ message: "No student found" });
        }
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const deleteStudent = async (req, res) => {
    try {
        const result = await Student.findByIdAndDelete(req.params.id);
        if (result) invalidate(`students:school:${result.schoolId || result.school}`);
        res.send(result)
    } catch (error) {
        res.status(500).json(error);
    }
}

const deleteStudents = async (req, res) => {
    try {
        const result = await Student.deleteMany({ school: req.params.id })
        if (result.deletedCount === 0) {
            res.send({ message: "No students found to delete" })
        } else {
            invalidate(`students:school:${req.params.id}`);
            res.send(result)
        }
    } catch (error) {
        res.status(500).json(error);
    }
}

const deleteStudentsByClass = async (req, res) => {
    try {
        const result = await Student.deleteMany({ sclassName: req.params.id })
        if (result.deletedCount === 0) {
            res.send({ message: "No students found to delete" })
        } else {
            res.send(result)
        }
    } catch (error) {
        res.status(500).json(err);
    }
}

const updateStudent = async (req, res) => {
    try {
        if (req.body.password) {
            const salt = await bcrypt.genSalt(10)
            res.body.password = await bcrypt.hash(res.body.password, salt)
        }
        let result = await Student.findByIdAndUpdate(req.params.id,
            { $set: req.body },
            { new: true })

        result.password = undefined;
        res.send(result)
    } catch (error) {
        res.status(500).json(error);
    }
}

const updateExamResult = async (req, res) => {
    const { subName, marksObtained } = req.body;

    try {
        const student = await Student.findById(req.params.id);

        if (!student) {
            return res.send({ message: 'Student not found' });
        }

        const existingResult = student.examResult.find(
            (result) => result.subName.toString() === subName
        );

        if (existingResult) {
            existingResult.marksObtained = marksObtained;
        } else {
            student.examResult.push({ subName, marksObtained });
        }

        const result = await student.save();

        // Notify the student that marks were published
        try {
            await createNotifications(
                [student._id],
                `Your marks have been updated for ${subName}`,
                "marks"
            );
        } catch (_) { /* non-fatal */ }

        return res.send(result);
    } catch (error) {
        res.status(500).json(error);
    }
};

const studentAttendance = async (req, res) => {
    const { subName, status, date } = req.body;

    try {
        const student = await Student.findById(req.params.id);

        if (!student) {
            return res.send({ message: 'Student not found' });
        }

        const subject = await Subject.findById(subName);

        const existingAttendance = student.attendance.find(
            (a) =>
                a.date.toDateString() === new Date(date).toDateString() &&
                a.subName.toString() === subName
        );

        if (existingAttendance) {
            existingAttendance.status = status;
        } else {
            // Check if the student has already attended the maximum number of sessions
            const attendedSessions = student.attendance.filter(
                (a) => a.subName.toString() === subName
            ).length;

            if (attendedSessions >= subject.sessions) {
                return res.send({ message: 'Maximum attendance limit reached' });
            }

            student.attendance.push({ date, status, subName });
        }

        const result = await student.save();
        return res.send(result);
    } catch (error) {
        res.status(500).json(error);
    }
};

const clearAllStudentsAttendanceBySubject = async (req, res) => {
    const subName = req.params.id;

    try {
        const result = await Student.updateMany(
            { 'attendance.subName': subName },
            { $pull: { attendance: { subName } } }
        );
        return res.send(result);
    } catch (error) {
        res.status(500).json(error);
    }
};

const clearAllStudentsAttendance = async (req, res) => {
    const schoolId = req.params.id

    try {
        const result = await Student.updateMany(
            { school: schoolId },
            { $set: { attendance: [] } }
        );

        return res.send(result);
    } catch (error) {
        res.status(500).json(error);
    }
};

const removeStudentAttendanceBySubject = async (req, res) => {
    const studentId = req.params.id;
    const subName = req.body.subId

    try {
        const result = await Student.updateOne(
            { _id: studentId },
            { $pull: { attendance: { subName: subName } } }
        );

        return res.send(result);
    } catch (error) {
        res.status(500).json(error);
    }
};


const removeStudentAttendance = async (req, res) => {
    const studentId = req.params.id;

    try {
        const result = await Student.updateOne(
            { _id: studentId },
            { $set: { attendance: [] } }
        );

        return res.send(result);
    } catch (error) {
        res.status(500).json(error);
    }
};


module.exports = {
    studentRegister,
    studentLogIn,
    getStudents,
    getStudentDetail,
    deleteStudents,
    deleteStudent,
    updateStudent,
    studentAttendance,
    deleteStudentsByClass,
    updateExamResult,

    clearAllStudentsAttendanceBySubject,
    clearAllStudentsAttendance,
    removeStudentAttendanceBySubject,
    removeStudentAttendance,
};