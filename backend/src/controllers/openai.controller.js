// backend/src/controllers/openai.controller.js

import OpenAI from "openai";
import UserSettings from "../models/userSettings.model.js";
import Flashcard from "../models/flashcard.model.js";

const generateFlashcardContent = async (req, res) => {
    try {
        const { text, englishLevel, promptType } = req.body;
        const userId = req.user._id;

        if (!text) {
            return res.status(400).json({ message: "Text is required" });
        }

        if (!englishLevel) {
            return res.status(400).json({ message: "English level is required" });
        }

        // Get user settings to check API key preference and get the effective key
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
                },
                generalSettings: {
                    cacheAudio: true,
                    defaultEnglishLevel: "B1"
                },
                aiSettings: {
                    chatgptModel: "gpt-4.1-mini"
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

        console.log(`AI Generation: Using ${apiKeyInfo.effectiveSource} API key for user ${userId}`);

        // Create OpenAI client with effective API key
        const openai = new OpenAI({ apiKey: effectiveApiKey });

        // Get the user's preferred model or use default
        const modelToUse = userSettings.aiSettings?.chatgptModel || "gpt-4.1-mini";

        // Generate the prompt based on the request type
        let prompt = "";
        switch (promptType) {
            case "definition":
                prompt = `English level you must to use in your output: ${englishLevel}. A detailed definition/explanation of meaning and usage (can be longer and more comprehensive) for: ${text}. Format example for output: A valley is a long, low area of land between hills or mountains. It is often formed by rivers or glaciers and can be wide or narrow. Valleys are places where people can live, grow crops, or travel through because they are lower and sometimes flatter than the surrounding land.`;
                break;
            case "shortDescription":
                prompt = `English level you must to use in your output: ${englishLevel}. Write a very short description (1-2 sentences max, under 100 characters) for English word/phrase: "${text}". The description should be concise, clear and appropriate for ${englishLevel} level learners.`;
                break;
            case "example":
                prompt = `Create a sentence. English level you must to use in your output: ${englishLevel}. Word to use: ${text}`;
                break;
            case "examples": // НОВИЙ ТИП: генерація 3 прикладів
                prompt = `Create 3 different example sentences using the word/phrase: "${text}". English level you must to use in your output: ${englishLevel}. Each sentence should show different contexts or meanings. Return as a JSON array of strings.`;
                break;
            case "transcription":
                prompt = `You are integrated in English LMS. Provide me with the transcription for: ${text}. Resources: Oxford Learner's Dictionaries. String format example for output: UK: [ˌjuːnɪˈvɜːsəti]; US: [ˌjuːnɪˈvɜːrsəti];`;
                break;
            case "translateToUkrainian":
                prompt = `Translate to Ukrainian. Provide several translation variants for: "${text}". Output only in this format: "Виглядати; дивитися; вигляд; зовнішність". No extra text. Only the string.`;
                break;
            case "translateFromUkrainian":
                prompt = `Provide translation from Ukrainian to English for: ${text}`;
                break;
            case "completeFlashcard":
            default:
                prompt = `Create a complete flashcard for an English vocabulary word/phrase. Word: "${text}".
                English level you must to use in your output: ${englishLevel}.
                
                Return JSON format:
                {
                  "text": "${text}",
                  "transcription": "Resources: Oxford Learner's Dictionaries. Format for output: UK: [ˌjuːnɪˈvɜːsəti] US: [ˌjuːnɪˈvɜːrsəti];",
                  "translation": " Several possible Ukrainian translation variants (1-2 or more) for: "${text}". Output only in the format like: "Виглядати; дивитися; вигляд; зовнішність". No extra text. Only the string.",
                  "shortDescription": "A very short description (1-2 sentences max, under 100 characters). The description should be concise and clear",
                  "explanation": "A detailed definition/explanation of meaning and usage (can be longer and more comprehensive). Format example for output: A valley is a long, low area of land between hills or mountains. It is often formed by rivers or glaciers and can be wide or narrow. Valleys are places where people can live, grow crops, or travel through because they are lower and sometimes flatter than the surrounding land.",
                  "examples": ["Example sentence 1 using the word", "Example sentence 2 showing different context", "Example sentence 3 with another usage"],
                  "notes": ""
                }
                
                Make sure to provide:
                - Accurate phonetic transcription
                - Clear explanation (in English) appropriate for ${englishLevel} English level
                - Short description that's concise but informative for quick reference
                - Detailed explanation for comprehensive understanding
                - THREE natural example sentences showing different contexts
                - Ukrainian translation variants`;
                break;
        }

        console.log(`Generating AI content for: "${text}" using ${apiKeyInfo.effectiveSource} API key with model ${modelToUse}`);

        // Call OpenAI API with the user's preferred model and effective API key
        const chatCompletion = await openai.chat.completions.create({
            model: modelToUse,
            messages: [
                { role: "system", content: "You are a helpful assistant for language learning, specializing in English and Ukrainian." },
                { role: "user", content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 800, // Збільшено для 3 прикладів
        });

        const aiResponse = chatCompletion.choices[0].message.content;

        // For complete flashcard, try to parse JSON response
        let parsedResponse = aiResponse;
        if (promptType === "completeFlashcard" || promptType === undefined) {
            try {
                // Extract JSON if it's wrapped in code blocks or text
                const jsonMatch = aiResponse.match(/```json\n([\s\S]*?)\n```/) ||
                    aiResponse.match(/```\n([\s\S]*?)\n```/) ||
                    aiResponse.match(/{[\s\S]*?}/);

                const jsonStr = jsonMatch ? jsonMatch[0] : aiResponse;
                parsedResponse = JSON.parse(jsonStr.replace(/```json|```/g, ''));

                // Ensure the text field matches the original input
                parsedResponse.text = text;

                // Забезпечуємо, що examples є масивом
                if (typeof parsedResponse.examples === 'string') {
                    parsedResponse.examples = [parsedResponse.examples];
                }
                if (!Array.isArray(parsedResponse.examples)) {
                    parsedResponse.examples = [];
                }

            } catch (error) {
                console.log("Error parsing AI response as JSON:", error);
                return res.status(200).json({
                    raw: aiResponse,
                    parsed: false,
                    message: "Couldn't parse AI response as JSON",
                    apiKeyInfo
                });
            }
        } else if (promptType === "examples") {
            // Для генерації прикладів парсимо як JSON array
            try {
                const jsonMatch = aiResponse.match(/\[[\s\S]*?\]/) || aiResponse.match(/```json\n([\s\S]*?)\n```/);
                if (jsonMatch) {
                    const jsonStr = jsonMatch[0].replace(/```json|```/g, '');
                    parsedResponse = JSON.parse(jsonStr);
                } else {
                    // Fallback - розділяємо по лініям
                    parsedResponse = aiResponse.split('\n')
                        .filter(line => line.trim())
                        .map(line => line.replace(/^\d+\.\s*/, '').replace(/^["\-]\s*/, '').replace(/["]*$/, '').trim())
                        .filter(line => line.length > 0)
                        .slice(0, 3); // Беремо максимум 3
                }
            } catch (error) {
                console.log("Error parsing examples response:", error);
                // Fallback - розділяємо по лініям
                parsedResponse = aiResponse.split('\n')
                    .filter(line => line.trim())
                    .map(line => line.replace(/^\d+\.\s*/, '').replace(/^["\-]\s*/, '').replace(/["]*$/, '').trim())
                    .filter(line => line.length > 0)
                    .slice(0, 3);
            }
        }

        return res.status(200).json({
            result: parsedResponse,
            raw: aiResponse,
            parsed: promptType === "completeFlashcard" || promptType === undefined || promptType === "examples",
            apiKeyInfo,
            modelUsed: modelToUse
        });

    } catch (error) {
        console.log("Error in generateFlashcardContent controller:", error);

        // Enhanced error handling
        let errorResponse = {
            message: "Error generating content",
            details: "Error occurred while generating content with AI"
        };

        if (error.status === 401) {
            errorResponse = {
                message: "Invalid OpenAI API key",
                details: "API key may be expired, invalid, or have insufficient permissions",
                action: "Check your API key in Settings"
            };
        } else if (error.status === 429) {
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
        }

        return res.status(error.status || 500).json(errorResponse);
    }
};

// НОВИЙ ENDPOINT: Регенерація прикладів для існуючої картки
const regenerateExamples = async (req, res) => {
    try {
        const { id } = req.params; // ID картки
        const userId = req.user._id;

        // Знаходимо картку
        const flashcard = await Flashcard.findOne({ _id: id, userId });
        if (!flashcard) {
            return res.status(404).json({ message: "Flashcard not found" });
        }

        // Отримуємо налаштування користувача
        let userSettings = await UserSettings.findOne({ userId });
        if (!userSettings) {
            return res.status(400).json({ message: "User settings not found" });
        }

        const effectiveApiKey = userSettings.getEffectiveApiKey();
        const apiKeyInfo = userSettings.getApiKeyInfo();

        if (!effectiveApiKey) {
            return res.status(500).json({
                message: "No OpenAI API key available",
                details: "Please configure an API key in Settings",
                apiKeyInfo
            });
        }

        const englishLevel = userSettings.generalSettings?.defaultEnglishLevel || "B1";
        const modelToUse = userSettings.aiSettings?.chatgptModel || "gpt-4.1-mini";

        // Створюємо OpenAI клієнт
        const openai = new OpenAI({ apiKey: effectiveApiKey });

        // Генеруємо нові приклади
        const prompt = `Create 3 NEW and DIFFERENT example sentences using the word/phrase: "${flashcard.text}". 
        English level: ${englishLevel}. 
        Each sentence should show different contexts or meanings than previous examples.
        Make them creative and varied.
        Return as a JSON array of strings.`;

        console.log(`Regenerating examples for: "${flashcard.text}" using ${apiKeyInfo.effectiveSource} API key`);

        const chatCompletion = await openai.chat.completions.create({
            model: modelToUse,
            messages: [
                { role: "system", content: "You are a helpful assistant for language learning. Create diverse and creative example sentences." },
                { role: "user", content: prompt }
            ],
            temperature: 0.8, // Трохи більше творчості для різноманітних прикладів
            max_tokens: 400,
        });

        const aiResponse = chatCompletion.choices[0].message.content;
        let newExamples = [];

        try {
            // Парсимо відповідь
            const jsonMatch = aiResponse.match(/\[[\s\S]*?\]/) || aiResponse.match(/```json\n([\s\S]*?)\n```/);
            if (jsonMatch) {
                const jsonStr = jsonMatch[0].replace(/```json|```/g, '');
                newExamples = JSON.parse(jsonStr);
            } else {
                // Fallback - розділяємо по лініям
                newExamples = aiResponse.split('\n')
                    .filter(line => line.trim())
                    .map(line => line.replace(/^\d+\.\s*/, '').replace(/^["\-]\s*/, '').replace(/["]*$/, '').trim())
                    .filter(line => line.length > 0)
                    .slice(0, 3);
            }
        } catch (error) {
            console.log("Error parsing examples response:", error);
            // Fallback parsing
            newExamples = aiResponse.split('\n')
                .filter(line => line.trim())
                .map(line => line.replace(/^\d+\.\s*/, '').replace(/^["\-]\s*/, '').replace(/["]*$/, '').trim())
                .filter(line => line.length > 0)
                .slice(0, 3);
        }

        // Оновлюємо картку з новими прикладами
        flashcard.examples = newExamples;
        await flashcard.save();

        // Повертаємо оновлену картку
        await flashcard.populate('categoryId', 'name color');

        return res.status(200).json({
            success: true,
            flashcard: flashcard,
            newExamples: newExamples,
            message: "Examples regenerated successfully",
            apiKeyInfo,
            modelUsed: modelToUse
        });

    } catch (error) {
        console.log("Error in regenerateExamples controller:", error);

        let errorResponse = {
            message: "Error regenerating examples",
            details: "Error occurred while generating new examples"
        };

        if (error.status === 401) {
            errorResponse = {
                message: "Invalid OpenAI API key",
                details: "API key may be expired, invalid, or have insufficient permissions"
            };
        } else if (error.status === 429) {
            errorResponse = {
                message: "OpenAI API rate limit exceeded",
                details: "Too many requests to OpenAI API"
            };
        } else if (error.status === 402 || error.message?.includes('quota')) {
            errorResponse = {
                message: "OpenAI API quota exceeded",
                details: "Insufficient credits or billing issue"
            };
        }

        return res.status(error.status || 500).json(errorResponse);
    }
};

export default {
    generateFlashcardContent,
    regenerateExamples
};