const Notice = require('../models/noticeSchema.js');
const { withCache, invalidate } = require('../utils/cache');

const noticeCreate = async (req, res) => {
    try {
        // Build attachments array from any uploaded files
        const attachments = (req.files || []).map(f => ({
            fileName: f.originalname,
            fileUrl:  f.path || `/uploads/${f.filename}`,
            fileType: f.originalname.split('.').pop().toLowerCase(),
            publicId: f.filename || null,
        }));

        const notice = new Notice({
            ...req.body,
            school:      req.body.adminID || req.body.school || req.body.schoolId,
            schoolId:    req.body.adminID || req.body.school || req.body.schoolId,
            attachments: attachments.length ? attachments : (req.body.attachments || []),
        });
        const result = await notice.save();
        invalidate(`notices:${result.schoolId}`);
        res.send(result);
    } catch (err) {
        res.status(500).json(err);
    }
};

/**
 * GET /NoticeList/:schoolId
 * Optional query params:
 *   audience   — filter by audience (students|teachers|parents|all)
 *   targetType — filter by targetType
 *   targetId   — filter by targetId
 */
const noticeList = async (req, res) => {
    try {
        const { audience, targetType, targetId } = req.query;

        // Build query — always include "all" notices plus any targeted ones
        const query = {
            $or: [{ school: req.params.id }, { schoolId: req.params.id }],
        };

        if (audience && audience !== 'all') {
            query.$and = [{ $or: [{ audience }, { audience: 'all' }] }];
        }

        if (targetType && targetType !== 'all') {
            const targetFilter = { $or: [{ targetType: 'all' }, { targetType }] };
            if (targetId) targetFilter.$or.push({ targetId });
            query.$and = [...(query.$and || []), targetFilter];
        }

        const cacheKey = `notices:${req.params.id}:${audience || ''}:${targetType || ''}:${targetId || ''}`;
        const notices = await withCache(cacheKey, async () =>
            Notice.find(query).sort({ date: -1 }).lean()
        , 60);

        if (notices.length > 0) {
            res.send(notices);
        } else {
            res.send({ message: "No notices found" });
        }
    } catch (err) {
        res.status(500).json(err);
    }
};

const updateNotice = async (req, res) => {
    try {
        const result = await Notice.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
        if (result) invalidate(`notices:${result.schoolId}`);
        res.send(result);
    } catch (error) {
        res.status(500).json(error);
    }
};

const deleteNotice = async (req, res) => {
    try {
        const result = await Notice.findByIdAndDelete(req.params.id);
        if (result) invalidate(`notices:${result.schoolId}`);
        res.send(result);
    } catch (error) {
        res.status(500).json(error);
    }
};

const deleteNotices = async (req, res) => {
    try {
        const result = await Notice.deleteMany({
            $or: [{ school: req.params.id }, { schoolId: req.params.id }],
        });
        if (result.deletedCount === 0) {
            res.send({ message: "No notices found to delete" });
        } else {
            res.send(result);
        }
    } catch (error) {
        res.status(500).json(error);
    }
};

module.exports = { noticeCreate, noticeList, updateNotice, deleteNotice, deleteNotices };
