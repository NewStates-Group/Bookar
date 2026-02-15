import NextAuth, { DefaultSession } from "next-auth";

declare module "next-auth" {
    interface Session {
        accessToken?: string;
        error?: string;
        user: {
            username?: string;
        } & DefaultSession["user"];
    }

    interface User {
        accessToken: string;
        refreshToken: string;
        username?: string;
        email?: string;
        id?: string;
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        accessToken?: string;
        refreshToken?: string;
        accessTokenExpires?: number;
        error?: string;
        user?: {
            username: string;
            email: string;
        }
    }
}
