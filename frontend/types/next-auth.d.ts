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
        };
        error?: string;
    }
}
