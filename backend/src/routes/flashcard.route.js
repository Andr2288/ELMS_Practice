// backend/src/routes/flashcard.route.js

import express from "express";

import flashcardController from "../controllers/flashcard.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", authMiddleware.protectRoute, flashcardController.getFlashcards);
router.post(
  "/",
  authMiddleware.protectRoute,
  flashcardController.createFlashcard
);
router.put(
  "/:id",
  authMiddleware.protectRoute,
  flashcardController.updateFlashcard
);
router.delete(
  "/:id",
  authMiddleware.protectRoute,
  flashcardController.deleteFlashcard
);

export default router;
