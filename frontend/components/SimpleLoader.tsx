export function SimpleLoader() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-950">
            <div className="flex flex-col items-center gap-6">
                <div className="flex flex-col items-center gap-2">
                    <div className="w-full relative h-0.5 w-20 overflow-hidden rounded-full bg-cyan-400/20 dark:bg-cyan-500/20">
                        <div className="absolute inset-y-0 w-1/2 animate-[slide_1.5s_ease-in-out_infinite] rounded-full bg-cyan-400 dark:bg-cyan-500" />
                    </div>
                </div>
            </div>
        </div>
    );
}