import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
    function middleware(req) {
        const token = req.nextauth.token;
        const isAuth = !!token;
        const isAuthPage =
            req.nextUrl.pathname.startsWith("/login") ||
            req.nextUrl.pathname.startsWith("/signup") ||
            req.nextUrl.pathname === "/";

        if (isAuth && isAuthPage) {
            return NextResponse.redirect(new URL("/overview", req.url));
        }
        return NextResponse.next();
    },
    {
        callbacks: {
            authorized: ({ token, req }) => {
                if (
                    req.nextUrl.pathname.startsWith("/login") ||
                    req.nextUrl.pathname.startsWith("/signup") ||
                    req.nextUrl.pathname === "/"
                ) {
                    return true;
                }
                return !!token;
            },
        },
    }
);

export const config = {
    matcher: ["/overview/:path*", "/login", "/signup", "/"],
};
