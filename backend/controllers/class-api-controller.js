/**
 * Class API Controller
 * Routes: POST   /api/class/create
 *         GET    /api/class/all
 *         GET    /api/class/:id
 *         PUT    /api/class/update/:id
 *         DELETE /api/class/delete/:id
 */

const Sclass     = require('../models/sclassSchema.js');
const Subject    = require('../models/subjectSchema.js');
const Student    = require('../models/studentSchema.js');
const Teacher    = require('../models/teacherSchema.js');
const Assignment = require('../models/assignmentSchema.js');
const { logger } = require('../utils/serverLogger.js');

// ── Shared populate helpers ───────────────────────────────────────────────────

// Light: no student population — used for list views
const lightPopulate = (query) =>
    query
        .populate('classTeacher', 'name email')
        .populate('subjects',     'subName subCode sessions teacherId');

// Full: includes students — used for single-class detail
const fullPopulate = (query) =>
    lightPopulate(query)
        .populate('students', 'name rollNum status');

// ── POST /api/class/create ────────────────────────────────────────────────────

const createClass = async (req, res) => {
    try {
        const { className, section, schoolId, classTeacherId, subjectIds, studentIds } = req.body;

        if (!className || !schoolId) {
            return res.status(400).json({ message: 'className and schoolId are required' });
        }

        // Unique className + section per school
        const duplicate = await Sclass.findOne({
            className,
            section: section || '',
            $or: [{ schoolId }, { school: schoolId }],
        });
        if (duplicate) {
            return res.status(409).json({
                message: `Class "${className}${section ? ` (${section})` : ''}" already exists in this school`,
            });
        }

        const sclass = new Sclass({
            className,  sclassName: className,
            section:    section    || '',
            schoolId,   school:     schoolId,
            classTeacher: classTeacherId || null,
            subjects:   subjectIds  || [],
            students:   studentIds  || [],
            status:     'active',
        });
        await sclass.save();

        // Back-link subjects → class
        if (subjectIds?.length) {
            await Subject.updateMany(
                { _id: { $in: subjectIds } },
                { $set: { classId: sclass._id, sclassName: sclass._id } }
            );
        }

        // Back-link students → class
        if (studentIds?.length) {
            await Student.updateMany(
                { _id: { $in: studentIds } },
                { $set: { classId: sclass._id, sclassName: sclass._id } }
            );
        }

        const populated = await fullPopulate(Sclass.findById(sclass._id));
        logger.info(`Class created: ${className}`, { schoolId });
        res.status(201).json({ message: 'Class created successfully', class: populated });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ message: 'A class with this name and section already exists' });
        }
        logger.error('createClass failed', { message: err.message });
        res.status(500).json({ message: err.message });
    }
};

// ── GET /api/class/all  — paginated, student count only ──────────────────────

