import NextAuth, { DefaultSession } from "next-auth"

declare module "next-auth" {
    interface Session {
        accessToken?: string;
        error?: string;
        user: {
            id: number;
            username: string;
            email: string;
            bio?: string;
            avatar?: string;
            stats?: {
                ongoing_courses: number;
                finished_courses: number;
                certificates_issued: number;
            };
        } & DefaultSession["user"]
    }

    interface User {
        id: number;
        username: string;
        email: string;
        accessToken: string;
        refreshToken: string;
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        accessToken?: string;
        refreshToken?: string;
        accessTokenExpires?: number;
        user?: {
            id: number;
            username: string;
            email: string;
            bio?: string;
            avatar?: string;
            stats?: any;
        };
        error?: string;
    }
}
