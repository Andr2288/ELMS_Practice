// backend/src/controllers/userSettings.controller.js

import UserSettings from "../models/userSettings.model.js";

const getUserSettings = async (req, res) => {
    try {
        const userId = req.user._id;

        let settings = await UserSettings.findOne({ userId });

        // Create default settings if none exist
        if (!settings) {
            settings = new UserSettings({
                userId,
                apiKeySource: "system", // Default to system key
                ttsSettings: {
                    model: "tts-1",
                    voice: "alloy",
                    speed: 1.0,
                    responseFormat: "mp3",
                    voiceStyle: "neutral",
                    customInstructions: ""
                },
                generalSettings: {
                    cacheAudio: true,
                    defaultEnglishLevel: "B1"
                },
                aiSettings: {
                    chatgptModel: "gpt-4.1-mini"
                }
            });
            await settings.save();
        }

        // Prepare response with API key info
        const settingsResponse = settings.toObject();
        const apiKeyInfo = settings.getApiKeyInfo();

        settingsResponse.hasApiKey = !!settings.openaiApiKey;
        settingsResponse.apiKeyInfo = apiKeyInfo;
        delete settingsResponse.openaiApiKey; // Never send raw API key

        return res.status(200).json(settingsResponse);
    } catch (error) {
        console.log("Error in getUserSettings controller", error.message);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};

// FIXED: Auto-save settings - no manual save needed
const updateUserSettings = async (req, res) => {
    try {
        const userId = req.user._id;
        const updateData = req.body;

        let settings = await UserSettings.findOne({ userId });

        if (!settings) {
            settings = new UserSettings({ userId });
        }

        // Update API key source
        if (updateData.apiKeySource !== undefined) {
            settings.apiKeySource = updateData.apiKeySource;
        }

        // Update API key if provided (but don't include in updateData for auto-save)
        if (updateData.openaiApiKey !== undefined) {
            settings.openaiApiKey = updateData.openaiApiKey;
        }

        // Update TTS settings
        if (updateData.ttsSettings) {
            if (updateData.ttsSettings.model) settings.ttsSettings.model = updateData.ttsSettings.model;
            if (updateData.ttsSettings.voice) settings.ttsSettings.voice = updateData.ttsSettings.voice;
            if (updateData.ttsSettings.speed !== undefined) settings.ttsSettings.speed = updateData.ttsSettings.speed;
            if (updateData.ttsSettings.responseFormat) settings.ttsSettings.responseFormat = updateData.ttsSettings.responseFormat;
            if (updateData.ttsSettings.voiceStyle) settings.ttsSettings.voiceStyle = updateData.ttsSettings.voiceStyle;
            if (updateData.ttsSettings.customInstructions !== undefined) settings.ttsSettings.customInstructions = updateData.ttsSettings.customInstructions;
        }

        // Update general settings
        if (updateData.generalSettings) {
            if (updateData.generalSettings.cacheAudio !== undefined) settings.generalSettings.cacheAudio = updateData.generalSettings.cacheAudio;
            if (updateData.generalSettings.defaultEnglishLevel) settings.generalSettings.defaultEnglishLevel = updateData.generalSettings.defaultEnglishLevel;
        }

        // Update AI settings
        if (updateData.aiSettings) {
            if (!settings.aiSettings) settings.aiSettings = {};
            if (updateData.aiSettings.chatgptModel) settings.aiSettings.chatgptModel = updateData.aiSettings.chatgptModel;
        }

        // Auto-save immediately
        await settings.save();

        // Return updated settings with API key info
        const settingsResponse = settings.toObject();
        const apiKeyInfo = settings.getApiKeyInfo();

        settingsResponse.hasApiKey = !!settings.openaiApiKey;
        settingsResponse.apiKeyInfo = apiKeyInfo;
        delete settingsResponse.openaiApiKey;

        return res.status(200).json(settingsResponse);
    } catch (error) {
        console.log("Error in updateUserSettings controller", error.message);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};

// Validate and save API key
const validateAndSaveApiKey = async (req, res) => {
    try {
        const userId = req.user._id;
        const { openaiApiKey } = req.body;

        if (!openaiApiKey || !openaiApiKey.trim()) {
            return res.status(400).json({
                success: false,
                message: "API ключ обов'язковий",
                details: "Введіть ваш OpenAI API ключ"
            });
        }

        const apiKey = openaiApiKey.trim();

        // Перевірка формату ключа
        if (!apiKey.startsWith('sk-')) {
            return res.status(400).json({
                success: false,
                message: "Невірний формат API ключа",
                details: "OpenAI API ключ повинен починатися з 'sk-'"
            });
        }

        // Тестування ключа з OpenAI
        const OpenAI = (await import("openai")).default;
        const openai = new OpenAI({ apiKey });

        try {
            // Простий тест API ключа
            const response = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [{ role: "user", content: "Test" }],
                max_tokens: 1
            });

            // Якщо тест пройшов успішно, зберігаємо ключ
            let settings = await UserSettings.findOne({ userId });
            if (!settings) {
                settings = new UserSettings({
                    userId,
                    apiKeySource: "user", // Автоматично перемикаємо на користувацький ключ
                    ttsSettings: {
                        model: "tts-1",
                        voice: "alloy",
                        speed: 1.0,
                        responseFormat: "mp3",
                        voiceStyle: "neutral",
                        customInstructions: ""
                    },
                    generalSettings: {
                        cacheAudio: true,
                        defaultEnglishLevel: "B1"
                    },
                    aiSettings: {
                        chatgptModel: "gpt-4.1-mini"
                    }
                });
            }

            settings.openaiApiKey = apiKey;
            settings.apiKeySource = "user"; // Автоматично перемикаємо на користувацький ключ
            await settings.save();

            return res.status(200).json({
                success: true,
                message: "API ключ валідний і збережено!",
                details: "Ключ успішно протестовано і збережено. Автоматично перемкнуто на використання власного ключа.",
                apiKeyInfo: settings.getApiKeyInfo()
            });

        } catch (apiError) {
            console.log("API key validation failed:", apiError.message);

            let errorMessage = "API ключ недійсний";
            let errorDetails = "";

            if (apiError.status === 401) {
                errorMessage = "API ключ недійсний або прострочений";
                errorDetails = "Перевірте правильність ключа на platform.openai.com";
            } else if (apiError.status === 402) {
                errorMessage = "Недостатньо кредитів на OpenAI акаунті";
                errorDetails = "Поповніть баланс на platform.openai.com/billing";
            } else if (apiError.status === 429) {
                errorMessage = "Перевищено ліміт запитів";
                errorDetails = "Спробуйте пізніше або перевірте ваш тарифний план";
            } else if (apiError.status === 500) {
                errorMessage = "Проблеми з сервером OpenAI";
                errorDetails = "Спробуйте пізніше";
            } else {
                errorDetails = apiError.message || "Невідома помилка при перевірці ключа";
            }

            return res.status(400).json({
                success: false,
                message: errorMessage,
                details: errorDetails
            });
        }

    } catch (error) {
        console.log("Error in validateAndSaveApiKey controller:", error.message);
        return res.status(500).json({
            success: false,
            message: "Внутрішня помилка сервера",
            details: "Помилка при обробці запиту"
        });
    }
};

