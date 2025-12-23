import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/10 blur-[120px]" />
      </div>

      {/* Top Buttons */}
      <div className="absolute top-6 right-6 z-20 flex gap-4">
        <Link href="/login">
          <Button variant="ghost" size="sm">
            Sign In
          </Button>
        </Link>
        <Link href="/signup">
          <Button size="sm">Get Started</Button>
        </Link>
      </div>

      {/* Hero Content */}
      <div className="z-10 text-center max-w-3xl space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
          <Sparkles className="w-4 h-4" />
          <span>The Future of Learning</span>
        </div>

        <h1 className="text-6xl md:text-8xl font-bold tracking-tighter text-balance bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/70">
          Bookar
        </h1>

        <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto text-balance font-light">
          Master Artificial Intelligence with hand-crafted courses.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link href="/signup">
            <Button size="lg" className="rounded-full px-8 text-lg h-12">
              Start Learning Now
            </Button>
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="absolute bottom-6 z-10 text-muted-foreground text-sm font-medium opacity-60">
        <p>Bookar 2025</p>
      </footer>
    </div>
  );
}
