# AI StudyHub

AI StudyHub is a full-stack learning workspace for organizing study documents, collaborating in workspaces, discovering public libraries, and using Gemini-powered document chat and flashcard generation.

The repository contains:

- A React 19 + Vite frontend in `FE/`
- An Express 5 backend in `BE/`
- Supabase-backed data and file storage
- Google sign-in, email/OTP registration, JWT access tokens, and refresh-token cookies
- AI document processing, semantic retrieval, moderation, and study tools
- Administrative dashboards for users, content, activity, storage, and AI usage

For the complete architecture, workflows, API catalog, data dependencies, and implementation notes, see [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md).

## Main Features

- Email/OTP registration, password login, Google OAuth, and password recovery
- Persistent sessions with short-lived access tokens and HttpOnly refresh cookies
- Personal document libraries with public/private visibility
- PDF, DOCX, and TXT upload, download, tagging, and deletion
- AI-assisted document moderation, metadata generation, embeddings, and semantic search
- Document-grounded chatbot and generated flashcards
- Shared workspaces with `Admin`, `Editor`, and `Viewer` membership
- Guest browsing of public libraries
- User search and public profile pages
- System-admin dashboard, moderation queue, user status management, logs, and usage metrics
- Light/dark theme and local interface preferences

## Technology Stack

| Layer | Technologies |
| --- | --- |
| Frontend | React 19, React Router 7, Vite 8, Axios, React Icons |
| Backend | Node.js, Express 5, Multer, JWT, bcrypt, Nodemailer |
| Database and storage | Supabase PostgreSQL, Supabase Storage, pgvector-compatible embeddings |
| AI | Google Gemini text and embedding models |
| Authentication | Email/OTP, username/password, Google OAuth, JWT access/refresh tokens |
| Document parsing | `pdf-parse`, `mammoth`, plain-text decoding |
| Testing and quality | Jest, ESLint, Vite production build |

## Prerequisites

- Node.js `^20.19.0` or `>=22.12.0`
- npm
- A Supabase project with the required tables, storage bucket, and `match_document_chunks` RPC
- A Google Gemini API key
- SMTP credentials for OTP and password-reset email
- A Google OAuth client for Google sign-in

The SQL schema and migrations are not included in this repository. The required data objects are summarized in [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md#data-and-storage-model).

## Quick Start

### 1. Install dependencies

```bash
cd BE
npm install

cd ../FE
npm install
```

The root `package.json` is not an application runner; install and run each application from its own directory.

### 2. Configure the backend

Create `BE/.env`:

```dotenv
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_DOCUMENT_BUCKET=documents

JWT_SECRET=replace-with-a-long-random-secret

GOOGLE_CLIENT_ID=your-google-oauth-client-id

EMAIL_HOST=your-smtp-host
EMAIL_PORT=2525
EMAIL_USER=your-smtp-user
EMAIL_PASS=your-smtp-password

GEMINI_API_KEY=your-gemini-api-key
GEMINI_TEXT_MODEL=gemini-2.5-flash
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
```

Never commit `.env` files or a Supabase service-role key.

### 3. Configure the frontend

Create `FE/.env`:

```dotenv
VITE_API_BASE_URL=http://localhost:5000/api
```

The frontend Google OAuth client is currently declared directly in:

- `FE/src/components/pages/LoginPage/LoginPage.jsx`
- `FE/src/components/pages/RegisterPage/RegisterGoogle.jsx`

It must match `GOOGLE_CLIENT_ID` on the backend. Moving it to a `VITE_GOOGLE_CLIENT_ID` variable is recommended before deployment.

### 4. Run the applications

Start the backend:

```bash
cd BE
node server.js
```

Start the frontend in another terminal:

```bash
cd FE
npm run dev
```

Open `http://localhost:5173`. The backend defaults to `http://localhost:5000`, and `GET /` can be used as a basic health check.

## Available Commands

### Frontend

```bash
npm run dev       # Start the Vite development server
npm run build     # Create a production build in FE/dist
npm run lint      # Run ESLint
npm run preview   # Preview the production build
```

### Backend

```bash
node server.js       # Start the API server
npm test             # Run Jest once
npm run test:watch   # Run Jest in watch mode
npm run test:coverage
```

## Repository Layout

```text
AI-student-hub/
├── BE/
│   ├── server.js
│   └── src/
│       ├── config/
│       ├── controllers/
│       ├── middleware/
│       ├── routes/
│       ├── services/
│       └── utils/
├── FE/
│   ├── public/
│   └── src/
│       ├── assets/
│       ├── components/
│       ├── context/
│       └── utils/
├── tools/srs_rewrite/
├── PROJECT_DOCUMENTATION.md
├── LICENSE
└── README.md
```

## Important Development Notes

- Authenticated API requests use `Authorization: Bearer <accessToken>`.
- The Axios client automatically attempts `/api/auth/refresh` after an eligible `401`.
- The refresh token is stored as an HttpOnly cookie scoped to `/api/auth`.
- Uploads accept PDF, DOCX, and TXT files, up to 10 files per request and 20 MB per file on the backend.
- `ChatBot.jsx` and `Flashcards.jsx` currently contain hard-coded `http://localhost:5000` URLs; replace them with the shared API client before non-local deployment.
- The UI currently advertises a 50 MB file limit in places while the backend enforces 20 MB per file.
- Database migrations are not checked in, so a compatible Supabase schema must be created separately.

## License

This project is licensed under the [MIT License](LICENSE).
