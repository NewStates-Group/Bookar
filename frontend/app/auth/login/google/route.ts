import { NextResponse } from "next/server";

export async function GET() {
    try {
        const origin = process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.bookar.study"
        const res = await fetch(`${process.env.AUTH_URL}/auth/google/url`, {
            cache: "no-store",
            headers: {
                "Origin": origin
            }
        });
        const data = await res.json();

        if (data.url) {
            return NextResponse.redirect(data.url);
        }

        return NextResponse.redirect(new URL("/login?error=GoogleUrlError", process.env.NEXTAUTH_URL || "http://localhost"));
    } catch (error) {
        return NextResponse.redirect(new URL("/login?error=GoogleInitError", process.env.NEXTAUTH_URL || "http://localhost"));
    }
}
