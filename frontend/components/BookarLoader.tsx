"use client";

import Image from "next/image";

export function BookarLoader() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-950">
            <div className="flex flex-col items-center gap-6">
                <div className="flex flex-col items-center gap-2">
                    <div className="flex gap-2 flex-row items-center justify-center">
                        <Image
                            src="/logo.png"
                            alt="Bookar"
                            width={30}
                            height={30}
                            className="md:w-13 h-auto dark:invert"
                            priority
                        />
                        <h1 className="text-5xl font-bold bg-gradient-to-r from-black via-gray-700 to-gray-400 dark:from-white dark:via-neutral-300 dark:to-neutral-500 bg-clip-text text-transparent">
                            Bookar
                        </h1>
                    </div>

                    <div className="w-full relative h-0.5 w-20 overflow-hidden rounded-full bg-cyan-400/20 dark:bg-cyan-500/20">
                        <div className="absolute inset-y-0 w-1/2 animate-[slide_1.5s_ease-in-out_infinite] rounded-full bg-cyan-400 dark:bg-cyan-500" />
                    </div>
                </div>
            </div>
        </div>
    );
}