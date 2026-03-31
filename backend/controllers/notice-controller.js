const Notice = require('../models/noticeSchema.js');
const { withCache, invalidate } = require('../utils/cache');

const noticeCreate = async (req, res) => {
    try {
        const notice = new Notice({ ...req.body, school: req.body.adminID });
        const result = await notice.save();
        invalidate(`notices:${result.school}`);
        res.send(result);
    } catch (err) {
        res.status(500).json(err);
    }
};

const noticeList = async (req, res) => {
    try {
        const cacheKey = `notices:${req.params.id}`;
        const notices = await withCache(cacheKey, async () => {
            const list = await Notice.find({ school: req.params.id })
                .sort({ date: -1 })
                .lean();
            return list;
        }, 120); // 2-minute cache

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
        if (result) invalidate(`notices:${result.school}`);
        res.send(result);
    } catch (error) {
        res.status(500).json(error);
    }
};

const deleteNotice = async (req, res) => {
    try {
        const result = await Notice.findByIdAndDelete(req.params.id);
        if (result) invalidate(`notices:${result.school}`);
        res.send(result);
    } catch (error) {
        res.status(500).json(error);
    }
};

const deleteNotices = async (req, res) => {
    try {
        const result = await Notice.deleteMany({ school: req.params.id })
        if (result.deletedCount === 0) {
            res.send({ message: "No notices found to delete" })
        } else {
            res.send(result)
        }
    } catch (error) {
        res.status(500).json(err);
    }
}

module.exports = { noticeCreate, noticeList, updateNotice, deleteNotice, deleteNotices };