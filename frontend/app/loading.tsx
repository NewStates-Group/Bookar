import Image from "next/image";

export default function RootLoading() {
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-6 bg-white dark:bg-neutral-950 transition-colors duration-300">
      <style>{`
        @keyframes load-pulse {
          0%, 100% { opacity: 0.2; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1); }
        }
        @keyframes load-fade {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div className="relative flex items-center justify-center" style={{ animation: "load-fade 0.6s ease-out both" }}>
        <Image
          src="/logo.png"
          alt="Bookar"
          width={48}
          height={48}
          className="block dark:hidden"
          priority
        />
        <Image
          src="/logo-white.png"
          alt="Bookar"
          width={48}
          height={48}
          className="hidden dark:block"
          priority
        />
      </div>
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-cyan-400"
            style={{
              animation: "load-pulse 1.2s ease-in-out infinite",
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
      <p
        className="text-sm text-neutral-400 dark:text-neutral-500 font-medium"
        style={{ animation: "load-fade 0.6s 0.3s ease-out both" }}
      >
        A carregar…
      </p>
    </div>
  );
}
