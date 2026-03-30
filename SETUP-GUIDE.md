# Environment Variables Setup Guide

This guide will help you obtain and configure all the environment variables needed for the School Management System.

## Quick Setup

1. **Copy the environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Edit the `.env` file with your actual values**

## How to Get Each Environment Variable

### 1. Project Information (Already Set)
```bash
PROJECT_NAME=School Management System
PROJECT_VERSION=1.0.0
PROJECT_DESCRIPTION=AI-Driven Learning Intelligence Platform
NODE_ENV=development
```
✅ **No action needed** - These are already configured.

### 2. Database Configuration

#### Option A: Local MongoDB (Recommended for Development)
```bash
MONGO_URL=mongodb://127.0.0.1:27017/smsproject
DB_NAME=smsproject
```

**Steps to set up:**
1. **Install MongoDB:**
   - **Windows/Mac:** Download from [mongodb.com/try/download/community](https://mongodb.com/try/download/community)
   - **Ubuntu:** `sudo apt install mongodb`
   - **Mac (Homebrew):** `brew install mongodb-community`

2. **Start MongoDB:**
   ```bash
   # Windows (as service)
   net start MongoDB
   
   # Mac/Linux
   sudo systemctl start mongod
   # or
   mongod
   ```

3. **Verify connection:**
   ```bash
   mongo
   # or with newer versions
   mongosh
   ```

#### Option B: MongoDB Atlas (Cloud Database)
```bash
MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/smsproject?retryWrites=true&w=majority
```

**Steps to set up:**
1. Go to [mongodb.com/atlas](https://mongodb.com/atlas)
2. Create free account
3. Create new cluster (free tier available)
4. Create database user:
   - Go to Database Access
   - Add New Database User
   - Choose password authentication
   - Save username/password
5. Get connection string:
   - Go to Clusters → Connect
   - Choose "Connect your application"
   - Copy the connection string
   - Replace `<username>` and `<password>` with your credentials

### 3. Server Configuration
```bash
BACKEND_PORT=5000
FRONTEND_PORT=3000
BACKEND_URL=http://localhost:5000
FRONTEND_URL=http://localhost:3000
```
✅ **No action needed** - Use default ports or change if needed.

### 4. Security Keys (IMPORTANT!)
```bash
SECRET_KEY=your_super_secret_key_change_this_in_production
JWT_SECRET=your_jwt_secret_for_token_generation
```

**Generate secure keys:**
```bash
# Method 1: Using Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Method 2: Using OpenSSL
openssl rand -hex 64

# Method 3: Online generator
# Visit: https://generate-secret.vercel.app/64
```

**Example:**
```bash
SECRET_KEY=a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
JWT_SECRET=9876543210fedcba0987654321fedcba0987654321fedcba0987654321fedcba
```

### 5. Email Service (Gmail Setup) - **OPTIONAL**
```bash
EMAIL_SERVICE=gmail
EMAIL_USER=your_school_email@gmail.com
EMAIL_PASS=your_app_specific_password
```

⚠️ **This is completely OPTIONAL!** You can skip email setup and use placeholder values.

**Steps to set up Gmail (only if you want email notifications):**
1. **Enable 2-Factor Authentication:**
   - Go to [myaccount.google.com](https://myaccount.google.com)
   - Security → 2-Step Verification → Turn On

2. **Generate App Password:**
   - Go to Security → 2-Step Verification
   - Scroll down to "App passwords"
   - Select app: "Mail"
   - Select device: "Other" → Enter "School Management System"
   - Copy the 16-character password

3. **Update .env:**
   ```bash
   EMAIL_USER=yourschool@gmail.com
   EMAIL_PASS=abcd efgh ijkl mnop  # The 16-character app password
   ```

**If you skip email setup, just use the placeholder values:**
```bash
EMAIL_SERVICE=gmail
EMAIL_USER=your_school_email@gmail.com
EMAIL_PASS=your_app_specific_password
```

### 6. File Storage
```bash
UPLOAD_DIR=uploads
MAX_FILE_SIZE=10MB
```
✅ **No action needed** - Default settings work fine.

### 7. Groq AI Configuration
```bash
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama3-8b-8192
```

**Steps to get Groq API Key:**
1. **Sign up for Groq:**
   - Go to [console.groq.com](https://console.groq.com)
   - Create free account
   - Verify email

2. **Get API Key:**
   - Go to API Keys section
   - Click "Create API Key"
   - Copy the key (starts with `gsk_`)
   - **Important:** Save it immediately (you can't see it again)

3. **Update .env:**
   ```bash
   GROQ_API_KEY=gsk_1234567890abcdef1234567890abcdef1234567890abcdef
   ```

**Available Models:**
- `llama3-8b-8192` - Fast, good for development
- `llama3-70b-8192` - More powerful, better for production
- `mixtral-8x7b-32768` - Balanced performance
- `gemma-7b-it` - Lightweight

### 8. Logging
```bash
LOG_LEVEL=info
ENABLE_LOGGING=true
```
✅ **No action needed** - Default settings work fine.

### 9. Development Tools
```bash
ENABLE_CORS=true
ENABLE_MORGAN_LOGGING=true
ENABLE_HELMET_SECURITY=true
```
✅ **No action needed** - Keep as `true` for development.

## Final .env File Example

```bash
# Project Information
PROJECT_NAME=School Management System
PROJECT_VERSION=1.0.0
PROJECT_DESCRIPTION=AI-Driven Learning Intelligence Platform

# Environment
NODE_ENV=development

# Database Configuration
MONGO_URL=mongodb://127.0.0.1:27017/smsproject
DB_NAME=smsproject

# Server Configuration
BACKEND_PORT=5000
FRONTEND_PORT=3000

# Security Keys (CHANGE THESE!)
SECRET_KEY=a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
JWT_SECRET=9876543210fedcba0987654321fedcba0987654321fedcba0987654321fedcba

# URLs
BACKEND_URL=http://localhost:5000
FRONTEND_URL=http://localhost:3000

# Email Service
EMAIL_SERVICE=gmail
EMAIL_USER=yourschool@gmail.com
EMAIL_PASS=abcd efgh ijkl mnop

# File Storage
UPLOAD_DIR=uploads
MAX_FILE_SIZE=10MB

# AI/ML Configuration
GROQ_API_KEY=gsk_1234567890abcdef1234567890abcdef1234567890abcdef
GROQ_MODEL=llama3-8b-8192

# Logging
LOG_LEVEL=info
ENABLE_LOGGING=true

# Development Tools
ENABLE_CORS=true
ENABLE_MORGAN_LOGGING=true
ENABLE_HELMET_SECURITY=true
```

## Verification Steps

1. **Test Database Connection:**
   ```bash
   cd backend
   npm install
   npm start
   ```
   Look for "Connected to MongoDB" message.

2. **Test Email (Optional):**
   - Send a test email through the app
   - Check if emails are delivered

3. **Test Groq AI (Optional):**
   ```bash
   # Test API key
   curl -X POST "https://api.groq.com/openai/v1/chat/completions" \
     -H "Authorization: Bearer YOUR_GROQ_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"messages":[{"role":"user","content":"Hello"}],"model":"llama3-8b-8192"}'
   ```

## Security Notes

⚠️ **Important Security Tips:**

1. **Never commit `.env` files to Git**
2. **Use different keys for development/production**
3. **Rotate keys regularly in production**
4. **Use environment-specific configurations**

## Troubleshooting

### Common Issues:

1. **MongoDB Connection Failed:**
   - Check if MongoDB is running: `sudo systemctl status mongod`
   - Verify connection string format
   - Check firewall settings

2. **Email Not Working:**
   - Verify 2FA is enabled on Gmail
   - Check app password is correct (16 characters)
   - Test with a simple email client first

3. **Groq API Errors:**
   - Verify API key format (starts with `gsk_`)
   - Check rate limits (free tier has limits)
   - Ensure model name is correct

4. **Port Already in Use:**
   ```bash
   # Find what's using the port
   lsof -i :5000
   
   # Kill the process
   kill -9 <PID>
   
   # Or use different ports in .env
   BACKEND_PORT=5001
   FRONTEND_PORT=3001
   ```

## Production Setup

For production, uncomment and modify these lines in `.env`:

```bash
NODE_ENV=production
MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/smsproject
BACKEND_URL=https://api.yourschool.com
FRONTEND_URL=https://app.yourschool.com
ENABLE_CORS=false
GROQ_MODEL=llama3-70b-8192
```

## Need Help?

If you encounter issues:
1. Check the logs in the terminal
2. Verify each environment variable is set correctly
3. Test each service individually
4. Check the troubleshooting section above