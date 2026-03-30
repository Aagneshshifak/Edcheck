# Environment Configuration Guide

This guide explains how to set up environment variables for the School Management System.

## Quick Start

1. **Backend Setup:**
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env with your actual values
   ```

2. **Frontend Setup:**
   ```bash
   cd frontend
   cp .env.example .env
   # Edit .env with your actual values
   ```

## Environment Files Overview

### 1. `backend/.env` - Backend Configuration
Contains server-side environment variables including:
- Database connection strings
- API keys and secrets
- Email/SMS service configuration
- Security settings

### 2. `frontend/.env` - Frontend Configuration
Contains client-side environment variables including:
- API endpoints
- Feature flags
- Third-party service keys (public keys only)
- UI configuration

### 3. `.env` - Root Configuration (Optional)
Shared environment variables for development convenience.

### 4. `docker-compose.env` - Docker Configuration
Environment variables for Docker Compose deployment.

## Required Environment Variables

### Backend (Minimum Required)
```bash
MONGO_URL=mongodb://127.0.0.1:27017/smsproject
SECRET_KEY=your_secret_key_here
PORT=5000
```

### Frontend (Minimum Required)
```bash
REACT_APP_BASE_URL=http://localhost:5000
```

## Database Setup Options

### Option 1: Local MongoDB
```bash
# Install MongoDB locally
MONGO_URL=mongodb://127.0.0.1:27017/smsproject
```

### Option 2: MongoDB Atlas (Cloud)
```bash
MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/smsproject?retryWrites=true&w=majority
```

### Option 3: Docker MongoDB
```bash
MONGO_URL=mongodb://smsuser:password@localhost:27017/smsproject
```

## Security Best Practices

1. **Never commit `.env` files to version control**
2. **Use strong, unique passwords and secrets**
3. **Rotate secrets regularly in production**
4. **Use different secrets for different environments**

## Environment-Specific Configurations

### Development
```bash
NODE_ENV=development
LOG_LEVEL=debug
ENABLE_CORS=true
```

### Production
```bash
NODE_ENV=production
LOG_LEVEL=error
ENABLE_CORS=false
# Use HTTPS URLs
BACKEND_URL=https://api.yourschool.com
FRONTEND_URL=https://app.yourschool.com
```

### Testing
```bash
NODE_ENV=test
MONGO_URL=mongodb://127.0.0.1:27017/smsproject_test
LOG_LEVEL=silent
```

## Common Issues and Solutions

### 1. Database Connection Failed
- Check if MongoDB is running
- Verify MONGO_URL format
- Ensure network connectivity

### 2. CORS Errors
- Verify FRONTEND_URL in backend .env
- Check REACT_APP_BASE_URL in frontend .env
- Ensure CORS is enabled in development

### 3. Authentication Issues
- Verify SECRET_KEY and JWT_SECRET are set
- Ensure secrets match between environments
- Check token expiration settings

## Docker Deployment

1. Copy docker environment file:
   ```bash
   cp docker-compose.env.example docker-compose.env
   ```

2. Update values in `docker-compose.env`

3. Run with Docker Compose:
   ```bash
   docker-compose --env-file docker-compose.env up
   ```

## Environment Validation

The application includes environment validation on startup. Missing required variables will cause the application to exit with an error message.

## Additional Services Configuration

### Email Service (Gmail Example)
```bash
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password  # Use App Password, not regular password
```

### SMS Service (Twilio Example)
```bash
SMS_API_KEY=your_twilio_api_key
SMS_SENDER_ID=+1234567890
```

### Groq AI Service Configuration
```bash
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama3-8b-8192  # Available models: llama3-8b-8192, llama3-70b-8192, mixtral-8x7b-32768, gemma-7b-it
GROQ_BASE_URL=https://api.groq.com/openai/v1
GROQ_DEFAULT_TEMPERATURE=0.7
GROQ_MAX_TOKENS=1024
```

### File Upload Configuration
```bash
MAX_FILE_SIZE=10485760  # 10MB in bytes
UPLOAD_PATH=./uploads
ALLOWED_FILE_TYPES=.jpg,.jpeg,.png,.pdf,.doc,.docx
```

## Monitoring and Logging

```bash
LOG_LEVEL=info  # debug, info, warn, error
LOG_FILE=logs/app.log
ENABLE_LOGGING=true
```

## Support

For environment configuration issues:
1. Check this documentation
2. Verify all required variables are set
3. Check application logs for specific error messages
4. Ensure services (MongoDB, Redis) are running