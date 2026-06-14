"use client";
import React from "react";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, BookOpen, Network, Bot } from "lucide-react";
import { apiRequest } from "@/lib/api";

interface Stats {
  total_courses: number;
  ongoing_courses: number;
  finished_courses: number;
  certificates_issued: number;
  total_mindmaps: number;
  total_rooms: number;
  total_messages: number;
  active_rooms: number;
}

function DonutChart({ value, max, size = 80, strokeWidth = 6, color }: { value: number; max: number; size?: number; strokeWidth?: number; color: string }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = max > 0 ? value / max : 0;
  const offset = circumference * (1 - pct);

  return (
    <svg width={size} height={size} className="transform -rotate-90 flex-shrink-0">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgb(226 232 240)" strokeWidth={strokeWidth} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-700 ease-out"
      />
    </svg>
  );
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

export default function StatsPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!session?.accessToken) return;
    apiRequest(`${process.env.NEXT_PUBLIC_API_URL}/auth/stats`)
      .then((data: any) => {
        setStats(data as Stats);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [session?.accessToken]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Carregando estatísticas...</p>
        </div>
      </div>
    );
  }

  const total = stats?.total_courses ?? 0;
  const finished = stats?.finished_courses ?? 0;
  const ongoing = stats?.ongoing_courses ?? 0;
  const totalMindmaps = stats?.total_mindmaps ?? 0;
  const totalRooms = stats?.total_rooms ?? 0;
  const activeRooms = stats?.active_rooms ?? 0;
  const totalMessages = stats?.total_messages ?? 0;
  const maxMsg = Math.max(totalMessages, 1);

  return (
    <div className="px-4 py-6 sm:px-6 md:py-10 max-w-5xl mx-auto w-full space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Estatísticas</h1>
        <p className="text-sm text-slate-500 mt-1">Visão geral do teu progresso na plataforma.</p>
      </div>

      {/* Courses — full width */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/5 blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-cyan-500" />
            Cursos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative flex items-center justify-center flex-shrink-0">
              <DonutChart value={finished} max={total || 1} color="#06b6d4" />
              <div className="absolute flex flex-col items-center">
                <span className="text-xl font-bold text-slate-800">{total}</span>
                <span className="text-[10px] text-slate-400">total</span>
              </div>
            </div>
            <div className="flex-1 w-full grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <p className="text-xs text-slate-500 mb-1">Em Curso</p>
                <p className="text-2xl font-bold text-slate-800">{ongoing}</p>
                <MiniBar value={ongoing} max={total || 1} color="#06b6d4" />
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <p className="text-xs text-slate-500 mb-1">Concluídos</p>
                <p className="text-2xl font-bold text-slate-800">{finished}</p>
                <MiniBar value={finished} max={total || 1} color="#06b6d4" />
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <p className="text-xs text-slate-500 mb-1">Certificados</p>
                <p className="text-2xl font-bold text-slate-800">{stats?.certificates_issued ?? 0}</p>
                <MiniBar value={stats?.certificates_issued ?? 0} max={total || 1} color="#06b6d4" />
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <p className="text-xs text-slate-500 mb-1">Taxa Conclusão</p>
                <p className="text-2xl font-bold text-slate-800">{total > 0 ? Math.round((finished / total) * 100) : 0}%</p>
                <MiniBar value={finished} max={total || 1} color="#06b6d4" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bottom row: Mind Maps + Explicador */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Mind Maps */}
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <div className="absolute top-0 right-0 w-36 h-36 bg-purple-500/5 blur-3xl -mr-16 -mt-16 pointer-events-none" />
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Network className="h-5 w-5 text-purple-500" />
              Mapas Mentais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-5">
              <div className="relative flex items-center justify-center flex-shrink-0">
                <svg width="72" height="72" className="flex-shrink-0">
                  <circle cx="36" cy="36" r="30" fill="none" stroke="rgb(226 232 240)" strokeWidth="6" />
                  <circle
                    cx="36" cy="36" r="30"
                    fill="none" stroke="#a855f7" strokeWidth="6"
                    strokeDasharray={2 * Math.PI * 30}
                    strokeDashoffset={2 * Math.PI * 30 * 0.25}
                    strokeLinecap="round"
                    className="transition-all duration-700 ease-out"
                    transform="rotate(-90 36 36)"
                  />
                </svg>
                <Network className="w-6 h-6 text-purple-500 absolute" />
              </div>
              <div className="flex-1">
                <p className="text-3xl font-bold text-slate-800">{totalMindmaps}</p>
                <p className="text-sm text-slate-500">mapas criados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Explicador */}
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <div className="absolute top-0 right-0 w-36 h-36 bg-green-500/5 blur-3xl -mr-16 -mt-16 pointer-events-none" />
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Bot className="h-5 w-5 text-green-500" />
              Explicador
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="text-center p-2 rounded-lg bg-slate-50 border border-slate-200">
                <p className="text-xl font-bold text-slate-800">{totalRooms}</p>
                <p className="text-[10px] text-slate-500">Salas</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-slate-50 border border-slate-200">
                <p className="text-xl font-bold text-slate-800">{activeRooms}</p>
                <p className="text-[10px] text-slate-500">Activas</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-slate-50 border border-slate-200">
                <p className="text-xl font-bold text-slate-800">{totalMessages}</p>
                <p className="text-[10px] text-slate-500">Mensagens</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
