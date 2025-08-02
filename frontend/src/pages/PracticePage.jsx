// frontend/src/pages/PracticePage.jsx

import { useState, useEffect } from "react";
import { useFlashcardStore } from "../store/useFlashcardStore.js";
import { useCategoryStore } from "../store/useCategoryStore.js";
import MultipleChoiceExercise from "../components/exercises/MultipleChoiceExercise.jsx";
import ListenAndFillExercise from "../components/exercises/ListenAndFillExercise.jsx";
import MatchDescriptionsExercise from "../components/exercises/MatchDescriptionsExercise.jsx";
import {
    Target, BookOpen, RotateCcw, Play, Headphones,
    Shuffle, Brain, CheckSquare, Volume2, Clock,
    ArrowRight, Star, TrendingUp, Calendar
} from "lucide-react";

const PracticePage = () => {
    const { flashcards, getFlashcards } = useFlashcardStore();
    const { categories, getCategories } = useCategoryStore();

    const [selectedCategory, setSelectedCategory] = useState('all');
    const [practiceCards, setPracticeCards] = useState([]);
    const [currentExercise, setCurrentExercise] = useState(null);
    const [lastResults, setLastResults] = useState(null);

    // Load data on component mount
    useEffect(() => {
        getFlashcards();
        getCategories();
    }, [getFlashcards, getCategories]);

    // Filter cards based on selected category
    useEffect(() => {
        let filteredCards = [...flashcards];

        if (selectedCategory !== 'all') {
            if (selectedCategory === 'uncategorized') {
                filteredCards = flashcards.filter(card => !card.categoryId);
            } else {
                filteredCards = flashcards.filter(card => card.categoryId?._id === selectedCategory);
            }
        }

        setPracticeCards(filteredCards);
    }, [flashcards, selectedCategory]);

    const handleExerciseClick = (exerciseType) => {
        if (practiceCards.length === 0) {
            return;
        }

        // Check minimum cards for specific exercises
        if (exerciseType === 'multiple-choice' && practiceCards.length < 4) {
            alert('Для цієї вправи потрібно мінімум 4 картки для створення 4 варіантів відповіді. У вас є тільки ' + practiceCards.length + '.');
            return;
        }

        // For listen-and-fill, we need at least 1 card
        if (exerciseType === 'listen-and-fill' && practiceCards.length === 0) {
            alert('Для цієї вправи потрібна хоча б одна картка.');
            return;
        }

        // For match-definitions, we need at least 3 cards
        if (exerciseType === 'match-definitions' && practiceCards.length < 3) {
            alert('Для цієї вправи потрібно мінімум 3 картки. У вас є тільки ' + practiceCards.length + '.');
            return;
        }

        // Shuffle cards for practice
        const shuffledCards = [...practiceCards].sort(() => Math.random() - 0.5);

        setCurrentExercise({
            type: exerciseType,
            cards: shuffledCards
        });
    };

    const handleExerciseExit = (results) => {
        setCurrentExercise(null);
        if (results && results.completed) {
            setLastResults(results);
        }
    };

    // If an exercise is active, render the exercise component
    if (currentExercise) {
        switch (currentExercise.type) {
            case 'multiple-choice':
                return (
                    <div className="ml-64 min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
                        <MultipleChoiceExercise
                            practiceCards={currentExercise.cards}
                            onExit={handleExerciseExit}
                        />
                    </div>
                );
            case 'listen-and-fill':
                return (
                    <div className="ml-64 min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
                        <ListenAndFillExercise
                            practiceCards={currentExercise.cards}
                            onExit={handleExerciseExit}
                        />
                    </div>
                );
            case 'match-definitions':
                return (
                    <div className="ml-64 min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
                        <MatchDescriptionsExercise
                            practiceCards={currentExercise.cards}
                            onExit={handleExerciseExit}
                        />
                    </div>
                );
            default:
                return (
                    <div className="ml-64 min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
                        <div className="max-w-4xl mx-auto text-center py-12">
                            <p className="text-gray-600 mb-4">Ця вправа ще в розробці</p>
                            <button
                                onClick={() => setCurrentExercise(null)}
                                className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg"
                            >
                                Повернутися
                            </button>
                        </div>
                    </div>
                );
        }
    }

    return (
        <div className="ml-64 min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="text-center mb-12">
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                        <Target className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-4xl font-bold text-gray-900 mb-4">Практика слів</h1>
                    <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                        Оберіть тип вправ для ефективного вивчення англійської мови
                    </p>
                </div>

                {/* Category Selection */}
                <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
                    <div className="flex items-center mb-4">
                        <BookOpen className="w-5 h-5 text-blue-600 mr-3" />
                        <h2 className="text-xl font-semibold text-gray-900">Оберіть категорію для практики</h2>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={() => setSelectedCategory('all')}
                            className={`px-4 py-2 rounded-lg font-medium transition-all ${
                                selectedCategory === 'all'
                                    ? 'bg-blue-600 text-white shadow-md'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            Всі картки ({flashcards.length})
                        </button>

                        <button
                            onClick={() => setSelectedCategory('uncategorized')}
                            className={`px-4 py-2 rounded-lg font-medium transition-all ${
                                selectedCategory === 'uncategorized'
                                    ? 'bg-blue-600 text-white shadow-md'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            Без категорії ({flashcards.filter(c => !c.categoryId).length})
                        </button>

                        {categories.map(category => (
                            <button
                                key={category._id}
                                onClick={() => setSelectedCategory(category._id)}
                                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                                    selectedCategory === category._id
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                                style={{
                                    backgroundColor: selectedCategory === category._id ? category.color : undefined
                                }}
                            >
                                {category.name} ({category.flashcardsCount || 0})
                            </button>
                        ))}
                    </div>
                </div>

                {/* Practice Types */}
                <div className="space-y-8">
                    {/* Основні вправи */}
                    <div>
                        <div className="flex items-center mb-6">
                            <div className="bg-gradient-to-r from-green-500 to-emerald-500 w-12 h-12 rounded-lg flex items-center justify-center mr-4 shadow-lg">
                                <Star className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">Основні вправи</h2>
                                <p className="text-gray-600">Щоденна практика для постійного вдосконалення</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Щоденний набір */}
                            <div
                                onClick={() => handleExerciseClick('daily-set')}
                                className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 cursor-pointer group hover:-translate-y-2"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="bg-gradient-to-r from-orange-400 to-red-400 w-14 h-14 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <Calendar className="w-7 h-7 text-white" />
                                    </div>
                                    <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">Щоденний набір вправ</h3>
                                <p className="text-gray-600 mb-4">
                                    Персоналізований набір вправ на основі вашого прогресу та слабких місць
                                </p>
                                <div className="flex items-center text-sm text-gray-500">
                                    <Clock className="w-4 h-4 mr-2" />
                                    <span>15-20 хвилин</span>
                                    <span className="mx-2">•</span>
                                    <span>{Math.min(20, practiceCards.length)} карток</span>
                                </div>
                            </div>

                            {/* Повтор всього */}
                            <div
                                onClick={() => handleExerciseClick('review-all')}
                                className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 cursor-pointer group hover:-translate-y-2"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="bg-gradient-to-r from-blue-400 to-purple-400 w-14 h-14 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <RotateCcw className="w-7 h-7 text-white" />
                                    </div>
                                    <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">Повтор всього вивченого</h3>
                                <p className="text-gray-600 mb-4">
                                    Повторіть всі слова з обраної категорії для закріплення знань
                                </p>
                                <div className="flex items-center text-sm text-gray-500">
                                    <Clock className="w-4 h-4 mr-2" />
                                    <span>Залежить від кількості</span>
                                    <span className="mx-2">•</span>
                                    <span>{practiceCards.length} карток</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Окремі вправи */}
                    <div>
                        <div className="flex items-center mb-6">
                            <div className="bg-gradient-to-r from-purple-500 to-indigo-500 w-12 h-12 rounded-lg flex items-center justify-center mr-4 shadow-lg">
                                <Brain className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">Спеціальні вправи</h2>
                                <p className="text-gray-600">Цільові вправи для розвитку конкретних навичок</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {/* Поєднати слова з описом */}
                            <div
                                onClick={() => handleExerciseClick('match-definitions')}
                                className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 cursor-pointer group hover:-translate-y-2"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="bg-gradient-to-r from-emerald-400 to-teal-400 w-14 h-14 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <Shuffle className="w-7 h-7 text-white" />
                                    </div>
                                    <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 mb-2">Поєднати з описом</h3>
                                <p className="text-gray-600 mb-4">
                                    З'єднайте англійські слова з їхніми короткими описами
                                </p>
                                <div className="flex items-center text-sm text-gray-500">
                                    <TrendingUp className="w-4 h-4 mr-2" />
                                    <span>Розвиває розуміння</span>
                                </div>
                            </div>

                            {/* Обрати правильний варіант */}
                            <div
                                onClick={() => handleExerciseClick('multiple-choice')}
                                className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 cursor-pointer group hover:-translate-y-2"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="bg-gradient-to-r from-pink-400 to-rose-400 w-14 h-14 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <CheckSquare className="w-7 h-7 text-white" />
                                    </div>
                                    <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 mb-2">Обрати варіант</h3>
                                <p className="text-gray-600 mb-4">
                                    Оберіть правильне слово з 4 варіантів на основі детального пояснення
                                </p>
                                <div className="flex items-center text-sm text-gray-500">
                                    <Brain className="w-4 h-4 mr-2" />
                                    <span>Логічне мислення</span>
                                </div>
                            </div>

                            {/* Прослухати та вписати */}
                            <div
                                onClick={() => handleExerciseClick('listen-and-fill')}
                                className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 cursor-pointer group hover:-translate-y-2"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="bg-gradient-to-r from-cyan-400 to-blue-400 w-14 h-14 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <Headphones className="w-7 h-7 text-white" />
                                    </div>
                                    <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 mb-2">Слухання та письмо</h3>
                                <p className="text-gray-600 mb-4">
                                    Прослухайте речення з пропуском та впишіть правильне слово
                                </p>
                                <div className="flex items-center text-sm text-gray-500">
                                    <Volume2 className="w-4 h-4 mr-2" />
                                    <span>Розвиває слух</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Stats Section */}
                {practiceCards.length === 0 && (
                    <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
                        <div className="text-gray-400 mb-4">
                            <BookOpen className="w-16 h-16 mx-auto" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">
                            Немає карток для практики
                        </h3>
                        <p className="text-gray-600 mb-4">
                            У обраній категорії немає флешкарток. Спочатку додайте картки або оберіть іншу категорію.
                        </p>
                        <button
                            onClick={() => setSelectedCategory('all')}
                            className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
                        >
                            Переглянути всі картки
                        </button>
                    </div>
                )}

                {/* Last Results */}
                {lastResults && (
                    <div className="bg-white rounded-2xl shadow-lg p-6 mt-6">
                        <h3 className="text-lg font-semibold mb-4 flex items-center">
                            <Target className="w-5 h-5 mr-2 text-green-600" />
                            Останній результат
                        </h3>
                        <div className="text-center">
                            <div className="text-3xl font-bold text-green-600 mb-2">
                                {Math.round((lastResults.score.correct / lastResults.score.total) * 100)}%
                            </div>
                            <div className="text-gray-600">
                                {lastResults.score.correct} з {lastResults.score.total} правильних відповідей
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PracticePage;