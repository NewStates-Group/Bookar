"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Choice {
    id: number;
    text: string;
}

interface Question {
    id: number;
    text: string;
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
    correct_answers: number[]; // IDs of correct choices
}

export function QuizView({
    quizId,
    courseId,
    onComplete
}: {
    quizId: number;
    courseId: string;
    onComplete?: () => void;
}) {
    const { data: session } = useSession();
    const router = useRouter();
    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [loading, setLoading] = useState(true);
    const [answers, setAnswers] = useState<Record<number, number>>({}); // questionId -> choiceId
    const [result, setResult] = useState<QuizResult | null>(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (session?.accessToken) {
            fetchQuiz();
        }
    }, [quizId, session]);

    const fetchQuiz = async () => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/module-quiz/${quizId}`, {
                headers: {
                    Authorization: `Bearer ${(session as any)?.accessToken}`,
                },
            });
            if (res.ok) {
                const data = await res.json();
                setQuiz(data);
            } else {
                toast.error("Erro ao carregar quiz");
            }
        } catch (error) {
            console.error(error);
            toast.error("Erro de conexão");
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = (questionId: number, choiceId: number) => {
        if (result) return; // Disable changing after submission
        setAnswers(prev => ({ ...prev, [questionId]: choiceId }));
    };

    const submitQuiz = async () => {
        if (!quiz) return;
        setSubmitting(true);

        const payload = {
            answers: Object.entries(answers).map(([qId, cId]) => ({
                question_id: parseInt(qId),
                choice_id: cId
            }))
        };

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/quiz/${quiz.id}/submit`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${(session as any)?.accessToken}`,
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const data = await res.json();
                setResult(data);
                if (data.passed) {
                    toast.success("Parabéns! Você passou no quiz.");
                    if (onComplete) onComplete();
                } else {
                    toast.error("Você não atingiu a pontuação mínima. Tente novamente.");
                }
            } else {
                toast.error("Erro ao enviar respostas");
            }
        } catch (error) {
            console.error(error);
            toast.error("Erro de conexão");
        } finally {
            setSubmitting(false);
        }
    };

    const retry = () => {
        setResult(null);
        setAnswers({});
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!quiz) {
        return <div className="text-center p-8">Quiz não encontrado.</div>;
    }

    return (
        <div className="max-w-3xl mx-auto p-6 space-y-8">
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold text-foreground">{quiz.title}</h1>
                <p className="text-foreground/60">{quiz.description || "Complete este quiz para avançar para o próximo módulo."}</p>
            </div>

            <div className="space-y-8">
                {quiz.questions.map((q, idx) => {
                    const userAnswer = answers[q.id];
                    const isCorrect = result?.correct_answers.includes(userAnswer);

                    return (
                        <div key={q.id} className="bg-card border border-border rounded-xl p-6 space-y-4">
                            <h3 className="text-lg font-semibold text-foreground">
                                {idx + 1}. {q.text}
                            </h3>
                            <div className="space-y-2">
                                {q.choices.map((c) => {
                                    const isSelected = userAnswer === c.id;
                                    let variant = "outline";
                                    let icon = null;

                                    if (result) {
                                        if (result.correct_answers.includes(c.id)) {
                                            variant = "success"; // We'll simulate styling below
                                            icon = <CheckCircle2 className="w-4 h-4 text-green-500" />;
                                        } else if (isSelected && !result.correct_answers.includes(c.id)) {
                                            variant = "error";
                                            icon = <XCircle className="w-4 h-4 text-destructive" />;
                                        }
                                    } else if (isSelected) {
                                        variant = "selected";
                                    }

                                    return (
                                        <div
                                            key={c.id}
                                            onClick={() => handleSelect(q.id, c.id)}
                                            className={`
                                                flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all
                                                ${variant === "selected" ? "border-primary bg-primary/5 text-primary" : ""}
                                                ${variant === "success" ? "border-green-500 bg-green-500/10" : ""}
                                                ${variant === "error" ? "border-destructive bg-destructive/10" : ""}
                                                ${variant === "outline" ? "border-border hover:bg-muted" : ""}
                                                ${result ? "cursor-default" : ""}
                                            `}
                                        >
                                            <span className="text-sm">{c.text}</span>
                                            {icon}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {result && (
                <div className={`p-6 rounded-xl border ${result.passed ? "bg-green-500/10 border-green-500/20" : "bg-destructive/10 border-destructive/20"}`}>
                    <div className="flex items-center gap-4">
                        {result.passed ? <CheckCircle2 className="w-8 h-8 text-green-600" /> : <AlertCircle className="w-8 h-8 text-destructive" />}
                        <div>
                            <h4 className="text-xl font-bold">{result.passed ? "Aprovado!" : "Tente novamente"}</h4>
                            <p className="text-sm opacity-80">Sua pontuação: {result.score.toFixed(1)}/10.0</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex justify-end gap-4 pt-4 border-t border-border">
                {result && !result.passed && (
                    <Button onClick={retry} variant="outline">
                        Tentar Novamente
                    </Button>
                )}

                {!result && (
                    <Button
                        onClick={submitQuiz}
                        disabled={submitting || Object.keys(answers).length < quiz.questions.length}
                        className="bg-primary hover:bg-primary/90"
                    >
                        {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Enviar Respostas
                    </Button>
                )}

                {result && result.passed && (
                    <Button
                        onClick={() => router.push(`/app/courses/${courseId}`)}
                        className="bg-primary hover:bg-primary/90"
                    >
                        Voltar ao Curso <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                )}
            </div>
        </div>
    );
}
