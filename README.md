
<h1 align="center">
     Edcheck — AI-Driven School Management Platform
</h1>
=======

Edcheck is a full-stack school management system built on the MERN stack with AI-powered learning intelligence. It brings together attendance tracking, performance analytics, test management, and real-time notifications into one platform for admins, teachers, students, and parents.

Live at: https://edcheck-neon.vercel.app

---

## What it does

Admins get a full dashboard to manage classes, teachers, students, assignments, and tests. They can see school-wide analytics, attendance reports, and AI-generated risk assessments for struggling students.

Teachers can take attendance, create and assign tests, grade submissions, view class insights, and use the AI teaching assistant to generate notes, detect weak topics, and build question banks.

Students get a personalised dashboard with their attendance, marks, upcoming tests, AI-generated study plans, daily routines, and assignment help.

Parents can log in to track their child's attendance, marks, and progress without needing to contact the school directly.

---

## Demo accounts

The database is pre-seeded with a full school setup including 10 classes, 20 teachers, 450 students, and their parents. Use any of the accounts below to explore the platform.

### Admin

There is one admin account for the entire school.

| Field    | Value               |
|----------|---------------------|
| Email    | admin@school.com    |
| Password | admin123            |

The admin account gives you access to the full dashboard, analytics, test control panel, teacher and student management, and all AI intelligence features.

### Teachers

There are 20 teacher accounts. Each teacher is assigned to specific subjects and classes.

| Email                    | Password    |
|--------------------------|-------------|
| teacher1@school.com      | teacher123  |
| teacher2@school.com      | teacher123  |
| teacher3@school.com      | teacher123  |
| teacher4@school.com      | teacher123  |
| teacher5@school.com      | teacher123  |
| teacher6@school.com      | teacher123  |
| teacher7@school.com      | teacher123  |
| teacher8@school.com      | teacher123  |
| teacher9@school.com      | teacher123  |
| teacher10@school.com     | teacher123  |
| teacher11@school.com     | teacher123  |
| teacher12@school.com     | teacher123  |
| teacher13@school.com     | teacher123  |
| teacher14@school.com     | teacher123  |
| teacher15@school.com     | teacher123  |
| teacher16@school.com     | teacher123  |
| teacher17@school.com     | teacher123  |
| teacher18@school.com     | teacher123  |
| teacher19@school.com     | teacher123  |
| teacher20@school.com     | teacher123  |

All teacher accounts use the same password: teacher123

### Students

There are 45 students per class across 10 classes (450 students total). Students log in using their name and roll number, not an email address.

To try a student account, use any student name visible in the admin panel after logging in as admin. The roll numbers run from 1 to 45 within each class.

| Field    | Value       |
|----------|-------------|
| Password | student123  |

### Parents

Each student has a linked parent account. Parent emails follow this pattern:

```
parent.{rollNumber}.class{classNumber}@school.com
```

Examples:

| Email                          | Password    | Child                        |
|--------------------------------|-------------|------------------------------|
| parent.1.class1@school.com     | parent123   | Roll 1, Class 6 Section A    |
| parent.1.class2@school.com     | parent123   | Roll 1, Class 6 Section B    |
| parent.1.class3@school.com     | parent123   | Roll 1, Class 7 Section A    |
| parent.5.class1@school.com     | parent123   | Roll 5, Class 6 Section A    |

All parent accounts use the same password: parent123

---

## Classes in the system

The school has 10 classes across grades 6 to 10.

| Class              |
|--------------------|
| Class 6 Section A  |
| Class 6 Section B  |
| Class 7 Section A  |
| Class 7 Section B  |
| Class 8 Section A  |
| Class 8 Section B  |
| Class 9 Section A  |
| Class 9 Section B  |
| Class 10 Section A |
| Class 10 Section B |

Each class has 7 subjects: Mathematics, Physics, Chemistry, Biology, English, French, and Computer Science.

---

## Running locally

You need Node.js 18 or higher and a MongoDB connection (local or Atlas).

Clone the repository and set up the backend:

```bash
cd backend
npm install
```

Create a .env file inside the backend folder:

```
MONGO_URL=mongodb://127.0.0.1/edcheck
JWT_SECRET=your_secret_key_here
PORT=5001
GROQ_API_KEY=your_groq_api_key
```

Start the backend:

```bash
npm start
```

Set up the frontend:

```bash
cd frontend
npm install
```

Create a .env file inside the frontend folder:

```
VITE_API_URL=http://localhost:5001
```

Start the frontend:

```bash
npm start
```

Frontend runs at localhost:3000. Backend runs at localhost:5001.

To seed the database with demo data:

```bash
cd backend
npm run seed
```

This creates the admin, all 20 teachers, 450 students, their parents, timetables, and subjects.

---

## Tech stack

- Frontend: React, Material UI, Redux Toolkit, Recharts
- Backend: Node.js, Express
- Database: MongoDB with Mongoose
- AI: Groq (llama-3.3-70b-versatile)
- Auth: JWT
- File uploads: Cloudinary
- Process manager: PM2
- Reverse proxy: Nginx
- Frontend hosting: Vercel
- Backend hosting: Google Compute Engine

---

## Project structure

```
Edcheck/
├── backend/
│   ├── controllers/       API route handlers
│   ├── models/            Mongoose schemas
│   ├── routes/            Express route definitions
│   ├── services/          AI services, schedulers, caching
│   ├── middleware/        Auth, rate limiting, uploads
│   ├── scripts/           Seed and diagnostic scripts
│   └── index.js           Server entry point
├── frontend/
│   └── src/
│       ├── pages/         Admin, Teacher, Student, Parent views
│       ├── components/    Shared UI components
│       ├── redux/         State management
│       └── config/        API URL config
├── deployment/
│   ├── nginx/             Nginx reverse proxy config
│   ├── setup-ssl.sh       One-time SSL setup script
│   ├── deploy.sh          Deploy updates script
│   └── README.md          Production deployment guide
└── ecosystem.config.js    PM2 process config
```

---

## Deployment

The frontend is deployed on Vercel at https://edcheck-neon.vercel.app

For backend deployment on a GCE VM with Nginx and SSL, see the full guide in deployment/README.md.

---

## Environment variables reference

Backend (.env):

| Variable                | Required | Description                          |
|-------------------------|----------|--------------------------------------|
| MONGO_URL               | Yes      | MongoDB connection string            |
| JWT_SECRET              | Yes      | Secret key for signing JWTs          |
| PORT                    | No       | Server port, defaults to 5001        |
| GROQ_API_KEY            | Yes      | Groq API key for AI features         |
| CLOUDINARY_CLOUD_NAME   | No       | Cloudinary for file uploads          |
| CLOUDINARY_API_KEY      | No       | Cloudinary API key                   |
| CLOUDINARY_API_SECRET   | No       | Cloudinary API secret                |

Frontend (.env):

| Variable      | Description                  |
|---------------|------------------------------|
| VITE_API_URL  | Backend API base URL         |
