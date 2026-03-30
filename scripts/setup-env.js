#!/usr/bin/env node

/**
 * Environment Setup Script
 * This script helps users set up their environment variables interactively
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function colorize(text, color) {
    return `${colors[color]}${text}${colors.reset}`;
}

function generateSecretKey() {
    return crypto.randomBytes(64).toString('hex');
}

function question(prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, resolve);
    });
}

async function setupEnvironment() {
    console.log(colorize('\n🚀 School Management System - Environment Setup', 'cyan'));
    console.log(colorize('=' .repeat(60), 'blue'));
    
    const envConfig = {};
    
    // Project Information
    console.log(colorize('\n📋 Project Information', 'yellow'));
    envConfig.PROJECT_NAME = 'School Management System';
    envConfig.PROJECT_VERSION = '1.0.0';
    envConfig.PROJECT_DESCRIPTION = 'AI-Driven Learning Intelligence Platform';
    envConfig.NODE_ENV = 'development';
    console.log(colorize('✅ Project info configured', 'green'));
    
    // Database Configuration
    console.log(colorize('\n🗄️  Database Configuration', 'yellow'));
    const dbChoice = await question(colorize('Choose database option:\n1. Local MongoDB (Recommended for development)\n2. MongoDB Atlas (Cloud)\nEnter choice (1 or 2): ', 'cyan'));
    
    if (dbChoice === '2') {
        envConfig.MONGO_URL = await question(colorize('Enter MongoDB Atlas connection string: ', 'cyan'));
    } else {
        envConfig.MONGO_URL = 'mongodb://127.0.0.1:27017/smsproject';
        console.log(colorize('✅ Using local MongoDB', 'green'));
    }
    envConfig.DB_NAME = 'smsproject';
    
    // Server Configuration
    console.log(colorize('\n🌐 Server Configuration', 'yellow'));
    const backendPort = await question(colorize('Backend port (default 5000): ', 'cyan')) || '5000';
    const frontendPort = await question(colorize('Frontend port (default 3000): ', 'cyan')) || '3000';
    
    envConfig.BACKEND_PORT = backendPort;
    envConfig.FRONTEND_PORT = frontendPort;
    envConfig.BACKEND_URL = `http://localhost:${backendPort}`;
    envConfig.FRONTEND_URL = `http://localhost:${frontendPort}`;
    
    // Security Keys
    console.log(colorize('\n🔐 Security Configuration', 'yellow'));
    const generateKeys = await question(colorize('Generate secure keys automatically? (y/n): ', 'cyan'));
    
    if (generateKeys.toLowerCase() === 'y' || generateKeys.toLowerCase() === 'yes') {
        envConfig.SECRET_KEY = generateSecretKey();
        envConfig.JWT_SECRET = generateSecretKey();
        console.log(colorize('✅ Secure keys generated', 'green'));
    } else {
        envConfig.SECRET_KEY = await question(colorize('Enter SECRET_KEY: ', 'cyan'));
        envConfig.JWT_SECRET = await question(colorize('Enter JWT_SECRET: ', 'cyan'));
    }
    
    // Email Configuration
    console.log(colorize('\n📧 Email Configuration', 'yellow'));
    const setupEmail = await question(colorize('Set up email service? (y/n): ', 'cyan'));
    
    if (setupEmail.toLowerCase() === 'y' || setupEmail.toLowerCase() === 'yes') {
        envConfig.EMAIL_SERVICE = 'gmail';
        envConfig.EMAIL_USER = await question(colorize('Enter Gmail address: ', 'cyan'));
        envConfig.EMAIL_PASS = await question(colorize('Enter Gmail App Password (16 characters): ', 'cyan'));
        console.log(colorize('ℹ️  Remember to enable 2FA and generate App Password in Gmail', 'blue'));
    } else {
        envConfig.EMAIL_SERVICE = 'gmail';
        envConfig.EMAIL_USER = 'your_school_email@gmail.com';
        envConfig.EMAIL_PASS = 'your_app_specific_password';
    }
    
    // File Storage
    console.log(colorize('\n📁 File Storage', 'yellow'));
    envConfig.UPLOAD_DIR = 'uploads';
    envConfig.MAX_FILE_SIZE = '10MB';
    console.log(colorize('✅ File storage configured', 'green'));
    
    // Groq AI Configuration
    console.log(colorize('\n🤖 AI Configuration (Groq)', 'yellow'));
    const setupGroq = await question(colorize('Set up Groq AI? (y/n): ', 'cyan'));
    
    if (setupGroq.toLowerCase() === 'y' || setupGroq.toLowerCase() === 'yes') {
        envConfig.GROQ_API_KEY = await question(colorize('Enter Groq API Key (from console.groq.com): ', 'cyan'));
        
        console.log(colorize('\nAvailable models:', 'blue'));
        console.log('1. llama3-8b-8192 (Fast, good for development)');
        console.log('2. llama3-70b-8192 (Powerful, better for production)');
        console.log('3. mixtral-8x7b-32768 (Balanced performance)');
        console.log('4. gemma-7b-it (Lightweight)');
        
        const modelChoice = await question(colorize('Choose model (1-4, default 1): ', 'cyan')) || '1';
        const models = {
            '1': 'llama3-8b-8192',
            '2': 'llama3-70b-8192',
            '3': 'mixtral-8x7b-32768',
            '4': 'gemma-7b-it'
        };
        envConfig.GROQ_MODEL = models[modelChoice] || 'llama3-8b-8192';
    } else {
        envConfig.GROQ_API_KEY = 'your_groq_api_key';
        envConfig.GROQ_MODEL = 'llama3-8b-8192';
    }
    
    // Logging and Development Tools
    console.log(colorize('\n🔧 Development Configuration', 'yellow'));
    envConfig.LOG_LEVEL = 'info';
    envConfig.ENABLE_LOGGING = 'true';
    envConfig.ENABLE_CORS = 'true';
    envConfig.ENABLE_MORGAN_LOGGING = 'true';
    envConfig.ENABLE_HELMET_SECURITY = 'true';
    console.log(colorize('✅ Development tools configured', 'green'));
    
    // Generate .env file
    console.log(colorize('\n📝 Generating .env file...', 'yellow'));
    
    let envContent = '# School Management System Environment Configuration\n';
    envContent += '# Generated automatically - modify as needed\n\n';
    
    // Add comments for each section
    const sections = {
        'PROJECT_NAME': '# Project Information',
        'MONGO_URL': '\n# Database Configuration',
        'BACKEND_PORT': '\n# Server Configuration',
        'SECRET_KEY': '\n# Security Keys',
        'BACKEND_URL': '\n# URLs',
        'EMAIL_SERVICE': '\n# Email Service',
        'UPLOAD_DIR': '\n# File Storage',
        'GROQ_API_KEY': '\n# AI/ML Configuration',
        'LOG_LEVEL': '\n# Logging',
        'ENABLE_CORS': '\n# Development Tools'
    };
    
    for (const [key, value] of Object.entries(envConfig)) {
        if (sections[key]) {
            envContent += sections[key] + '\n';
        }
        envContent += `${key}=${value}\n`;
    }
    
    // Write to .env file
    fs.writeFileSync('.env', envContent);
    
    // Also create backend and frontend .env files
    const backendEnvContent = `MONGO_URL=${envConfig.MONGO_URL}
SECRET_KEY=${envConfig.SECRET_KEY}
JWT_SECRET=${envConfig.JWT_SECRET}
PORT=${envConfig.BACKEND_PORT}
EMAIL_SERVICE=${envConfig.EMAIL_SERVICE}
EMAIL_USER=${envConfig.EMAIL_USER}
EMAIL_PASS=${envConfig.EMAIL_PASS}
GROQ_API_KEY=${envConfig.GROQ_API_KEY}
GROQ_MODEL=${envConfig.GROQ_MODEL}
UPLOAD_DIR=${envConfig.UPLOAD_DIR}
MAX_FILE_SIZE=${envConfig.MAX_FILE_SIZE}
LOG_LEVEL=${envConfig.LOG_LEVEL}
ENABLE_LOGGING=${envConfig.ENABLE_LOGGING}
ENABLE_CORS=${envConfig.ENABLE_CORS}
`;
    
    const frontendEnvContent = `REACT_APP_BASE_URL=${envConfig.BACKEND_URL}
REACT_APP_ENV=${envConfig.NODE_ENV}
REACT_APP_NAME=${envConfig.PROJECT_NAME}
REACT_APP_VERSION=${envConfig.PROJECT_VERSION}
`;
    
    // Create directories if they don't exist
    if (!fs.existsSync('backend')) {
        fs.mkdirSync('backend');
    }
    if (!fs.existsSync('frontend')) {
        fs.mkdirSync('frontend');
    }
    
    fs.writeFileSync('backend/.env', backendEnvContent);
    fs.writeFileSync('frontend/.env', frontendEnvContent);
    
    console.log(colorize('\n✅ Environment setup complete!', 'green'));
    console.log(colorize('\nFiles created:', 'blue'));
    console.log('  📄 .env (root)');
    console.log('  📄 backend/.env');
    console.log('  📄 frontend/.env');
    
    console.log(colorize('\n🚀 Next steps:', 'cyan'));
    console.log('1. Install dependencies: npm run install-deps');
    console.log('2. Start development: npm run dev');
    
    if (envConfig.MONGO_URL.includes('127.0.0.1')) {
        console.log(colorize('\n⚠️  Make sure MongoDB is running locally!', 'yellow'));
    }
    
    if (envConfig.GROQ_API_KEY === 'your_groq_api_key') {
        console.log(colorize('\n⚠️  Remember to get your Groq API key from console.groq.com', 'yellow'));
    }
    
    console.log(colorize('\n📚 For detailed setup instructions, see SETUP-GUIDE.md', 'blue'));
}

// Run the setup
setupEnvironment()
    .then(() => {
        rl.close();
        process.exit(0);
    })
    .catch((error) => {
        console.error(colorize('\n❌ Setup failed:', 'red'), error.message);
        rl.close();
        process.exit(1);
    });