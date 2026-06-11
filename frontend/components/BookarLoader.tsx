"use client";

import Image from "next/image";
import { useTheme } from "next-themes";

export function BookarLoader() {
    const { resolvedTheme } = useTheme();
    const dark = resolvedTheme === "dark";

    return (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-950">
            <div className="flex flex-col items-center gap-6">
                <div className="flex gap-2 flex-row items-center justify-center">
                    <Image
                        src="/logo.png"
                        alt="Bookar"
                        width={35}
                        height={35}
                        className="md:w-15 h-auto block dark:hidden"
                        priority
                    />
                    <Image
                        src="/logo-white.png"
                        alt="Bookar"
                        width={35}
                        height={35}
                        className="md:w-15 h-auto hidden dark:block"
                        priority
                    />
                    <h1 className="text-5xl font-bold bg-gradient-to-r from-black via-gray-700 to-gray-400 dark:from-white dark:via-neutral-300 dark:to-neutral-500 bg-clip-text text-transparent">
                        Bookar
                    </h1>
                </div>

                <div className="flex gap-2">
                    <span className="size-2 rounded-full bg-cyan-400 dark:bg-cyan-500 animate-bounce" />
                    <span
                        className="size-2 rounded-full bg-cyan-400 dark:bg-cyan-500 animate-bounce"
                        style={{ animationDelay: "150ms" }}
                    />
                    <span
                        className="size-2 rounded-full bg-cyan-400 dark:bg-cyan-500 animate-bounce"
                        style={{ animationDelay: "300ms" }}
                    />
                </div>
            </div>
        </div>
    );
}