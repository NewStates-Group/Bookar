import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
    function middleware(req) {
        const token = req.nextauth.token;
        const { pathname } = req.nextUrl;

        const publicRoutes = ["/", "/login", "/signup"];
        const isPublic = publicRoutes.some(route =>
            pathname === route || pathname.startsWith(route)
        );

        // if (token?.error === "RefreshAccessTokenError") {
        //     console.log("TOKEN ERROR")
        //     return NextResponse.redirect(new URL("/login?error=session", req.url));
        // }

        // if (!token && !isPublic) {
        //     console.log("NOT TOKEN AND NOT PUBLIC")    
        //     return NextResponse.redirect(new URL("/login", req.url));
        // }

        // if (token && isPublic) {
        //     console.log("PUBLIC AND TOKEN")
        //     return NextResponse.redirect(new URL("/app", req.url));
        // }

        console.log("NEXT")
        return NextResponse.next();
    },
    {
        callbacks: {
            authorized: () => true,
        },
    }
);
