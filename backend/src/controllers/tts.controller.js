// backend/src/controllers/tts.controller.js - ОНОВЛЕНА ВЕРСІЯ

import OpenAI from "openai";
import crypto from "crypto";
import UserSettings from "../models/userSettings.model.js";

// Simple in-memory cache for audio files
const audioCache = new Map();

const generateSpeech = async (req, res) => {
    try {
        const { text, timestamp, sessionId, cardId, exercise } = req.body;
        const userId = req.user._id;

        if (!text) {
            return res.status(400).json({ message: "Text is required" });
        }

        console.log(`TTS Request - User: ${userId}, Session: ${sessionId}, Card: ${cardId}, Exercise: ${exercise}`);
        console.log(`TTS Text: "${text.substring(0, 100)}..."`);

        // Get user settings first
        let userSettings = await UserSettings.findOne({ userId });

        // Create default settings if none exist
        if (!userSettings) {
            userSettings = new UserSettings({
                userId,
                apiKeySource: "system",
                ttsSettings: {
                    model: "tts-1",
                    voice: "alloy",
                    speed: 1.0,
                    responseFormat: "mp3",
                    voiceStyle: "neutral",
                    customInstructions: ""
                }
            });
            await userSettings.save();
        }

        // FIXED: Use the new getEffectiveApiKey method
        const effectiveApiKey = userSettings.getEffectiveApiKey();
        const apiKeyInfo = userSettings.getApiKeyInfo();

        if (!effectiveApiKey) {
            return res.status(500).json({
                message: "No OpenAI API key available",
                details: "Please configure an API key in Settings",
                apiKeyInfo
            });
        }

        console.log(`TTS: Using ${apiKeyInfo.effectiveSource} API key for user ${userId}`);

        // Validate API key format
        if (!effectiveApiKey.startsWith('sk-')) {
            return res.status(500).json({
                message: "Invalid OpenAI API key format",
                apiKeyInfo
            });
        }

        // ОНОВЛЕНО: Create enhanced cache key with more unique parameters
        const cacheKeyData = {
            text: text.toLowerCase().trim(),
            model: userSettings.ttsSettings.model,
            voice: userSettings.ttsSettings.voice,
            speed: userSettings.ttsSettings.speed,
            style: userSettings.ttsSettings.voiceStyle,
            custom: userSettings.ttsSettings.customInstructions,
            // ДОДАНО: Нові параметри для унікальності
            sessionId: sessionId || 'no-session',
            cardId: cardId || 'no-card',
            exercise: exercise || 'general',
            timestamp: timestamp || Date.now(),
            userId: userId.toString() // Додаємо user ID для ізоляції кешу
        };

        const settingsHash = crypto.createHash('md5')
            .update(JSON.stringify(cacheKeyData))
            .digest('hex');

        console.log(`TTS Cache Key: ${settingsHash} (Session: ${sessionId})`);

        // Check cache if enabled - але тільки для загальних запитів, не для вправ
        const shouldUseCache = userSettings.generalSettings.cacheAudio &&
            (!exercise || exercise === 'general') &&
            audioCache.has(settingsHash);

        if (shouldUseCache) {
            console.log(`Using cached audio for session ${sessionId}: ${text.substring(0, 50)}`);
            const cachedAudio = audioCache.get(settingsHash);
            res.set({
                'Content-Type': 'audio/mpeg',
                'Content-Length': cachedAudio.length,
                'Cache-Control': 'public, max-age=86400',
                'X-Audio-Source': 'cache',
                'X-API-Key-Source': apiKeyInfo.effectiveSource,
                'X-Session-Id': sessionId || 'no-session'
            });
            return res.send(cachedAudio);
        }

        console.log(`Generating new TTS for session ${sessionId}: "${text.substring(0, 50)}" using ${apiKeyInfo.effectiveSource} API key`);
        console.log(`Settings: model=${userSettings.ttsSettings.model}, voice=${userSettings.ttsSettings.voice}, speed=${userSettings.ttsSettings.speed}`);

        // Initialize OpenAI with effective API key
        const openai = new OpenAI({ apiKey: effectiveApiKey });

        // Prepare TTS parameters
        const ttsParams = {
            model: userSettings.ttsSettings.model,
            voice: userSettings.ttsSettings.voice,
            input: text.substring(0, 4096), // Limit text length
            response_format: userSettings.ttsSettings.responseFormat,
            speed: Math.max(0.25, Math.min(4.0, userSettings.ttsSettings.speed)) // Clamp speed
        };

        // Add custom instructions for advanced models
        if (userSettings.ttsSettings.model === "gpt-4o-mini-tts") {
            let instructions = UserSettings.getVoiceStyleInstructions(userSettings.ttsSettings.voiceStyle);

            // Append custom instructions if provided
            if (userSettings.ttsSettings.customInstructions) {
                instructions += "\n\nAdditional instructions: " + userSettings.ttsSettings.customInstructions;
            }

            ttsParams.instructions = instructions;
        }

        // Generate speech
        const mp3 = await openai.audio.speech.create(ttsParams);
        const buffer = Buffer.from(await mp3.arrayBuffer());

        console.log(`TTS generated successfully for session ${sessionId}. Buffer size: ${buffer.length}`);

        // ОНОВЛЕНО: Cache logic - кешуємо тільки загальні запити, не вправи
        const shouldCache = userSettings.generalSettings.cacheAudio &&
            audioCache.size < 100 &&
            (!exercise || exercise === 'general');

        if (shouldCache) {
            audioCache.set(settingsHash, buffer);
            console.log(`Audio cached for session ${sessionId}. Cache size: ${audioCache.size}`);
        } else if (exercise) {
            console.log(`Not caching audio for exercise: ${exercise} (session: ${sessionId})`);
        }

        res.set({
            'Content-Type': 'audio/mpeg',
            'Content-Length': buffer.length,
            'Cache-Control': 'public, max-age=86400',
            'X-Audio-Source': 'generated',
            'X-API-Key-Source': apiKeyInfo.effectiveSource,
            'X-TTS-Model': userSettings.ttsSettings.model,
            'X-TTS-Voice': userSettings.ttsSettings.voice,
            'X-Session-Id': sessionId || 'no-session',
            'X-Exercise': exercise || 'general'
        });

        return res.send(buffer);

    } catch (error) {
        console.log("Error in generateSpeech controller:", error.message);

        // Enhanced error handling
        let errorResponse = {
            message: "Error generating speech",
            details: "Internal server error occurred while generating speech"
        };

        if (error.status === 401 || error.message?.includes('Incorrect API key')) {
            errorResponse = {
                message: "Invalid OpenAI API key",
                details: "API key may be expired, invalid, or have insufficient permissions",
                action: "Check your API key in Settings"
            };
        } else if (error.status === 429 || error.message?.includes('rate limit')) {
            errorResponse = {
                message: "OpenAI API rate limit exceeded",
                details: "Too many requests to OpenAI API",
                action: "Please try again later"
            };
        } else if (error.status === 402 || error.message?.includes('quota')) {
            errorResponse = {
                message: "OpenAI API quota exceeded",
                details: "Insufficient credits or billing issue",
                action: "Please check your OpenAI billing"
            };
        } else if (error.status === 400) {
            errorResponse = {
                message: "Invalid request to OpenAI API",
                details: error.message,
                action: "Check your TTS settings"
            };
        } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            errorResponse = {
                message: "Cannot connect to OpenAI API",
                details: "Network connectivity issue",
                action: "Check your internet connection"
            };
        }

        return res.status(error.status || 500).json(errorResponse);
    }
};

