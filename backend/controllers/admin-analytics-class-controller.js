const ClassAnalytics = require('../models/classAnalyticsSchema');
const { computeClassAnalytics } = require('../utils/classAnalyticsComputer');

// POST /Admin/class/:id/analytics/recompute
const recomputeClassAnalytics = async (req, res) => {
    try {
        const { schoolId } = req.body;
        if (!schoolId) {
            return res.status(400).json({ message: 'schoolId is required' });
        }

        const doc = await computeClassAnalytics(req.params.id, schoolId);
        res.json(doc);
    } catch (err) {
        // computeClassAnalytics throws with classId in message when class not found
        if (err.message && err.message.includes(req.params.id)) {
            return res.status(404).json({ message: err.message });
        }
        res.status(500).json({ message: err.message });
    }
};

// GET /Admin/class/:id/analytics
const getClassAnalytics = async (req, res) => {
    try {
        const doc = await ClassAnalytics.findOne({ classId: req.params.id });
        if (!doc) {
            return res.status(404).json({ message: `No analytics found for class ${req.params.id}` });
        }
        res.json(doc);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /Admin/school/:schoolId/analytics
const getSchoolAnalytics = async (req, res) => {
    try {
        const docs = await ClassAnalytics.find({ schoolId: req.params.schoolId })
            .populate('classId', 'className section')
            .populate('weakSubjects', 'subName')
            .sort({ performanceScore: 1 });
        res.json(docs);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { recomputeClassAnalytics, getClassAnalytics, getSchoolAnalytics };