const getAllClasses = async (req, res) => {
    try {
        const page   = Math.max(1, parseInt(req.query.page)  || 1);
        const limit  = Math.min(50, parseInt(req.query.limit) || 20);
        const skip   = (page - 1) * limit;
        const status = req.query.status || null;

        const filter = {};
        if (req.query.schoolId) {
            filter.$or = [{ schoolId: req.query.schoolId }, { school: req.query.schoolId }];
        }
        if (status) filter.status = status;

        const [classes, total] = await Promise.all([
            lightPopulate(
                Sclass.find(filter)
                    .sort({ className: 1 })
                    .skip(skip)
                    .limit(limit)
                    .select('-students')   // exclude student array — count separately
            ),
            Sclass.countDocuments(filter),
        ]);

        // Attach student counts via aggregation — no document loading
        const classIds = classes.map(c => c._id);
        const counts = await Student.aggregate([
            { $match: { $or: [{ classId: { $in: classIds } }, { sclassName: { $in: classIds } }] } },
            { $group: { _id: '$classId', count: { $sum: 1 } } },
        ]);
        const countMap = {};
        counts.forEach(r => { countMap[String(r._id)] = r.count; });

        const result = classes.map(c => ({
            ...c.toObject(),
            studentCount: countMap[String(c._id)] || 0,
        }));

        res.json({ classes: result, total, page, limit, totalPages: Math.ceil(total / limit) });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ── GET /api/class/:id  — full detail, students paginated ────────────────────

const getClassById = async (req, res) => {
    try {
        const studentPage  = Math.max(1, parseInt(req.query.studentPage)  || 1);
        const studentLimit = Math.min(50, parseInt(req.query.studentLimit) || 20);
        const studentSkip  = (studentPage - 1) * studentLimit;

        // Load class without students first
        const sclass = await lightPopulate(Sclass.findById(req.params.id).select('-students'));
        if (!sclass) return res.status(404).json({ message: 'Class not found' });

        // Load students paginated — only those belonging to this class
        const studentFilter = {
            $or: [{ classId: req.params.id }, { sclassName: req.params.id }],
        };
        const [students, studentTotal] = await Promise.all([
            Student.find(studentFilter, 'name rollNum status')
                .sort({ rollNum: 1 })
                .skip(studentSkip)
                .limit(studentLimit)
                .lean(),
            Student.countDocuments(studentFilter),
        ]);

        // Teachers assigned to this class
        const teachers = await Teacher.find(
            { teachClasses: req.params.id },
            'name email teachSubjects'
        ).populate('teachSubjects', 'subName');

        res.json({
            class: sclass,
            students,
            studentTotal,
            studentPage,
            studentLimit,
            studentTotalPages: Math.ceil(studentTotal / studentLimit),
            teachers,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ── PUT /api/class/update/:id ─────────────────────────────────────────────────

const updateClassById = async (req, res) => {
    try {
        const { className, section, classTeacherId, subjectIds, studentIds, status } = req.body;

        const update = {};
        if (className !== undefined) {
            update.className  = className;
            update.sclassName = className;
        }
        if (section  !== undefined) update.section = section;
        if (status   !== undefined) update.status  = status;

        // classTeacherId: null → clear, string → set, omitted → no change
        if (classTeacherId === null) {
            update.classTeacher = null;
        } else if (classTeacherId) {
            update.classTeacher = classTeacherId;
        }

        if (Array.isArray(subjectIds)) update.subjects = subjectIds;
        if (Array.isArray(studentIds)) update.students = studentIds;

        const sclass = await Sclass.findByIdAndUpdate(
            req.params.id,
            { $set: update },
            { new: true, runValidators: true }
        );
        if (!sclass) return res.status(404).json({ message: 'Class not found' });

        // Sync back-links
        if (Array.isArray(subjectIds)) {
            await Subject.updateMany(
                { _id: { $in: subjectIds } },
                { $set: { classId: sclass._id, sclassName: sclass._id } }
            );
        }
        if (Array.isArray(studentIds)) {
            await Student.updateMany(
                { _id: { $in: studentIds } },
                { $set: { classId: sclass._id, sclassName: sclass._id } }
            );
        }

        const populated = await fullPopulate(Sclass.findById(sclass._id));
        res.json({ message: 'Class updated successfully', class: populated });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ message: 'A class with this name and section already exists' });
        }
        res.status(500).json({ message: err.message });
    }
};

// ── DELETE /api/class/delete/:id ──────────────────────────────────────────────

const deleteClassById = async (req, res) => {
    try {
        const sclass = await Sclass.findById(req.params.id);
        if (!sclass) return res.status(404).json({ message: 'Class not found' });

        // Safety checks — run in parallel
        const [studentCount, assignmentCount] = await Promise.all([
            // Students enrolled via the students array OR via back-reference fields
            Student.countDocuments({
                $or: [
                    { _id: { $in: sclass.students } },
                    { classId:    req.params.id },
                    { sclassName: req.params.id },
                ],
            }),
            // Assignments linked to this class
            Assignment.countDocuments({
                $or: [
                    { sclassName: req.params.id },
                    { classId:    req.params.id },
                ],
            }),
        ]);

        if (studentCount > 0) {
            return res.status(400).json({
                message: `Cannot delete: ${studentCount} student${studentCount > 1 ? 's are' : ' is'} still enrolled in this class. Please reassign or remove them first.`,
                studentCount,
            });
        }

        if (assignmentCount > 0) {
            return res.status(400).json({
                message: `Cannot delete: ${assignmentCount} assignment${assignmentCount > 1 ? 's exist' : ' exists'} for this class. Please delete the assignments first.`,
                assignmentCount,
            });
        }

        await Sclass.findByIdAndDelete(req.params.id);
        logger.info(`Class deleted: ${sclass.className}`, { classId: req.params.id });
        res.json({ message: 'Class deleted successfully', class: sclass });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// getClassTree and checkClassIntegrity are exported below

// ── GET /api/class/:id/tree  — full relationship tree ────────────────────────
// Returns the complete Admin → Class → {Teacher, Subjects, Students} hierarchy
// in a single response. Students are capped at 50 for performance.

const getClassTree = async (req, res) => {
    try {
        const sclass = await Sclass.findById(req.params.id)
            .populate('schoolId',     'schoolName email')
            .populate('classTeacher', 'name email phone teachSubjects teachClasses')
            .populate({
                path:     'subjects',
                select:   'subName subCode sessions topics teacherId',
                populate: { path: 'teacherId', select: 'name email' },
            })
            .select('-students');   // students loaded separately below

        if (!sclass) return res.status(404).json({ message: 'Class not found' });

        // Students — capped at 50, sorted by roll number
        const students = await Student.find(
            { $or: [{ classId: req.params.id }, { sclassName: req.params.id }] },
            'name rollNum status parentName parentPhone'
        ).sort({ rollNum: 1 }).limit(50).lean();

        const studentTotal = await Student.countDocuments({
            $or: [{ classId: req.params.id }, { sclassName: req.params.id }],
        });

        // Teachers who teach this class (via teachClasses array)
        const teachers = await Teacher.find(
            { teachClasses: req.params.id },
            'name email phone teachSubjects teachClasses status'
        ).populate('teachSubjects', 'subName subCode');

        res.json({
            tree: {
                school: sclass.schoolId,
                class: {
                    _id:          sclass._id,
                    className:    sclass.className,
                    sclassName:   sclass.sclassName,
                    section:      sclass.section,
                    status:       sclass.status,
                    classTeacher: sclass.classTeacher,
                    subjects:     sclass.subjects,
                    students: {
                        data:  students,
                        total: studentTotal,
                        note:  studentTotal > 50 ? `Showing 50 of ${studentTotal}. Use /api/class/${req.params.id} with pagination for full list.` : undefined,
                    },
                    teachers,
                },
            },
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ── GET /api/class/:id/integrity  — relationship integrity check ──────────────
// Verifies that all back-references are consistent:
//   • Every student in class.students has classId pointing back to this class
//   • Every subject in class.subjects has classId pointing back to this class
//   • classTeacher has this class in their teachClasses array

const checkClassIntegrity = async (req, res) => {
    try {
        const sclass = await Sclass.findById(req.params.id).lean();
        if (!sclass) return res.status(404).json({ message: 'Class not found' });

        const issues = [];

        // Check students
        if (sclass.students?.length) {
            const orphaned = await Student.find({
                _id: { $in: sclass.students },
                $nor: [{ classId: sclass._id }, { sclassName: sclass._id }],
            }, '_id name').lean();
            if (orphaned.length) {
                issues.push({
                    type: 'student_back_ref_missing',
                    message: `${orphaned.length} student(s) in class.students don't have classId pointing back`,
                    ids: orphaned.map(s => s._id),
                });
            }
        }

        // Check subjects
        if (sclass.subjects?.length) {
            const orphaned = await Subject.find({
                _id: { $in: sclass.subjects },
                $nor: [{ classId: sclass._id }, { sclassName: sclass._id }],
            }, '_id subName').lean();
            if (orphaned.length) {
                issues.push({
                    type: 'subject_back_ref_missing',
                    message: `${orphaned.length} subject(s) in class.subjects don't have classId pointing back`,
                    ids: orphaned.map(s => s._id),
                });
            }
        }

        // Check classTeacher
        if (sclass.classTeacher) {
            const teacher = await Teacher.findById(sclass.classTeacher, 'name teachClasses').lean();
            if (teacher) {
                const hasClass = teacher.teachClasses?.some(c => String(c) === String(sclass._id));
                if (!hasClass) {
                    issues.push({
                        type: 'teacher_class_ref_missing',
                        message: `classTeacher "${teacher.name}" doesn't have this class in their teachClasses array`,
                        teacherId: teacher._id,
                    });
                }
            }
        }

        // Auto-repair if requested
        if (req.query.repair === 'true' && issues.length) {
            // Fix student back-refs
            if (sclass.students?.length) {
                await Student.updateMany(
                    { _id: { $in: sclass.students } },
                    { $set: { classId: sclass._id, sclassName: sclass._id } }
                );
            }
            // Fix subject back-refs
            if (sclass.subjects?.length) {
                await Subject.updateMany(
                    { _id: { $in: sclass.subjects } },
                    { $set: { classId: sclass._id, sclassName: sclass._id } }
                );
            }
            // Fix teacher back-ref
            if (sclass.classTeacher) {
                await Teacher.findByIdAndUpdate(sclass.classTeacher, {
                    $addToSet: { teachClasses: sclass._id },
                });
            }
            return res.json({ status: 'repaired', issuesFixed: issues.length, issues });
        }

        res.json({
            status: issues.length === 0 ? 'ok' : 'issues_found',
            issueCount: issues.length,
            issues,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = {
    createClass, getAllClasses, getClassById, updateClassById, deleteClassById,
    getClassTree, checkClassIntegrity,
};
