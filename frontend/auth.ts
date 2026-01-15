import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";


async function getMe(accessToken: string) {
    const res = await fetch(`${process.env.AUTH_URL}/auth/me`, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
    });

    if (!res.ok) {
        throw new Error("Failed to fetch /me");
    }

    return res.json();
}

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
            error: undefined,
        };
    } catch (error) {
        return {
            ...token,
            error: "RefreshAccessTokenError",
        };
    }
}


export const authOptions: NextAuthOptions = {
    session: {
        strategy: "jwt",
    },

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

                const data = await res.json();

                if (!res.ok || !data.access) {
                    return null;
                }

                return {
                    accessToken: data.access,
                    refreshToken: data.refresh,
                };
            },
        }),
    ],

    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                const profile = await getMe(user.accessToken);

                return {
                    accessToken: user.accessToken,
                    refreshToken: user.refreshToken,
                    accessTokenExpires: Date.now() + 30 * 60 * 1000,

                    user: {
                        username: profile.username,
                        email: profile.email,
                    },
                };
            }

            if (Date.now() < (token.accessTokenExpires as number)) {
                return token;
            }

            const refreshed = await refreshAccessToken(token);

            if (refreshed.error) {
                return {
                    ...refreshed,
                    accessToken: null,
                    refreshToken: null,
                };
            }

            const profile = await getMe(refreshed.accessToken);

            return {
                ...refreshed,
                user: {
                    username: profile.username,
                    email: profile.email,
                },
            };
        },

        async session({ session, token }) {
            session.accessToken = token.accessToken as string;
            session.error = token.error;

            session.user = token.user as any;

            return session;
        },
    },

    pages: {
        signIn: "/login",
    },

    secret: process.env.AUTH_SECRET,
};