// Test current API key configuration
const testCurrentApiKey = async (req, res) => {
    try {
        const userId = req.user._id;

        const settings = await UserSettings.findOne({ userId });
        if (!settings) {
            return res.status(400).json({
                success: false,
                message: "Налаштування не знайдено",
                details: "Створіть налаштування спочатку"
            });
        }

        const effectiveApiKey = settings.getEffectiveApiKey();
        const apiKeyInfo = settings.getApiKeyInfo();

        if (!effectiveApiKey) {
            return res.status(400).json({
                success: false,
                message: "API ключ не налаштований",
                details: "Встановіть власний ключ або перевірте системний",
                apiKeyInfo
            });
        }

        // Test the effective API key
        const OpenAI = (await import("openai")).default;
        const openai = new OpenAI({ apiKey: effectiveApiKey });

        try {
            const response = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [{ role: "user", content: "Test connection" }],
                max_tokens: 1
            });

            return res.status(200).json({
                success: true,
                message: `${apiKeyInfo.effectiveSource === 'user' ? 'Власний' : 'Системний'} API ключ працює!`,
                details: `Тест успішний. Використовується ${apiKeyInfo.effectiveSource === 'user' ? 'ваш особистий' : 'системний'} ключ.`,
                apiKeyInfo
            });

        } catch (apiError) {
            let errorMessage = `Помилка`;
            let errorDetails = "";

            if (apiError.status === 401) {
                errorMessage = "API ключ недійсний";
                errorDetails = apiKeyInfo.effectiveSource === 'user'
                    ? "Системний API ключ недійсний або прострочений"
                    : "Ваш API ключ ключ недійсний або прострочений";
            } else if (apiError.status === 402) {
                errorMessage = "Недостатньо кредитів";
                errorDetails = "Поповніть баланс OpenAI";
            } else if (apiError.status === 429) {
                errorMessage = "Перевищено ліміт запитів";
                errorDetails = "Спробуйте пізніше";
            }

            return res.status(400).json({
                success: false,
                message: errorMessage,
                details: errorDetails,
                apiKeyInfo
            });
        }

    } catch (error) {
        console.log("Error in testCurrentApiKey:", error.message);
        return res.status(500).json({
            success: false,
            message: "Внутрішня помилка сервера",
            details: "Помилка при тестуванні ключа"
        });
    }
};

