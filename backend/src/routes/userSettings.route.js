// backend/src/routes/userSettings.route.js

import express from "express";

import userSettingsController from "../controllers/userSettings.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";

const router = express.Router();

// Get user settings
router.get("/", authMiddleware.protectRoute, userSettingsController.getUserSettings);

// Update user settings
router.put("/", authMiddleware.protectRoute, userSettingsController.updateUserSettings);

// Validate and save API key
router.post("/validate-api-key", authMiddleware.protectRoute, userSettingsController.validateAndSaveApiKey);

// Test current API key configuration
router.get("/test-current-key", authMiddleware.protectRoute, userSettingsController.testCurrentApiKey);

// Reset settings to default
router.post("/reset", authMiddleware.protectRoute, userSettingsController.resetUserSettings);

// Get available options for dropdowns
router.get("/options", authMiddleware.protectRoute, userSettingsController.getAvailableOptions);

export default router;