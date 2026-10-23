import express from 'express';
import { auth } from "../middlewares/auth.js";
import { generateArticle, generateBlogTitle, generateImage, removeImageBackground, removeImageObject, resumeReview } from "../controllers/aiController.js";
import { uploadImage, uploadResume } from "../configs/multer.js";

const aiRouter = express.Router();

aiRouter.post('/generate-article', auth, generateArticle);
aiRouter.post('/generate-blog-title', auth, generateBlogTitle);
aiRouter.post('/generate-image', auth, generateImage);
aiRouter.post('/remove-image-background', auth, uploadImage.single('image'), removeImageBackground);
aiRouter.post('/remove-image-object', auth, uploadImage.single('image'), removeImageObject);
aiRouter.post('/resume-review', auth, uploadResume.single('resume'), resumeReview);

export { aiRouter };