import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

async function refreshAccessToken(token: any) {
    try {
        const res = await fetch(`${process.env.AUTH_URL}/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                refresh: token.refreshToken,
            }),
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error("Failed to refresh token");
        }

        return {
            ...token,
            accessToken: data.access,
            accessTokenExpires: Date.now() + 30 * 60 * 1000,
        };
    } catch (error) {
        console.error("Erro ao renovar access token:", error);
        return {
            ...token,
            error: "RefreshAccessTokenError",
        };
    }
}

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                username: { label: "Username", type: "text" },
                password: { label: "Password", type: "password" },
            },

            async authorize(credentials) {
                if (!credentials?.username || !credentials?.password) {
                    return null;
                }

                const res = await fetch(`${process.env.AUTH_URL}/auth/pair`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        username: credentials.username,
                        password: credentials.password,
                    }),
                });

                const user = await res.json();
                console.log(user)
                if (!res.ok || !user.access) {
                    return null;
                }

                return {
                    id: credentials.username,
                    name: credentials.username,
                    accessToken: user.access,
                    refreshToken: user.refresh,
                };
            },
        }),
    ],

    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                return {
                    name: user.name,
                    accessToken: user.accessToken,
                    refreshToken: user.refreshToken,
                    accessTokenExpires: Date.now() + 30 * 60 * 1000,
                };
            }

            if (Date.now() < (token.accessTokenExpires as number)) {
                return token;
            }

            return refreshAccessToken(token);
        },

        async session({ session, token }) {
            session.accessToken = token.accessToken as string;
            session.error = token.error;
            session.user = {
                ...session.user,
                name: token.name
            }
            return session;
        },
    },

    pages: {
        signIn: "/login",
    },

    secret: process.env.AUTH_SECRET,
};
