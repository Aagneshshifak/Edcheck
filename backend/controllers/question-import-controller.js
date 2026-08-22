const questionImporter = require('../services/questionImporter');

const uploadQuestions = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded.' });
        }

        const buffer = req.file.buffer;
        const originalName = req.file.originalname.toLowerCase();
        
        let questions = [];

        if (originalName.endsWith('.xml')) {
            questions = questionImporter.parseXML(buffer);
        } else if (originalName.endsWith('.xls') || originalName.endsWith('.xlsx')) {
            questions = questionImporter.parseExcel(buffer);
        } else {
            return res.status(400).json({ error: 'Unsupported file format. Please upload XML, XLS, or XLSX.' });
        }

        // Process through the validation pipeline
        // Assuming req.user contains the authenticated user details (admin/teacher)
        const schoolId = req.user?.school || null;
        const teacherId = req.user?._id || null;

        const report = await questionImporter.processImport(questions, schoolId, teacherId);

        res.status(200).json(report);

    } catch (err) {
        res.status(500).json({ error: 'Failed to process import', details: err.message });
    }
};

module.exports = {
    uploadQuestions
};
