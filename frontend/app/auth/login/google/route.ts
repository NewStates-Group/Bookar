import { NextResponse } from "next/server";

export async function GET() {
    try {
        const res = await fetch(`${process.env.AUTH_URL}/auth/google/url`, {
            cache: "no-store",
        });
        const data = await res.json();

        if (data.url) {
            return NextResponse.redirect(data.url);
        }

        return NextResponse.redirect(new URL("/login?error=GoogleUrlError", process.env.NEXTAUTH_URL || "http://localhost:3000"));
    } catch (error) {
        console.error("Error initiating Google login:", error);
        return NextResponse.redirect(new URL("/login?error=GoogleInitError", process.env.NEXTAUTH_URL || "http://localhost:3000"));
    }
}
