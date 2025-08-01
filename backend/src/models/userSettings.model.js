// backend/src/models/userSettings.model.js

import mongoose from "mongoose";

const userSettingsSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        // OpenAI API Settings
        openaiApiKey: {
            type: String,
            default: "", // Encrypted on save
        },

        // API Key Source Selection
        apiKeySource: {
            type: String,
            default: "system", // "system" or "user"
            enum: ["system", "user"],
        },

        // TTS Settings
        ttsSettings: {
            model: {
                type: String,
                default: "tts-1", // Default OpenAI TTS model
                enum: ["tts-1", "tts-1-hd", "gpt-4o-mini-tts"], // Available models
            },
            voice: {
                type: String,
                default: "alloy",
                enum: ["alloy", "ash", "coral", "echo", "fable", "onyx", "nova", "sage", "shimmer"], // OpenAI voices
            },
            speed: {
                type: Number,
                default: 1.0,
                min: 0.25,
                max: 4.0,
            },
            responseFormat: {
                type: String,
                default: "mp3",
                enum: ["mp3", "opus", "aac", "flac"],
            },
            // Voice style instructions (custom for advanced models)
            voiceStyle: {
                type: String,
                default: "neutral",
                enum: ["neutral", "formal", "calm", "dramatic", "educational"],
            },
            customInstructions: {
                type: String,
                default: "",
                maxlength: 500,
            },
        },

        // General Settings
        generalSettings: {
            cacheAudio: {
                type: Boolean,
                default: true,
            },
            // Default English level
            defaultEnglishLevel: {
                type: String,
                default: "B1",
                enum: ["A1", "A2", "B1", "B2", "C1", "C2"],
            }
        },

        // AI Settings
        aiSettings: {
            chatgptModel: {
                type: String,
                default: "gpt-4.1-mini",
                enum: ["gpt-4.1", "gpt-4.1-mini", "gpt-4o"],
            },
        }
    },
    {
        timestamps: true,
    }
);

// Index for performance
userSettingsSchema.index({ userId: 1 });

// Pre-save middleware to encrypt API key
userSettingsSchema.pre("save", function(next) {
    // Simple encryption - in production use proper encryption
    if (this.isModified("openaiApiKey") && this.openaiApiKey) {
        // For now, just store as-is. In production, encrypt this!
        // this.openaiApiKey = encrypt(this.openaiApiKey);
    }
    next();
});

// Method to decrypt API key (placeholder for real encryption)
userSettingsSchema.methods.getDecryptedApiKey = function() {
    return this.openaiApiKey; // In production, decrypt here
};

// Helper method to check if system key is valid
userSettingsSchema.statics.isSystemKeyValid = function() {
    const systemKey = process.env.OPENAI_API_KEY;
    return !!(systemKey && systemKey.trim() && systemKey.startsWith('sk-'));
};

// Helper method to check if user key is valid
userSettingsSchema.methods.isUserKeyValid = function() {
    const userKey = this.openaiApiKey;
    return !!(userKey && userKey.trim() && userKey.startsWith('sk-'));
};

// FIXED: Method to get the effective API key based on user preference
userSettingsSchema.methods.getEffectiveApiKey = function() {
    // Логіка: Спочатку перевіряємо, що користувач хоче використовувати

    if (this.apiKeySource === "user") {
        // Користувач хоче використовувати свій ключ
        if (this.isUserKeyValid()) {
            console.log("Using user API key");
            return this.openaiApiKey.trim();
        }
        // Якщо користувацький ключ недійсний, fallback на системний
        console.log("User key invalid, falling back to system key");
    }

    // Використовуємо системний ключ якщо:
    // 1. Користувач обрав "system"
    // 2. Користувач обрав "user", але його ключ недійсний (fallback)
    if (this.constructor.isSystemKeyValid()) {
        console.log("Using system API key");
        return process.env.OPENAI_API_KEY.trim();
    }

    // Немає валідного ключа
    console.log("No valid API key available");
    return null;
};

// FIXED: Method to check if user has a valid API key configuration
userSettingsSchema.methods.hasValidApiKey = function() {
    return !!this.getEffectiveApiKey();
};

// FIXED: Method to get API key source info for response
userSettingsSchema.methods.getApiKeyInfo = function() {
    const hasSystemKey = this.constructor.isSystemKeyValid();
    const hasUserKey = this.isUserKeyValid();

    // Визначаємо, який ключ фактично використовується
    let effectiveSource = "none";

    if (this.apiKeySource === "user" && hasUserKey) {
        effectiveSource = "user";
    } else if (hasSystemKey) {
        effectiveSource = "system";
    }

    return {
        source: this.apiKeySource, // Що обрав користувач
        hasUserKey: hasUserKey,
        hasSystemKey: hasSystemKey,
        effectiveSource: effectiveSource, // Що фактично використовується
        hasValidKey: effectiveSource !== "none"
    };
};

// Default voice style instructions
userSettingsSchema.statics.getVoiceStyleInstructions = function(style) {
    const instructions = {
        neutral: "Speak naturally and clearly with neutral tone.",
        formal: "Voice: Clear, authoritative, and composed, projecting confidence and professionalism. Tone: Neutral and informative, maintaining a balance between formality and approachability.",
        calm: "Voice Affect: Calm, composed, and reassuring; project quiet authority and confidence. Tone: Sincere, empathetic, and gently authoritative.",
        dramatic: "Voice Affect: Low, hushed, and suspenseful; convey tension and intrigue. Tone: Deeply serious and mysterious, maintaining an undercurrent of unease.",
        educational: "Voice: Clear and engaging, suitable for learning. Pace: Moderate and well-structured for comprehension. Tone: Encouraging and instructive."
    };
    return instructions[style] || instructions.neutral;
};

const UserSettings = mongoose.model("UserSettings", userSettingsSchema);
export default UserSettings;