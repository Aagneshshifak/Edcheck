/**
 * Question Importer Service
 * 
 * Handles reading XML and Excel files, standardizing them into an internal schema,
 * and pushing them through the hybrid validation pipeline.
 */

'use strict';

const { XMLParser } = require('fast-xml-parser');
const xlsx = require('xlsx');
const AIQuestionBank = require('../models/aiQuestionBankSchema');
const Curriculum = require('../models/curriculumSchema');
const { validateQuestionsBatch } = require('./questionValidator');
const { logger } = require('../utils/serverLogger');

/**
 * Standardize an options array into exactly 4 strings if MCQ.
 */
function standardizeOptions(q, type) {
    if (type !== 'mcq') return [];
    
    let opts = q.options;
    // Handle XML <options><option>A</option>...</options>
    if (opts && typeof opts === 'object' && !Array.isArray(opts)) {
        opts = opts.option;
    }
    // Handle Excel OptionA, OptionB columns
    if (!opts || !Array.isArray(opts)) {
        opts = [];
        if (q.OptionA) opts.push(String(q.OptionA));
        if (q.OptionB) opts.push(String(q.OptionB));
        if (q.OptionC) opts.push(String(q.OptionC));
        if (q.OptionD) opts.push(String(q.OptionD));
    }
    
    return opts.map(o => typeof o === 'object' && o['#text'] ? o['#text'] : String(o));
}

/**
 * Clean and standardize a single row/question object.
 */
function standardizeRow(raw, index) {
    const q = { ...raw };
    const type = String(q.type || q.QuestionType || q.questionType || 'mcq').toLowerCase();
    
    // Normalize correct answer
    let ca = q.correctAnswer || q.CorrectAnswer;
    if (typeof ca === 'string' && ca.match(/^[A-D]$/i)) {
        ca = ca.toUpperCase().charCodeAt(0) - 65; // A=0, B=1...
    } else {
        ca = parseInt(ca, 10);
    }

    // Key concepts / Rubric
    let concepts = q.keyConcepts || q.KeyConcepts || [];
    if (typeof concepts === 'string') concepts = concepts.split(',').map(s => s.trim());
    if (concepts && concepts.concept) concepts = Array.isArray(concepts.concept) ? concepts.concept : [concepts.concept];
    
    let rubric = q.rubric || q.Rubric || [];
    if (typeof rubric === 'string') {
        rubric = rubric.split(',').map(c => ({ criterion: c.trim(), marks: 1 }));
    } else if (rubric && rubric.criterion) {
        const crits = Array.isArray(rubric.criterion) ? rubric.criterion : [rubric.criterion];
        rubric = crits.map(c => typeof c === 'string' ? { criterion: c, marks: 1 } : { criterion: c.text || c.name, marks: Number(c.marks) || 1 });
    }

    return {
        _tempId: `import_${Date.now()}_${index}`,
        questionText: String(q.text || q.question || q.Question || ''),
        questionType: type,
        options: standardizeOptions(q, type),
        correctAnswer: ca,
        expectedAnswer: q.expectedAnswer || q.ExpectedAnswer || null,
        keyConcepts: concepts,
        scoringRubric: rubric,
        difficulty: String(q.difficulty || q.Difficulty || 'medium').toLowerCase(),
        marks: Number(q.marks || q.Marks) || 1,
        source: 'IMPORTED',
        curriculumMeta: {
            classId: String(q.class || q.Class || ''),
            subjectId: String(q.subject || q.Subject || ''),
            domain: String(q.domain || q.Domain || ''),
            chapter: String(q.chapter || q.Chapter || ''),
            subtopic: String(q.subtopic || q.Subtopic || ''),
            concept: String(q.concept || q.Concept || ''),
            source: 'IMPORTED'
        }
    };
}

/**
 * Parse XML buffer into standardized question array.
 */
function parseXML(buffer) {
    try {
        const parser = new XMLParser({ ignoreAttributes: false, parseAttributeValue: true });
        const obj = parser.parse(buffer.toString('utf8'));
        
        // Find questions array
        let qs = [];
        if (obj.questions && obj.questions.question) qs = obj.questions.question;
        else if (obj.question) qs = obj.question;
        else if (Array.isArray(obj)) qs = obj;
        
        if (!Array.isArray(qs)) qs = [qs];
        
        return qs.map((q, i) => standardizeRow(q, i));
    } catch (err) {
        throw new Error(`XML Parsing failed: ${err.message}`);
    }
}

/**
 * Parse Excel buffer into standardized question array.
 */
