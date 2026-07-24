// Load environment variables first
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// Import routes
const authRoutes = require('./src/routes/authRoutes');
const documentRoutes = require('./src/routes/documentRoutes');
const aiRoutes = require('./src/routes/aiRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const workspaceRoutes = require('./src/routes/workspaceRoutes');
const publicRoutes = require('./src/routes/publicRoutes');
const profileRoutes = require('./src/routes/profileRoutes');
const issueReportRoutes = require('./src/routes/issueReportRoutes');

// ─── 1. Security headers (helmet) ─────────────────────────────────────────────
app.use(helmet({
    // Allow cross-origin embedding of Supabase signed-URL documents
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ─── 2. CORS ──────────────────────────────────────────────────────────────────
app.use(cors({
    origin: [
        ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
        'http://localhost:5173',
        'http://localhost:5174',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:5174',
    ],
    credentials: true, // Allow cookies/tokens
}));

// ─── 3. Body parsing ──────────────────────────────────────────────────────────
app.use(express.json());

// ─── 4. Rate limiters ─────────────────────────────────────────────────────────

// General API limiter – 100000000 requests per 15 minutes per IP
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100000000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: 'error', message: 'Too many requests. Please try again later.' },
});

// Strict limiter for OTP and auth flows – 10 requests per 15 minutes per IP
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: 'error', message: 'Too many authentication attempts. Please wait 15 minutes and try again.' },
});

app.use('/api', generalLimiter);

// Apply strict limiter to OTP / sensitive auth endpoints
app.use('/api/auth/verify-otp', authLimiter);
app.use('/api/auth/verify-reset-otp', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/google', authLimiter);

// ─── 5. Mount routes ──────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/issues', issueReportRoutes);

// Health check
app.get('/', (req, res) => {
    res.send('AI StudyHub Backend is running.');
});

// ─── 6. Start server ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`[🚀 Server] Listening at http://localhost:${PORT}`);
});
