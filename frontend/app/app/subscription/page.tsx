"use client";
import React from "react";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Crown, Sparkles, CheckCircle2, XCircle, CreditCard, Calendar, AlertTriangle, Clock, ChevronDown, ChevronUp, RotateCw, DollarSign, ArrowLeftRight, X } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { useRouter } from "next/navigation";
import { GatewaySelectModal } from "@/components/GatewaySelectModal";

interface Plan {
  id: number;
  slug: string;
  name: string;
  description: string;
  price: string;
  monthly_limits: boolean;
  max_explicador_messages: number | null;
  max_explicador_participants: number | null;
  max_courses_generated: number | null;
  max_mindmaps_generated: number | null;
  max_mindmap_modules: number | null;
  max_mindmap_quizzes: number | null;
  max_mindmap_materials: number | null;
}

interface SubscriptionPlan {
  id: number;
  slug: string;
  name: string;
  description: string;
  price: number;
  monthly_limits: boolean;
  max_explicador_messages: number | null;
  max_explicador_participants: number | null;
  max_courses_generated: number | null;
  max_mindmaps_generated: number | null;
  max_mindmap_modules: number | null;
  max_mindmap_quizzes: number | null;
  max_mindmap_materials: number | null;
}

interface UserSubscription {
  id: number;
  plan: SubscriptionPlan | null;
  status: string;
  current_period_start: string;
  current_period_end: string | null;
  canceled_at: string | null;
  payment_gateway: string;
}

interface UsageMetric {
  metric: string;
  used: number;
  limit: number | null;
  remaining: number | null;
}

