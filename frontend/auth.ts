import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                username: {label: "Username", type: "text"},
                password: {label: "Password", type: "password"}
            },
            async authorize(credentials, req) {
                if (!credentials?.username || !credentials?.password) return null;

                const baseUrl = process.env.NEXT_PUBLIC_API_URL;

                const res = await fetch(`${baseUrl}/auth/pair`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        username: credentials.username,
                        password: credentials.password,
                    }),
                });

                const user = await res.json();

                if (res.ok && user.access) {
                    return {
                        id: credentials.username,
                        name: credentials.username,
                        accessToken: user.access,
                        refreshToken: user.refresh,
                    };
                }
                return null;
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.accessToken = user.accessToken;
                token.refreshToken = user.refreshToken;
            }
            return token;
        },
        async session({ session, token }) {
            session.accessToken = token.accessToken as string;
            return session;
        },
    },
    pages: {
        signIn: "/login",
    },
    secret: process.env.NEXTAUTH_SECRET
};

