const SchoolConfig = require('../models/schoolConfigSchema');

module.exports = (toggleKey) => async (req, res, next) => {
  try {
    const schoolId = req.params.schoolId || req.body.schoolId || req.query.schoolId;
    const config = await SchoolConfig.findOne({ schoolId }).lean();
    if (config && config.featureToggles[toggleKey] === false) {
      return res.status(403).json({ message: 'Feature disabled by administrator' });
    }
    next();
  } catch (err) {
    next(err);
  }
};
