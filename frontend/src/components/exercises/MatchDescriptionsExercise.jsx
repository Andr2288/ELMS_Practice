// frontend/src/components/exercises/MatchDescriptionsExercise.jsx

import { useState, useEffect } from "react";
import { useFlashcardStore } from "../../store/useFlashcardStore.js";
import { useUserSettingsStore } from "../../store/useUserSettingsStore.js";
import {
    CheckCircle, XCircle, ArrowRight, RotateCcw,
    Shuffle, Loader, Home, Trophy, Link2,
    Target, AlertCircle
} from "lucide-react";

const MatchDescriptionsExercise = ({ practiceCards, onExit }) => {
    const { generateFieldContent } = useFlashcardStore();
    const { getDefaultEnglishLevel } = useUserSettingsStore();

    const [currentSetIndex, setCurrentSetIndex] = useState(0);
    const [wordsInCurrentSet, setWordsInCurrentSet] = useState([]);
    const [descriptions, setDescriptions] = useState([]);
    const [shuffledDescriptions, setShuffledDescriptions] = useState([]);
    const [matches, setMatches] = useState({}); // {wordIndex: descriptionIndex}
    const [selectedWord, setSelectedWord] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [showResult, setShowResult] = useState(false);
    const [correctMatches, setCorrectMatches] = useState({});
    const [score, setScore] = useState({ correct: 0, total: 0 });

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

            // Reset matches
            setMatches({});
            setSelectedWord(null);
            setShowResult(false);
            setCorrectMatches({});

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

    // Handle word selection
    const handleWordClick = (wordIndex) => {
        if (showResult) return;

        // If this word is already matched, remove the match
        if (matches[wordIndex] !== undefined) {
            const newMatches = { ...matches };
            delete newMatches[wordIndex];
            setMatches(newMatches);
            setSelectedWord(null);
        } else {
            setSelectedWord(wordIndex);
        }
    };

    // Handle description selection
    const handleDescriptionClick = (shuffledDescIndex) => {
        if (showResult || selectedWord === null) return;

        // Check if this description is already matched
        const isAlreadyMatched = Object.values(matches).includes(shuffledDescIndex);
        if (isAlreadyMatched) return;

        // Create the match
        setMatches({
            ...matches,
            [selectedWord]: shuffledDescIndex
        });
        setSelectedWord(null);
    };

    // Check if all words are matched
    const areAllMatched = () => {
        return wordsInCurrentSet.every((_, index) => matches[index] !== undefined);
    };

    // Handle submit
    const handleSubmit = () => {
        if (!areAllMatched() || showResult) return;

        // Calculate correct matches
        const correct = {};
        let correctCount = 0;

        wordsInCurrentSet.forEach((word, wordIndex) => {
            const selectedDescIndex = matches[wordIndex];
            const selectedDesc = shuffledDescriptions[selectedDescIndex];
            const isCorrect = selectedDesc.originalIndex === wordIndex;

            correct[wordIndex] = isCorrect;
            if (isCorrect) correctCount++;
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

    // Get match line coordinates (simplified version)
    const getConnectionClass = (wordIndex, descriptionIndex) => {
        const selectedDescIndex = matches[wordIndex];
        if (selectedDescIndex === descriptionIndex) {
            if (showResult) {
                return correctMatches[wordIndex] ? 'border-green-500' : 'border-red-500';
            }
            return 'border-blue-500';
        }
        return '';
    };

    return (
        <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                        <div className="bg-gradient-to-r from-emerald-400 to-teal-400 w-12 h-12 rounded-xl flex items-center justify-center mr-4">
                            <Shuffle className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Поєднати з описом</h1>
                            <p className="text-gray-600">З'єднайте слова з їхніми описами</p>
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
            <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
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
                                Поєднайте слова з їхніми описами
                            </h2>
                            <div className="flex items-center justify-center text-gray-600 mb-4">
                                <Target className="w-5 h-5 mr-2" />
                                <span>Натисніть на слово, потім на відповідний опис</span>
                            </div>
                            {selectedWord !== null && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 inline-block">
                                    <div className="flex items-center text-blue-800">
                                        <Link2 className="w-4 h-4 mr-2" />
                                        <span>Обрано слово: <strong>{wordsInCurrentSet[selectedWord]?.text}</strong></span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Matching Interface */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Words Column */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
                                    Слова
                                </h3>
                                <div className="space-y-3">
                                    {wordsInCurrentSet.map((word, wordIndex) => {
                                        const isSelected = selectedWord === wordIndex;
                                        const isMatched = matches[wordIndex] !== undefined;
                                        const isCorrect = showResult ? correctMatches[wordIndex] : null;

                                        let buttonClass = "w-full p-4 text-left rounded-xl border-2 transition-all duration-200 font-medium ";

                                        if (showResult) {
                                            if (isCorrect === true) {
                                                buttonClass += "border-green-500 bg-green-50 text-green-700";
                                            } else if (isCorrect === false) {
                                                buttonClass += "border-red-500 bg-red-50 text-red-700";
                                            } else {
                                                buttonClass += "border-gray-200 bg-gray-50 text-gray-500";
                                            }
                                        } else if (isMatched) {
                                            buttonClass += "border-blue-500 bg-blue-50 text-blue-700";
                                        } else if (isSelected) {
                                            buttonClass += "border-purple-500 bg-purple-50 text-purple-700 shadow-lg scale-105";
                                        } else {
                                            buttonClass += "border-gray-300 hover:border-blue-300 hover:bg-blue-50 text-gray-700 cursor-pointer";
                                        }

                                        return (
                                            <button
                                                key={wordIndex}
                                                onClick={() => handleWordClick(wordIndex)}
                                                className={buttonClass}
                                                disabled={showResult}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <div className="text-xl font-bold mb-1">
                                                            {word.text}
                                                        </div>
                                                        {word.transcription && (
                                                            <div className="text-sm text-gray-500">
                                                                {word.transcription}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center">
                                                        {showResult && isCorrect === true && (
                                                            <CheckCircle className="w-6 h-6 text-green-600" />
                                                        )}
                                                        {showResult && isCorrect === false && (
                                                            <XCircle className="w-6 h-6 text-red-600" />
                                                        )}
                                                        {!showResult && isMatched && (
                                                            <Link2 className="w-5 h-5 text-blue-600" />
                                                        )}
                                                        {!showResult && isSelected && (
                                                            <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse" />
                                                        )}
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Descriptions Column */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
                                    Описи
                                </h3>
                                <div className="space-y-3">
                                    {shuffledDescriptions.map((item, shuffledIndex) => {
                                        const isMatched = Object.values(matches).includes(shuffledIndex);
                                        const matchedWordIndex = Object.keys(matches).find(
                                            key => matches[key] === shuffledIndex
                                        );
                                        const isCorrectMatch = showResult && matchedWordIndex !== undefined ?
                                            correctMatches[matchedWordIndex] : null;

                                        let buttonClass = "w-full p-4 text-left rounded-xl border-2 transition-all duration-200 ";

                                        if (showResult) {
                                            if (isCorrectMatch === true) {
                                                buttonClass += "border-green-500 bg-green-50 text-green-700";
                                            } else if (isCorrectMatch === false) {
                                                buttonClass += "border-red-500 bg-red-50 text-red-700";
                                            } else {
                                                buttonClass += "border-gray-200 bg-gray-50 text-gray-500";
                                            }
                                        } else if (isMatched) {
                                            buttonClass += "border-blue-500 bg-blue-50 text-blue-700";
                                        } else if (selectedWord !== null) {
                                            buttonClass += "border-gray-300 hover:border-purple-300 hover:bg-purple-50 text-gray-700 cursor-pointer";
                                        } else {
                                            buttonClass += "border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed";
                                        }

                                        return (
                                            <button
                                                key={shuffledIndex}
                                                onClick={() => handleDescriptionClick(shuffledIndex)}
                                                className={buttonClass}
                                                disabled={showResult || selectedWord === null || isMatched}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="text-base leading-relaxed pr-4">
                                                        {item.description}
                                                    </div>
                                                    <div>
                                                        {showResult && isCorrectMatch === true && (
                                                            <CheckCircle className="w-6 h-6 text-green-600" />
                                                        )}
                                                        {showResult && isCorrectMatch === false && (
                                                            <XCircle className="w-6 h-6 text-red-600" />
                                                        )}
                                                        {!showResult && isMatched && (
                                                            <Link2 className="w-5 h-5 text-blue-600" />
                                                        )}
                                                    </div>
                                                </div>
                                            </button>
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
                                        <span>Поєднайте всі слова з описами</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Result Summary */}
                        {showResult && (
                            <div className="mt-8 p-6 bg-gray-50 rounded-xl">
                                <h3 className="text-lg font-semibold mb-4 text-center">Результат набору</h3>
                                <div className="grid gap-3">
                                    {wordsInCurrentSet.map((word, wordIndex) => {
                                        const isCorrect = correctMatches[wordIndex];
                                        const selectedDescIndex = matches[wordIndex];
                                        const selectedDesc = shuffledDescriptions[selectedDescIndex];

                                        return (
                                            <div
                                                key={wordIndex}
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
                                                        <div className="font-bold text-gray-900 mb-1">
                                                            {word.text}
                                                        </div>
                                                        <div className="text-sm text-gray-600 mb-2">
                                                            Ваш вибір: "{selectedDesc.description}"
                                                        </div>
                                                        {!isCorrect && (
                                                            <div className="text-sm text-green-700">
                                                                Правильний опис: "{descriptions[wordIndex]}"
                                                            </div>
                                                        )}
                                                        {word.translation && (
                                                            <div className="text-xs text-gray-500 mt-1">
                                                                Переклад: {word.translation}
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