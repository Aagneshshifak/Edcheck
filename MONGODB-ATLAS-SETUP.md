# MongoDB Atlas Setup Guide (SRV Connection)

This guide will help you set up MongoDB Atlas cloud database for your School Management System.

## 🚀 Step-by-Step Atlas Setup

### Step 1: Create MongoDB Atlas Account
1. Go to [mongodb.com/atlas](https://mongodb.com/atlas)
2. Click **"Try Free"**
3. Sign up with email or Google account
4. Verify your email address

### Step 2: Create Your First Cluster
1. **Choose deployment option:**
   - Select **"Shared"** (Free tier - M0 Sandbox)
   - Click **"Create"**

2. **Configure cluster:**
   - **Cloud Provider:** AWS (recommended)
   - **Region:** Choose closest to your location
   - **Cluster Tier:** M0 Sandbox (Free Forever)
   - **Cluster Name:** Leave default or name it `sms-cluster`

3. **Click "Create Cluster"** (takes 1-3 minutes)

### Step 3: Create Database User
1. **Go to Database Access** (left sidebar)
2. **Click "Add New Database User"**
3. **Authentication Method:** Password
4. **Username:** `smsuser` (or your preferred username)
5. **Password:** Click "Autogenerate Secure Password" or create your own
   - **⚠️ IMPORTANT:** Copy and save this password!
6. **Database User Privileges:** 
   - Select "Read and write to any database"
7. **Click "Add User"**

### Step 4: Configure Network Access
1. **Go to Network Access** (left sidebar)
2. **Click "Add IP Address"**
3. **Choose one option:**
   
   **Option A: Allow Access from Anywhere (Development)**
   - Click "Allow Access from Anywhere"
   - IP Address: `0.0.0.0/0`
   - ⚠️ **Note:** Only use this for development
   
   **Option B: Add Your Current IP (Recommended)**
   - Click "Add Current IP Address"
   - Your IP will be auto-detected

4. **Click "Confirm"**

### Step 5: Get Connection String
1. **Go to Clusters** (Database → Clusters)
2. **Click "Connect"** on your cluster
3. **Choose "Connect your application"**
4. **Driver:** Node.js
5. **Version:** 4.1 or later
6. **Copy the connection string** - it looks like:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

### Step 6: Configure Your Connection String

**Replace placeholders in the connection string:**

**Original:**
```
mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

**Updated (example):**
```
mongodb+srv://smsuser:MySecurePassword123@cluster0.abc123.mongodb.net/smsproject?retryWrites=true&w=majority
```

**Key changes:**
- Replace `<username>` with your database username (e.g., `smsuser`)
- Replace `<password>` with your database password
- Add `/smsproject` before the `?` to specify database name

### Step 7: Update Your .env File

Open your `.env` file and update the MongoDB URL:

```bash
# Replace this line:
MONGO_URL=mongodb://127.0.0.1:27017/smsproject

# With your Atlas connection string:
MONGO_URL=mongodb+srv://smsuser:MySecurePassword123@cluster0.abc123.mongodb.net/smsproject?retryWrites=true&w=majority
```

## 🔧 Complete .env Configuration

Here's your complete `.env` file with Atlas:

```bash
# Project Information
PROJECT_NAME=School Management System
PROJECT_VERSION=1.0.0
PROJECT_DESCRIPTION=AI-Driven Learning Intelligence Platform

# Environment
NODE_ENV=development

# Database Configuration (MongoDB Atlas)
MONGO_URL=mongodb+srv://smsuser:YourPassword123@cluster0.xxxxx.mongodb.net/smsproject?retryWrites=true&w=majority
DB_NAME=smsproject

# Server Configuration
BACKEND_PORT=5000
FRONTEND_PORT=3000

# Security Keys (Generate new ones!)
SECRET_KEY=your_generated_secret_key_64_characters_long
JWT_SECRET=your_generated_jwt_secret_key_64_characters_long

# URLs
BACKEND_URL=http://localhost:5000
FRONTEND_URL=http://localhost:3000

# Email Service
EMAIL_SERVICE=gmail
EMAIL_USER=your_school_email@gmail.com
EMAIL_PASS=your_gmail_app_password

# File Storage
UPLOAD_DIR=uploads
MAX_FILE_SIZE=10MB

# AI/ML Configuration
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama3-8b-8192

# Logging
LOG_LEVEL=info
ENABLE_LOGGING=true

# Development Tools
ENABLE_CORS=true
ENABLE_MORGAN_LOGGING=true
ENABLE_HELMET_SECURITY=true
```

## ✅ Test Your Connection

1. **Start your backend:**
   ```bash
   cd backend
   npm install
   npm start
   ```

2. **Look for success message:**
   ```
   Connected to MongoDB
   Server started at port no. 5000
   ```

3. **If connection fails, check:**
   - Username and password are correct
   - IP address is whitelisted
   - Connection string format is correct

## 🔒 Security Best Practices

### For Development:
- Use "Allow Access from Anywhere" (0.0.0.0/0)
- Keep default M0 free tier

### For Production:
1. **Restrict IP Access:**
   - Only add specific server IPs
   - Remove 0.0.0.0/0 access

2. **Use Environment Variables:**
   ```bash
   # Production .env
   NODE_ENV=production
   MONGO_URL=mongodb+srv://produser:SecurePassword@prod-cluster.xxxxx.mongodb.net/smsproject?retryWrites=true&w=majority
   ```

3. **Create Separate Clusters:**
   - Development cluster
   - Production cluster
   - Different users for each

## 🆘 Troubleshooting

### Connection Timeout Error:
```
MongoNetworkTimeoutError: connection timed out
```
**Solutions:**
- Check Network Access settings
- Verify your IP is whitelisted
- Try "Allow Access from Anywhere" temporarily

### Authentication Failed:
```
MongoServerError: bad auth : authentication failed
```
**Solutions:**
- Double-check username and password
- Ensure user has "Read and write" permissions
- Check for special characters in password (URL encode them)

### DNS Resolution Error:
```
MongooseServerSelectionError: getaddrinfo ENOTFOUND
```
**Solutions:**
- Check internet connection
- Verify cluster URL is correct
- Try different DNS (8.8.8.8)

### Special Characters in Password:
If your password has special characters, URL encode them:
- `@` becomes `%40`
- `#` becomes `%23`
- `$` becomes `%24`
- `%` becomes `%25`

**Example:**
```
Password: MyPass@123#
Encoded: MyPass%40123%23
```

## 📊 Monitor Your Database

1. **Go to Atlas Dashboard**
2. **Click on your cluster**
3. **View metrics:**
   - Connections
   - Operations
   - Storage usage

## 💰 Free Tier Limits

MongoDB Atlas M0 (Free) includes:
- **Storage:** 512 MB
- **RAM:** Shared
- **Connections:** 500 concurrent
- **No credit card required**

Perfect for development and small projects!

## 🚀 Next Steps

1. **Test the connection** with your app
2. **Set up other environment variables** (Groq API, Email)
3. **Start developing** your School Management System
4. **Monitor usage** in Atlas dashboard

Your MongoDB Atlas setup is now complete! 🎉