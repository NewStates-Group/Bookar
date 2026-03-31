"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, CheckCircle, XCircle, Trophy, RefreshCcw } from "lucide-react";
import { useSession } from "next-auth/react";

interface Choice {
    id: string;
    text: string;
}

interface Question {
    id: string;
    text: string;
    choices: Choice[];
}

interface QuizData {
    id: number;
    title: string;
    description: string;
    questions: Question[];
}

interface QuizProps {
    lessonId: number;
    onComplete: () => void;
}

export function Quiz({ lessonId, onComplete }: QuizProps) {
    const { data: session } = useSession();
    const [quiz, setQuiz] = useState<QuizData | null>(null);
    const [loading, setLoading] = useState(true);
    const [answers, setAnswers] = useState<Record<number, number>>({});
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<{ score: number; passed: boolean; correct_answers: string[] } | null>(null);

    useEffect(() => {
        if (lessonId && session?.accessToken) {
            fetchQuiz();
        }
    }, [lessonId, session]);

    const fetchQuiz = async () => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/quiz/${lessonId}`, {
                headers: {
                    Authorization: `Bearer ${(session as any)?.accessToken}`,
                },
            });
            if (res.ok) {
                const data = await res.json();
                setQuiz(data);
            } else {
                const err = await res.json();
                // console.error(err);
                if (res.status === 404) {
                    // Quiz not ready or not found
                    // Assuming if not found, we might skip or show a specific message
                    // For now, let's treat it as "no quiz" and maybe autocomplete?
                    // Or just show "Waiting for quiz..."
                }
            }
        } catch (error) {
            // console.error("Failed to fetch quiz", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAnswer = (questionId: string, choiceId: string) => {
        setAnswers(prev => ({ ...prev, [questionId]: choiceId }));
    };

    const handleSubmit = async () => {
        if (!quiz) return;
        setSubmitting(true);

        const submission = {
            answers: Object.entries(answers).map(([qId, cId]) => ({
                question_id: qId,
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
                body: JSON.stringify(submission),
            });

            if (res.ok) {
                const data = await res.json();
                setResult(data);
                if (data.passed) {
                    toast.success("Parabéns! Você passou no quiz.");
                    setTimeout(() => onComplete(), 2000); // Call onComplete after short delay
                } else {
                    toast.error("Você não atingiu a pontuação mínima. Tente novamente.");
                }
            } else {
                toast.error("Erro ao enviar respostas.");
            }
        } catch (error) {
            toast.error("Erro de conexão.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleRetry = () => {
        setResult(null);
        setAnswers({});
    };

    if (loading) {
        return <div className="p-8 text-center text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />Carregando Quiz...</div>;
    }

    if (!quiz) {
        return (
            <div className="p-8 text-center bg-zinc-900 rounded-xl border border-white/10">
                <p className="text-muted-foreground">Este quiz ainda não está disponível.</p>
                <Button variant="ghost" className="mt-4" onClick={fetchQuiz}>Tentar Novamente</Button>
            </div>
        );
    }

    if (result) {
        return (
            <div className="max-w-2xl mx-auto p-8 bg-zinc-900 rounded-xl border border-white/10 text-center space-y-6">
                <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center bg-zinc-800 border-4 border-zinc-700">
                    {result.passed ? <Trophy className="w-10 h-10 text-yellow-500" /> : <XCircle className="w-10 h-10 text-destructive" />}
                </div>

                <div>
                    <h2 className="text-3xl font-bold text-white mb-2">{result.score.toFixed(1)} / 10</h2>
                    <p className={`text-lg font-medium ${result.passed ? 'text-green-500' : 'text-destructive'}`}>
                        {result.passed ? "Aprovado!" : "Tente Novamente"}
                    </p>
                </div>

                {!result.passed && (
                    <Button onClick={handleRetry} className="gap-2">
                        <RefreshCcw className="w-4 h-4" /> Tentar Novamente
                    </Button>
                )}

                {result.passed && (
                    <Button onClick={onComplete} className="gap-2 bg-green-600 hover:bg-green-700">
                        Continuar para Próxima Aula
                    </Button>
                )}
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-8 p-6 bg-zinc-900/50 rounded-xl border border-white/10 backdrop-blur-sm">
            <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-white">{quiz.title}</h2>
                <p className="text-muted-foreground">{quiz.description}</p>
            </div>

            <div className="space-y-8">
                {quiz.questions.map((q, index) => (
                    <div key={q.id} className="space-y-4">
                        <h3 className="text-lg font-medium text-white flex gap-3">
                            <span className="text-primary/50 font-bold">0{index + 1}.</span> {q.text}
                        </h3>
                        <RadioGroup
                            onValueChange={(val) => handleAnswer(q.id, val)}
                            value={answers[q.id]?.toString()}
                            className="space-y-3"
                        >
                            {q.choices.map((c) => (
                                <div key={c.id} className={`flex items-center space-x-3 p-3 rounded-lg border transition-all ${answers[q.id] === c.id ? 'bg-primary/10 border-primary' : 'bg-black/20 border-white/5 hover:bg-white/5'}`}>
                                    <RadioGroupItem value={c.id.toString()} id={`q${q.id}-c${c.id}`} />
                                    <Label htmlFor={`q${q.id}-c${c.id}`} className="text-white/80 cursor-pointer flex-1 py-1">{c.text}</Label>
                                </div>
                            ))}
                        </RadioGroup>
                    </div>
                ))}
            </div>

            <div className="pt-6 border-t border-white/10 flex justify-end">
                <Button
                    onClick={handleSubmit}
                    disabled={Object.keys(answers).length !== quiz.questions.length || submitting}
                    size="lg"
                    className="px-8"
                >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Enviar Respostas
                </Button>
            </div>
        </div>
    );
}
