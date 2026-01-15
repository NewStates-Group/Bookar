import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/10 blur-[120px]" />
      </div>

      <div className="absolute top-6 right-6 z-20 flex gap-4">
        <Link href="/login">
          <Button variant="ghost" size="sm">
            Entrar
          </Button>
        </Link>
        <div className="border"></div>
        <Link href="/signup">
          <Button size="sm" variant={"outline"}>Registar-se</Button>
        </Link>
      </div>

      <div className="z-10 text-center max-w-3xl space-y-3 animate-in fade-in slide-in-from-bottom-8 duration-1000">
        <div className="flex justify-center items-center gap-1">
          <Image
            src={"/logo.png"}
            alt="Logo"
            width={80}
            height={80}
          />
        <h1 className="text-6xl md:text-8xl font-bold tracking-tighter text-balance bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/70">
          Bookar
        </h1>
        </div>
        <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto text-balance font-light">
          A melhor plataforma de aprendizado baseado em IA.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link href="/signup">
            <Button size="lg" variant={"outline"} className="rounded-full px-8 text-lg h-12">
              Começar agora
            </Button>
          </Link>
        </div>
      </div>

      <footer className="absolute bottom-6 z-10 text-muted-foreground text-sm font-medium opacity-60">
        <p>&copy; Bookar 2026</p>
      </footer>
    </div>
  );
}
