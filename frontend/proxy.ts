import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
    function middleware(req) {
        const token = req.nextauth.token;
        const { pathname } = req.nextUrl;

        const isPublic =
            pathname === "/" ||
            pathname.startsWith("/login") ||
            pathname.startsWith("/signup");

        if (token?.error === "RefreshAccessTokenError") {
            if (!isPublic) {
                return NextResponse.redirect(new URL("/login", req.url));
            }
            return NextResponse.next();
        }

        if (!token && !isPublic) {
            return NextResponse.redirect(new URL("/login", req.url));
        }

        if (token && isPublic) {
            return NextResponse.redirect(new URL("/overview", req.url));
        }

        return NextResponse.next();
    },
    {
        callbacks: {
            authorized: () => true,
        },
    }
);

export const config = {
    matcher: ["/overview/:path*", "/login", "/signup", "/"],
};
