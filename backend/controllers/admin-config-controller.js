const SchoolConfig = require('../models/schoolConfigSchema');

const DEFAULT_GRADING_SCALE = [
  { letter: 'A', min: 90, max: 100 },
  { letter: 'B', min: 80, max: 89 },
  { letter: 'C', min: 70, max: 79 },
  { letter: 'D', min: 60, max: 69 },
  { letter: 'F', min: 0,  max: 59 },
];

const DEFAULT_FEATURE_TOGGLES = {
  leaderboard:  true,
  parentPortal: true,
  fileUploads:  true,
  testRetake:   true,
};

function bandsOverlap(a, b) {
  return a.min <= b.max && b.min <= a.max;
}

function findOverlap(gradingScale) {
  for (let i = 0; i < gradingScale.length; i++) {
    for (let j = i + 1; j < gradingScale.length; j++) {
      const a = gradingScale[i];
      const b = gradingScale[j];
      if (bandsOverlap(a, b)) {
        return { a, b };
      }
    }
  }
  return null;
}

const getConfig = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const config = await SchoolConfig.findOne({ schoolId });

    if (!config) {
      return res.status(200).json({
        schoolId,
        gradingScale: DEFAULT_GRADING_SCALE,
        featureToggles: DEFAULT_FEATURE_TOGGLES,
      });
    }

    return res.status(200).json(config);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const updateConfig = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { termStart, termEnd, gradingScale, featureToggles, academicYear } = req.body;

    // Validate termEnd > termStart
    if (termStart && termEnd) {
      if (new Date(termEnd) <= new Date(termStart)) {
        return res.status(400).json({ message: 'termEnd must be after termStart' });
      }
    }

    // Validate no overlapping grade bands
    if (gradingScale && gradingScale.length > 0) {
      const overlap = findOverlap(gradingScale);
      if (overlap) {
        const { a, b } = overlap;
        return res.status(400).json({
          message: `Overlapping grade bands: ${a.letter} (${a.min}-${a.max}) and ${b.letter} (${b.min}-${b.max})`,
        });
      }
    }

    const update = {};
    if (academicYear !== undefined) update.academicYear = academicYear;
    if (termStart   !== undefined) update.termStart     = termStart;
    if (termEnd     !== undefined) update.termEnd       = termEnd;
    if (gradingScale !== undefined) update.gradingScale = gradingScale;
    if (featureToggles !== undefined) {
      for (const key of Object.keys(featureToggles)) {
        update[`featureToggles.${key}`] = featureToggles[key];
      }
    }

    const updated = await SchoolConfig.findOneAndUpdate(
      { schoolId },
      { $set: update },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json(updated);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = { getConfig, updateConfig };
