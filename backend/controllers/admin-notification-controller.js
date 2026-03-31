const Notification = require('../models/notificationSchema.js');
const Student = require('../models/studentSchema.js');
const Teacher = require('../models/teacherSchema.js');
const Parent = require('../models/parentSchema.js');
const { createNotifications } = require('./notification-controller.js');

/**
 * Resolve recipient user IDs based on recipientType and schoolId.
 * Returns an array of ObjectId strings.
 */
async function resolveRecipients(recipientType, schoolId, classId) {
    const schoolQuery = { $or: [{ schoolId }, { school: schoolId }] };

    switch (recipientType) {
        case 'All': {
            const [students, teachers, parents] = await Promise.all([
                Student.find(schoolQuery, '_id').lean(),
                Teacher.find(schoolQuery, '_id').lean(),
                Parent.find({ school: schoolId }, '_id').lean(),
            ]);
            return [
                ...students.map(s => s._id),
                ...teachers.map(t => t._id),
                ...parents.map(p => p._id),
            ];
        }
        case 'Students': {
            const query = classId
                ? { $or: [{ classId }, { sclassName: classId }], ...schoolQuery }
                : schoolQuery;
            const students = await Student.find(query, '_id').lean();
            return students.map(s => s._id);
        }
        case 'Teachers': {
            const teachers = await Teacher.find(schoolQuery, '_id').lean();
            return teachers.map(t => t._id);
        }
        case 'Parents': {
            const parents = await Parent.find({ school: schoolId }, '_id').lean();
            return parents.map(p => p._id);
        }
        case 'Class': {
            if (!classId) return [];
            const students = await Student.find(
                { $or: [{ classId }, { sclassName: classId }], ...schoolQuery },
                '_id'
            ).lean();
            return students.map(s => s._id);
        }
        default:
            return [];
    }
}

// POST /Admin/notifications/send
// Body: { title, message, recipientType, classId?, scheduledAt?, schoolId }
const sendNotification = async (req, res) => {
    try {
        const { title, message, recipientType, classId, schoolId } = req.body;

        if (!title || !message || !recipientType || !schoolId) {
            return res.status(400).json({ message: 'title, message, recipientType, and schoolId are required' });
        }

        const validTypes = ['All', 'Students', 'Teachers', 'Parents', 'Class'];
        if (!validTypes.includes(recipientType)) {
            return res.status(400).json({ message: `recipientType must be one of: ${validTypes.join(', ')}` });
        }

        if (recipientType === 'Class' && !classId) {
            return res.status(400).json({ message: 'classId is required when recipientType is "Class"' });
        }

        const recipientIds = await resolveRecipients(recipientType, schoolId, classId);

        if (recipientIds.length === 0) {
            return res.status(200).json({ message: 'Notifications sent', count: 0 });
        }

        // Build the combined message string (title + body)
        const fullMessage = `${title}: ${message}`;

        await createNotifications(recipientIds, fullMessage, 'feedback');

        return res.status(201).json({ message: 'Notifications sent', count: recipientIds.length });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

// GET /Admin/notifications/sent/:schoolId
// Returns notifications sent to users of this school, grouped by message content
const getSentNotifications = async (req, res) => {
    try {
        const { schoolId } = req.params;

        // Gather all user IDs belonging to this school
        const schoolQuery = { $or: [{ schoolId }, { school: schoolId }] };
        const [students, teachers, parents] = await Promise.all([
            Student.find(schoolQuery, '_id').lean(),
            Teacher.find(schoolQuery, '_id').lean(),
            Parent.find({ school: schoolId }, '_id').lean(),
        ]);

        const userIds = [
            ...students.map(s => s._id),
            ...teachers.map(t => t._id),
            ...parents.map(p => p._id),
        ];

        if (userIds.length === 0) {
            return res.status(200).json([]);
        }

        // Aggregate notifications for these users, grouped by message
        const grouped = await Notification.aggregate([
            { $match: { userId: { $in: userIds } } },
            {
                $group: {
                    _id: '$message',
                    notificationId: { $first: '$_id' },
                    message: { $first: '$message' },
                    type: { $first: '$type' },
                    createdAt: { $first: '$createdAt' },
                    totalRecipients: { $sum: 1 },
                    readCount: { $sum: { $cond: ['$readStatus', 1, 0] } },
                },
            },
            { $sort: { createdAt: -1 } },
        ]);

        return res.status(200).json(grouped);
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

// DELETE /Admin/notifications/:id
const deleteNotification = async (req, res) => {
    try {
        const deleted = await Notification.findByIdAndDelete(req.params.id);
        if (!deleted) {
            return res.status(404).json({ message: 'Notification not found' });
        }
        return res.status(200).json({ message: 'Notification deleted' });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

module.exports = { sendNotification, getSentNotifications, deleteNotification };
