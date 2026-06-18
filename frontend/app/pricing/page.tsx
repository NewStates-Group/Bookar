"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, Loader2, ArrowLeft } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ManualPaymentModal } from "@/components/ManualPaymentModal";


interface Plan {
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
  manual_payment_iban?: string;
  manual_payment_account_name?: string;
}

interface UserSub {
  plan: Plan | null;
  status: string;
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

function PlanCard({
  plan,
  isCurrent,
  isLoading,
  onSelect,
}: {
  plan: Plan;
  isCurrent: boolean;
  isLoading: boolean;
  onSelect: () => void;
}) {
  const isFree = plan.slug === "free";
  const priceNum = plan.price;

  return (
    <Card
      className={`relative flex flex-col border-2 transition-all hover:shadow-lg ${isCurrent
          ? "border-cyan-400 shadow-md"
          : plan.slug === "pro"
            ? "border-cyan-200 hover:border-cyan-300"
            : "border-slate-200 hover:border-slate-300"
        }`}
    >
      {plan.slug === "pro" && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-cyan-400 hover:bg-cyan-500 text-black text-xs px-4 py-1">
            Mais Popular
          </Badge>
        </div>
      )}

      <CardHeader className="text-center pb-4">
        <CardTitle className="text-xl font-bold">{plan.name}</CardTitle>
        <CardDescription className="text-sm text-slate-500 min-h-[40px]">
          {plan.description}
        </CardDescription>
        <div className="mt-3">
          <span className="text-4xl font-extrabold">
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

      <CardContent className="flex-1 space-y-3">
        {Object.entries(limitLabels).map(([key, cfg]) => {
          const value = plan[key as keyof Plan] as number | null;
          if (value === 0 && cfg.hideWhenZero) return null;
          return (
            <div key={key} className="flex items-center justify-between text-sm">
              <span className="text-slate-600">{cfg.label}</span>
              <span className="font-medium text-slate-800">
                {formatLimit(value, plan.monthly_limits, cfg.structural)}
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
            onClick={onSelect}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                A processar...
              </>
            ) : priceNum === 0 ? "Começar Grátis" : "Assinar Agora"}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

export default function PricingPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpgrading, setIsUpgrading] = useState<string | null>(null);
  const [selectedPlanSlug, setSelectedPlanSlug] = useState<string | null>(null);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await apiRequest(
          `${process.env.NEXT_PUBLIC_API_URL}/subscriptions/plans`
        );
        setPlans(data as Plan[]);

        if (session?.accessToken) {
          try {
            const sub = (await apiRequest(
              `${process.env.NEXT_PUBLIC_API_URL}/subscriptions/my`
            )) as UserSub;
            if (sub.plan) setCurrentPlan(sub.plan);
          } catch { }
        }
      } catch (err) {
        console.error("Failed to load plans", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [session]);

  const handleUpgrade = async (planSlug: string) => {
    if (!session) {
      localStorage.setItem("redirectTo", "/pricing");
      router.push("/login");
      return;
    }

    if (planSlug === "free") return;

    const plan = plans.find((p) => p.slug === planSlug);
    if (plan) {
      setSelectedPlan(plan);
      setSelectedPlanSlug(planSlug);
      setManualModalOpen(true);
    }
  };

  const handlePlanSelect = (planSlug: string) => {
    if (!session) {
      localStorage.setItem("redirectTo", "/pricing");
      router.push("/login");
      return;
    }
    handleUpgrade(planSlug);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-16">
        <Link
          href="#"
          onClick={(e) => {
            router.back()
          }}
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Link>

        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 mb-3">
            Escolhe o teu plano
          </h1>
          <p className="text-lg text-slate-500 max-w-xl mx-auto">
            Começa grátis e faz upgrade quando precisares de mais.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <PlanCard
              key={plan.slug}
              plan={plan}
              isCurrent={currentPlan?.slug === plan.slug}
              isLoading={isUpgrading === plan.slug}
              onSelect={() => handlePlanSelect(plan.slug)}
            />
          ))}
        </div>

        <div className="text-center py-6 text-sm md:text-base text-slate-400">
          <p>
            Todos os planos incluem acesso às funcionalidades da plataforma. Paga por transferência bancária e envia o comprovativo.
          </p>
        </div>
      </div>

      <ManualPaymentModal
        open={manualModalOpen}
        onOpenChange={setManualModalOpen}
        planName={selectedPlan?.name || ""}
        planSlug={selectedPlanSlug || ""}
        price={selectedPlan?.price || 0}
        iban={selectedPlan?.manual_payment_iban}
        accountName={selectedPlan?.manual_payment_account_name}
        phone={selectedPlan?.manual_payment_phone}
        onSuccess={() => {
          setTimeout(() => {
            setManualModalOpen(false);
            router.push("/app/subscription");
          }, 1500);
        }}
      />
    </div>
  );
}
