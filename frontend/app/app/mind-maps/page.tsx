"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Loader2, Trash2, X, Network, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import useSWR from "swr";
import { authenticatedFetcher, apiRequest } from "@/lib/api";
import { useWebSocket } from "@/context/WebSocketContext";
import { DeleteMindMapDialog } from "@/components/DeleteMindMapDialog";

interface MindMap {
  uuid: string;
  topic: string;
  title?: string;
  desc?: string;
  status: "PROCESSING" | "READY" | "FAILED";
  created_at: string;
}

export default function MindMapsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [language, setLanguage] = useState("pt");
  const [isCreating, setIsCreating] = useState(false);
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [mapToDelete, setMapToDelete] = useState<{
    id: string;
    title?: string | null;
    topic?: string;
  } | null>(null);

  const { data: mindMaps, mutate: mutateMindMaps, isLoading } = useSWR<
    MindMap[]
  >(
    session?.accessToken
      ? [`${process.env.NEXT_PUBLIC_API_URL}/mind-maps`, session.accessToken]
      : null,
    authenticatedFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  );

  const { addListener } = useWebSocket();

  useEffect(() => {
    const removeListener = addListener((data) => {
      if (data.type === "mind_map_update") {
        mutateMindMaps();
        if (data.status === "READY") {
          // toast.success(`Mapa Mental "${data.title}" está pronto!`);
        } else if (data.status === "FAILED") {
          toast.error("Ocorreu um erro ao gerar o mapa mental.");
        }
      }
    });

    return () => removeListener();
  }, [addListener, mutateMindMaps]);

  const handleCreateMindMap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setIsCreating(true);
    try {
      await apiRequest(`${process.env.NEXT_PUBLIC_API_URL}/mind-maps`, {
        method: "POST",
        body: JSON.stringify({ topic, language }),
      });
      // toast.success("Geração do mapa mental iniciada no worker!");
      setTopic("");
      setOpen(false);
      mutateMindMaps();
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar o mapa");
    } finally {
      setIsCreating(false);
    }
  };

  const openDeleteDialog = (map: MindMap, e: React.MouseEvent) => {
    e.stopPropagation();
    setMapToDelete({
      id: map.uuid,
      title: map.title || map.topic,
      topic: map.topic,
    });
  };

  const confirmDeleteMindMap = async () => {
    if (!mapToDelete) return;
    const id = mapToDelete.id;
    setIsDeleting(id);
    try {
      await apiRequest(`${process.env.NEXT_PUBLIC_API_URL}/mind-maps/${id}`, {
        method: "DELETE",
      });
      mutateMindMaps();
      setMapToDelete(null);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Erro ao eliminar mapa mental.";
      toast.error(message);
    } finally {
      setIsDeleting(null);
    }
  };

  if (status === "loading" || (session?.accessToken && isLoading)) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-cyan-500 mx-auto" />
          <p className="text-muted-foreground font-medium">
            Carregando seus mapas mentais...
          </p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    router.replace("/login");
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Mapas Mentais</h1>
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Crie trilhas de aprendizagem visuais interativas a partir de qualquer
            assunto com ajuda de inteligência artificial.
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {/* Creator Card */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Card className="group flex flex-col items-center justify-center p-6 border-2 border-dashed border-cyan-500/30 hover:border-cyan-500 cursor-pointer bg-cyan-500/[0.02] hover:bg-cyan-500/[0.05] hover:shadow-[0_0_20px_rgba(6,182,212,0.15)] transition-all duration-300 min-h-[220px] rounded-2xl">
              <div className="w-12 h-12 rounded-full bg-cyan-500/10 flex items-center justify-center group-hover:scale-110 group-hover:bg-cyan-500/20 transition-all duration-300">
                <Plus className="w-6 h-6 text-cyan-500" />
              </div>
              <span className="font-bold text-gray-700 dark:text-gray-300 mt-4 group-hover:text-cyan-500 transition-colors">
                Novo Mapa Mental
              </span>
            </Card>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] border border-cyan-500/20 bg-background shadow-2xl">
            <div className="space-y-4 pt-4">
              <div className="w-12 h-12 bg-cyan-500/10 rounded-full flex items-center justify-center mx-auto">
                <Network className="w-6 h-6 text-cyan-500" />
              </div>
              <DialogTitle className="text-2xl font-bold text-center">
                Criar Mapa Mental
              </DialogTitle>
              <DialogDescription className="text-center text-sm text-muted-foreground">
                Qual assunto você deseja dominar hoje? Nossa IA vai construir um
                caminho estruturado de videoaulas para você.
              </DialogDescription>
            </div>

            <form onSubmit={handleCreateMindMap} className="space-y-4 mt-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Assunto</label>
                <Input
                  placeholder="Ex: Introdução ao React Hooks, Docker do zero, Microserviços..."
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="h-12 border-cyan-500/20 focus:border-cyan-500 focus:ring-cyan-500 focus:ring-1"
                  required
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setOpen(false)}
                  disabled={isCreating}
                  className="rounded-full h-11"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isCreating || !topic.trim()}
                  className="bg-cyan-500 hover:bg-cyan-600 text-white font-semibold rounded-full h-11 px-6 shadow-md shadow-cyan-500/25"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Em geração...
                    </>
                  ) : (
                    "Gerar Roadmap"
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Existing Mind Maps */}
        {mindMaps?.map((map) => (
          <Card
            key={map.uuid}
            className={`group relative flex flex-col justify-between px-6 pt-6 border border-border bg-card rounded-2xl transition-all duration-300 min-h-[220px] ${map.status === "READY"
              ? "hover:border-cyan-500/30 hover:shadow-lg hover:shadow-cyan-500/[0.05]"
              : ""
              }`}
          >
            {/* Delete button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 hover:bg-red-50/50 dark:hover:bg-red-950/30 rounded-full transition-all duration-300"
              onClick={(e) => openDeleteDialog(map, e)}
              disabled={isDeleting === map.uuid}
            >
              {isDeleting === map.uuid ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </Button>

            {/* PROCESSING CARD */}
            {map.status === "PROCESSING" && (
              <div className="flex flex-col items-center justify-center flex-1 py-4">
                <Loader2 className="w-10 h-10 text-cyan-500 animate-spin mb-3" />
                <h3 className="font-bold text-center text-sm text-gray-700 dark:text-gray-300 capitalize max-w-[80%] line-clamp-1">
                  {map.topic}
                </h3>
                <span className="text-xs text-muted-foreground mt-1">
                  Estruturando mapa...
                </span>
              </div>
            )}

            {/* FAILED CARD */}
            {map.status === "FAILED" && (
              <div className="flex flex-col items-center justify-center flex-1 py-4 gap-2">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <X className="w-5 h-5 text-red-500" />
                </div>
                <h3 className="font-bold text-center text-sm text-red-500 capitalize max-w-[80%] line-clamp-1">
                  Falha: {map.topic}
                </h3>
                <span className="text-xs text-muted-foreground text-center px-2 line-clamp-2" title={map.desc}>
                  {map.desc || "Tente criar novamente"}
                </span>
              </div>
            )}

            {/* READY CARD */}
            {map.status === "READY" && (
              <>
                <div className="space-y-2">
                  <h3
                    onClick={() => {
                      if (map.status === "READY") {
                        router.push(`/app/mind-maps/${map.uuid}`);
                      }
                    }}
                    className="font-medium hover:underline cursor-pointer text-gray-800 dark:text-gray-200 text-lg capitalize line-clamp-2 leading-snug hover:text-cyan-500 transition-colors">
                    {map.title}
                  </h3>

                  <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-3 leading-relaxed mt-1">
                    {map.desc}
                  </p>

                  <div className="flex items-center justify-left gap-2 mt-3">
                    <p className="text-xs border rounded-sm p-1 px-2 font-light capitalize text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700">
                      {map.topic}
                    </p>
                  </div>
                </div>
              </>
            )}
          </Card>
        ))}
      </div>

      <DeleteMindMapDialog
        open={!!mapToDelete}
        onOpenChange={(open) => !open && !isDeleting && setMapToDelete(null)}
        mapTitle={mapToDelete?.title}
        isDeleting={!!mapToDelete && isDeleting === mapToDelete.id}
        onConfirm={confirmDeleteMindMap}
      />
    </div>
  );
}
