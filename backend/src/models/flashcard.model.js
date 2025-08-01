// backend/src/models/flashcard.model.js

import mongoose from "mongoose";

const flashcardSchema = new mongoose.Schema(
    {
        text: {
            type: String,
            required: true,
            trim: true,
        },
        transcription: {
            type: String,
            default: "",
            trim: true,
        },
        translation: {
            type: String,
            default: "",
            trim: true,
        },
        // Короткий опис для відображення в grid режимі
        shortDescription: {
            type: String,
            default: "",
            trim: true,
            maxlength: 200, // Обмежуємо довжину для короткого опису
        },
        // Детальне пояснення для детального режиму
        explanation: {
            type: String,
            default: "",
            trim: true,
        },
        // ОНОВЛЕНО: example тепер масив прикладів
        examples: [{
            type: String,
            trim: true,
        }],
        // Залишаємо старе поле для зворотної сумісності, але deprecated
        example: {
            type: String,
            default: "",
            trim: true,
        },
        notes: {
            type: String,
            default: "",
            trim: true,
        },
        isAIGenerated: {
            type: Boolean,
            default: false,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        categoryId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Category",
            default: null, // null means no category (uncategorized)
        },
    },
    {
        timestamps: true,
    }
);

// Middleware для міграції старих даних при зчитуванні
flashcardSchema.post('find', function(docs) {
    if (docs && Array.isArray(docs)) {
        docs.forEach(doc => {
            // Якщо є старий example і немає examples, переносимо
            if (doc.example && (!doc.examples || doc.examples.length === 0)) {
                doc.examples = [doc.example];
            }
        });
    }
});

flashcardSchema.post('findOne', function(doc) {
    if (doc) {
        // Якщо є старий example і немає examples, переносимо
        if (doc.example && (!doc.examples || doc.examples.length === 0)) {
            doc.examples = [doc.example];
        }
    }
});

// Index for better performance
flashcardSchema.index({ userId: 1, categoryId: 1 });

const Flashcard = mongoose.model("Flashcard", flashcardSchema);
export default Flashcard;