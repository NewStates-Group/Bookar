import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const apiUrlRaw = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL;
const apiUrl = apiUrlRaw?.endsWith("/") ? apiUrlRaw.slice(0, -1) : apiUrlRaw;
const origin = process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.bookar.study"

async function getMe(accessToken: string) {
    const res = await fetch(`${apiUrl}/auth/me`, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "Origin": origin
        },
    });

    if (!res.ok) {
        throw new Error("Failed to fetch /me");
    }

    return res.json();
}

async function refreshAccessToken(token: any) {
    try {
        const res = await fetch(`${apiUrl}/auth/refresh`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Origin": origin
            },
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
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
                token: { label: "Token", type: "text" },
            },

            async authorize(credentials: any) {
                if (credentials?.accessToken && credentials?.refreshToken) {
                    return {
                        accessToken: credentials.accessToken,
                        refreshToken: credentials.refreshToken,
                    } as any;
                }

                if (!credentials?.email || !credentials?.password) {
                    return null;
                }
                let res;
                try {
                    res = await fetch(`${apiUrl}/auth/pair`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Origin": origin
                        },
                        body: JSON.stringify({
                            email: credentials.email,
                            password: credentials.password,
                            token: credentials.token,
                        }),
                    });
                } catch (e) {
                    console.error("[NextAuth] Fetch error for /auth/pair:", e);
                }

                if (!res) {
                    console.error("[NextAuth] No response received for /auth/pair");
                    return null;
                }

                if (!res.ok) {
                    const text = await res.text();
                    console.error(`[NextAuth] Login failed with status ${res.status}. Body:`, text.substring(0, 500));
                    throw new Error("Login falhou. Verifique o seu e-mail e senha.");
                }

                const data = await res.json();

                if (!data.access) {
                    throw new Error("Login falhou. Resposta inválida do servidor.");
                }

                return {
                    accessToken: data.access,
                    refreshToken: data.refresh,
                } as any;
            },
        }),
    ],

    callbacks: {
        async jwt({ token, user, trigger }: any) {
            // Initial sign-in (Credentials or Direct Tokens)
            if (user) {
                try {
                    const profile = await getMe(user.accessToken);

                    return {
                        accessToken: user.accessToken,
                        refreshToken: user.refreshToken,
                        accessTokenExpires: Date.now() + 30 * 60 * 1000,

                        user: {
                            id: profile.id,
                            email: profile.email,
                            first_name: profile.first_name || "",
                            last_name: profile.last_name || "",
                            bio: profile.bio || "",
                            avatar: profile.avatar || null,
                            stats: profile.stats || null,
                        },
                    };
                } catch (error) {
                    return {
                        accessToken: user.accessToken,
                        refreshToken: user.refreshToken,
                        accessTokenExpires: Date.now() + 30 * 60 * 1000,
                        user: null,
                        error: "FetchProfileError"
                    };
                }
            }

            if (trigger === "update" && token.accessToken) {
                try {
                    const profile = await getMe(token.accessToken as string);
                    return {
                        ...token,
                        user: {
                            id: profile.id,
                            email: profile.email,
                            first_name: profile.first_name,
                            last_name: profile.last_name,
                            bio: profile.bio,
                            avatar: profile.avatar,
                            stats: profile.stats,
                        },
                    };
                } catch (error) {
                    return token;
                }
            }

            if (Date.now() < (token.accessTokenExpires as number) - 5 * 60 * 1000) {
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

            try {
                const profile = await getMe(refreshed.accessToken);

                return {
                    ...refreshed,
                    user: {
                        id: profile.id,
                        email: profile.email,
                        first_name: profile.first_name,
                        last_name: profile.last_name,
                        bio: profile.bio,
                        avatar: profile.avatar,
                        stats: profile.stats,
                    },
                };
            } catch (error) {
                return refreshed;
            }
        },

        async session({ session, token }: any) {
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