interface HistoryEntry {
  id: number;
  plan: SubscriptionPlan | null;
  status: string;
  payment_gateway: string;
  period_start: string;
  period_end: string | null;
  canceled_at: string | null;
  created_at: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "outline" | "secondary" | "destructive"; icon: React.ReactNode }> = {
  active: { label: "Activo", variant: "default", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  canceled: { label: "Cancelado", variant: "destructive", icon: <XCircle className="w-3.5 h-3.5" /> },
  past_due: { label: "Vencido", variant: "destructive", icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  expired: { label: "Expirado", variant: "outline", icon: <Clock className="w-3.5 h-3.5" /> },
  trialing: { label: "Em teste", variant: "secondary", icon: <Sparkles className="w-3.5 h-3.5" /> },
};

const metricLabels: Record<string, string> = {
  explicador_message: "Mensagens no Explicador",
  course_generated: "Cursos Gerados",
  mindmap_generated: "Mapas Mentais Gerados",
};

const planLabels: Record<string, { color: string; bg: string }> = {
  free: { color: "text-slate-600", bg: "bg-slate-100" },
  pro: { color: "text-cyan-700", bg: "bg-cyan-50 border-cyan-200" },
  pro_plus: { color: "text-purple-700", bg: "bg-purple-50 border-purple-200" },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("pt-PT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("pt-PT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const limitLabels: Record<string, { label: string; hideWhenZero?: boolean; structural?: boolean }> = {
  max_explicador_messages: { label: "Mensagens no Explicador" },
  max_explicador_participants: { label: "Convidados por sala", structural: true },
  max_courses_generated: { label: "Cursos gerados", hideWhenZero: true },
  max_mindmaps_generated: { label: "Mapas mentais gerados" },
  max_mindmap_modules: { label: "Módulos por mapa mental", structural: true },
  max_mindmap_quizzes: { label: "Testes por mapa mental", structural: true },
  max_mindmap_materials: { label: "Materiais de leitura", structural: true },
};

function formatLimit(value: number | null, monthly: boolean, structural: boolean = false): any {
  if (value === null) return "Ilimitado";
  if (value === 0) return <X className="w-3 h-3 text-red-600" />;
  if (structural) return `${value}`;
  return `${value}${monthly ? "/mês" : ""}`;
}

const planColors: Record<string, string> = {
  free: "text-slate-600",
  pro: "text-cyan-700",
  pro_plus: "text-purple-700",
};

export default function SubscriptionPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [usage, setUsage] = useState<UsageMetric[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [showPricing, setShowPricing] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState<string | null>(null);
  const [gatewayPlanSlug, setGatewayPlanSlug] = useState<string | null>(null);
  const [gatewayModalOpen, setGatewayModalOpen] = useState(false);

  useEffect(() => {
    if (!session?.accessToken) return;

    Promise.all([
      apiRequest(`${process.env.NEXT_PUBLIC_API_URL}/subscriptions/my`),
      apiRequest(`${process.env.NEXT_PUBLIC_API_URL}/subscriptions/usage`),
      apiRequest(`${process.env.NEXT_PUBLIC_API_URL}/subscriptions/plans`),
    ])
      .then(([sub, usageData, plansData]: any) => {
        setSubscription(sub as UserSubscription);
        setUsage((usageData?.metrics || []) as UsageMetric[]);
        setPlans(plansData as Plan[]);
      })
      .catch(() => {
        toast.error("Erro ao carregar dados da subscrição");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [session?.accessToken]);

  const handleUpgrade = async (planSlug: string, gateway: string) => {
    if (!session) {
      localStorage.setItem("redirectTo", "/app/subscription");
      router.push("/login");
      return;
    }
    setIsUpgrading(planSlug);

    if (planSlug === "free") {
      setIsUpgrading(null);
      return;
    }

    const successUrl = `${window.location.origin}/app/profile?upgraded=true&gateway=${gateway}&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = window.location.href;

    try {
      const result = await apiRequest(
        `${process.env.NEXT_PUBLIC_API_URL}/subscriptions/checkout`,
        {
          method: "POST",
          body: JSON.stringify({
            plan_slug: planSlug,
            success_url: successUrl,
            cancel_url: cancelUrl,
            gateway,
          }),
        }
      );
      const { url } = result as { url: string };
      if (url) {
        window.location.href = url;
      } else {
        window.location.reload();
      }
    } catch (err) {
      console.error("Upgrade failed", err);
      toast.error("Erro ao iniciar upgrade. Tenta novamente.");
    } finally {
      setIsUpgrading(null);
    }
  };

  const handlePlanSelect = (planSlug: string) => {
    if (planSlug === "free") {
      handleUpgrade(planSlug, "");
      return;
    }
    setGatewayPlanSlug(planSlug);
    setGatewayModalOpen(true);
  };

  const handleGatewaySelect = (gateway: "stripe" | "kambafy") => {
    setGatewayModalOpen(false);
    if (gatewayPlanSlug) {
      handleUpgrade(gatewayPlanSlug, gateway);
    }
  };

  function loadHistory() {
    setHistoryOpen(true);
    if (history.length > 0) return;
    setHistoryLoading(true);
    apiRequest(`${process.env.NEXT_PUBLIC_API_URL}/subscriptions/history`)
      .then((data: any) => {
        setHistory((data || []).slice(-10) as HistoryEntry[]);
      })
      .catch(() => { })
      .finally(() => setHistoryLoading(false));
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center py-20">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Carregando subscrição...</p>
        </div>
      </div>
    );
  }

  const plan = subscription?.plan;
  const statusInfo = statusConfig[subscription?.status || "active"];
  const planStyle = plan ? planLabels[plan.slug] || planLabels.free : planLabels.free;

  return (
    <div className="px-4 py-6 sm:px-6 md:py-10 max-w-5xl mx-auto w-full space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">A Minha Subscrição</h1>
        <p className="text-sm text-slate-500 mt-1">Gerir o teu plano e histórico de subscrições.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <Card className="border-slate-200 shadow-sm overflow-hidden relative lg:col-span-2">
          <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/5 blur-3xl -mr-24 -mt-24 pointer-events-none" />
          <CardHeader className="pb-1">
            <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              Plano Atual
            </CardTitle>
            <CardDescription>Detalhes do teu plano de subscrição atual.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col p-4 rounded-xl border border-slate-200 bg-white/50">
              <div>
                <p className="text-lg flex items-center font-bold text-slate-900">
                  Plano {plan?.name || "Free"}
                  <span
                    className={`bg-transparent! gap-1.5 px-3 py-1.5 text-sm font-semibold whitespace-nowrap 
                        ${plan?.slug === "pro_plus" ? "text-purple-500 hover:text-purple-600" :
                        plan?.slug === "pro" ? "text-cyan-500 hover:text-cyan-600" :
                          ""
                      }`}
                  >
                    ({statusInfo.label})
                  </span>
                </p>
                <p className="text-sm text-slate-500">{plan?.description || "Plano gratuito com funcionalidades limitadas."}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Início do período</span>
                </div>
                <p className="text-sm font-semibold text-slate-800">{formatDateTime(subscription?.current_period_start || null)}</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Fim do período</span>
                </div>
                <p className="text-sm font-semibold text-slate-800">{formatDateTime(subscription?.current_period_end || null)}</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Método de pagamento</span>
                </div>
                <p className="text-sm font-semibold text-slate-800 capitalize">{subscription?.payment_gateway || "Nenhum"}</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>Preço</span>
                </div>
                <p className="text-sm font-semibold text-slate-800">
                  {plan?.price && plan.price > 0 ? `${plan.price.toLocaleString("pt-PT")} Kz/mês` : "Grátis"}
                </p>
              </div>
            </div>

            {subscription?.canceled_at && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-700">
                  Subscrição cancelada em {formatDate(subscription.canceled_at)}.
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              {(!plan || plan.slug === "free") && (
                <Button
                  className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold gap-1.5"
                  onClick={() => { setShowPricing(true); window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); }}
                >
                  <Sparkles className="w-4 h-4" />
                  Fazer Upgrade
                </Button>
              )}
              {plan && plan.slug !== "free" && (
                <Button
                  className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold gap-1.5"
                  onClick={() => { setShowPricing(true); window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); }}
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  Trocar de Plano
                </Button>
              )}
              <Button
                variant="outline"
                className="flex-1 border-slate-300 gap-1.5"
                onClick={() => { setShowPricing(!showPricing); }}
              >
                <Crown className="w-4 h-4" />
                {showPricing ? "Fechar Planos" : "Ver Planos"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              Utilização
            </CardTitle>
            <CardDescription>Teu consumo atual de funcionalidades neste período.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {usage.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma utilização registada.</p>
            ) : (
              usage.map((m) => {
                const pct = m.limit && m.limit > 0 ? Math.round((m.used / m.limit) * 100) : 0;
                return (
                  <div key={m.metric} className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-slate-700">{metricLabels[m.metric] || m.metric}</span>
                      <span className="text-sm font-semibold text-slate-900">
                        {m.limit === null ? `${m.used}` : `${m.used} / ${m.limit}`}
                      </span>
                    </div>
                    {m.limit !== null && (
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${pct >= 80 ? "bg-red-400" : pct >= 50 ? "bg-amber-400" : "bg-cyan-400"
                            }`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    )}
                    {m.remaining !== null && (
                      <p className="text-xs text-slate-500">{m.remaining} restantes</p>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {showPricing && plans.length > 0 && (
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="text-center flex flex-col items-center justify-center">
            <CardTitle className="text-xl text-center font-bold text-slate-900 flex items-center gap-2">
              Escolhe o teu plano
            </CardTitle>
            <CardDescription>
              Compara os planos disponíveis e escolhe o que melhor se adequa a ti.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              {plans.map((p) => {
                const isCurrent = plan?.slug === p.slug;
                const priceNum = parseFloat(p.price);
                const isFree = p.slug === "free";
                return (
                  <Card
                    key={p.slug}
                    className={`relative flex flex-col border-2 transition-all hover:shadow-md ${isCurrent
                        ? "border-cyan-400 shadow-sm"
                        : p.slug === "pro"
                          ? "border-cyan-200 hover:border-cyan-300"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                  >
                    {p.slug === "pro" && !isCurrent && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                        <Badge className="bg-cyan-400 hover:bg-cyan-500 text-black text-xs px-4 py-1">
                          Mais Popular
                        </Badge>
                      </div>
                    )}

                    <CardHeader className="text-center pb-3">
                      <CardTitle className="text-lg font-bold">{p.name}</CardTitle>
                      <CardDescription className="text-sm text-slate-500 min-h-[36px]">
                        {p.description}
                      </CardDescription>
                      <div className="mt-2">
                        <span className="text-3xl font-extrabold">
                          {isFree ? "Grátis" : `${priceNum.toLocaleString('pt-AO', {
                            style: 'currency',
                            currency: 'AOA',
                            minimumFractionDigits: 0
                          })}`}
                        </span>
                        {!isFree && (
                          <span className="text-sm text-slate-500 ml-1">/mês</span>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent className="flex-1 space-y-2 pb-3">
                      {Object.entries(limitLabels).map(([key, cfg]) => {
                        const value = p[key as keyof Plan] as number | null;
                        if (value === 0 && cfg.hideWhenZero) return null;
                        return (
                          <div key={key} className="flex items-center justify-between text-sm">
                            <span className="text-slate-600">{cfg.label}</span>
                            <span className="font-medium text-slate-800">
                              {formatLimit(value, p.monthly_limits, cfg.structural)}
                            </span>
                          </div>
                        );
                      })}
                    </CardContent>

                    <CardFooter className="pt-2">
                      {isCurrent ? (
                        <Button className="w-full" variant="outline" disabled>
                          Plano Atual
                        </Button>
                      ) : isFree ? (
                        <Button className="w-full" variant="outline" disabled>
                          Grátis
                        </Button>
                      ) : (
                        <Button
                          className="w-full bg-cyan-400 hover:bg-cyan-500 text-black font-semibold"
                          onClick={() => handlePlanSelect(p.slug)}
                          disabled={isUpgrading === p.slug}
                        >
                          {isUpgrading === p.slug ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              A processar...
                            </>
                          ) : (
                            "Assinar Agora"
                          )}
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-none shadow-none bg-transparent!">
        <button
          className="w-full flex items-center justify-between px-4 sm:px-6 text-left transition-colors rounded-lg"
        >
          <div className="flex flex-row justify-center items-center gap-2">
            <Clock className="w-5 h-5 text-slate-500" />
            <span className="font-semibold text-slate-800">
              Histórico de Subscrições
            </span>
          </div>

          {!historyOpen && (
            <ChevronDown className="cursor-pointer w-5 h-5 text-slate-400" onClick={loadHistory} />
          )}
        </button>

        {historyOpen && (
          <CardContent className="border-t border-slate-100 pt-4">
            {historyLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
                <span className="text-sm text-slate-500">Carregando histórico...</span>
              </div>
            ) : history.length === 0 ? (
              <div className="py-8 text-center">
                <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Nenhum histórico encontrado.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-sm font-semibold text-slate-500">
                      <th className="pb-3 pr-4">Plano</th>
                      <th className="pb-3 pr-4">Estado</th>
                      <th className="pb-3 pr-4">Início</th>
                      <th className="pb-3 pr-4">Fim</th>
                      <th className="pb-3 pr-4">Pagamento</th>
                      <th className="pb-3 text-right">Criado em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((entry) => {
                      const statusInfo = statusConfig[entry.status] || statusConfig.expired;
                      const color = entry.plan ? planColors[entry.plan.slug] || "text-slate-500" : "text-slate-500";
                      return (
                        <tr key={entry.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors text-sm">
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-800">{entry.plan?.name || "Nenhum"}</span>
                            </div>
                          </td>
                          <td className="py-3 pr-4">
                            <p className={`font-semibold text-sm ${color}`}>
                              {statusInfo.label}
                            </p>
                          </td>
                          <td className="py-3 pr-4 text-slate-600">{formatDate(entry.period_start)}</td>
                          <td className="py-3 pr-4 text-slate-600">{formatDate(entry.period_end)}</td>
                          <td className="py-3 pr-4 text-slate-600 capitalize">{entry.payment_gateway || "—"}</td>
                          <td className="py-3 text-right text-slate-500 text-xs">{formatDateTime(entry.created_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      <GatewaySelectModal
        open={gatewayModalOpen}
        onOpenChange={setGatewayModalOpen}
        planName={plans.find((p) => p.slug === gatewayPlanSlug)?.name || ""}
        onSelect={handleGatewaySelect}
        isLoading={isUpgrading === gatewayPlanSlug}
      />
    </div>
  );
}
