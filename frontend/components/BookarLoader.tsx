import Image from "next/image";

export function BookarLoader() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-6">
                <div className="flex gap-2 flex-row items-center justify-center">
                    <Image
                        src="/logo.png"
                        alt="Bookar"
                        width={35}
                        height={35}
                        className="md:w-15 h-auto"
                        priority
                    />
                    <h1 className="text-5xl font-bold bg-gradient-to-r from-black via-gray-700 to-gray-400 bg-clip-text text-transparent">
                        Bookar
                    </h1>
                </div>

                <div className="flex gap-2">
                    <span className="size-2 rounded-full bg-primary animate-bounce" />
                    <span
                        className="size-2 rounded-full bg-primary animate-bounce"
                        style={{ animationDelay: "150ms" }}
                    />
                    <span
                        className="size-2 rounded-full bg-primary animate-bounce"
                        style={{ animationDelay: "300ms" }}
                    />
                </div>
            </div>
        </div>
    );
}