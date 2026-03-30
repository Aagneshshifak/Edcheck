// Groq AI Configuration Example
// This file shows how to configure Groq for AI-powered features

const Groq = require('groq-sdk');

const groqConfig = {
    apiKey: process.env.GROQ_API_KEY,
    baseURL: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
    timeout: parseInt(process.env.GROQ_TIMEOUT) || 30000,
    maxRetries: 3,
};

// Initialize Groq client
const groq = new Groq(groqConfig);

// Available models configuration
const GROQ_MODELS = {
    FAST: 'llama3-8b-8192',        // Fast responses, good for real-time features
    BALANCED: 'mixtral-8x7b-32768', // Balanced performance and quality
    POWERFUL: 'llama3-70b-8192',   // Most capable, use for complex analysis
    LIGHTWEIGHT: 'gemma-7b-it'     // Lightweight model for simple tasks
};

// Model selection based on use case
const getModelForTask = (taskType) => {
    switch (taskType) {
        case 'student_risk_analysis':
            return GROQ_MODELS.POWERFUL;
        case 'learning_recommendations':
            return GROQ_MODELS.BALANCED;
        case 'quick_insights':
            return GROQ_MODELS.FAST;
        case 'simple_classification':
            return GROQ_MODELS.LIGHTWEIGHT;
        default:
            return process.env.GROQ_MODEL || GROQ_MODELS.FAST;
    }
};

// Example AI service functions
const aiServices = {
    // Analyze student performance and generate insights
    async analyzeStudentPerformance(studentData) {
        try {
            const model = getModelForTask('student_risk_analysis');
            const response = await groq.chat.completions.create({
                messages: [
                    {
                        role: 'system',
                        content: 'You are an educational AI assistant that analyzes student performance data and provides insights.'
                    },
                    {
                        role: 'user',
                        content: `Analyze this student's performance data and provide insights: ${JSON.stringify(studentData)}`
                    }
                ],
                model: model,
                temperature: parseFloat(process.env.GROQ_DEFAULT_TEMPERATURE) || 0.7,
                max_tokens: parseInt(process.env.GROQ_MAX_TOKENS) || 1024,
            });

            return response.choices[0]?.message?.content;
        } catch (error) {
            console.error('Groq AI Error:', error);
            throw new Error('Failed to analyze student performance');
        }
    },

    // Generate personalized learning recommendations
    async generateLearningRecommendations(studentProfile, subjectData) {
        try {
            const model = getModelForTask('learning_recommendations');
            const response = await groq.chat.completions.create({
                messages: [
                    {
                        role: 'system',
                        content: 'You are an educational AI that creates personalized learning recommendations based on student profiles and performance data.'
                    },
                    {
                        role: 'user',
                        content: `Based on this student profile: ${JSON.stringify(studentProfile)} and subject data: ${JSON.stringify(subjectData)}, provide personalized learning recommendations.`
                    }
                ],
                model: model,
                temperature: 0.8,
                max_tokens: 1024,
            });

            return response.choices[0]?.message?.content;
        } catch (error) {
            console.error('Groq AI Error:', error);
            throw new Error('Failed to generate learning recommendations');
        }
    },

    // Detect at-risk students
    async detectAtRiskStudents(classData) {
        try {
            const model = getModelForTask('student_risk_analysis');
            const response = await groq.chat.completions.create({
                messages: [
                    {
                        role: 'system',
                        content: 'You are an AI that identifies students at risk of academic failure based on performance patterns, attendance, and behavioral indicators.'
                    },
                    {
                        role: 'user',
                        content: `Analyze this class data and identify students who may be at risk: ${JSON.stringify(classData)}`
                    }
                ],
                model: model,
                temperature: 0.3, // Lower temperature for more consistent risk assessment
                max_tokens: 1024,
            });

            return response.choices[0]?.message?.content;
        } catch (error) {
            console.error('Groq AI Error:', error);
            throw new Error('Failed to detect at-risk students');
        }
    },

    // Generate teacher performance insights
    async analyzeTeacherPerformance(teacherData) {
        try {
            const model = getModelForTask('learning_recommendations');
            const response = await groq.chat.completions.create({
                messages: [
                    {
                        role: 'system',
                        content: 'You are an AI that analyzes teacher performance data and provides constructive insights for professional development.'
                    },
                    {
                        role: 'user',
                        content: `Analyze this teacher's performance data and provide insights: ${JSON.stringify(teacherData)}`
                    }
                ],
                model: model,
                temperature: 0.6,
                max_tokens: 1024,
            });

            return response.choices[0]?.message?.content;
        } catch (error) {
            console.error('Groq AI Error:', error);
            throw new Error('Failed to analyze teacher performance');
        }
    },

    // Quick classification tasks
    async classifyFeedback(feedbackText) {
        try {
            const model = getModelForTask('simple_classification');
            const response = await groq.chat.completions.create({
                messages: [
                    {
                        role: 'system',
                        content: 'Classify the following feedback into categories: Academic, Behavioral, Administrative, or Other. Also determine the priority level: High, Medium, or Low.'
                    },
                    {
                        role: 'user',
                        content: feedbackText
                    }
                ],
                model: model,
                temperature: 0.2,
                max_tokens: 100,
            });

            return response.choices[0]?.message?.content;
        } catch (error) {
            console.error('Groq AI Error:', error);
            throw new Error('Failed to classify feedback');
        }
    }
};

// Rate limiting and caching utilities
const rateLimiter = {
    requests: new Map(),
    
    async checkLimit(userId, limit = 100, windowMs = 3600000) { // 100 requests per hour
        const now = Date.now();
        const userRequests = this.requests.get(userId) || [];
        
        // Remove old requests outside the window
        const validRequests = userRequests.filter(time => now - time < windowMs);
        
        if (validRequests.length >= limit) {
            throw new Error('Rate limit exceeded');
        }
        
        validRequests.push(now);
        this.requests.set(userId, validRequests);
        
        return true;
    }
};

module.exports = {
    groq,
    aiServices,
    rateLimiter,
    GROQ_MODELS,
    getModelForTask
};