// frontend/src/components/exercises/ListenAndFillExercise.jsx - ОНОВЛЕНА ВЕРСІЯ З ДЕТАЛЬНОЮ ІНФОРМАЦІЄЮ

import { useState, useEffect, useRef } from "react";
import { useFlashcardStore } from "../../store/useFlashcardStore.js";
import { useUserSettingsStore } from "../../store/useUserSettingsStore.js";
import { axiosInstance } from "../../lib/axios.js";
import {
    CheckCircle, XCircle, ArrowRight, RotateCcw,
    Volume2, Loader, Home, Trophy, VolumeX,
    Headphones, Type, Play, Pause, HelpCircle,
    StickyNote, Sparkles, RotateCw as RefreshIcon
} from "lucide-react";
import toast from "react-hot-toast";

const ListenAndFillExercise = ({ practiceCards, onExit }) => {
    const { generateFieldContent, updateFlashcard } = useFlashcardStore();
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

    // Additional audio states for detailed info TTS
    const [isPlayingDetailAudio, setIsPlayingDetailAudio] = useState(false);
    const [isRegeneratingExamples, setIsRegeneratingExamples] = useState(false);
    const [updatedCard, setUpdatedCard] = useState(null); // Для збереження оновленої картки

    // ВИПРАВЛЕНО: Використовуємо useRef для надійнішого відстеження session ID
    const currentSessionRef = useRef(null);
    const [audioSessionId, setAudioSessionId] = useState(null);

    const audioRef = useRef(null);
    const inputRef = useRef(null);
    const detailAudioRef = useRef(null); // Для детального TTS

    const currentCard = practiceCards[currentCardIndex];
    const displayCard = updatedCard || currentCard; // Використовуємо оновлену картку якщо є
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

    // TTS Function for detailed info (similar to MultipleChoiceExercise)
    const speakText = async (text) => {
        if (!text || isPlayingDetailAudio) return;

        try {
            // Stop current audio
            if (detailAudioRef.current) {
                detailAudioRef.current.pause();
                detailAudioRef.current = null;
            }

            setIsPlayingDetailAudio(true);

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

            detailAudioRef.current = audio;

            audio.onended = () => {
                setIsPlayingDetailAudio(false);
                detailAudioRef.current = null;
                URL.revokeObjectURL(audioUrl);
            };

            audio.onerror = () => {
                setIsPlayingDetailAudio(false);
                detailAudioRef.current = null;
                URL.revokeObjectURL(audioUrl);
                toast.error("Помилка відтворення звуку");
            };

            await audio.play();
        } catch (error) {
            setIsPlayingDetailAudio(false);
            detailAudioRef.current = null;
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

    // Regenerate examples function (similar to MultipleChoiceExercise)
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

    // Generate sentence with gap and audio for current card
    const generateQuestion = async (card) => {
        if (!card) return;

        setIsLoading(true);
        setIsGenerating(true);
        setAudioError(null);
        setShowResult(false);
        setUpdatedCard(null); // Скидаємо оновлену картку

        // ВИПРАВЛЕНО: Створюємо унікальний session ID та зберігаємо в ref
        const newSessionId = `${card._id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        currentSessionRef.current = newSessionId;
        setAudioSessionId(newSessionId);

        console.log(`[${newSessionId}] Starting new session for card: "${card.text}"`);

        // Clear previous audio immediately
        if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
            setAudioUrl(null);
        }
        setIsPlayingAudio(false);

        // ВИПРАВЛЕНО: Очищуємо стейт та чекаємо
        setExerciseData(null);
        setUserAnswer("");
        setSelectedAnswer(null);
        setIsCorrect(null);

        try {
            console.log(`[${newSessionId}] Generating question for word: "${card.text}"`);

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
                console.log(`[${newSessionId}] Received exercise data from API:`, exerciseData);
            } else if (typeof response === 'string') {
                // Fallback: якщо прийшов рядок, намагаємось парсити як JSON
                try {
                    exerciseData = JSON.parse(response);
                    console.log(`[${newSessionId}] Parsed exercise data from string:`, exerciseData);
                } catch (parseError) {
                    console.error(`[${newSessionId}] Failed to parse string response as JSON:`, parseError);
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
                console.error(`[${newSessionId}] Missing required fields:`, exerciseData);
                throw new Error("Missing required fields in exercise data");
            }

            // Перевірка що displaySentence містить пропуск
            if (!exerciseData.displaySentence.includes('____')) {
                console.error(`[${newSessionId}] Display sentence doesn't contain gap:`, exerciseData.displaySentence);
                throw new Error("Display sentence doesn't contain gap");
            }

            // Забезпечуємо що hint існує
            if (!exerciseData.hint) {
                exerciseData.hint = "";
            }

            console.log(`[${newSessionId}] Successfully validated exercise data:`, exerciseData);

            // ВИПРАВЛЕНО: Встановлюємо дані та чекаємо мілісекунду
            setExerciseData(exerciseData);
            await new Promise(resolve => setTimeout(resolve, 100));

            // ВИПРАВЛЕНО: Перевіряємо що session ID не змінився перед генерацією аудіо
            if (currentSessionRef.current === newSessionId) {
                console.log(`[${newSessionId}] Generating audio for: "${exerciseData.audioSentence}"`);
                await generateAudio(exerciseData.audioSentence, card.text, newSessionId);
            } else {
                console.log(`[${newSessionId}] Session ID changed during generation (current: ${currentSessionRef.current}), skipping audio`);
            }

        } catch (error) {
            console.error(`[${newSessionId}] Error generating question:`, error);

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

            console.log(`[${newSessionId}] Using fallback exercise data:`, fallbackData);

            setExerciseData(fallbackData);
            await new Promise(resolve => setTimeout(resolve, 100));

            // ВИПРАВЛЕНО: Перевіряємо session ID перед fallback аудіо
            if (currentSessionRef.current === newSessionId) {
                try {
                    await generateAudio(fallbackData.audioSentence, card.text, newSessionId);
                } catch (audioError) {
                    console.error(`[${newSessionId}] Audio generation also failed:`, audioError);
                    setAudioError("Помилка генерації аудіо");
                }
            } else {
                console.log(`[${newSessionId}] Session ID changed during fallback (current: ${currentSessionRef.current}), skipping audio`);
            }
        } finally {
            setIsLoading(false);
            setIsGenerating(false);
        }
    };

    // ВИПРАВЛЕНО: Generate TTS audio з session tracking
    const generateAudio = async (sentence, targetWord = null, sessionId = null) => {
        const currentSessionId = sessionId || currentSessionRef.current;

        // ДОДАНА ПЕРЕВІРКА: Переконуємося що session ще актуальний
        if (currentSessionRef.current !== currentSessionId) {
            console.log(`[${currentSessionId}] Session expired before audio generation started`);
            return;
        }

        setIsLoadingAudio(true);
        setAudioError(null);

        try {
            console.log(`[${currentSessionId}] Generating TTS for: "${sentence}"${targetWord ? ` (target word: ${targetWord})` : ''}`);

            // ВИПРАВЛЕНО: Додаємо унікальні параметри для кожного запиту
            const requestData = {
                text: sentence,
                timestamp: Date.now(),
                sessionId: currentSessionId, // Додаємо session ID
                cardId: currentCard?._id, // Додаємо ID картки
                exercise: 'listen-and-fill' // Додаємо тип вправи
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

            // ВИПРАВЛЕНО: Перевіряємо що session ID ще актуальний
            if (currentSessionRef.current !== currentSessionId) {
                console.log(`[${currentSessionId}] Session ID changed during audio generation, ignoring result`);
                return;
            }

            const audioBlob = new Blob([response.data], { type: 'audio/mpeg' });
            const newAudioUrl = URL.createObjectURL(audioBlob);

            console.log(`[${currentSessionId}] TTS audio generated successfully for: "${sentence}"`);

            // Clean up previous audio URL before setting new one
            if (audioUrl) {
                URL.revokeObjectURL(audioUrl);
            }

            setAudioUrl(newAudioUrl);

            // ВИПРАВЛЕНО: Відтворення буде автоматично через useEffect при зміні audioUrl

        } catch (error) {
            console.error(`[${currentSessionId}] Error generating audio:`, error);

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

            // ВИПРАВЛЕНО: Показуємо помилку тільки якщо session ID актуальний
            if (currentSessionRef.current === currentSessionId) {
                setAudioError(errorMessage);
            }
        } finally {
            if (currentSessionRef.current === currentSessionId) {
                setIsLoadingAudio(false);
            }
        }
    };

    // Play audio
    const playAudio = () => {
        if (audioRef.current && audioUrl) {
            console.log(`[${currentSessionRef.current}] Playing audio...`);
            setIsPlayingAudio(true);
            audioRef.current.currentTime = 0; // Reset to beginning
            audioRef.current.play()
                .then(() => {
                    console.log(`[${currentSessionRef.current}] Audio playback started successfully`);
                })
                .catch(error => {
                    console.error(`[${currentSessionRef.current}] Error playing audio:`, error);
                    setAudioError("Помилка відтворення аудіо");
                    setIsPlayingAudio(false);
                });
        } else {
            console.warn(`[${currentSessionRef.current}] Cannot play audio: missing audio reference or URL`);
        }
    };

    // Audio event handlers
    const handleAudioEnded = () => {
        console.log(`[${currentSessionRef.current}] Audio playback ended`);
        setIsPlayingAudio(false);
    };

    const handleAudioError = (e) => {
        console.error(`[${currentSessionRef.current}] Audio playback error:`, e);
        setIsPlayingAudio(false);
        setAudioError("Помилка відтворення аудіо");
    };

    // Initialize first question
    useEffect(() => {
        if (currentCard) {
            console.log(`Initializing question for card: "${currentCard.text}" (index: ${currentCardIndex}) - Previous session: ${currentSessionRef.current}`);

            // ВИПРАВЛЕНО: Cleanup previous audio та reset всіх станів
            if (audioUrl) {
                console.log("Cleaning up previous audio URL");
                URL.revokeObjectURL(audioUrl);
                setAudioUrl(null);
            }
            setIsPlayingAudio(false);
            setAudioError(null);
            setExerciseData(null);

            // ВИПРАВЛЕНО: Додаємо невелику затримку для уникнення race conditions
            const timer = setTimeout(() => {
                generateQuestion(currentCard);
            }, 50);

            return () => {
                clearTimeout(timer);
            };
        }
    }, [currentCardIndex]); // ВИПРАВЛЕНО: Змінюємо залежність на currentCardIndex замість currentCard

    // Cleanup audio URL on unmount and when audioUrl changes
    useEffect(() => {
        return () => {
            if (audioUrl) {
                console.log("Component unmounting: cleaning up audio URL");
                URL.revokeObjectURL(audioUrl);
            }
        };
    }, [audioUrl]);

    // ДОДАНО: Автоматичне відтворення нового аудіо
    useEffect(() => {
        if (audioUrl && audioRef.current && !isPlayingAudio && !audioError) {
            console.log(`[${currentSessionRef.current}] Auto-playing new audio`);

            // Невелика затримка для надійності
            const autoPlayTimer = setTimeout(() => {
                // Подвійна перевірка що все ще актуально
                if (audioUrl && audioRef.current && !isPlayingAudio) {
                    playAudio();
                }
            }, 200);

            return () => clearTimeout(autoPlayTimer);
        }
    }, [audioUrl]); // Викликається при зміні audioUrl

    // Audio cleanup on unmount
    useEffect(() => {
        return () => {
            if (detailAudioRef.current) {
                detailAudioRef.current.pause();
                detailAudioRef.current = null;
            }
        };
    }, []);

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
        setUpdatedCard(null);
        // generateQuestion буде викликана через useEffect
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

    const examples = getExamples(displayCard);

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
                                    <div>
                                        <p className="text-lg text-gray-800 font-mono tracking-wide mb-3">
                                            {showResult ? (
                                                // Показуємо повне речення з виділеним словом після відповіді
                                                exerciseData.audioSentence.split(new RegExp(`(\\b${exerciseData.correctForm}\\b)`, 'gi')).map((part, index) =>
                                                    part.toLowerCase() === exerciseData.correctForm.toLowerCase() ? (
                                                        <mark key={index} className={`px-2 py-1 rounded font-bold ${
                                                            isCorrect ? 'bg-green-300 text-green-800' : 'bg-yellow-300 text-yellow-800'
                                                        }`}>
                                                            {part}
                                                        </mark>
                                                    ) : (
                                                        part
                                                    )
                                                )
                                            ) : (
                                                // Показуємо речення з пропуском до відповіді
                                                exerciseData.displaySentence
                                            )}
                                        </p>

                                        {/* Переклад речення після відповіді */}
                                        {showResult && exerciseData.sentenceTranslation && (
                                            <div className="mt-3 pt-3 border-t border-blue-200">
                                                <p className="text-sm text-gray-600 mb-1">Переклад речення:</p>
                                                <p className="text-base text-gray-700 italic">
                                                    {exerciseData.sentenceTranslation}
                                                </p>
                                            </div>
                                        )}

                                        {/* Placeholder для майбутнього AI перекладу */}
                                        {showResult && !exerciseData.sentenceTranslation && (
                                            <div className="mt-3 pt-3 border-t border-blue-200">
                                                <p className="text-sm text-gray-500 italic">
                                                    💡 Переклад речення буде додано в наступних версіях
                                                </p>
                                            </div>
                                        )}
                                    </div>
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

                        {/* Result with Detailed Information */}
                        {showResult && exerciseData && (
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
                                                disabled={isPlayingDetailAudio}
                                                className={`px-6 py-3 rounded-lg transition-all shadow-md ${
                                                    isPlayingDetailAudio
                                                        ? "bg-green-500 hover:bg-green-600 animate-pulse scale-105"
                                                        : "bg-purple-500 hover:bg-purple-600 hover:scale-105"
                                                } disabled:bg-gray-300 disabled:scale-100 text-white flex items-center space-x-2 mx-auto`}
                                            >
                                                <Volume2 className="w-5 h-5" />
                                                <span>
                                                    {isPlayingDetailAudio ? "Відтворення..." : "Озвучити"}
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
                                                            <RotateCcw className="w-3 h-3" />
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