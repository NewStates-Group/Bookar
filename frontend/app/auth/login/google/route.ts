import { NextResponse } from "next/server";

export async function GET() {
    // console.log("[GoogleRoute] Initiating Google login...");
    try {
        const isProdEnv = process.env.NODE_ENV === "production"
        const res = await fetch(`${process.env.AUTH_URL}/auth/google/url`, {
            cache: "no-store",
            headers: {
                "Host": isProdEnv ? "api.bookar.study" : "api.localhost"
            }
        });
        const data = await res.json();
        // console.log("[GoogleRoute] Google URL response:", data);

        if (data.url) {
            // console.log("[GoogleRoute] Redirecting to Google:", data.url);
            return NextResponse.redirect(data.url);
        }

        // console.error("[GoogleRoute] No URL returned from API");
        return NextResponse.redirect(new URL("/login?error=GoogleUrlError", process.env.NEXTAUTH_URL || "http://localhost"));
    } catch (error) {
        // console.error("[GoogleRoute] Error initiating Google login:", error);
        return NextResponse.redirect(new URL("/login?error=GoogleInitError", process.env.NEXTAUTH_URL || "http://localhost"));
    }
}
