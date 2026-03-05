# ArtLens AI Backend API Reference

This document outlines the REST API endpoints provided by the Express backend. The backend serves as a proxy to Google Cloud services (Firestore, Cloud Storage, and Vertex AI) to keep client-side secure.

## Authentication

Most endpoints require authentication via a custom HTTP header containing the user's UUID.

**Header:** `X-User-Id: <uuid>`

Endpoints that do not require authentication are explicitly marked below. If authentication fails, the server responds with:
```json
{ "error": "Access denied" } // 403 Forbidden
```

---

## 1. Users

### Create User (Onboarding)
Create a new user profile. Returns a generated `userId` which should be used for all subsequent authenticated requests.

- **Method:** `POST`
- **Endpoint:** `/api/users`
- **Auth Required:** No

**Request Body:**
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "persona": "guide", // "guide" | "academic" | "blogger"
  "language": "en"   // "en" | "pt" | "es"
}
```

**Response:** `201 Created`
```json
{
  "userId": "123e4567-e89b-12d3-a456-426614174000"
}
```

### Get User Profile
Fetch the user's settings and metadata.

- **Method:** `GET`
- **Endpoint:** `/api/users/:userId`
- **Auth Required:** Yes

**Response:** `200 OK`
```json
{
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "persona": "guide",
  "language": "en",
  "selfieUrl": "users/123e4567-e89b-12d3-a456-426614174000/selfie.jpg",
  "createdAt": "2026-03-05T12:00:00.000Z",
  "lastActiveAt": "2026-03-05T14:30:00.000Z"
}
```

### Update User Profile
Update specific fields on the user profile.

- **Method:** `PATCH`
- **Endpoint:** `/api/users/:userId`
- **Auth Required:** Yes

**Request Body (Partial updates allowed):**
```json
{
  "persona": "academic",
  "language": "pt"
}
```

**Response:** `200 OK`
```json
{
  "ok": true
}
```

### Get User Scan History
Retrieve the 50 most recent artwork scans.

- **Method:** `GET`
- **Endpoint:** `/api/users/:userId/scans`
- **Auth Required:** Yes

**Response:** `200 OK`
```json
{
  "scans": [
    {
      "scanId": "abc-123",
      "artworkTitle": "Starry Night",
      "artist": "Vincent van Gogh",
      "year": "1889",
      "style": "Post-Impressionism",
      "capturedImageUrl": "...",
      "createdAt": "2026-03-05T12:30:00.000Z",
      "language": "en"
    }
  ]
}
```

---

## 2. Scans & Analysis

### Save Scan Result
Record a new scanned artwork to Firestore.

- **Method:** `POST`
- **Endpoint:** `/api/scans`
- **Auth Required:** Yes

**Request Body:**
```json
{
  "artData": {
    "title": "Mona Lisa",
    "artist": "Leonardo da Vinci",
    "year": "1503",
    "country": "Italy",
    "style": "Renaissance",
    "description": "A portrait...",
    "funFact": "It was stolen in 1911.",
    "sources": [],
    "annotations": []
  },
  "capturedImageUrl": "users/.../scan/abc.jpg",
  "language": "en"
}
```

**Response:** `201 Created`
```json
{
  "scanId": "def-456"
}
```

### Update Deep Analysis
Append asynchronous deep analysis results to an existing scan.

- **Method:** `PATCH`
- **Endpoint:** `/api/scans/:scanId/deep-analysis`
- **Auth Required:** Yes

**Request Body:**
```json
{
  "deepAnalysis": {
    "historicalContext": "...",
    "technicalAnalysis": "...",
    "symbolism": "...",
    "curiosities": ["...", "..."]
  }
}
```

**Response:** `200 OK`
```json
{
  "ok": true
}
```

---

## 3. Chat History

### Load Chat History
Load all messages related to a specific scanned artwork.

- **Method:** `GET`
- **Endpoint:** `/api/scans/:scanId/chats`
- **Auth Required:** Yes

**Response:** `200 OK`
```json
{
  "messages": [
    {
      "messageId": "msg-001",
      "role": "user",
      "text": "Who painted this?",
      "isAudioTranscription": false,
      "createdAt": "2026-03-05T12:35:00.000Z"
    }
  ]
}
```

### Save Chat Message
Record a new message sent by either the user or the AI model.

- **Method:** `POST`
- **Endpoint:** `/api/scans/:scanId/chats`
- **Auth Required:** Yes

**Request Body:**
```json
{
  "role": "model", // "user" | "model"
  "text": "Leonardo da Vinci painted the Mona Lisa.",
  "isAudioTranscription": false
}
```

**Response:** `201 Created`
```json
{
  "messageId": "msg-002"
}
```

---

## 4. Images & Storage

### Upload Image
Upload an image to Cloud Storage. Note that this uses `multipart/form-data`. Maximum file size is 5MB.

- **Method:** `POST`
- **Endpoint:** `/api/images/upload`
- **Auth Required:** Yes
- **Content-Type:** `multipart/form-data`

**Form Fields:**
- `file`: The image file (JPEG, PNG, WEBP)
- `type`: `selfie`, `scan`, or `generated`
- `scanId`: Required if type is `scan`

**Response:** `200 OK`
```json
{
  "url": "users/123e4567-e89b-12d3-a456-426614174000/selfie.jpg"
}
```
*(Common Errors: `413 Payload Too Large`, `415 Unsupported Media Type`)*

### Get Image
Proxy an image request to Cloud Storage via a signed URL redirect.

- **Method:** `GET`
- **Endpoint:** `/api/images/*`
- **Auth Required:** Yes

**Example:**
`GET /api/images/users/123e4567/selfie.jpg` -> `302 Redirect` to a temporary GCP Signed URL.

---

## 5. Vertex AI Generation Proxies

### Forward Text/Chat Generation
A direct proxy to Vertex AI for text generation. Passes the `X-User-Id` validation but otherwise acts as a passthrough.

- **Method:** `POST`
- **Endpoint:** `/api/generate`
- **Auth Required:** Yes

**Request Body (Partial Example):**
```json
{
  "model": "gemini-2.5-flash",
  "contents": [
    { "role": "user", "parts": [{ "text": "Hello Gemini" }] }
  ],
  "systemInstruction": { "parts": [{ "text": "You are a helpful guide." }] }
}
```

**Response:** `200 OK`
Returns the raw Vertex AI JSON response, but adds a top-level convenience field:
```json
{
  "text": "Hello! How can I help?",
  "candidates": [...],
  "usageMetadata": {...}
}
```

### Generate Artwork Portrait ("Generate Me")
Generates an image using the user's previously uploaded selfie, styled to match the specified artwork.

- **Method:** `POST`
- **Endpoint:** `/api/generate-image`
- **Auth Required:** Yes

**Request Body:**
```json
{
  "artworkTitle": "Starry Night",
  "artworkArtist": "Vincent van Gogh",
  "artworkYear": "1889", // optional
  "artworkStyle": "Post-Impressionism" // optional
}
```

**Response:** `200 OK`
```json
{
  "imageId": "img-999",
  "imageUrl": "https://storage.googleapis.com/... (signed URL)",
  "prompt": "Generate a creative artistic portrait..."
}
```

### List Generated Image Gallery
Fetch the user's history of AI-generated portraits.

- **Method:** `GET`
- **Endpoint:** `/api/generate-image`
- **Auth Required:** Yes

**Response:** `200 OK`
```json
{
  "images": [
    {
      "id": "img-999",
      "artworkTitle": "Starry Night",
      "artworkArtist": "Vincent van Gogh",
      "imageUrl": "https://storage.googleapis.com/...",
      "prompt": "...",
      "createdAt": 1709643600000
    }
  ]
}
```