const resetUserSettings = async (req, res) => {
    try {
        const userId = req.user._id;

        await UserSettings.findOneAndDelete({ userId });

        // Create new default settings
        const defaultSettings = new UserSettings({
            userId,
            apiKeySource: "system", // Reset to system key
            ttsSettings: {
                model: "tts-1",
                voice: "alloy",
                speed: 1.0,
                responseFormat: "mp3",
                voiceStyle: "neutral",
                customInstructions: ""
            },
            generalSettings: {
                cacheAudio: true,
                defaultEnglishLevel: "B1"
            },
            aiSettings: {
                chatgptModel: "gpt-4.1-mini"
            }
        });
        await defaultSettings.save();

        // Return new settings with API key info
        const settingsResponse = defaultSettings.toObject();
        const apiKeyInfo = defaultSettings.getApiKeyInfo();

        settingsResponse.hasApiKey = false;
        settingsResponse.apiKeyInfo = apiKeyInfo;
        delete settingsResponse.openaiApiKey;

        return res.status(200).json(settingsResponse);
    } catch (error) {
        console.log("Error in resetUserSettings controller", error.message);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};

const getAvailableOptions = async (req, res) => {
    try {
        return res.status(200).json({
            models: [
                { id: "tts-1", name: "TTS-1 (Standard)", description: "Fast, good quality" },
                { id: "tts-1-hd", name: "TTS-1 HD", description: "Higher quality, slower" },
                { id: "gpt-4o-mini-tts", name: "GPT-4o Mini TTS", description: "Advanced model with custom instructions" }
            ],
            voices: [
                { id: "alloy", name: "Alloy", description: "Neutral, versatile" },
                { id: "ash", name: "Ash", description: "Clear, professional" },
                { id: "coral", name: "Coral", description: "Warm, friendly" },
                { id: "echo", name: "Echo", description: "Deep, resonant" },
                { id: "fable", name: "Fable", description: "Expressive, storytelling" },
                { id: "onyx", name: "Onyx", description: "Strong, confident" },
                { id: "nova", name: "Nova", description: "Bright, energetic" },
                { id: "sage", name: "Sage", description: "Wise, calm" },
                { id: "shimmer", name: "Shimmer", description: "Gentle, soothing" }
            ],
            voiceStyles: [
                { id: "neutral", name: "Нейтральний", description: "Природна та чітка вимова" },
                { id: "formal", name: "Офіційний", description: "Професійний та авторитетний" },
                { id: "calm", name: "Спокійний", description: "Заспокійливий та впевнений" },
                { id: "dramatic", name: "Драматичний", description: "Напружений та інтригуючий" },
                { id: "educational", name: "Навчальний", description: "Чіткий та зрозумілий для навчання" }
            ],
            responseFormats: [
                { id: "mp3", name: "MP3", description: "Standard quality, widely supported" },
                { id: "opus", name: "Opus", description: "Good compression, modern format" },
                { id: "aac", name: "AAC", description: "High quality, Apple preferred" },
                { id: "flac", name: "FLAC", description: "Lossless quality, large files" }
            ],
            englishLevels: [
                { id: "A1", name: "A1 - Початковий", description: "Базові слова та фрази" },
                { id: "A2", name: "A2 - Елементарний", description: "Прості повсякденні вирази" },
                { id: "B1", name: "B1 - Середній", description: "Спілкування на знайомі теми" },
                { id: "B2", name: "B2 - Вище середнього", description: "Вільне спілкування з носіями" },
                { id: "C1", name: "C1 - Просунутий", description: "Складні тексти та абстрактні теми" },
                { id: "C2", name: "C2 - Вільне володіння", description: "Майже як носій мови" }
            ],
            chatgptModels: [
                { id: "gpt-4.1", name: "GPT-4.1", description: "Найпотужніша модель, найкраща якість результатів" },
                { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", description: "Оптимальне співвідношення якості та вартості (рекомендовано)" },
                { id: "gpt-4o", name: "GPT-4o", description: "Швидка та ефективна модель з хорошою якістю" }
            ],
            // API Key source options
            apiKeySources: [
                { id: "system", name: "Системний ключ", description: "Використовувати загальний API ключ системи" },
                { id: "user", name: "Власний ключ", description: "Використовувати ваш особистий API ключ" }
            ]
        });
    } catch (error) {
        console.log("Error in getAvailableOptions controller", error.message);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};

export default {
    getUserSettings,
    updateUserSettings,
    validateAndSaveApiKey,
    testCurrentApiKey,
    resetUserSettings,
    getAvailableOptions,
};