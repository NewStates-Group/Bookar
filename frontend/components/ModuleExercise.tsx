"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Choice {
    id: number;
    text: string;
}

interface Question {
    id: number;
    text: string;
    type: "TF" | "MC" | "SA";
    explanation?: string;
    choices: Choice[];
}

interface Quiz {
    id: number;
    title: string;
    description?: string;
    questions: Question[];
}

interface QuizResult {
    score: number;
    passed: boolean;
    correct_answers: number[];
}

interface ModuleExerciseProps {
    moduleId: number;
    onComplete?: () => void;
}

export default function ModuleExercise({ moduleId, onComplete }: ModuleExerciseProps) {
    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [answers, setAnswers] = useState<Record<number, number>>({});
    const [result, setResult] = useState<QuizResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchQuiz = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/module/${moduleId}/quiz`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
                },
            });

            if (!res.ok) {
                throw new Error("Failed to fetch quiz");
            }

            const data = await res.json();
            setQuiz(data);
        } catch (error) {
            toast.error("Erro ao carregar exercícios");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!quiz) return;

        const answersArray = Object.entries(answers).map(([questionId, choiceId]) => ({
            question_id: parseInt(questionId),
            choice_id: choiceId,
        }));

        if (answersArray.length !== quiz.questions.length) {
            toast.error("Por favor, responda todas as perguntas");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/courses/module/${moduleId}/quiz/submit`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
                    },
                    body: JSON.stringify({ answers: answersArray }),
                }
            );

            if (!res.ok) {
                throw new Error("Failed to submit quiz");
            }

            const data = await res.json();
            setResult(data);

            if (data.passed) {
                toast.success(`Parabéns! Você passou com nota ${data.score.toFixed(1)}`);
                onComplete?.();
            } else {
                toast.error(`Você não passou. Nota: ${data.score.toFixed(1)}`);
            }
        } catch (error) {
            toast.error("Erro ao submeter respostas");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAnswerChange = (questionId: number, choiceId: number) => {
        setAnswers((prev) => ({ ...prev, [questionId]: choiceId }));
    };

    if (!quiz && !isLoading) {
        return (
            <Card className="p-8 text-center">
                <h2 className="text-2xl font-bold mb-4">Exercícios do Módulo</h2>
                <p className="text-muted-foreground mb-6">
                    Complete os exercícios para testar seu conhecimento
                </p>
                <Button onClick={fetchQuiz}>Iniciar Exercícios</Button>
            </Card>
        );
    }

    if (isLoading) {
        return (
            <Card className="p-8 text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
                <p>Carregando exercícios...</p>
            </Card>
        );
    }

    if (!quiz) return null;

    return (
        <Card className="p-8">
            <div className="mb-6">
                <h2 className="text-2xl font-bold mb-2">{quiz.title}</h2>
                {quiz.description && (
                    <p className="text-muted-foreground">{quiz.description}</p>
                )}
            </div>

            <div className="space-y-8">
                {quiz.questions.map((question, index) => (
                    <div key={question.id} className="border-b pb-6 last:border-0">
                        <div className="mb-4">
                            <h3 className="font-semibold text-lg mb-2">
                                {index + 1}. {question.text}
                            </h3>
                            {question.type === "TF" && (
                                <span className="text-xs text-muted-foreground">
                                    (Verdadeiro ou Falso)
                                </span>
                            )}
                            {question.type === "MC" && (
                                <span className="text-xs text-muted-foreground">
                                    (Múltipla Escolha)
                                </span>
                            )}
                        </div>

                        <RadioGroup
                            value={answers[question.id]?.toString()}
                            onValueChange={(value) =>
                                handleAnswerChange(question.id, parseInt(value))
                            }
                            disabled={!!result}
                        >
                            {question.choices.map((choice) => {
                                const isSelected = answers[question.id] === choice.id;
                                const isCorrect = result?.correct_answers.includes(choice.id);
                                const showFeedback = result && isSelected;

                                return (
                                    <div
                                        key={choice.id}
                                        className={`flex items-center space-x-2 p-3 rounded-lg border ${showFeedback
                                                ? isCorrect
                                                    ? "border-green-500 bg-green-50 dark:bg-green-950"
                                                    : "border-red-500 bg-red-50 dark:bg-red-950"
                                                : "border-border"
                                            }`}
                                    >
                                        <RadioGroupItem value={choice.id.toString()} id={`choice-${choice.id}`} />
                                        <Label
                                            htmlFor={`choice-${choice.id}`}
                                            className="flex-1 cursor-pointer"
                                        >
                                            {choice.text}
                                        </Label>
                                        {showFeedback && (
                                            <>
                                                {isCorrect ? (
                                                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                                                ) : (
                                                    <XCircle className="w-5 h-5 text-red-600" />
                                                )}
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </RadioGroup>

                        {result && question.explanation && (
                            <div className="mt-4 p-4 bg-muted rounded-lg">
                                <p className="text-sm">
                                    <strong>Explicação:</strong> {question.explanation}
                                </p>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {!result && (
                <div className="mt-8 flex justify-end">
                    <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting || Object.keys(answers).length !== quiz.questions.length}
                        size="lg"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Enviando...
                            </>
                        ) : (
                            "Submeter Respostas"
                        )}
                    </Button>
                </div>
            )}

            {result && (
                <div className="mt-8 p-6 bg-muted rounded-lg text-center">
                    <h3 className="text-xl font-bold mb-2">
                        {result.passed ? "Parabéns! 🎉" : "Continue tentando! 💪"}
                    </h3>
                    <p className="text-2xl font-bold mb-2">
                        Nota: {result.score.toFixed(1)}/10
                    </p>
                    <p className="text-muted-foreground">
                        {result.passed
                            ? "Você passou no exercício!"
                            : "Você precisa de pelo menos 7.0 para passar"}
                    </p>
                </div>
            )}
        </Card>
    );
}
