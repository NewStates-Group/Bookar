import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";


async function getMe(accessToken: string) {
    const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL;
    const res = await fetch(`${apiUrl}/auth/me`, {
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
        const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL;
        const res = await fetch(`${apiUrl}/auth/refresh`, {
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
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },

            async authorize(credentials: any) {
                // Support passing tokens directly (for Google callback flow)
                if (credentials?.accessToken && credentials?.refreshToken) {
                    return {
                        accessToken: credentials.accessToken,
                        refreshToken: credentials.refreshToken,
                    } as any;
                }

                if (!credentials?.email || !credentials?.password) {
                    return null;
                }

                const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL;
                const res = await fetch(`${apiUrl}/auth/pair`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        email: credentials.email,
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
                    console.error("Error fetching user profile at login:", error);
                    // Return tokens so they can at least try to refresh or logout, but avoid empty user if possible
                    return {
                        accessToken: user.accessToken,
                        refreshToken: user.refreshToken,
                        accessTokenExpires: Date.now() + 30 * 60 * 1000,
                        user: null, // Change to null to indicate no profile
                        error: "FetchProfileError"
                    };
                }
            }

            // Handle manual update from client
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
