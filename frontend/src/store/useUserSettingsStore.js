// frontend/src/store/useUserSettingsStore.js

import { create } from "zustand";
import { axiosInstance } from "../lib/axios.js";
import toast from "react-hot-toast";

export const useUserSettingsStore = create((set, get) => ({
    settings: null,
    availableOptions: null,
    isLoading: false,
    hasApiKey: false,
    isSaving: false, // For auto-save indicator

    // Load user settings
    loadSettings: async () => {
        set({ isLoading: true });
        try {
            const response = await axiosInstance.get("/settings");
            set({
                settings: response.data,
                hasApiKey: response.data.hasApiKey,
            });
            return response.data;
        } catch (error) {
            console.error("Error loading settings:", error);
            toast.error("Помилка завантаження налаштувань");
            throw error;
        } finally {
            set({ isLoading: false });
        }
    },

    // Load available options for dropdowns
    loadAvailableOptions: async () => {
        try {
            const response = await axiosInstance.get("/settings/options");
            set({ availableOptions: response.data });
            return response.data;
        } catch (error) {
            console.error("Error loading options:", error);
            // Don't show toast for this, it's not critical
            throw error;
        }
    },

    // FIXED: Auto-save individual setting immediately
    updateSetting: async (path, value) => {
        const currentSettings = get().settings;
        if (!currentSettings) return;

        // Optimistically update local state first
        const newSettings = { ...currentSettings };
        const keys = path.split('.');
        let current = newSettings;

        // Navigate to the parent object
        for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) {
                current[keys[i]] = {};
            }
            current = current[keys[i]];
        }

        // Set the value
        current[keys[keys.length - 1]] = value;

        // Update local state immediately
        set({ settings: newSettings, isSaving: true });

        try {
            // Prepare the update data structure
            const updateData = {};
            const topLevelKey = keys[0];

            if (topLevelKey === 'apiKeySource') {
                updateData.apiKeySource = value;
            } else if (topLevelKey === 'ttsSettings') {
                updateData.ttsSettings = newSettings.ttsSettings;
            } else if (topLevelKey === 'generalSettings') {
                updateData.generalSettings = newSettings.generalSettings;
            } else if (topLevelKey === 'aiSettings') {
                updateData.aiSettings = newSettings.aiSettings;
            }

            // Send to server
            const response = await axiosInstance.put("/settings", updateData);

            // Update with server response
            set({
                settings: response.data,
                hasApiKey: response.data.hasApiKey,
                isSaving: false
            });

            // Show subtle success indication (no toast to avoid spam)
            console.log("Setting auto-saved:", path, value);

        } catch (error) {
            console.error("Error auto-saving setting:", error);

            // Revert optimistic update
            set({ settings: currentSettings, isSaving: false });

            const message = error.response?.data?.message || "Помилка збереження";
            toast.error(message);
            throw error;
        }
    },

    // Update multiple settings at once (for form submissions)
    updateSettings: async (settingsData) => {
        try {
            set({ isSaving: true });
            const response = await axiosInstance.put("/settings", settingsData);
            set({
                settings: response.data,
                hasApiKey: response.data.hasApiKey,
                isSaving: false
            });
            toast.success("Налаштування збережено!");
            return response.data;
        } catch (error) {
            console.error("Error updating settings:", error);
            set({ isSaving: false });
            const message = error.response?.data?.message || "Помилка збереження";
            toast.error(message);
            throw error;
        }
    },

    // Reset settings to default
    resetSettings: async () => {
        try {
            set({ isSaving: true });
            const response = await axiosInstance.post("/settings/reset");
            set({
                settings: response.data,
                hasApiKey: false,
                isSaving: false
            });
            toast.success("Налаштування скинуто!");
            return response.data;
        } catch (error) {
            console.error("Error resetting settings:", error);
            set({ isSaving: false });
            toast.error("Помилка скидання налаштувань");
            throw error;
        }
    },

    // Test user API key
    testApiKey: async (showToast = true) => {
        try {
            const response = await axiosInstance.get("/settings/test-current-key");
            if (showToast) {
                toast.success("API ключ працює!");
            }
            return response.data;
        } catch (error) {
            console.error("API test failed:", error);
            const message = error.response?.data?.message || "Помилка тесту API";
            if (showToast) {
                toast.error(message);
            }
            throw error;
        }
    },

    // Validate and save API key
    validateAndSaveApiKey: async (apiKey) => {
        try {
            const response = await axiosInstance.post("/settings/validate-api-key", {
                openaiApiKey: apiKey
            });

            // Reload settings to get updated API key info
            await get().loadSettings();

            return response.data;
        } catch (error) {
            console.error("API validation failed:", error);
            throw error;
        }
    },

    // Get current TTS settings
    getTTSSettings: () => {
        const settings = get().settings;
        return settings?.ttsSettings || {
            model: "tts-1",
            voice: "alloy",
            speed: 1.0,
            responseFormat: "mp3",
            voiceStyle: "neutral",
            customInstructions: ""
        };
    },

    // Get current general settings
    getGeneralSettings: () => {
        const settings = get().settings;
        return settings?.generalSettings || {
            cacheAudio: true,
            defaultEnglishLevel: "B1"
        };
    },

    // Get current AI settings
    getAISettings: () => {
        const settings = get().settings;
        return settings?.aiSettings || {
            chatgptModel: "gpt-4.1-mini"
        };
    },

    // Get default English level
    getDefaultEnglishLevel: () => {
        const settings = get().getGeneralSettings();
        return settings.defaultEnglishLevel || "B1";
    },

    // Get ChatGPT model
    getChatGPTModel: () => {
        const settings = get().getAISettings();
        return settings.chatgptModel || "gpt-4.1-mini";
    },

    // Check if user has configured their own API key
    hasUserApiKey: () => {
        const settings = get().settings;
        return settings?.apiKeyInfo?.hasUserKey || false;
    },

    // Get API key source
    getApiKeySource: () => {
        const settings = get().settings;
        return settings?.apiKeySource || "system";
    },

    // Get effective API key source (what's actually being used)
    getEffectiveApiKeySource: () => {
        const settings = get().settings;
        return settings?.apiKeyInfo?.effectiveSource || "none";
    },

    // Check if there's a valid API key available
    hasValidApiKey: () => {
        const settings = get().settings;
        return settings?.apiKeyInfo?.hasValidKey || false;
    },

    // Get voice style instructions
    getVoiceStyleInstruction: (style) => {
        const instructions = {
            neutral: "Speak naturally and clearly with neutral tone.",
            formal: "Voice: Clear, authoritative, and composed, projecting confidence and professionalism. Tone: Neutral and informative.",
            calm: "Voice Affect: Calm, composed, and reassuring; project quiet authority and confidence. Tone: Sincere and empathetic.",
            dramatic: "Voice Affect: Low, hushed, and suspenseful; convey tension and intrigue. Tone: Deeply serious and mysterious.",
            educational: "Voice: Clear and engaging, suitable for learning. Pace: Moderate and well-structured for comprehension."
        };
        return instructions[style] || instructions.neutral;
    },

    // Check if audio caching is enabled
    isCacheEnabled: () => {
        const settings = get().getGeneralSettings();
        return settings.cacheAudio;
    },

    // Utility to get complete settings with defaults
    getCompleteSettings: () => {
        const state = get();
        return {
            ttsSettings: state.getTTSSettings(),
            generalSettings: state.getGeneralSettings(),
            aiSettings: state.getAISettings(),
            hasApiKey: state.hasApiKey,
            apiKeySource: state.getApiKeySource(),
            effectiveApiKeySource: state.getEffectiveApiKeySource(),
            hasValidApiKey: state.hasValidApiKey()
        };
    },

    // Clear store (for logout)
    clearSettings: () => {
        set({
            settings: null,
            availableOptions: null,
            hasApiKey: false,
            isSaving: false
        });
    },
}));