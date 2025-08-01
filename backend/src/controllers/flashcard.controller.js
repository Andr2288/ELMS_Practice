// backend/src/controllers/flashcard.controller.js

import Flashcard from "../models/flashcard.model.js";
import Category from "../models/category.model.js";

const createFlashcard = async (req, res) => {
  try {
    const { text, transcription, translation, shortDescription, explanation, example, examples, notes, isAIGenerated, categoryId } = req.body;
    const userId = req.user._id;

    if (!text) {
      return res.status(400).json({ message: "Text is required" });
    }

    // Verify category exists if provided
    if (categoryId) {
      const category = await Category.findOne({ _id: categoryId, userId });
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
    }

    // Обробляємо examples - підтримуємо як новий формат (масив), так і старий (рядок)
    let processedExamples = [];
    if (examples && Array.isArray(examples)) {
      processedExamples = examples.filter(ex => ex && ex.trim()).map(ex => ex.trim());
    } else if (example && example.trim()) {
      // Для зворотної сумісності зі старим форматом
      processedExamples = [example.trim()];
    }

    const newFlashcard = new Flashcard({
      text: text.trim(),
      transcription: transcription?.trim() || "",
      translation: translation?.trim() || "",
      shortDescription: shortDescription?.trim() || "",
      explanation: explanation?.trim() || "",
      examples: processedExamples,
      example: example?.trim() || "", // Залишаємо для зворотної сумісності
      notes: notes?.trim() || "",
      isAIGenerated: isAIGenerated || false,
      categoryId: categoryId || null,
      userId,
    });

    await newFlashcard.save();

    // Populate category information
    await newFlashcard.populate('categoryId', 'name color');

    return res.status(201).json(newFlashcard);
  } catch (error) {
    console.log("Error in createFlashcard controller", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const getFlashcards = async (req, res) => {
  try {
    const userId = req.user._id;
    const { categoryId } = req.query;

    let query = { userId };

    // Filter by category if provided
    if (categoryId) {
      if (categoryId === 'uncategorized') {
        query.categoryId = null;
      } else {
        query.categoryId = categoryId;
      }
    }

    const flashcards = await Flashcard.find(query)
        .populate('categoryId', 'name color')
        .sort({ createdAt: -1 });

    return res.status(200).json(flashcards);
  } catch (error) {
    console.log("Error in getFlashcards controller", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const updateFlashcard = async (req, res) => {
  try {
    const { id } = req.params;
    const { text, transcription, translation, shortDescription, explanation, example, examples, notes, isAIGenerated, categoryId } = req.body;
    const userId = req.user._id;

    if (!text) {
      return res.status(400).json({ message: "Text is required" });
    }

    const flashcard = await Flashcard.findOne({ _id: id, userId });

    if (!flashcard) {
      return res.status(404).json({ message: "Flashcard not found" });
    }

    // Verify category exists if provided
    if (categoryId) {
      const category = await Category.findOne({ _id: categoryId, userId });
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
    }

    // Обробляємо examples - підтримуємо як новий формат (масив), так і старий (рядок)
    let processedExamples = [];
    if (examples && Array.isArray(examples)) {
      processedExamples = examples.filter(ex => ex && ex.trim()).map(ex => ex.trim());
    } else if (example && example.trim()) {
      // Для зворотної сумісності зі старим форматом
      processedExamples = [example.trim()];
    }

    flashcard.text = text.trim();
    flashcard.transcription = transcription?.trim() || "";
    flashcard.translation = translation?.trim() || "";
    flashcard.shortDescription = shortDescription?.trim() || "";
    flashcard.explanation = explanation?.trim() || "";
    flashcard.examples = processedExamples;
    flashcard.example = example?.trim() || ""; // Залишаємо для зворотної сумісності
    flashcard.notes = notes?.trim() || "";
    if (isAIGenerated !== undefined) flashcard.isAIGenerated = isAIGenerated;
    flashcard.categoryId = categoryId || null;

    await flashcard.save();

    // Populate category information
    await flashcard.populate('categoryId', 'name color');

    return res.status(200).json(flashcard);
  } catch (error) {
    console.log("Error in updateFlashcard controller", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const deleteFlashcard = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const flashcard = await Flashcard.findOneAndDelete({ _id: id, userId });

    if (!flashcard) {
      return res.status(404).json({ message: "Flashcard not found" });
    }

    return res.status(200).json({ message: "Flashcard deleted" });
  } catch (error) {
    console.log("Error in deleteFlashcard controller", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// Get flashcards grouped by category
const getFlashcardsGrouped = async (req, res) => {
  try {
    const userId = req.user._id;

    const result = await Flashcard.aggregate([
      { $match: { userId } },
      {
        $lookup: {
          from: "categories",
          localField: "categoryId",
          foreignField: "_id",
          as: "category"
        }
      },
      {
        $group: {
          _id: "$categoryId",
          category: { $first: { $arrayElemAt: ["$category", 0] } },
          flashcards: { $push: "$$ROOT" },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    return res.status(200).json(result);
  } catch (error) {
    console.log("Error in getFlashcardsGrouped controller", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export default {
  createFlashcard,
  getFlashcards,
  updateFlashcard,
  deleteFlashcard,
  getFlashcardsGrouped,
};