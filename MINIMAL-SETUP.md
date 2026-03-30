# Minimal Setup Guide - Skip Optional Services

This guide shows you how to set up the School Management System with **only the essential** environment variables, skipping all optional services.

## 🚀 Essential Variables Only

You only need these **4 essential variables** to get started:

### 1. Database (MongoDB Atlas)
```bash
MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/smsproject?retryWrites=true&w=majority
```

### 2. Security Keys
```bash
SECRET_KEY=your_generated_secret_key
JWT_SECRET=your_generated_jwt_secret
```

### 3. Ports (Optional - defaults work fine)
```bash
BACKEND_PORT=5000
FRONTEND_PORT=3000
```

## 📝 Minimal .env File

Create a `.env` file with just these essentials:

```bash
# Project Information
PROJECT_NAME=School Management System
PROJECT_VERSION=1.0.0
NODE_ENV=development

# Database Configuration (REQUIRED)
MONGO_URL=mongodb+srv://your_username:your_password@cluster0.xxxxx.mongodb.net/smsproject?retryWrites=true&w=majority
DB_NAME=smsproject

# Server Configuration
BACKEND_PORT=5000
FRONTEND_PORT=3000
BACKEND_URL=http://localhost:5000
FRONTEND_URL=http://localhost:3000

# Security Keys (REQUIRED - Generate these!)
SECRET_KEY=your_generated_64_character_secret_key_here
JWT_SECRET=your_generated_64_character_jwt_secret_here

# Optional Services (Use placeholders - skip setup)
EMAIL_SERVICE=gmail
EMAIL_USER=placeholder@gmail.com
EMAIL_PASS=placeholder_password

GROQ_API_KEY=placeholder_groq_key
GROQ_MODEL=llama3-8b-8192

# File Storage
UPLOAD_DIR=uploads
MAX_FILE_SIZE=10MB

# Logging
LOG_LEVEL=info
ENABLE_LOGGING=true

# Development Tools
ENABLE_CORS=true
ENABLE_MORGAN_LOGGING=true
ENABLE_HELMET_SECURITY=true
```

## 🔧 Quick Setup Steps

### Step 1: Generate Security Keys
```bash
# Generate SECRET_KEY
node -e "console.log('SECRET_KEY=' + require('crypto').randomBytes(64).toString('hex'))"

# Generate JWT_SECRET  
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
```

### Step 2: Set Up MongoDB Atlas
1. Go to [mongodb.com/atlas](https://mongodb.com/atlas)
2. Create free account → Create cluster (M0 Free)
3. Create database user with password
4. Network Access → Allow access from anywhere (0.0.0.0/0)
5. Get connection string and replace username/password

### Step 3: Create .env File
```bash
# Copy the minimal template above
# Replace MONGO_URL with your Atlas connection string
# Replace SECRET_KEY and JWT_SECRET with generated keys
```

### Step 4: Start the Application
```bash
# Install dependencies
npm run install-deps

# Start development
npm run dev
```

## ✅ What Works Without Optional Services

**✅ Works perfectly:**
- User authentication (Admin, Teacher, Student)
- Database operations (CRUD)
- Class management
- Student enrollment
- Attendance tracking
- Exam results
- Notice management
- Basic complaints/feedback

**❌ Won't work (but app still runs):**
- Email notifications
- AI-powered insights
- Advanced analytics
- Automated recommendations

## 🔄 Add Optional Services Later

You can always add these services later when needed:

### Add Email Service:
```bash
# Add to .env when ready
EMAIL_USER=your_real_email@gmail.com
EMAIL_PASS=your_gmail_app_password
```

### Add Groq AI:
```bash
# Add to .env when ready
GROQ_API_KEY=gsk_your_real_groq_api_key
```

## 🆘 Troubleshooting

**App won't start:**
- Check MongoDB connection string
- Verify security keys are set
- Ensure ports aren't in use

**Database connection failed:**
- Verify Atlas cluster is running
- Check username/password in connection string
- Ensure IP is whitelisted (0.0.0.0/0)

**Authentication not working:**
- Verify SECRET_KEY and JWT_SECRET are different
- Ensure keys are long enough (64+ characters)

## 🎯 Summary

With just **MongoDB Atlas** + **Security Keys**, you have a fully functional school management system! 

All other services (Email, AI, SMS, etc.) are optional enhancements that can be added later as your needs grow.

**Total setup time: ~10 minutes** ⚡