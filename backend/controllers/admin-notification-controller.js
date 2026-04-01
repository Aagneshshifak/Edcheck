const Notification = require('../models/notificationSchema.js');
const Student = require('../models/studentSchema.js');
const Teacher = require('../models/teacherSchema.js');
const Parent = require('../models/parentSchema.js');
const { createNotifications } = require('./notification-controller.js');
const { logger } = require('../utils/serverLogger.js');

async function resolveRecipients(recipientType, schoolId, classId) {
    const schoolQuery = { $or: [{ schoolId }, { school: schoolId }] };
    switch (recipientType) {
        case 'All': {
            const [students, teachers, parents] = await Promise.all([
                Student.find(schoolQuery, '_id').lean(),
                Teacher.find(schoolQuery, '_id').lean(),
                Parent.find({ school: schoolId }, '_id').lean(),
            ]);
            return [...students, ...teachers, ...parents].map(u => u._id);
        }
        case 'Students': {
            const q = classId ? { $or: [{ classId }, { sclassName: classId }], ...schoolQuery } : schoolQuery;
            return (await Student.find(q, '_id').lean()).map(s => s._id);
        }
        case 'Teachers':
            return (await Teacher.find(schoolQuery, '_id').lean()).map(t => t._id);
        case 'Parents':
            return (await Parent.find({ school: schoolId }, '_id').lean()).map(p => p._id);
        case 'Class': {
            if (!classId) return [];
            const q = { $or: [{ classId }, { sclassName: classId }], ...schoolQuery };
            return (await Student.find(q, '_id').lean()).map(s => s._id);
        }
        default: return [];
    }
}

// GET /Admin/notifications/preview  — recipient count before sending
// Query: recipientType, schoolId, classId?
const previewRecipients = async (req, res) => {
    try {
        const { recipientType, schoolId, classId } = req.query;
        if (!recipientType || !schoolId) return res.status(400).json({ message: 'recipientType and schoolId required' });
        const ids = await resolveRecipients(recipientType, schoolId, classId);
        res.json({ count: ids.length });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// POST /Admin/notifications/send
const sendNotification = async (req, res) => {
    try {
        const { title, message, recipientType, classId, schoolId } = req.body;

        if (!title || !message || !recipientType || !schoolId) {
            return res.status(400).json({ message: 'title, message, recipientType, and schoolId are required' });
        }
        if (!['All', 'Students', 'Teachers', 'Parents', 'Class'].includes(recipientType)) {
            return res.status(400).json({ message: 'Invalid recipientType' });
        }
        if (recipientType === 'Class' && !classId) {
            return res.status(400).json({ message: 'classId is required for Class recipient type' });
        }

        const recipientIds = await resolveRecipients(recipientType, schoolId, classId);
        if (recipientIds.length === 0) {
            return res.status(200).json({ message: 'No recipients found', count: 0 });
        }

        await createNotifications(recipientIds, message, 'announcement', { title, recipientType });

        logger.info(`Notification sent to ${recipientIds.length} recipients`, { recipientType, title });
        return res.status(201).json({ message: 'Notifications sent', count: recipientIds.length });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

// GET /Admin/notifications/sent/:schoolId
const getSentNotifications = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const schoolQuery = { $or: [{ schoolId }, { school: schoolId }] };
        const [students, teachers, parents] = await Promise.all([
            Student.find(schoolQuery, '_id').lean(),
            Teacher.find(schoolQuery, '_id').lean(),
            Parent.find({ school: schoolId }, '_id').lean(),
        ]);
        const userIds = [...students, ...teachers, ...parents].map(u => u._id);
        if (!userIds.length) return res.status(200).json([]);

        const grouped = await Notification.aggregate([
            { $match: { userId: { $in: userIds }, type: 'announcement' } },
            { $group: {
                _id: { title: '$title', message: '$message' },
                notificationId: { $first: '$_id' },
                title:          { $first: '$title' },
                message:        { $first: '$message' },
                recipientType:  { $first: '$recipientType' },
                type:           { $first: '$type' },
                createdAt:      { $first: '$createdAt' },
                totalRecipients: { $sum: 1 },
                readCount:      { $sum: { $cond: ['$readStatus', 1, 0] } },
            }},
            { $sort: { createdAt: -1 } },
            { $limit: 100 },
        ]);

        return res.status(200).json(grouped);
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

// DELETE /Admin/notifications/:id  — deletes all notifications with same title+message
const deleteNotification = async (req, res) => {
    try {
        const target = await Notification.findById(req.params.id);
        if (!target) return res.status(404).json({ message: 'Notification not found' });
        // Delete all copies of this broadcast
        await Notification.deleteMany({ title: target.title, message: target.message });
        return res.status(200).json({ message: 'Notification deleted' });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

module.exports = { sendNotification, getSentNotifications, deleteNotification, previewRecipients };
