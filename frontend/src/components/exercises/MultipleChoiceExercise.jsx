// frontend/src/components/exercises/MultipleChoiceExercise.jsx
// ЛОГІКА ПОВТОРЕННЯ: Неправильно відповіджені слова додаються в кінець для закріплення
// ДОДАНО: Детальна інформація про слово після вибору відповіді

import { useState, useEffect, useRef } from "react";
import { useFlashcardStore } from "../../store/useFlashcardStore.js";
import { useUserSettingsStore } from "../../store/useUserSettingsStore.js";
import { axiosInstance } from "../../lib/axios.js";
import {
    CheckCircle, XCircle, ArrowRight, RotateCcw,
    Brain, Loader, Home, Trophy, Volume2,
    RotateCcw as RefreshIcon, StickyNote, Sparkles
} from "lucide-react";
import toast from "react-hot-toast";

const MultipleChoiceExercise = ({ practiceCards, onExit }) => {
    const { generateFieldContent, updateFlashcard } = useFlashcardStore();
    const { getDefaultEnglishLevel, getTTSSettings } = useUserSettingsStore();

    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [dynamicPracticeCards, setDynamicPracticeCards] = useState([...practiceCards]); // Динамічний масив карток
    const [currentExplanation, setCurrentExplanation] = useState("");
    const [answerOptions, setAnswerOptions] = useState([]);
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [isCorrect, setIsCorrect] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [score, setScore] = useState({ correct: 0, total: 0 });
    const [showResult, setShowResult] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [originalCardsCount, setOriginalCardsCount] = useState(practiceCards.length); // Початкова кількість
    const [cardAddedBack, setCardAddedBack] = useState(false); // Індикатор що картка додана знову

    // Audio states
    const [isPlayingAudio, setIsPlayingAudio] = useState(false);
    const [isRegeneratingExamples, setIsRegeneratingExamples] = useState(false);
    const [updatedCard, setUpdatedCard] = useState(null); // Для збереження оновленої картки

    const currentCard = dynamicPracticeCards[currentCardIndex];
    const displayCard = updatedCard || currentCard; // Використовуємо оновлену картку якщо є
    const englishLevel = getDefaultEnglishLevel();

    // Audio ref
    const currentAudioRef = useRef(null);

    // Check if we have enough cards for the exercise (need 4 cards minimum for 4 options)
    if (practiceCards.length < 4) {
        return (
            <div className="text-center py-12">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
                    <h3 className="text-lg font-semibold text-yellow-800 mb-2">
                        Недостатньо карток
                    </h3>
                    <p className="text-yellow-700">
                        Для цієї вправи потрібно мінімум 4 картки для створення 4 варіантів відповіді.
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

    // Generate explanation and 4 answer options for current card
    const generateQuestion = async (card) => {
        if (!card) return;

        setIsLoading(true);
        setIsGenerating(true);
        setCardAddedBack(false); // Скидаємо індикатор
        setUpdatedCard(null); // Скидаємо оновлену картку

        try {
            setShowResult(false);

            // Generate new explanation different from existing ones
            const explanation = await generateFieldContent(
                card.text,
                englishLevel,
                "exerciseExplanation"
            );

            // Create wrong answers from original practice cards (не з динамічного масиву)
            const otherCards = practiceCards.filter(c => c._id !== card._id);
            const shuffledOthers = otherCards.sort(() => Math.random() - 0.5);

            // Always take exactly 3 wrong answers for 4 total options
            const wrongAnswers = shuffledOthers
                .slice(0, 3)
                .map(c => c.text);

            // Create all options (1 correct + 3 wrong = 4 total) and shuffle
            const allOptions = [card.text, ...wrongAnswers];
            const shuffledOptions = allOptions.sort(() => Math.random() - 0.5);

            setCurrentExplanation(explanation);
            setAnswerOptions(shuffledOptions);
            setSelectedAnswer(null);
            setIsCorrect(null);
        } catch (error) {
            console.error("Error generating question:", error);
            // Fallback to existing explanation if AI generation fails
            setCurrentExplanation(
                card.explanation ||
                card.shortDescription ||
                `A word or phrase: "${card.text}"`
            );

            // Still create 4 options with other cards
            const otherCards = practiceCards.filter(c => c._id !== card._id);
            const shuffledOthers = otherCards.sort(() => Math.random() - 0.5);
            const wrongAnswers = shuffledOthers.slice(0, 3).map(c => c.text);
            const allOptions = [card.text, ...wrongAnswers];
            setAnswerOptions(allOptions.sort(() => Math.random() - 0.5));
            setSelectedAnswer(null);
            setIsCorrect(null);
            setShowResult(false);
        } finally {
            setIsLoading(false);
            setIsGenerating(false);
        }
    };

    // Initialize first question
    useEffect(() => {
        if (currentCard) {
            generateQuestion(currentCard);
        }
    }, [currentCardIndex]); // Змінено залежність на currentCardIndex

    // Initialize dynamic practice cards
    useEffect(() => {
        setDynamicPracticeCards([...practiceCards]);
        setOriginalCardsCount(practiceCards.length);
    }, [practiceCards]);

    // Auto-hide "card added back" indicator
    useEffect(() => {
        if (cardAddedBack) {
            const timer = setTimeout(() => {
                setCardAddedBack(false);
            }, 3000); // Згасає через 3 секунди

            return () => clearTimeout(timer);
        }
    }, [cardAddedBack]);

    // Audio cleanup
    useEffect(() => {
        return () => {
            if (currentAudioRef.current) {
                currentAudioRef.current.pause();
                currentAudioRef.current = null;
            }
        };
    }, []);

    // TTS Function (similar to DetailedFlashcardView)
    const speakText = async (text) => {
        if (!text || isPlayingAudio) return;

        try {
            // Stop current audio
            if (currentAudioRef.current) {
                currentAudioRef.current.pause();
                currentAudioRef.current = null;
            }

            setIsPlayingAudio(true);

            const response = await axiosInstance.post(
                "/tts/speech",
                { text: text.trim() },
                {
                    responseType: "blob",
                    timeout: 30000,
                }
            );

            const audioBlob = new Blob([response.data], { type: "audio/mpeg" });
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);

            currentAudioRef.current = audio;

            audio.onended = () => {
                setIsPlayingAudio(false);
                currentAudioRef.current = null;
                URL.revokeObjectURL(audioUrl);
            };

            audio.onerror = () => {
                setIsPlayingAudio(false);
                currentAudioRef.current = null;
                URL.revokeObjectURL(audioUrl);
                toast.error("Помилка відтворення звуку");
            };

            await audio.play();
        } catch (error) {
            setIsPlayingAudio(false);
            currentAudioRef.current = null;
            console.error("Error playing TTS:", error);

            if (error.response?.status === 401) {
                toast.error("API ключ недійсний");
            } else if (error.response?.status === 402) {
                toast.error("Недостатньо кредитів OpenAI");
            } else {
                toast.error("Помилка генерації озвучення");
            }
        }
    };

    // Regenerate examples function (similar to DetailedFlashcardView)
    const regenerateExamples = async () => {
        if (!displayCard || isRegeneratingExamples) return;

        setIsRegeneratingExamples(true);

        try {
            const response = await axiosInstance.post(`/openai/regenerate-examples/${displayCard._id}`);

            if (response.data.success) {
                const newCard = response.data.flashcard;
                setUpdatedCard(newCard);

                // Also update in global store
                await updateFlashcard(displayCard._id, {
                    ...displayCard,
                    examples: newCard.examples
                });
            } else {
                toast.error("Помилка генерації прикладів");
            }
        } catch (error) {
            console.error("Error regenerating examples:", error);
            if (error.response?.status === 401) {
                toast.error("API ключ недійсний");
            } else if (error.response?.status === 402) {
                toast.error("Недостатньо кредитів OpenAI");
            } else {
                toast.error("Помилка генерації нових прикладів");
            }
        } finally {
            setIsRegeneratingExamples(false);
        }
    };

    // Get examples from card (supporting both old and new format)
    const getExamples = (card) => {
        if (card?.examples && Array.isArray(card.examples) && card.examples.length > 0) {
            return card.examples.filter(ex => ex && ex.trim());
        } else if (card?.example && card.example.trim()) {
            return [card.example.trim()];
        }
        return [];
    };

    const handleAnswerSelect = (answer) => {
        if (selectedAnswer !== null) return; // Prevent multiple selections

        const correct = answer === currentCard.text;
        setSelectedAnswer(answer);
        setIsCorrect(correct);
        setShowResult(true);

        setScore(prev => ({
            correct: prev.correct + (correct ? 1 : 0),
            total: prev.total + 1
        }));
    };

    const handleContinue = () => {
        // Якщо відповідь неправильна, додаємо картку в кінець масиву для повторення
        if (!isCorrect && currentCard) {
            // Перевіряємо, чи ця картка вже не додана раніше (щоб уникнути дублювання)
            const isDuplicate = dynamicPracticeCards
                .slice(currentCardIndex + 1)
                .some(card => card._id === currentCard._id);

            if (!isDuplicate) {
                setDynamicPracticeCards(prevCards => [...prevCards, currentCard]);
                setCardAddedBack(true);
                console.log(`Card "${currentCard.text}" added back for review`);
            } else {
                console.log(`Card "${currentCard.text}" already scheduled for review`);
            }
        }

        if (currentCardIndex < dynamicPracticeCards.length - 1) {
            setCurrentCardIndex(currentCardIndex + 1);
        } else {
            // Exercise completed
            onExit({
                completed: true,
                score: {
                    correct: score.correct + (isCorrect ? 1 : 0),
                    total: score.total + 1
                }
            });
        }
    };

    const handleRestart = () => {
        setCurrentCardIndex(0);
        setDynamicPracticeCards([...practiceCards]); // Повертаємо оригінальний масив
        setOriginalCardsCount(practiceCards.length);
        setScore({ correct: 0, total: 0 });
        setCardAddedBack(false);
        setUpdatedCard(null);
        // generateQuestion буде викликана через useEffect при зміні currentCardIndex
    };

    if (!currentCard) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-600">Немає карток для вправи</p>
                <button
                    onClick={() => onExit({ completed: false })}
                    className="mt-4 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg"
                >
                    Повернутися
                </button>
            </div>
        );
    }

    const examples = getExamples(displayCard);

    return (
        <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                        <div className="bg-gradient-to-r from-pink-400 to-rose-400 w-12 h-12 rounded-xl flex items-center justify-center mr-4">
                            <Brain className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Обрати варіант</h1>
                            <p className="text-gray-600">Оберіть правильне слово за поясненням</p>
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
                    <span>Питання {currentCardIndex + 1} з {dynamicPracticeCards.length}</span>
                    <span>Правильно: {score.correct} з {dynamicPracticeCards.length}</span>
                </div>
                {/* Прогрес-бар базується на оригінальній кількості для правильного відображення */}
                <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                        className="bg-gradient-to-r from-pink-400 to-rose-400 h-2 rounded-full transition-all duration-300"
                        style={{
                            width: `${Math.min(100, (Math.min(currentCardIndex + 1, dynamicPracticeCards.length) / dynamicPracticeCards.length) * 100)}%`
                        }}
                    />
                </div>
            </div>

            {/* Question */}
            <div className="bg-white rounded-2xl shadow-md p-8 mb-6 h-full">
                {isLoading ? (
                    <div className="text-center py-12">
                        <Loader className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
                        <p className="text-gray-600">
                            {isGenerating ? "Генерую нове пояснення..." : "Завантаження..."}
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="text-center mb-8">
                            <h2 className="text-lg font-medium text-gray-700 mb-4">
                                Яке слово підходить до цього опису?
                            </h2>
                            <div className="bg-blue-50 rounded-xl p-6 border-l-4 border-blue-400">
                                <p className="text-lg text-gray-800 leading-relaxed">
                                    {currentExplanation}
                                </p>
                            </div>
                        </div>

                        {/* Answer Options - 2x2 Grid */}
                        <div className="grid grid-cols-2 gap-4 max-w-3xl mx-auto">
                            {answerOptions.map((option, index) => {
                                let buttonClass = "w-full p-6 text-center rounded-xl border-2 transition-all duration-200 font-medium text-lg ";

                                if (selectedAnswer === null) {
                                    buttonClass += "border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-gray-700 hover:shadow-lg hover:scale-102";
                                } else if (option === currentCard.text) {
                                    buttonClass += "border-green-500 bg-green-50 text-green-700 shadow-lg";
                                } else if (option === selectedAnswer) {
                                    buttonClass += "border-red-500 bg-red-50 text-red-700 shadow-lg";
                                } else {
                                    buttonClass += "border-gray-200 bg-gray-50 text-gray-500";
                                }

                                return (
                                    <button
                                        key={index}
                                        onClick={() => handleAnswerSelect(option)}
                                        disabled={selectedAnswer !== null}
                                        className={buttonClass}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="flex-1">{option}</span>
                                            {selectedAnswer !== null && (
                                                <span className="ml-3">
                                                    {option === currentCard.text ? (
                                                        <CheckCircle className="w-6 h-6 text-green-600" />
                                                    ) : option === selectedAnswer ? (
                                                        <XCircle className="w-6 h-6 text-red-600" />
                                                    ) : null}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Result with Detailed Information */}
                        {showResult && (
                            <div className={`mt-8 rounded-xl border ${
                                isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                            }`}>
                                {/* Result Header */}
                                <div className="p-6 border-b border-gray-200">
                                    <div className="flex items-center mb-3">
                                        {isCorrect ? (
                                            <CheckCircle className="w-6 h-6 text-green-600 mr-3" />
                                        ) : (
                                            <XCircle className="w-6 h-6 text-red-600 mr-3" />
                                        )}
                                        <span className={`font-semibold ${
                                            isCorrect ? 'text-green-800' : 'text-red-800'
                                        }`}>
                                            {isCorrect ? 'Правильно!' : 'Неправильно'}
                                        </span>
                                    </div>

                                    {!isCorrect && (
                                        <>
                                            <p className="text-gray-700 mb-3">
                                                Правильна відповідь: <strong>{currentCard.text}</strong>
                                            </p>
                                            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-3">
                                                <div className="flex items-center text-orange-800">
                                                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                    </svg>
                                                    <span className="font-medium">Це слово буде додано для повторення</span>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Detailed Information Section */}
                                <div className="bg-gradient-to-br from-stone-50 to-neutral-100 overflow-hidden">
                                    {/* Header - вертикальне розташування */}
                                    <div className="text-center p-6 pb-4 space-y-4">
                                        {/* AI badge */}
                                        {displayCard.isAIGenerated && (
                                            <div className="flex justify-center">
                                                <div className="inline-flex items-center space-x-1 text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded-full">
                                                    <Sparkles className="w-3 h-3" />
                                                    <span>ШІ-генерація</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Слово */}
                                        <h3 className="text-3xl font-bold text-gray-900">
                                            {displayCard.text}
                                        </h3>

                                        {/* Транскрипція */}
                                        {displayCard.transcription && (
                                            <p className="text-lg text-gray-600 font-mono">
                                                {displayCard.transcription}
                                            </p>
                                        )}

                                        {/* Кнопка озвучки */}
                                        <div className="pt-2">
                                            <button
                                                onClick={() => speakText(displayCard.text)}
                                                disabled={isPlayingAudio}
                                                className={`px-6 py-3 rounded-lg transition-all shadow-md ${
                                                    isPlayingAudio
                                                        ? "bg-green-500 hover:bg-green-600 animate-pulse scale-105"
                                                        : "bg-purple-500 hover:bg-purple-600 hover:scale-105"
                                                } disabled:bg-gray-300 disabled:scale-100 text-white flex items-center space-x-2 mx-auto`}
                                            >
                                                <Volume2 className="w-5 h-5" />
                                                <span>
                                                    {isPlayingAudio ? "Відтворення..." : "Озвучити"}
                                                </span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Content - все відображається вертикально */}
                                    <div className="px-6 pb-6 space-y-6">
                                        {/* Translation */}
                                        {displayCard.translation && (
                                            <div className="text-center py-4">
                                                <p className="text-2xl font-bold text-gray-900 leading-relaxed mb-2">
                                                    {displayCard.translation.charAt(0).toUpperCase() + displayCard.translation.slice(1)}
                                                </p>
                                                <div className="w-16 h-0.5 bg-gradient-to-r from-transparent via-gray-300 to-transparent mx-auto"></div>
                                            </div>
                                        )}

                                        {/* Explanation */}
                                        {displayCard.explanation && (
                                            <div>
                                                <h4 className="text-sm font-semibold text-blue-700 mb-3 uppercase tracking-wide">
                                                    Детальне пояснення
                                                </h4>
                                                <div className="bg-white/60 rounded-lg p-4 border-l-4 border-blue-300">
                                                    <p className="text-gray-800 leading-relaxed text-lg">
                                                        {displayCard.explanation}
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Notes */}
                                        {displayCard.notes && (
                                            <div>
                                                <h4 className="text-sm font-semibold text-rose-700 mb-3 uppercase tracking-wide flex items-center">
                                                    <StickyNote className="w-4 h-4 mr-1" />
                                                    Особисті нотатки
                                                </h4>
                                                <div className="bg-rose-50/80 rounded-lg p-4 border-l-4 border-rose-300">
                                                    <p className="text-gray-800 leading-relaxed text-lg">
                                                        {displayCard.notes}
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Examples */}
                                        {examples.length > 0 && (
                                            <div>
                                                <div className="flex items-center justify-between mb-3">
                                                    <h4 className="text-sm font-semibold text-green-700 uppercase tracking-wide">
                                                        Приклади використання
                                                    </h4>
                                                    <button
                                                        onClick={regenerateExamples}
                                                        disabled={isRegeneratingExamples}
                                                        className="flex items-center space-x-1 text-xs bg-green-100 hover:bg-green-200 disabled:bg-gray-100 text-green-700 disabled:text-gray-500 px-2 py-1 rounded transition-colors"
                                                        title="Згенерувати інші приклади"
                                                    >
                                                        {isRegeneratingExamples ? (
                                                            <Loader className="w-3 h-3 animate-spin" />
                                                        ) : (
                                                            <RefreshIcon className="w-3 h-3" />
                                                        )}
                                                        <span>Інші приклади</span>
                                                    </button>
                                                </div>

                                                <div className="space-y-3">
                                                    {examples.map((example, index) => (
                                                        <div key={index} className="bg-green-50/80 rounded-lg p-4 border-l-4 border-green-300">
                                                            <p className="text-gray-800 italic leading-relaxed text-lg">
                                                                "{example}"
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* No additional info message */}
                                        {!displayCard.translation &&
                                            !displayCard.explanation &&
                                            examples.length === 0 &&
                                            !displayCard.notes && (
                                                <div className="flex items-center justify-center h-32">
                                                    <div className="text-center text-gray-500">
                                                        <p className="text-lg mb-2">Додаткової інформації немає</p>
                                                        <p className="text-sm">Відредагуйте картку, щоб додати пояснення або приклади</p>
                                                    </div>
                                                </div>
                                            )}
                                    </div>
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
                            className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white py-3 px-6 rounded-xl font-medium transition-all flex items-center"
                        >
                            {currentCardIndex < dynamicPracticeCards.length - 1 ? (
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

export default MultipleChoiceExercise;