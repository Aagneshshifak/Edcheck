# Update Test Questions Endpoint

## Endpoint
`PUT /Test/:id/questions`

## Description
Allows teachers to add or update questions for an existing test. This endpoint validates question data, checks teacher authorization, and preserves all test metadata.

## Authentication
Requires authentication token (via `auth` middleware)

## Request Parameters

### URL Parameters
- `id` (required): The test ID

### Body Parameters
```json
{
  "teacherId": "507f1f77bcf86cd799439011",
  "questions": [
    {
      "questionText": "What is 2+2?",
      "options": ["3", "4", "5", "6"],
      "correctAnswer": 1,
      "marks": 1
    },
    {
      "questionText": "What is the capital of France?",
      "options": ["London", "Paris", "Berlin", "Madrid"],
      "correctAnswer": 1,
      "marks": 2
    }
  ]
}
```

## Validation Rules

### Question Text
- Must not be empty
- Must not be only whitespace

### Options
- Must be an array
- Must have between 2-6 options

### Correct Answer
- Must be a valid index (0-based) within the options array
- Cannot be negative
- Cannot be greater than or equal to options.length

### Marks
- Must be greater than 0
- Can be decimal (e.g., 0.5, 1.5)

## Authorization
- Teacher must teach the class associated with the test
- Checks both `teachClasses` array and legacy `teachSclass` field

## Response

### Success (200)
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "title": "Math Quiz",
  "subject": {
    "_id": "507f1f77bcf86cd799439012",
    "subName": "Mathematics",
    "subCode": "MATH101"
  },
  "classId": {
    "_id": "507f1f77bcf86cd799439013",
    "sclassName": "Class 10A"
  },
  "durationMinutes": 30,
  "questions": [
    {
      "questionText": "What is 2+2?",
      "options": ["3", "4", "5", "6"],
      "correctAnswer": 1,
      "marks": 1
    }
  ],
  "isActive": false,
  "createdBy": "507f1f77bcf86cd799439014",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T11:00:00.000Z"
}
```

### Error Responses

#### 400 - Missing Questions Array
```json
{
  "message": "Questions array is required"
}
```

#### 400 - Invalid Question Data
```json
{
  "message": "Question 1: Question text cannot be empty"
}
```

```json
{
  "message": "Question 2: Questions must have 2-6 options"
}
```

```json
{
  "message": "Question 3: Correct answer must be a valid option index"
}
```

```json
{
  "message": "Question 4: Marks must be greater than 0"
}
```

#### 404 - Test Not Found
```json
{
  "message": "Test not found"
}
```

#### 403 - Unauthorized Teacher
```json
{
  "message": "Unauthorized: Teacher not found"
}
```

```json
{
  "message": "Unauthorized: Teacher does not teach this class"
}
```

#### 500 - Server Error
```json
{
  "message": "Error message details"
}
```

## Example Usage

### Using cURL
```bash
curl -X PUT http://localhost:5001/Test/507f1f77bcf86cd799439011/questions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "teacherId": "507f1f77bcf86cd799439015",
    "questions": [
      {
        "questionText": "What is 2+2?",
        "options": ["3", "4", "5", "6"],
        "correctAnswer": 1,
        "marks": 1
      }
    ]
  }'
```

### Using JavaScript (Axios)
```javascript
const axios = require('axios');

const updateQuestions = async (testId, teacherId, questions) => {
  try {
    const response = await axios.put(
      `http://localhost:5001/Test/${testId}/questions`,
      {
        teacherId,
        questions
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('Questions updated:', response.data);
  } catch (error) {
    console.error('Error:', error.response.data);
  }
};
```

## Notes

- The endpoint preserves all existing test metadata (title, subject, class, duration, createdBy)
- Only the questions array is updated
- All questions are validated before any database update occurs
- If any question fails validation, the entire request is rejected
- The response includes populated subject and class details