// Test TTS with current user settings and API key
const testTTSWithCurrentSettings = async (req, res) => {
    try {
        const userId = req.user._id;

        const userSettings = await UserSettings.findOne({ userId });
        if (!userSettings) {
            return res.status(400).json({
                success: false,
                message: "User settings not found",
                details: "Please configure your settings first"
            });
        }

        // FIXED: Use the new getEffectiveApiKey method
        const effectiveApiKey = userSettings.getEffectiveApiKey();
        const apiKeyInfo = userSettings.getApiKeyInfo();

        if (!effectiveApiKey) {
            return res.status(400).json({
                success: false,
                message: "No API key available",
                details: "Configure a user or system API key",
                apiKeyInfo
            });
        }

        console.log("Testing TTS with current settings...");

        const openai = new OpenAI({ apiKey: effectiveApiKey });

        // Use user's TTS settings
        const ttsParams = {
            model: userSettings.ttsSettings.model,
            voice: userSettings.ttsSettings.voice,
            input: "Test TTS functionality",
            response_format: userSettings.ttsSettings.responseFormat,
            speed: userSettings.ttsSettings.speed
        };

        const mp3 = await openai.audio.speech.create(ttsParams);
        const buffer = Buffer.from(await mp3.arrayBuffer());

        console.log("TTS test successful. Audio size:", buffer.length);

        return res.status(200).json({
            success: true,
            message: "TTS працює з поточними налаштуваннями!",
            details: `Тест успішний. Використовується ${apiKeyInfo.effectiveSource === 'user' ? 'ваш особистий' : 'системний'} ключ.`,
            audio_size: buffer.length,
            settings_used: ttsParams,
            apiKeyInfo
        });
    } catch (error) {
        console.log("TTS test failed:", error.message);

        let errorDetails = {
            success: false,
            message: "TTS test failed",
            error: error.message
        };

        if (error.status === 401) {
            errorDetails.message = "Invalid API key for TTS";
        } else if (error.status === 402) {
            errorDetails.message = "Insufficient credits for TTS";
        } else if (error.status === 429) {
            errorDetails.message = "TTS rate limit exceeded";
        }

        return res.status(error.status || 500).json(errorDetails);
    }
};

