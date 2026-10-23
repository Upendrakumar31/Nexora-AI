import express from 'express';
import cors from 'cors';
import { clerkMiddleware, requireAuth } from '@clerk/express'
import 'dotenv/config';
import { aiRouter } from './routes/aiRoutes.js';
import { resumeRouter } from './routes/resumeRoutes.js';
import connectCloudinary from './configs/cloudinary.js';
import userRouter from './routes/userRoutes.js';
import { fileURLToPath } from 'url';

const app = express();

try {
    await connectCloudinary();
} catch (cloudinaryError) {
    console.warn('⚠️  [Cloudinary] Connection initialization warning:', cloudinaryError.message);
}

// Restrict CORS to configured client origin with localhost development fallbacks
const allowedOrigins = [
    process.env.CLIENT_URL,
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error(`CORS policy blocked access from origin: ${origin}`));
    },
    credentials: true,
}));

app.use(express.json());

app.use(clerkMiddleware());

app.get('/', (req, res) => res.send('Nexora AI Server is Live!'));

app.use(requireAuth());

app.use('/api/ai', aiRouter);
app.use('/api/resumes', resumeRouter);
app.use('/api/user', userRouter);

// Global error handler for Multer upload errors, CORS rejections, and uncaught route errors
app.use((err, _req, res, _next) => {
    console.error('🚨 [Server Error]:', err.message);
    const statusCode = err.name === 'MulterError' ? 400 : (err.status || 500);
    res.status(statusCode).json({
        success: false,
        message: err.message || 'An internal server error occurred.',
    });
});


const PORT = process.env.PORT || 3000;

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    app.listen(PORT, () => {
        console.log("Server is running on port", PORT);
    });
}

export default app;
export { app };