// frontend/src/pages/PracticePage.jsx - ПОВНІСТЮ НОВИЙ ДИЗАЙН

import { useState, useEffect } from "react";
import { useFlashcardStore } from "../store/useFlashcardStore.js";
import { useCategoryStore } from "../store/useCategoryStore.js";
import MultipleChoiceExercise from "../components/exercises/MultipleChoiceExercise.jsx";
import ListenAndFillExercise from "../components/exercises/ListenAndFillExercise.jsx";
import MatchDescriptionsExercise from "../components/exercises/MatchDescriptionsExercise.jsx";
import {
    Target, BookOpen, Play, Headphones, Shuffle, Brain,
    CheckSquare, Volume2, Clock, ArrowRight, Star, TrendingUp,
    Calendar, Filter, X, Zap, Award, Activity, Users,
    Sparkles, Flame, ChevronRight, BarChart3, Medal,
    Globe, Settings, RefreshCw, Lightbulb, Timer
} from "lucide-react";

const PracticePage = () => {
    const { flashcards, getFlashcards } = useFlashcardStore();
    const { categories, getCategories } = useCategoryStore();

    const [selectedCategory, setSelectedCategory] = useState('all');
    const [practiceCards, setPracticeCards] = useState([]);
    const [currentExercise, setCurrentExercise] = useState(null);
    const [lastResults, setLastResults] = useState(null);
    const [showCategoryFilter, setShowCategoryFilter] = useState(false);
    const [activeTab, setActiveTab] = useState('recommended');

    // Статистика та прогрес
    const [practiceStats, setPracticeStats] = useState({
        todayCount: 0,
        weeklyGoal: 50,
        streak: 3,
        totalPracticed: 147
    });

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
        if (practiceCards.length === 0) return;

        // Check minimum cards for specific exercises
        if (exerciseType === 'multiple-choice' && practiceCards.length < 4) {
            alert('Для цієї вправи потрібно мінімум 4 картки.');
            return;
        }

        if (exerciseType === 'match-definitions' && practiceCards.length < 3) {
            alert('Для цієї вправи потрібно мінімум 3 картки.');
            return;
        }

        const shuffledCards = [...practiceCards].sort(() => Math.random() - 0.5);
        setCurrentExercise({ type: exerciseType, cards: shuffledCards });
    };

    const handleExerciseExit = (results) => {
        setCurrentExercise(null);
        if (results && results.completed) {
            setLastResults(results);
            // Оновити статистику
            setPracticeStats(prev => ({
                ...prev,
                todayCount: prev.todayCount + 1
            }));
        }
    };

    // Exercise types data
    const exerciseTypes = [
        {
            id: 'multiple-choice',
            title: 'Множинний вибір',
            description: 'Оберіть правильний варіант з 4 можливих',
            icon: Brain,
            color: 'from-purple-500 to-pink-500',
            difficulty: 'Легко',
            time: '2-3 хв',
            minCards: 4,
            features: ['Швидке запам\'ятовування', 'Логічне мислення', 'Контекстне розуміння']
        },
        {
            id: 'listen-and-fill',
            title: 'Слухання та письмо',
            description: 'Прослухайте речення та впишіть пропуск',
            icon: Headphones,
            color: 'from-blue-500 to-cyan-500',
            difficulty: 'Середньо',
            time: '3-5 хв',
            minCards: 1,
            features: ['Розвиток слуху', 'Правопис', 'Вимова']
        },
        {
            id: 'match-definitions',
            title: 'Поєднання значень',
            description: 'З\'єднайте слова з їхніми описами',
            icon: Shuffle,
            color: 'from-emerald-500 to-teal-500',
            difficulty: 'Середньо',
            time: '4-6 хв',
            minCards: 3,
            features: ['Розуміння контексту', 'Логічні зв\'язки', 'Детальне осмислення']
        }
    ];

    // Quick practice suggestions
    const quickPractice = [
        {
            title: 'Швидка розминка',
            description: '5 хвилин щоденної практики',
            icon: Zap,
            cards: 10,
            time: '5 хв',
            color: 'bg-gradient-to-r from-yellow-400 to-orange-500'
        },
        {
            title: 'Інтенсивний режим',
            description: 'Глибоке вивчення слів',
            icon: Flame,
            cards: 25,
            time: '15 хв',
            color: 'bg-gradient-to-r from-red-500 to-pink-500'
        },
        {
            title: 'Марафон знань',
            description: 'Максимальна концентрація',
            icon: Medal,
            cards: 50,
            time: '30+ хв',
            color: 'bg-gradient-to-r from-indigo-500 to-purple-500'
        }
    ];

    // If an exercise is active, render the exercise component
    if (currentExercise) {
        switch (currentExercise.type) {
            case 'multiple-choice':
                return (
                    <div className="ml-64 min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-8">
                        <MultipleChoiceExercise
                            practiceCards={currentExercise.cards}
                            onExit={handleExerciseExit}
                        />
                    </div>
                );
            case 'listen-and-fill':
                return (
                    <div className="ml-64 min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-8">
                        <ListenAndFillExercise
                            practiceCards={currentExercise.cards}
                            onExit={handleExerciseExit}
                        />
                    </div>
                );
            case 'match-definitions':
                return (
                    <div className="ml-64 min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-8">
                        <MatchDescriptionsExercise
                            practiceCards={currentExercise.cards}
                            onExit={handleExerciseExit}
                        />
                    </div>
                );
            default:
                return (
                    <div className="ml-64 min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-8">
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
        <div className="ml-64 min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
            {/* Hero Section */}
            <div className="relative overflow-hidden mb-8">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10" />
                <div className="relative px-8 py-12">
                    <div className="max-w-7xl mx-auto">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <div className="flex items-center mb-4">
                                    <div className="bg-gradient-to-r from-blue-600 to-purple-600 w-16 h-16 rounded-2xl flex items-center justify-center mr-4 shadow-lg">
                                        <Target className="w-8 h-8 text-white" />
                                    </div>
                                    <div>
                                        <h1 className="text-4xl font-bold text-gray-900 mb-2">
                                            Практика англійської
                                        </h1>
                                        <p className="text-lg text-gray-600">
                                            Покращуйте свої навички через інтерактивні вправи
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Quick Stats */}
                            <div className="hidden lg:flex space-x-6">
                                <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 text-center shadow-lg">
                                    <div className="text-2xl font-bold text-blue-600">{practiceStats.todayCount}</div>
                                    <div className="text-sm text-gray-600">Сьогодні</div>
                                </div>
                                <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 text-center shadow-lg">
                                    <div className="text-2xl font-bold text-green-600">{practiceStats.streak}</div>
                                    <div className="text-sm text-gray-600">Серія днів</div>
                                </div>
                                <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 text-center shadow-lg">
                                    <div className="text-2xl font-bold text-purple-600">{practiceCards.length}</div>
                                    <div className="text-sm text-gray-600">Доступно</div>
                                </div>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-lg">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center">
                                    <Activity className="w-5 h-5 text-blue-600 mr-2" />
                                    <span className="font-medium text-gray-900">Щоденний прогрес</span>
                                </div>
                                <span className="text-sm text-gray-600">
                                    {practiceStats.todayCount} / {practiceStats.weeklyGoal}
                                </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3">
                                <div
                                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-500"
                                    style={{ width: `${Math.min(100, (practiceStats.todayCount / practiceStats.weeklyGoal) * 100)}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-8 pb-12">
                <div className="max-w-7xl mx-auto">
                    {/* Category Filter */}
                    <div className="mb-8">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold text-gray-900">Оберіть категорію</h2>
                            <button
                                onClick={() => setShowCategoryFilter(!showCategoryFilter)}
                                className="lg:hidden flex items-center text-blue-600 hover:text-blue-700 transition-colors"
                            >
                                <Filter className="w-5 h-5 mr-2" />
                                Фільтр
                            </button>
                        </div>

                        <div className={`${showCategoryFilter ? 'block' : 'hidden lg:block'}`}>
                            <div className="flex flex-wrap gap-3">
                                <button
                                    onClick={() => setSelectedCategory('all')}
                                    className={`relative px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                                        selectedCategory === 'all'
                                            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg transform scale-105'
                                            : 'bg-white text-gray-700 hover:bg-gray-50 shadow-md hover:shadow-lg'
                                    }`}
                                >
                                    <Globe className="w-4 h-4 inline mr-2" />
                                    Всі картки
                                    <span className="ml-2 px-2 py-1 text-xs rounded-full bg-black/20">
                                        {flashcards.length}
                                    </span>
                                </button>

                                <button
                                    onClick={() => setSelectedCategory('uncategorized')}
                                    className={`relative px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                                        selectedCategory === 'uncategorized'
                                            ? 'bg-gradient-to-r from-gray-600 to-gray-700 text-white shadow-lg transform scale-105'
                                            : 'bg-white text-gray-700 hover:bg-gray-50 shadow-md hover:shadow-lg'
                                    }`}
                                >
                                    <BookOpen className="w-4 h-4 inline mr-2" />
                                    Без категорії
                                    <span className="ml-2 px-2 py-1 text-xs rounded-full bg-black/20">
                                        {flashcards.filter(c => !c.categoryId).length}
                                    </span>
                                </button>

                                {categories.map(category => (
                                    <button
                                        key={category._id}
                                        onClick={() => setSelectedCategory(category._id)}
                                        className={`relative px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                                            selectedCategory === category._id
                                                ? 'text-white shadow-lg transform scale-105'
                                                : 'bg-white text-gray-700 hover:bg-gray-50 shadow-md hover:shadow-lg'
                                        }`}
                                        style={{
                                            background: selectedCategory === category._id
                                                ? `linear-gradient(135deg, ${category.color}, ${category.color}dd)`
                                                : undefined
                                        }}
                                    >
                                        {category.name}
                                        <span className="ml-2 px-2 py-1 text-xs rounded-full bg-black/20">
                                            {category.flashcardsCount || 0}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Tab Navigation */}
                    <div className="mb-8">
                        <nav className="flex space-x-8">
                            {[
                                { id: 'recommended', label: 'Рекомендовано', icon: Star },
                                { id: 'exercises', label: 'Всі вправи', icon: Target },
                                { id: 'quick', label: 'Швидка практика', icon: Zap }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center px-4 py-2 border-b-2 font-medium transition-colors ${
                                        activeTab === tab.id
                                            ? 'border-blue-600 text-blue-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    <tab.icon className="w-4 h-4 mr-2" />
                                    {tab.label}
                                </button>
                            ))}
                        </nav>
                    </div>

                    {/* Content based on active tab */}
                    {activeTab === 'recommended' && (
                        <div className="space-y-8 mb-8">
                            {/* Quick Practice Cards */}
                            <div>
                                <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                                    <Sparkles className="w-5 h-5 mr-2 text-yellow-500" />
                                    Швидкий старт
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {quickPractice.map((practice, index) => (
                                        <div
                                            key={index}
                                            onClick={() => handleExerciseClick('multiple-choice')}
                                            className="relative group cursor-pointer"
                                        >
                                            <div className={`${practice.color} rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2`}>
                                                <div className="flex items-center justify-between mb-4">
                                                    <practice.icon className="w-8 h-8" />
                                                    <ArrowRight className="w-5 h-5 opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                                </div>
                                                <h4 className="text-lg font-semibold mb-2">{practice.title}</h4>
                                                <p className="text-white/90 text-sm mb-4">{practice.description}</p>
                                                <div className="flex items-center text-sm">
                                                    <Clock className="w-4 h-4 mr-1" />
                                                    <span>{practice.time}</span>
                                                    <span className="mx-2">•</span>
                                                    <span>{Math.min(practice.cards, practiceCards.length)} карток</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Today's Recommendation */}
                            <div>
                                <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                                    <Lightbulb className="w-5 h-5 mr-2 text-blue-500" />
                                    Рекомендація дня
                                </h3>
                                <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-8 text-white shadow-xl">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="text-2xl font-bold mb-2">Міксована практика</h4>
                                            <p className="text-blue-100 mb-4">
                                                Комбінація різних типів вправ для максимального ефекту
                                            </p>
                                            <div className="flex items-center space-x-4 text-sm">
                                                <div className="flex items-center">
                                                    <Timer className="w-4 h-4 mr-1" />
                                                    15-20 хв
                                                </div>
                                                <div className="flex items-center">
                                                    <BookOpen className="w-4 h-4 mr-1" />
                                                    {Math.min(20, practiceCards.length)} карток
                                                </div>
                                                <div className="flex items-center">
                                                    <TrendingUp className="w-4 h-4 mr-1" />
                                                    Високий ефект
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleExerciseClick('multiple-choice')}
                                            className="bg-white/20 hover:bg-white/30 text-white px-8 py-4 rounded-xl font-semibold transition-all duration-200 flex items-center"
                                        >
                                            Почати
                                            <Play className="w-5 h-5 ml-2" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'exercises' && (
                        <div className="mb-8">
                            <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                                <Target className="w-5 h-5 mr-2 text-purple-500" />
                                Типи вправ
                            </h3>
                            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
                                {exerciseTypes.map((exercise) => {
                                    const isAvailable = practiceCards.length >= exercise.minCards;
                                    const Icon = exercise.icon;

                                    return (
                                        <div
                                            key={exercise.id}
                                            onClick={() => isAvailable && handleExerciseClick(exercise.id)}
                                            className={`group relative bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 ${
                                                isAvailable ? 'cursor-pointer hover:-translate-y-2' : 'opacity-60 cursor-not-allowed'
                                            }`}
                                        >
                                            {/* Background Gradient */}
                                            <div className={`absolute inset-0 bg-gradient-to-br ${exercise.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300 rounded-2xl`} />

                                            {/* Icon */}
                                            <div className={`w-16 h-16 bg-gradient-to-br ${exercise.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                                                <Icon className="w-8 h-8 text-white" />
                                            </div>

                                            {/* Content */}
                                            <div className="relative">
                                                <div className="flex items-center justify-between mb-3">
                                                    <h4 className="text-xl font-bold text-gray-900">{exercise.title}</h4>
                                                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                                                </div>

                                                <p className="text-gray-600 mb-6">{exercise.description}</p>

                                                {/* Stats */}
                                                <div className="flex items-center space-x-4 mb-6 text-sm">
                                                    <div className="flex items-center text-green-600">
                                                        <span className="w-2 h-2 bg-green-600 rounded-full mr-2" />
                                                        {exercise.difficulty}
                                                    </div>
                                                    <div className="flex items-center text-blue-600">
                                                        <Clock className="w-4 h-4 mr-1" />
                                                        {exercise.time}
                                                    </div>
                                                </div>

                                                {/* Features */}
                                                <div className="space-y-2 mb-6">
                                                    {exercise.features.map((feature, index) => (
                                                        <div key={index} className="flex items-center text-sm text-gray-600">
                                                            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-3" />
                                                            {feature}
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Action */}
                                                {isAvailable ? (
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sm text-gray-500">
                                                            {practiceCards.length} карток доступно
                                                        </span>
                                                        <div className={`px-4 py-2 bg-gradient-to-r ${exercise.color} text-white rounded-lg text-sm font-medium`}>
                                                            Почати
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="text-sm text-red-500">
                                                        Потрібно мінімум {exercise.minCards} карток
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {activeTab === 'quick' && (
                        <div className="mb-8">
                            <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                                <Zap className="w-5 h-5 mr-2 text-yellow-500" />
                                Швидка практика
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="bg-white rounded-2xl p-8 shadow-lg">
                                    <h4 className="text-lg font-semibold mb-4">Експрес-режим</h4>
                                    <p className="text-gray-600 mb-6">
                                        Швидкі 5-хвилинні сесії для підтримання форми
                                    </p>
                                    <button
                                        onClick={() => handleExerciseClick('multiple-choice')}
                                        className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-white py-3 rounded-xl font-medium hover:shadow-lg transition-all"
                                    >
                                        Почати експрес
                                    </button>
                                </div>

                                <div className="bg-white rounded-2xl p-8 shadow-lg">
                                    <h4 className="text-lg font-semibold mb-4">Випадкова вправа</h4>
                                    <p className="text-gray-600 mb-6">
                                        Система обере найкращу вправу для вас
                                    </p>
                                    <button
                                        onClick={() => {
                                            const randomExercise = exerciseTypes[Math.floor(Math.random() * exerciseTypes.length)];
                                            handleExerciseClick(randomExercise.id);
                                        }}
                                        className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-xl font-medium hover:shadow-lg transition-all"
                                    >
                                        Випадкова вправа
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* No Cards State */}
                    {practiceCards.length === 0 && (
                        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
                            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                <BookOpen className="w-12 h-12 text-gray-400" />
                            </div>
                            <h3 className="text-2xl font-semibold text-gray-900 mb-4">
                                Немає карток для практики
                            </h3>
                            <p className="text-gray-600 mb-8 max-w-md mx-auto">
                                У обраній категорії немає флешкарток. Спочатку додайте картки або оберіть іншу категорію.
                            </p>
                            <button
                                onClick={() => setSelectedCategory('all')}
                                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-8 rounded-xl font-medium hover:shadow-lg transition-all"
                            >
                                Переглянути всі картки
                            </button>
                        </div>
                    )}

                    {/* Last Results */}
                    {lastResults && (
                        <div className="bg-white rounded-2xl shadow-lg p-8 mt-8">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-semibold flex items-center">
                                    <Award className="w-6 h-6 mr-3 text-green-600" />
                                    Останній результат
                                </h3>
                                <div className="flex items-center text-sm text-gray-500">
                                    <Clock className="w-4 h-4 mr-1" />
                                    Щойно завершено
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-6">
                                    <div className="text-center">
                                        <div className="text-4xl font-bold text-green-600 mb-1">
                                            {Math.round((lastResults.score.correct / lastResults.score.total) * 100)}%
                                        </div>
                                        <div className="text-sm text-gray-600">Точність</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-blue-600 mb-1">
                                            {lastResults.score.correct}
                                        </div>
                                        <div className="text-sm text-gray-600">Правильно</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-purple-600 mb-1">
                                            {lastResults.score.total}
                                        </div>
                                        <div className="text-sm text-gray-600">Всього</div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setLastResults(null)}
                                    className="text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PracticePage;