function parseExcel(buffer) {
    try {
        const workbook = xlsx.read(buffer, { type: 'buffer' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows = xlsx.utils.sheet_to_json(worksheet);
        
        return rows.map((r, i) => standardizeRow(r, i));
    } catch (err) {
        throw new Error(`Excel Parsing failed: ${err.message}`);
    }
}

/**
 * Validate a question deterministically (missing fields, options, etc).
 */
function deterministicValidation(q, index) {
    if (!q.questionText) return `Row ${index + 1}: Missing question text`;
    if (!q.curriculumMeta.classId) return `Row ${index + 1}: Missing class`;
    if (!q.curriculumMeta.subjectId) return `Row ${index + 1}: Missing subject`;
    if (!q.curriculumMeta.chapter) return `Row ${index + 1}: Missing chapter`;
    if (!q.curriculumMeta.subtopic) return `Row ${index + 1}: Missing subtopic`;
    
    if (q.questionType === 'mcq') {
        if (q.options.length < 2) return `Row ${index + 1}: MCQ requires at least 2 options`;
        if (Number.isNaN(q.correctAnswer) || q.correctAnswer < 0 || q.correctAnswer >= q.options.length) {
            return `Row ${index + 1}: Correct answer must be a valid option index (0 to ${q.options.length-1})`;
        }
        // Duplicate options
        const optSet = new Set(q.options.map(o => String(o).toLowerCase().trim()));
        if (optSet.size !== q.options.length) return `Row ${index + 1}: MCQ contains duplicate options`;
    }
    
    if (q.questionType === 'sentence' || q.questionType === 'sentence_answer') {
        if (!q.expectedAnswer) return `Row ${index + 1}: Sentence question missing expected answer`;
        if (!q.keyConcepts || q.keyConcepts.length === 0) return `Row ${index + 1}: Sentence question missing key concepts`;
        if (!q.scoringRubric || q.scoringRubric.length === 0) return `Row ${index + 1}: Sentence question missing rubric`;
    }
    
    return null;
}

/**
 * Process an import through the full pipeline.
 */
async function processImport(questions, schoolId, teacherId) {
    const report = {
        totalRows: questions.length,
        validRows: 0,
        reviewRows: 0,
        invalidRows: 0,
        savedRows: 0,
        errors: []
    };
    
    const validQuestions = [];
    const classCurriculums = {}; // Cache to avoid excessive DB hits

    // 1. Schema & Curriculum Validation
    for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const dError = deterministicValidation(q, i);
        if (dError) {
            report.invalidRows++;
            report.errors.push({ row: i + 1, field: 'Validation', error: dError, severity: 'ERROR' });
            continue;
        }

        // Curriculum Validation
        const cacheKey = `${q.curriculumMeta.classId}_${q.curriculumMeta.subjectId}`;
        if (!classCurriculums[cacheKey]) {
            classCurriculums[cacheKey] = await Curriculum.find({
                classLevel: q.curriculumMeta.classId,
                subject: q.curriculumMeta.subjectId
            }).lean();
        }
        const curr = classCurriculums[cacheKey];
        const match = curr.find(c => 
            c.chapter.toLowerCase() === q.curriculumMeta.chapter.toLowerCase() &&
            c.subtopic.toLowerCase() === q.curriculumMeta.subtopic.toLowerCase()
        );

        if (!match) {
            report.invalidRows++;
            report.errors.push({ 
                row: i + 1, 
                field: 'subtopic', 
                value: q.curriculumMeta.subtopic,
                error: `Subtopic '${q.curriculumMeta.subtopic}' does not exist in curriculum for Chapter '${q.curriculumMeta.chapter}'`, 
                severity: 'ERROR' 
            });
            continue;
        }

        validQuestions.push(q);
    }

    // 2. Duplicate Detection against DB
    const finalToAI = [];
    for (const q of validQuestions) {
        // Simple exact match duplicate check
        const dup = await AIQuestionBank.findOne({
            questionText: q.questionText,
            'curriculumMeta.subjectId': q.curriculumMeta.subjectId
        }).select('_id');
        
        if (dup) {
            report.invalidRows++;
            report.errors.push({ row: '?', field: 'Duplicate', error: `Question already exists in Question Bank`, severity: 'ERROR' });
            continue;
        }
        finalToAI.push(q);
    }

    // 3. AI Batch Semantic Validation
    // This calls the existing hybrid validator
    let validatedBatch = [];
    try {
        validatedBatch = await validateQuestionsBatch(finalToAI, 'system_importer');
    } catch (err) {
        logger.error('Batch validation failed during import', { err: err.message });
        throw new Error(`AI Semantic Validation failed: ${err.message}`);
    }

    // 4. Save Valid & Requires Review
    for (const vq of validatedBatch) {
        if (vq.validationStatus === 'INVALID') {
            report.invalidRows++;
            report.errors.push({
                row: '?', field: 'AI Validation', error: vq.validationNotes || 'Failed semantic check', severity: 'ERROR'
            });
            continue;
        }

        // Create AIQuestionBank entry
        const qDoc = new AIQuestionBank({
            questionText: vq.questionText,
            questionType: vq.questionType,
            options: vq.options,
            correctAnswer: vq.correctAnswer,
            expectedAnswer: vq.expectedAnswer,
            keyConcepts: vq.keyConcepts,
            scoringRubric: vq.scoringRubric,
            topic: vq.topic || vq.curriculumMeta.chapter, // Legacy compat
            difficulty: vq.difficulty,
            marks: vq.maxMarks || vq.marks,
            source: 'IMPORTED',
            curriculumMeta: vq.curriculumMeta,
            validationStatus: vq.validationStatus,
            validationNotes: vq.validationNotes,
            validationScore: vq.validationScore
        });

        await qDoc.save();
        report.savedRows++;
        
        if (vq.validationStatus === 'VALID') report.validRows++;
        else if (vq.validationStatus === 'REQUIRES_REVIEW') report.reviewRows++;
    }

    return report;
}

module.exports = {
    parseXML,
    parseExcel,
    processImport
};
