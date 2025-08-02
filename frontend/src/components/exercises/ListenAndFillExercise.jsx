// frontend/src/components/exercises/ListenAndFillExercise.jsx - ВИПРАВЛЕНА ВЕРСІЯ

import { useState, useEffect, useRef } from "react";
import { useFlashcardStore } from "../../store/useFlashcardStore.js";
import { useUserSettingsStore } from "../../store/useUserSettingsStore.js";
import { axiosInstance } from "../../lib/axios.js";
import {
    CheckCircle, XCircle, ArrowRight, RotateCcw,
    Volume2, Loader, Home, Trophy, VolumeX,
    Headphones, Type, Play, Pause, HelpCircle
} from "lucide-react";

const ListenAndFillExercise = ({ practiceCards, onExit }) => {
    const { generateFieldContent } = useFlashcardStore();
    const { getDefaultEnglishLevel, getTTSSettings } = useUserSettingsStore();

    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [exerciseData, setExerciseData] = useState(null); // JSON дані від ШІ
    const [userAnswer, setUserAnswer] = useState("");
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [isCorrect, setIsCorrect] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [score, setScore] = useState({ correct: 0, total: 0 });
    const [showResult, setShowResult] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    // Audio states
    const [audioUrl, setAudioUrl] = useState(null);
    const [isPlayingAudio, setIsPlayingAudio] = useState(false);
    const [audioError, setAudioError] = useState(null);
    const [isLoadingAudio, setIsLoadingAudio] = useState(false);

    const audioRef = useRef(null);
    const inputRef = useRef(null);

    const currentCard = practiceCards[currentCardIndex];
    const englishLevel = getDefaultEnglishLevel();

    // Check if we have enough cards for the exercise
    if (practiceCards.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
                    <h3 className="text-lg font-semibold text-yellow-800 mb-2">
                        Немає карток
                    </h3>
                    <p className="text-yellow-700">
                        Для цієї вправи потрібна хоча б одна картка.
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

    // Generate sentence with gap and audio for current card
    const generateQuestion = async (card) => {
        if (!card) return;

        setIsLoading(true);
        setIsGenerating(true);
        setAudioError(null);

        // Clear previous audio immediately
        if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
            setAudioUrl(null);
        }
        setIsPlayingAudio(false);

        try {
            console.log(`Generating question for word: "${card.text}"`);

            // Generate sentence data with new JSON format
            const response = await generateFieldContent(
                card.text,
                englishLevel,
                "sentenceWithGap"
            );

            let exerciseData;

            // ВИПРАВЛЕНО: response вже має бути об'єктом, якщо backend працює правильно
            if (typeof response === 'object' && response !== null) {
                exerciseData = response;
                console.log('Received exercise data from API:', exerciseData);
            } else if (typeof response === 'string') {
                // Fallback: якщо прийшов рядок, намагаємось парсити як JSON
                try {
                    exerciseData = JSON.parse(response);
                    console.log('Parsed exercise data from string:', exerciseData);
                } catch (parseError) {
                    console.error("Failed to parse string response as JSON:", parseError);
                    throw new Error("Invalid response format from AI");
                }
            } else {
                throw new Error("Invalid response type from AI");
            }

            // Валідація обов'язкових полів
            if (!exerciseData || typeof exerciseData !== 'object') {
                throw new Error("Exercise data is not an object");
            }

            if (!exerciseData.displaySentence || !exerciseData.audioSentence || !exerciseData.correctForm) {
                console.error("Missing required fields:", exerciseData);
                throw new Error("Missing required fields in exercise data");
            }

            // Перевірка що displaySentence містить пропуск
            if (!exerciseData.displaySentence.includes('____')) {
                console.error("Display sentence doesn't contain gap:", exerciseData.displaySentence);
                throw new Error("Display sentence doesn't contain gap");
            }

            // Забезпечуємо що hint існує
            if (!exerciseData.hint) {
                exerciseData.hint = "";
            }

            console.log('Successfully validated exercise data:', exerciseData);

            // Set the exercise data
            setExerciseData(exerciseData);

            // Small delay to ensure state is updated
            await new Promise(resolve => setTimeout(resolve, 100));

            // Generate audio for the COMPLETE sentence
            await generateAudio(exerciseData.audioSentence, card.text);

            setUserAnswer("");
            setSelectedAnswer(null);
            setIsCorrect(null);
            setShowResult(false);

        } catch (error) {
            console.error("Error generating question:", error);

            // Enhanced fallback logic based on existing card data
            let fallbackData;

            if (card.examples && card.examples.length > 0) {
                // Use existing example and create proper structure
                const example = card.examples[0];
                const wordRegex = new RegExp(`\\b${card.text}\\b`, 'gi');
                const displaySentence = example.replace(wordRegex, '____');

                fallbackData = {
                    displaySentence: displaySentence,
                    audioSentence: example, // Use original example for audio
                    correctForm: card.text,
                    hint: ""
                };
            } else if (card.example) {
                // Use old example field
                const wordRegex = new RegExp(`\\b${card.text}\\b`, 'gi');
                const displaySentence = card.example.replace(wordRegex, '____');

                fallbackData = {
                    displaySentence: displaySentence,
                    audioSentence: card.example, // Use original example for audio
                    correctForm: card.text,
                    hint: ""
                };
            } else {
                // Generic fallback
                fallbackData = {
                    displaySentence: `Complete this sentence: I need to ____ this word.`,
                    audioSentence: `Complete this sentence: I need to ${card.text} this word.`,
                    correctForm: card.text,
                    hint: ""
                };
            }

            console.log(`Using fallback exercise data:`, fallbackData);

            setExerciseData(fallbackData);

            // Small delay for fallback too
            await new Promise(resolve => setTimeout(resolve, 100));

            // Try to generate audio even for fallback
            try {
                await generateAudio(fallbackData.audioSentence, card.text);
            } catch (audioError) {
                console.error("Audio generation also failed:", audioError);
                setAudioError("Помилка генерації аудіо");
            }

            setUserAnswer("");
            setSelectedAnswer(null);
            setIsCorrect(null);
            setShowResult(false);
        } finally {
            setIsLoading(false);
            setIsGenerating(false);
        }
    };

    // Generate TTS audio
    const generateAudio = async (sentence, targetWord = null) => {
        setIsLoadingAudio(true);
        setAudioError(null);

        try {
            console.log(`Generating TTS for: "${sentence}"${targetWord ? ` (target word: ${targetWord})` : ''}`);

            const requestData = {
                text: sentence,
                timestamp: Date.now() // Force cache bypass
            };

            const response = await axiosInstance.post('/tts/speech',
                requestData,
                {
                    responseType: 'blob',
                    headers: {
                        'Content-Type': 'application/json',
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache'
                    },
                    timeout: 30000 // 30 seconds timeout
                }
            );

            const audioBlob = new Blob([response.data], { type: 'audio/mpeg' });
            const newAudioUrl = URL.createObjectURL(audioBlob);

            console.log(`TTS audio generated successfully for: "${sentence}"`);

            // Clean up previous audio URL before setting new one
            if (audioUrl) {
                URL.revokeObjectURL(audioUrl);
            }

            setAudioUrl(newAudioUrl);

            // Auto-play the audio once it's ready with a small delay
            setTimeout(() => {
                console.log(`Auto-playing audio for: "${sentence}"`);
                playAudio();
            }, 300);

        } catch (error) {
            console.error("Error generating audio:", error);

            let errorMessage = "Помилка генерації аудіо";

            if (error.response?.status === 401) {
                errorMessage = "API ключ недійсний або відсутній";
            } else if (error.response?.status === 402) {
                errorMessage = "Недостатньо кредитів OpenAI";
            } else if (error.response?.status === 429) {
                errorMessage = "Перевищено ліміт запитів";
            } else if (error.code === 'ECONNABORTED') {
                errorMessage = "Перевищено час очікування";
            } else if (!navigator.onLine) {
                errorMessage = "Немає з'єднання з інтернетом";
            }

            setAudioError(errorMessage);
        } finally {
            setIsLoadingAudio(false);
        }
    };

    // Play audio
    const playAudio = () => {
        if (audioRef.current && audioUrl) {
            console.log(`Playing audio...`);
            setIsPlayingAudio(true);
            audioRef.current.currentTime = 0; // Reset to beginning
            audioRef.current.play()
                .then(() => {
                    console.log(`Audio playback started successfully`);
                })
                .catch(error => {
                    console.error("Error playing audio:", error);
                    setAudioError("Помилка відтворення аудіо");
                    setIsPlayingAudio(false);
                });
        } else {
            console.warn("Cannot play audio: missing audio reference or URL");
        }
    };

    // Audio event handlers
    const handleAudioEnded = () => {
        console.log("Audio playback ended");
        setIsPlayingAudio(false);
    };

    const handleAudioError = (e) => {
        console.error("Audio playback error:", e);
        setIsPlayingAudio(false);
        setAudioError("Помилка відтворення аудіо");
    };

    // Initialize first question
    useEffect(() => {
        if (currentCard) {
            console.log(`Initializing question for card: "${currentCard.text}" (index: ${currentCardIndex})`);

            // Cleanup previous audio
            if (audioUrl) {
                console.log("Cleaning up previous audio URL");
                URL.revokeObjectURL(audioUrl);
                setAudioUrl(null);
            }
            setIsPlayingAudio(false);

            generateQuestion(currentCard);
        }
    }, [currentCard]);

    // Cleanup audio URL on unmount and when audioUrl changes
    useEffect(() => {
        return () => {
            if (audioUrl) {
                console.log("Component unmounting: cleaning up audio URL");
                URL.revokeObjectURL(audioUrl);
            }
        };
    }, [audioUrl]);

    // Enhanced check answer function - now checks against correct form
    const checkAnswer = (answer, correctForm, originalWord) => {
        const normalizeText = (text) => {
            return text.toLowerCase().trim().replace(/[.,!?;:'"]/g, '');
        };

        const normalizedAnswer = normalizeText(answer);
        const normalizedCorrect = normalizeText(correctForm);
        const normalizedOriginal = normalizeText(originalWord);

        // Exact match with correct form
        if (normalizedAnswer === normalizedCorrect) {
            return true;
        }

        // Also accept original word form (for flexibility)
        if (normalizedAnswer === normalizedOriginal) {
            return true;
        }

        // Check if answer contains the correct word (for multi-word answers)
        if (normalizedCorrect.includes(' ')) {
            return normalizedCorrect.split(' ').some(word =>
                word === normalizedAnswer
            );
        }

        return false;
    };

    const handleSubmitAnswer = () => {
        if (!userAnswer.trim() || selectedAnswer !== null || !exerciseData) return;

        const correct = checkAnswer(userAnswer, exerciseData.correctForm, currentCard.text);
        setSelectedAnswer(userAnswer);
        setIsCorrect(correct);
        setShowResult(true);

        setScore(prev => ({
            correct: prev.correct + (correct ? 1 : 0),
            total: prev.total + 1
        }));
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !showResult) {
            handleSubmitAnswer();
        }
    };

    const handleContinue = () => {
        if (currentCardIndex < practiceCards.length - 1) {
            setCurrentCardIndex(currentCardIndex + 1);
        } else {
            // Exercise completed
            onExit({
                completed: true,
                score: score
            });
        }
    };

    const handleRestart = () => {
        setCurrentCardIndex(0);
        setScore({ correct: 0, total: 0 });
        generateQuestion(practiceCards[0]);
    };

    // Focus input when result is shown
    useEffect(() => {
        if (!isLoading && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isLoading, currentCardIndex]);

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

    return (
        <div className="max-w-4xl mx-auto">
            {/* Audio element */}
            {audioUrl && (
                <audio
                    ref={audioRef}
                    src={audioUrl}
                    onEnded={handleAudioEnded}
                    onError={handleAudioError}
                    preload="auto"
                />
            )}

            {/* Header */}
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                        <div className="bg-gradient-to-r from-cyan-400 to-blue-400 w-12 h-12 rounded-xl flex items-center justify-center mr-4">
                            <Headphones className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Слухання та письмо</h1>
                            <p className="text-gray-600">Прослухайте речення та впишіть пропущене слово</p>
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
                    <span>Питання {currentCardIndex + 1} з {practiceCards.length}</span>
                    <span>Правильно: {score.correct} з {practiceCards.length}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                        className="bg-gradient-to-r from-cyan-400 to-blue-400 h-2 rounded-full transition-all duration-300"
                        style={{
                            width: `${((currentCardIndex + 1) / practiceCards.length) * 100}%`
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
                            {isGenerating ? "Генерую завдання..." : "Завантаження..."}
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Audio Controls */}
                        <div className="text-center mb-8">
                            <h2 className="text-lg font-medium text-gray-700 mb-4">
                                Яке слово ви чуєте на місці пропуску?
                            </h2>

                            <div className="bg-blue-50 rounded-xl p-6 border-l-4 border-blue-400 mb-6">
                                <div className="flex items-center justify-center mb-4">
                                    {isLoadingAudio ? (
                                        <div className="flex items-center text-blue-600">
                                            <Loader className="w-6 h-6 animate-spin mr-2" />
                                            <span>Генерую аудіо...</span>
                                        </div>
                                    ) : audioError ? (
                                        <div className="text-center">
                                            <div className="flex items-center justify-center text-red-600 mb-4">
                                                <VolumeX className="w-6 h-6 mr-2" />
                                                <span>{audioError}</span>
                                            </div>
                                            <div className="text-sm text-gray-600 mb-4">
                                                Аудіо недоступне, але ви можете читати речення текстом
                                            </div>
                                            <button
                                                onClick={() => generateAudio(exerciseData?.audioSentence)}
                                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
                                            >
                                                Спробувати знову
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={playAudio}
                                            disabled={!audioUrl || isPlayingAudio}
                                            className={`flex items-center justify-center w-16 h-16 rounded-full text-white font-medium transition-all transform hover:scale-105 ${
                                                isPlayingAudio
                                                    ? 'bg-green-500 cursor-not-allowed'
                                                    : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
                                            }`}
                                        >
                                            {isPlayingAudio ? (
                                                <div className="flex space-x-1">
                                                    <div className="w-1 h-4 bg-white rounded-full animate-pulse"></div>
                                                    <div className="w-1 h-4 bg-white rounded-full animate-pulse" style={{animationDelay: '0.1s'}}></div>
                                                    <div className="w-1 h-4 bg-white rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                                                </div>
                                            ) : (
                                                <Volume2 className="w-8 h-8" />
                                            )}
                                        </button>
                                    )}
                                </div>

                                {/* Show sentence text visually */}
                                {exerciseData?.displaySentence && (
                                    <p className="text-lg text-gray-800 font-mono tracking-wide">
                                        {exerciseData.displaySentence}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Answer Input */}
                        <div className="space-y-4">
                            <div className="max-w-md mx-auto">
                                <div className="relative">
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={userAnswer}
                                        onChange={(e) => setUserAnswer(e.target.value)}
                                        onKeyPress={handleKeyPress}
                                        disabled={showResult}
                                        placeholder="Впишіть слово..."
                                        className={`w-full p-4 text-lg text-center rounded-xl border-2 transition-all duration-200 font-medium ${
                                            showResult
                                                ? isCorrect
                                                    ? 'border-green-500 bg-green-50 text-green-700'
                                                    : 'border-red-500 bg-red-50 text-red-700'
                                                : 'border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200'
                                        }`}
                                    />
                                    {showResult && (
                                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                            {isCorrect ? (
                                                <CheckCircle className="w-6 h-6 text-green-600" />
                                            ) : (
                                                <XCircle className="w-6 h-6 text-red-600" />
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {!showResult && (
                                <div className="text-center">
                                    <button
                                        onClick={handleSubmitAnswer}
                                        disabled={!userAnswer.trim()}
                                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-3 px-8 rounded-xl font-medium transition-all"
                                    >
                                        Перевірити
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Result */}
                        {showResult && exerciseData && (
                            <div className={`mt-6 p-6 rounded-xl ${
                                isCorrect ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                            }`}>
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
                                    <div className="space-y-2">
                                        <p className="text-gray-700">
                                            Правильна відповідь: <strong>{exerciseData.correctForm}</strong>
                                        </p>
                                        <p className="text-gray-600 text-sm">
                                            Ваша відповідь: <span className="font-mono">{userAnswer}</span>
                                        </p>
                                        {exerciseData.hint && (
                                            <p className="text-blue-600 text-sm">
                                                Підказка: {exerciseData.hint}
                                            </p>
                                        )}
                                        <p className="text-gray-600 text-sm">
                                            Повне речення: {exerciseData.audioSentence}
                                        </p>
                                    </div>
                                )}

                                {currentCard.translation && (
                                    <p className="text-gray-600 text-sm mt-2">
                                        Переклад: {currentCard.translation}
                                    </p>
                                )}
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
                            className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white py-3 px-6 rounded-xl font-medium transition-all flex items-center"
                        >
                            {currentCardIndex < practiceCards.length - 1 ? (
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

export default ListenAndFillExercise;