// ОНОВЛЕНО: Clear audio cache with statistics
const clearAudioCache = async (req, res) => {
    try {
        const cacheSize = audioCache.size;

        // ДОДАНО: Статистика кешу перед очищенням
        const cacheStats = {
            totalEntries: cacheSize,
            memoryUsage: 0
        };

        // Підрахунок приблизного використання пам'яті
        for (const [key, buffer] of audioCache.entries()) {
            cacheStats.memoryUsage += buffer.length;
        }

        audioCache.clear();

        console.log(`Audio cache cleared. Was holding ${cacheStats.totalEntries} entries, ~${Math.round(cacheStats.memoryUsage / 1024 / 1024)}MB`);

        return res.status(200).json({
            message: "Audio cache cleared",
            statistics: {
                cleared_entries: cacheSize,
                memory_freed_mb: Math.round(cacheStats.memoryUsage / 1024 / 1024),
                memory_freed_bytes: cacheStats.memoryUsage
            }
        });
    } catch (error) {
        console.log("Error clearing cache:", error.message);
        return res.status(500).json({ message: "Error clearing cache" });
    }
};

// ДОДАНО: Отримання статистики кешу
const getCacheStats = async (req, res) => {
    try {
        const cacheStats = {
            totalEntries: audioCache.size,
            memoryUsage: 0,
            entries: []
        };

        // Підрахунок використання пам'яті та деталі записів
        for (const [key, buffer] of audioCache.entries()) {
            cacheStats.memoryUsage += buffer.length;
            cacheStats.entries.push({
                key: key.substring(0, 16) + '...', // Показуємо тільки частину ключа
                size: buffer.length,
                size_kb: Math.round(buffer.length / 1024)
            });
        }

        // Сортуємо за розміром (найбільші спочатку)
        cacheStats.entries.sort((a, b) => b.size - a.size);

        return res.status(200).json({
            cache_statistics: {
                total_entries: cacheStats.totalEntries,
                total_memory_mb: Math.round(cacheStats.memoryUsage / 1024 / 1024),
                total_memory_bytes: cacheStats.memoryUsage,
                largest_entries: cacheStats.entries.slice(0, 10) // Показуємо топ 10
            }
        });
    } catch (error) {
        console.log("Error getting cache stats:", error.message);
        return res.status(500).json({ message: "Error getting cache statistics" });
    }
};

// Check available models with current API key
const checkAvailableModels = async (req, res) => {
    try {
        const userId = req.user._id;
        const userSettings = await UserSettings.findOne({ userId });

        if (!userSettings) {
            return res.status(400).json({
                success: false,
                message: "User settings not found"
            });
        }

        // FIXED: Use the new getEffectiveApiKey method
        const effectiveApiKey = userSettings.getEffectiveApiKey();
        const apiKeyInfo = userSettings.getApiKeyInfo();

        if (!effectiveApiKey) {
            return res.status(400).json({
                success: false,
                message: "No API key available",
                apiKeyInfo
            });
        }

        const openai = new OpenAI({ apiKey: effectiveApiKey });
        const modelsResponse = await openai.models.list();

        const models = Array.isArray(modelsResponse.data)
            ? modelsResponse.data
            : (modelsResponse.data?.data || modelsResponse);

        if (!Array.isArray(models)) {
            return res.status(200).json({
                success: true,
                message: "Models retrieved but in unexpected format",
                raw_response: modelsResponse,
                apiKeyInfo
            });
        }

        const ttsModels = models.filter(model => {
            const id = typeof model === 'string' ? model : model.id;
            return id && (
                id.includes('tts') ||
                id.includes('speech') ||
                id === 'tts-1' ||
                id === 'tts-1-hd'
            );
        });

        const modelIds = models.map(m => typeof m === 'string' ? m : m.id);

        return res.status(200).json({
            success: true,
            message: "Models retrieved successfully",
            total_models: models.length,
            tts_models: ttsModels.map(m => typeof m === 'string' ? m : m.id),
            all_models: modelIds.slice(0, 10),
            apiKeyInfo
        });
    } catch (error) {
        console.log("Models check failed:", error.message);

        let errorDetails = {
            success: false,
            message: "Failed to get models",
            error: error.message
        };

        if (error.status === 401) {
            errorDetails.message = "Invalid API key for models access";
        } else if (error.status === 402) {
            errorDetails.message = "Insufficient credits for models access";
        }

        return res.status(error.status || 500).json(errorDetails);
    }
};

export default {
    generateSpeech,
    testTTSWithCurrentSettings,
    clearAudioCache,
    getCacheStats, // ДОДАНО
    checkAvailableModels,
};