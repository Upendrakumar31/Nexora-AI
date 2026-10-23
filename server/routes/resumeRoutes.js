import express from 'express';
import { auth } from '../middlewares/auth.js';
import { listResumes, getResume, getChatHistory, sendChatMessage } from '../controllers/resumeController.js';

const resumeRouter = express.Router();

// List all resumes for the authenticated user
resumeRouter.get('/', auth, listResumes);

// Get a specific resume (metadata + review)
resumeRouter.get('/:resumeId', auth, getResume);

// Get chat history for a specific resume
resumeRouter.get('/:resumeId/chat', auth, getChatHistory);

// Send a chat message about a specific resume
resumeRouter.post('/:resumeId/chat', auth, sendChatMessage);

export { resumeRouter };
