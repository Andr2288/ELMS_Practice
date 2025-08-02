// frontend/src/components/exercises/MatchDescriptionsExercise.jsx - DRAG AND DROP VERSION

import { useState, useEffect } from "react";
import { useFlashcardStore } from "../../store/useFlashcardStore.js";
import { useUserSettingsStore } from "../../store/useUserSettingsStore.js";
import {
    CheckCircle, XCircle, ArrowRight, RotateCcw,
    Shuffle, Loader, Home, Trophy, Move,
    Target, AlertCircle, GripVertical
} from "lucide-react";

const MatchDescriptionsExercise = ({ practiceCards, onExit }) => {
    const { generateFieldContent } = useFlashcardStore();
    const { getDefaultEnglishLevel } = useUserSettingsStore();

    const [currentSetIndex, setCurrentSetIndex] = useState(0);
    const [wordsInCurrentSet, setWordsInCurrentSet] = useState([]);
    const [descriptions, setDescriptions] = useState([]);
    const [shuffledDescriptions, setShuffledDescriptions] = useState([]);
    const [matches, setMatches] = useState({}); // {dropZoneIndex: wordIndex}
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [showResult, setShowResult] = useState(false);
    const [correctMatches, setCorrectMatches] = useState({});
    const [score, setScore] = useState({ correct: 0, total: 0 });

    // Drag and Drop states
    const [draggedWord, setDraggedWord] = useState(null);
    const [dragOverZone, setDragOverZone] = useState(null);

    const englishLevel = getDefaultEnglishLevel();
    const wordsPerSet = 3;

    // Calculate total sets
    const totalSets = Math.ceil(practiceCards.length / wordsPerSet);

    // Check if we have enough cards for the exercise
    if (practiceCards.length < 3) {
        return (
            <div className="text-center py-12">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
                    <h3 className="text-lg font-semibold text-yellow-800 mb-2">
                        Недостатньо карток
                    </h3>
                    <p className="text-yellow-700">
                        Для цієї вправи потрібно мінімум 3 картки.
                        У вас є тільки {practiceCards.length}.
                    </p>
                </div>
                <button
                    onClick={() => onExit({ completed: false })}
                    className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg"
                >
                    Повернутися
                </button>
            </div>
        );
    }

    // Get current set of words
    const getCurrentWords = (setIndex) => {
        const startIndex = setIndex * wordsPerSet;
        const endIndex = Math.min(startIndex + wordsPerSet, practiceCards.length);
        return practiceCards.slice(startIndex, endIndex);
    };

    // Generate descriptions for current set
    const generateDescriptionsForSet = async (words) => {
        setIsLoading(true);
        setIsGenerating(true);

        try {
            const generatedDescriptions = [];

            for (let i = 0; i < words.length; i++) {
                const word = words[i];
                console.log(`Generating matching description for word: "${word.text}"`);

                try {
                    const description = await generateFieldContent(
                        word.text,
                        englishLevel,
                        "matchingDescription"
                    );
                    generatedDescriptions.push(description);
                } catch (error) {
                    console.error(`Error generating description for ${word.text}:`, error);
                    // Fallback to existing description or create simple one
                    const fallback = word.shortDescription ||
                        word.explanation ||
                        `A word: ${word.text}`;
                    generatedDescriptions.push(fallback);
                }
            }

            setDescriptions(generatedDescriptions);

            // Create shuffled descriptions with indices
            const descriptionsWithIndices = generatedDescriptions.map((desc, index) => ({
                description: desc,
                originalIndex: index
            }));

            // Shuffle descriptions
            const shuffled = [...descriptionsWithIndices].sort(() => Math.random() - 0.5);
            setShuffledDescriptions(shuffled);

            // Reset matches and states
            setMatches({});
            setShowResult(false);
            setCorrectMatches({});
            setDraggedWord(null);
            setDragOverZone(null);

        } catch (error) {
            console.error("Error generating descriptions:", error);
        } finally {
            setIsLoading(false);
            setIsGenerating(false);
        }
    };

    // Initialize first set
    useEffect(() => {
        const currentWords = getCurrentWords(currentSetIndex);
        setWordsInCurrentSet(currentWords);
        generateDescriptionsForSet(currentWords);
    }, [currentSetIndex]);

    // Drag and Drop handlers
    const handleDragStart = (e, wordIndex) => {
        setDraggedWord(wordIndex);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.target.outerHTML);
        e.target.style.opacity = '0.5';
    };

    const handleDragEnd = (e) => {
        e.target.style.opacity = '1';
        setDraggedWord(null);
        setDragOverZone(null);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDragEnter = (e, dropZoneIndex) => {
        e.preventDefault();
        setDragOverZone(dropZoneIndex);
    };

    const handleDragLeave = (e) => {
        // Only clear drag over if we're actually leaving the drop zone
        if (!e.currentTarget.contains(e.relatedTarget)) {
            setDragOverZone(null);
        }
    };

    const handleDrop = (e, dropZoneIndex) => {
        e.preventDefault();

        if (draggedWord !== null && !showResult) {
            // Remove word from any existing drop zone
            const newMatches = { ...matches };

            // Remove this word from any previous drop zone
            Object.keys(newMatches).forEach(zoneIndex => {
                if (newMatches[zoneIndex] === draggedWord) {
                    delete newMatches[zoneIndex];
                }
            });

            // Remove any word that was previously in this drop zone
            if (newMatches[dropZoneIndex] !== undefined) {
                delete newMatches[dropZoneIndex];
            }

            // Add the word to the new drop zone
            newMatches[dropZoneIndex] = draggedWord;

            setMatches(newMatches);
        }

        setDragOverZone(null);
    };

    // Check if word is currently placed in a drop zone
    const isWordPlaced = (wordIndex) => {
        return Object.values(matches).includes(wordIndex);
    };

    // Get word placed in specific drop zone
    const getWordInDropZone = (dropZoneIndex) => {
        return matches[dropZoneIndex];
    };

    // Check if all words are matched
    const areAllMatched = () => {
        return wordsInCurrentSet.every((_, index) => Object.values(matches).includes(index));
    };

    // Handle submit
    const handleSubmit = () => {
        if (!areAllMatched() || showResult) return;

        // Calculate correct matches
        const correct = {};
        let correctCount = 0;

        // For each drop zone, check if the correct word is placed
        shuffledDescriptions.forEach((descItem, dropZoneIndex) => {
            const wordIndex = matches[dropZoneIndex];
            if (wordIndex !== undefined) {
                const isCorrect = descItem.originalIndex === wordIndex;
                correct[dropZoneIndex] = isCorrect;
                if (isCorrect) correctCount++;
            }
        });

        setCorrectMatches(correct);
        setShowResult(true);

        // Update score
        setScore(prev => ({
            correct: prev.correct + correctCount,
            total: prev.total + wordsInCurrentSet.length
        }));
    };

    // Handle continue to next set
    const handleContinue = () => {
        if (currentSetIndex < totalSets - 1) {
            setCurrentSetIndex(currentSetIndex + 1);
        } else {
            // Exercise completed
            onExit({
                completed: true,
                score: score
            });
        }
    };

    // Handle restart
    const handleRestart = () => {
        setCurrentSetIndex(0);
        setScore({ correct: 0, total: 0 });
    };

    return (
        <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                        <div className="bg-gradient-to-r from-emerald-400 to-teal-400 w-12 h-12 rounded-xl flex items-center justify-center mr-4">
                            <Shuffle className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Поєднати з описом</h1>
                            <p className="text-gray-600">Перетягніть слова до відповідних описів</p>
                        </div>
                    </div>
                    <button
                        onClick={() => onExit({ completed: false })}
                        className="flex items-center text-gray-600 hover:text-gray-800 transition-colors"
                    >
                        <Home className="w-5 h-5 mr-2" />
                        Вийти
                    </button>
                </div>

                {/* Progress */}
                <div className="flex justify-between items-center text-sm text-gray-600 mb-2">
                    <span>Набір {currentSetIndex + 1} з {totalSets}</span>
                    <span>Правильно: {score.correct} з {score.total}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                        className="bg-gradient-to-r from-emerald-400 to-teal-400 h-2 rounded-full transition-all duration-300"
                        style={{
                            width: `${((currentSetIndex + 1) / totalSets) * 100}%`
                        }}
                    />
                </div>
            </div>

            {/* Main Exercise */}
            <div className="bg-white rounded-2xl shadow-md p-8 mb-6">
                {isLoading ? (
                    <div className="text-center py-12">
                        <Loader className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
                        <p className="text-gray-600">
                            {isGenerating ? "Генерую завуальовані описи для слів..." : "Завантаження..."}
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Instructions */}
                        <div className="text-center mb-8">
                            <h2 className="text-xl font-semibold text-gray-900 mb-2">
                                Перетягніть слова до відповідних описів
                            </h2>
                            <div className="flex items-center justify-center text-gray-600 mb-4">
                                <Move className="w-5 h-5 mr-2" />
                                <span>Перетягуйте слова в порожні поля навпроти описів</span>
                            </div>
                        </div>

                        {/* Draggable Words */}
                        <div className="mb-8">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
                                Слова для перетягування
                            </h3>
                            <div className="flex flex-wrap justify-center gap-4">
                                {wordsInCurrentSet.map((word, wordIndex) => {
                                    const isPlaced = isWordPlaced(wordIndex);

                                    return (
                                        <div
                                            key={wordIndex}
                                            draggable={!showResult && !isPlaced}
                                            onDragStart={(e) => handleDragStart(e, wordIndex)}
                                            onDragEnd={handleDragEnd}
                                            className={`px-6 py-4 rounded-xl border-2 font-medium transition-all duration-200 cursor-move select-none ${
                                                showResult
                                                    ? 'border-gray-200 bg-gray-50 text-gray-500 cursor-default'
                                                    : isPlaced
                                                        ? 'border-blue-500 bg-blue-50 text-blue-700 opacity-50 cursor-default'
                                                        : draggedWord === wordIndex
                                                            ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-lg scale-105'
                                                            : 'border-gray-300 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50 hover:shadow-md'
                                            }`}
                                        >
                                            <div className="flex items-center">
                                                {!showResult && !isPlaced && (
                                                    <GripVertical className="w-4 h-4 mr-2 text-gray-400" />
                                                )}
                                                <div>
                                                    <div className="text-lg font-bold">
                                                        {word.text}
                                                    </div>
                                                    {word.transcription && (
                                                        <div className="text-sm text-gray-500">
                                                            {word.transcription}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            {wordsInCurrentSet.some((_, index) => isWordPlaced(index)) && (
                                <p className="text-center text-sm text-gray-500 mt-4">
                                    Розміщені слова стають напівпрозорими
                                </p>
                            )}
                        </div>

                        {/* Matching Interface - Two Columns */}
                        <div className="grid grid-cols-2 gap-8">
                            {/* Drop Zones Column */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
                                    Перетягніть сюди
                                </h3>
                                <div className="space-y-4">
                                    {shuffledDescriptions.map((item, dropZoneIndex) => {
                                        const wordIndex = getWordInDropZone(dropZoneIndex);
                                        const hasWord = wordIndex !== undefined;
                                        const isCorrect = showResult ? correctMatches[dropZoneIndex] : null;
                                        const isDragOver = dragOverZone === dropZoneIndex;

                                        let dropZoneClass = "h-24 p-4 rounded-xl border-2 border-dashed transition-all duration-200 flex items-center justify-center ";

                                        if (showResult) {
                                            if (isCorrect === true) {
                                                dropZoneClass += "border-green-500 bg-green-50";
                                            } else if (isCorrect === false) {
                                                dropZoneClass += "border-red-500 bg-red-50";
                                            } else {
                                                dropZoneClass += "border-gray-200 bg-gray-50";
                                            }
                                        } else if (isDragOver) {
                                            dropZoneClass += "border-purple-500 bg-purple-100 scale-105";
                                        } else if (hasWord) {
                                            dropZoneClass += "border-blue-500 bg-blue-50";
                                        } else {
                                            dropZoneClass += "border-gray-300 bg-gray-50 hover:border-blue-300 hover:bg-blue-50";
                                        }

                                        return (
                                            <div
                                                key={dropZoneIndex}
                                                onDragOver={handleDragOver}
                                                onDragEnter={(e) => handleDragEnter(e, dropZoneIndex)}
                                                onDragLeave={handleDragLeave}
                                                onDrop={(e) => handleDrop(e, dropZoneIndex)}
                                                className={dropZoneClass}
                                            >
                                                {hasWord ? (
                                                    <div className="flex items-center">
                                                        <div className="text-lg font-bold text-gray-900">
                                                            {wordsInCurrentSet[wordIndex]?.text}
                                                        </div>
                                                        {showResult && (
                                                            <div className="ml-3">
                                                                {isCorrect === true ? (
                                                                    <CheckCircle className="w-6 h-6 text-green-600" />
                                                                ) : (
                                                                    <XCircle className="w-6 h-6 text-red-600" />
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="text-gray-400 text-center">
                                                        {isDragOver ? (
                                                            <div className="text-purple-600 font-medium">
                                                                Відпустіть тут
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center">
                                                                <Target className="w-5 h-5 mr-2" />
                                                                <span>Перетягніть слово</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Descriptions Column */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
                                    Описи
                                </h3>
                                <div className="space-y-4">
                                    {shuffledDescriptions.map((item, index) => {
                                        const isCorrectlyMatched = showResult ? correctMatches[index] === true : false;
                                        const isWronglyMatched = showResult ? correctMatches[index] === false : false;

                                        let descClass = "h-24 p-4 rounded-xl border transition-all duration-200 flex items-center ";

                                        if (showResult) {
                                            if (isCorrectlyMatched) {
                                                descClass += "border-green-200 bg-green-50";
                                            } else if (isWronglyMatched) {
                                                descClass += "border-red-200 bg-red-50";
                                            } else {
                                                descClass += "border-gray-200 bg-gray-50";
                                            }
                                        } else {
                                            descClass += "border-gray-200 bg-white";
                                        }

                                        return (
                                            <div key={index} className={descClass}>
                                                <p className="text-base leading-relaxed text-gray-800 text-center w-full">
                                                    {item.description}
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Submit Button */}
                        {!showResult && (
                            <div className="text-center mt-8">
                                <button
                                    onClick={handleSubmit}
                                    disabled={!areAllMatched()}
                                    className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:bg-gray-400 text-white py-3 px-8 rounded-xl font-medium transition-all flex items-center mx-auto"
                                >
                                    Перевірити поєднання
                                    <CheckCircle className="w-5 h-5 ml-2" />
                                </button>

                                {!areAllMatched() && (
                                    <div className="flex items-center justify-center text-sm text-gray-500 mt-2">
                                        <AlertCircle className="w-4 h-4 mr-1" />
                                        <span>Перетягніть всі слова до описів</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Result Summary */}
                        {showResult && (
                            <div className="mt-8 p-6 bg-gray-50 rounded-xl">
                                <h3 className="text-lg font-semibold mb-4 text-center">Результат набору</h3>
                                <div className="grid gap-3">
                                    {shuffledDescriptions.map((item, dropZoneIndex) => {
                                        const wordIndex = getWordInDropZone(dropZoneIndex);
                                        const isCorrect = correctMatches[dropZoneIndex];
                                        const word = wordIndex !== undefined ? wordsInCurrentSet[wordIndex] : null;
                                        const correctWord = wordsInCurrentSet[item.originalIndex];

                                        return (
                                            <div
                                                key={dropZoneIndex}
                                                className={`p-3 rounded-lg border ${
                                                    isCorrect
                                                        ? 'border-green-200 bg-green-50'
                                                        : 'border-red-200 bg-red-50'
                                                }`}
                                            >
                                                <div className="flex items-start">
                                                    <div className="mr-3 mt-1">
                                                        {isCorrect ? (
                                                            <CheckCircle className="w-5 h-5 text-green-600" />
                                                        ) : (
                                                            <XCircle className="w-5 h-5 text-red-600" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="text-sm text-gray-600 mb-2">
                                                            Опис: "{item.description}"
                                                        </div>
                                                        {word && (
                                                            <div className="font-bold text-gray-900 mb-1">
                                                                Ваш вибір: {word.text}
                                                            </div>
                                                        )}
                                                        {!isCorrect && (
                                                            <div className="text-sm text-green-700">
                                                                Правильна відповідь: {correctWord.text}
                                                            </div>
                                                        )}
                                                        {correctWord.translation && (
                                                            <div className="text-xs text-gray-500 mt-1">
                                                                Переклад: {correctWord.translation}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Controls */}
            {showResult && (
                <div className="bg-white rounded-2xl shadow-lg p-6">
                    <div className="flex justify-between items-center">
                        <button
                            onClick={handleRestart}
                            className="flex items-center text-gray-600 hover:text-gray-800 transition-colors"
                        >
                            <RotateCcw className="w-5 h-5 mr-2" />
                            Почати заново
                        </button>

                        <button
                            onClick={handleContinue}
                            className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white py-3 px-6 rounded-xl font-medium transition-all flex items-center"
                        >
                            {currentSetIndex < totalSets - 1 ? (
                                <>
                                    Продовжити
                                    <ArrowRight className="w-5 h-5 ml-2" />
                                </>
                            ) : (
                                <>
                                    Завершити
                                    <Trophy className="w-5 h-5 ml-2" />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MatchDescriptionsExercise;