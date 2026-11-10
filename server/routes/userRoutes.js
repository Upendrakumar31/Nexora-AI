import express from 'express';
import { auth } from "../middlewares/auth.js";
import { getPublishedCreations, getUserCreations, toggleLikeCreation, syncSubscription } from "../controllers/userController.js";

const userRouter = express.Router();

userRouter.get('/get-user-creations', auth, (req, res) => getUserCreations(req, res));
userRouter.get('/get-published-creations', auth, getPublishedCreations);
userRouter.post('/toggle-like-creation', auth, toggleLikeCreation);
userRouter.post('/sync-subscription', auth, syncSubscription);
userRouter.get('/subscription', auth, syncSubscription);

export default userRouter; 