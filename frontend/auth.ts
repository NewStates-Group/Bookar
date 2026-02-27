import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";


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

async function googleLoginHelper(idToken: string) {
    const res = await fetch(`${process.env.AUTH_URL}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_token: idToken }),
    });

    if (!res.ok) {
        throw new Error("Failed to exchange Google token");
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
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
            authorization: {
                params: {
                    prompt: "consent",
                    access_type: "offline",
                    response_type: "code"
                }
            },
            checks: ['none']
        }),
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
                    throw new Error(data.detail || "Authentication failed");
                }

                return {
                    accessToken: data.access,
                    refreshToken: data.refresh,
                } as any;
            },
        }),
    ],

    callbacks: {
        async jwt({ token, user, account, trigger }) {
            // Initial Google sign-in
            if (account?.provider === "google" && account.id_token) {
                try {
                    const data = await googleLoginHelper(account.id_token);
                    const profile = await getMe(data.access);

                    return {
                        accessToken: data.access,
                        refreshToken: data.refresh,
                        accessTokenExpires: Date.now() + 30 * 60 * 1000,
                        user: {
                            id: profile.id,
                            username: profile.username,
                            email: profile.email,
                            first_name: profile.first_name,
                            last_name: profile.last_name,
                            bio: profile.bio,
                            avatar: profile.avatar,
                            stats: profile.stats,
                        },
                    };
                } catch (error) {
                    console.error("Google login error:", error);
                    return { ...token, error: "GoogleLoginError" };
                }
            }

            // Initial Credentials sign-in
            if (user) {
                const profile = await getMe(user.accessToken);

                return {
                    accessToken: user.accessToken,
                    refreshToken: user.refreshToken,
                    accessTokenExpires: Date.now() + 30 * 60 * 1000,

                    user: {
                        id: profile.id,
                        username: profile.username,
                        email: profile.email,
                        first_name: profile.first_name,
                        last_name: profile.last_name,
                        bio: profile.bio,
                        avatar: profile.avatar,
                        stats: profile.stats,
                    },
                };
            }

            // Handle manual update from client
            if (trigger === "update" && token.accessToken) {
                try {
                    const profile = await getMe(token.accessToken as string);
                    return {
                        ...token,
                        user: {
                            id: profile.id,
                            username: profile.username,
                            email: profile.email,
                            first_name: profile.first_name,
                            last_name: profile.last_name,
                            bio: profile.bio,
                            avatar: profile.avatar,
                            stats: profile.stats,
                        },
                    };
                } catch (error) {
                    console.error("Error during session update:", error);
                    return token;
                }
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
                    id: profile.id,
                    username: profile.username,
                    email: profile.email,
                    first_name: profile.first_name,
                    last_name: profile.last_name,
                    bio: profile.bio,
                    avatar: profile.avatar,
                    stats: profile.stats,
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

    secret: process.env.AUTH_SECRET as string,
};
