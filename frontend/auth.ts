import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const apiUrlRaw = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL;
const apiUrl = apiUrlRaw?.endsWith("/") ? apiUrlRaw.slice(0, -1) : apiUrlRaw;
const origin = process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.bookar.study";

const ACCESS_TOKEN_LIFETIME_MS = 15 * 60 * 1000;
const REFRESH_SKEW_MS = 2 * 60 * 1000;
/** Alinhado com REFRESH_TOKEN_LIFETIME no backend (7 dias). */
const SESSION_MAX_AGE_SEC = 7 * 24 * 60 * 60;

function accessExpiresAt(): number {
  return Date.now() + ACCESS_TOKEN_LIFETIME_MS;
}

function isAccessExpired(accessTokenExpires?: number | null): boolean {
  if (!accessTokenExpires) return true;
  return Date.now() >= accessTokenExpires - REFRESH_SKEW_MS;
}

async function getMe(accessToken: string) {
  const res = await fetch(`${apiUrl}/auth/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Origin: origin,
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch /me");
  }

  return res.json();
}

async function refreshAccessToken(token: Record<string, unknown>) {
  if (!token.refreshToken) {
    return { ...token, error: "RefreshAccessTokenError" as const };
  }

  try {
    const res = await fetch(`${apiUrl}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
      },
      body: JSON.stringify({
        refresh: token.refreshToken,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const detail = String(data?.detail || data?.message || "").toLowerCase();
      const isInvalidRefresh =
        res.status === 401 ||
        res.status === 400 ||
        detail.includes("token") ||
        detail.includes("blacklist");

      if (isInvalidRefresh) {
        return { ...token, error: "RefreshAccessTokenError" as const };
      }
      // Erro transitório (rede/5xx): mantém tokens para nova tentativa
      return token;
    }

    return {
      ...token,
      accessToken: data.access,
      refreshToken: data.refresh ?? token.refreshToken,
      accessTokenExpires: accessExpiresAt(),
      error: undefined,
    };
  } catch {
    return token;
  }
}

function profileFromApi(profile: Record<string, unknown>) {
  return {
    id: profile.id,
    email: profile.email,
    first_name: profile.first_name || "",
    last_name: profile.last_name || "",
    bio: profile.bio || "",
    avatar: profile.avatar || null,
    stats: profile.stats || null,
  };
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_SEC,
    updateAge: 60 * 60,
  },

  jwt: {
    maxAge: SESSION_MAX_AGE_SEC,
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
              Origin: origin,
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
          console.error(`[NextAuth] Login failed with status ${res.status}. Body:`, text);
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
      if (user?.accessToken) {
        try {
          const profile = await getMe(user.accessToken);
          return {
            accessToken: user.accessToken,
            refreshToken: user.refreshToken,
            accessTokenExpires: accessExpiresAt(),
            user: profileFromApi(profile),
          };
        } catch {
          return {
            accessToken: user.accessToken,
            refreshToken: user.refreshToken,
            accessTokenExpires: accessExpiresAt(),
            user: token.user ?? null,
          };
        }
      }

      if (token.error === "RefreshAccessTokenError") {
        return token;
      }

      let working = { ...token };

      if (
        working.refreshToken &&
        (!working.accessToken || isAccessExpired(working.accessTokenExpires))
      ) {
        working = await refreshAccessToken(working);
        if (working.error === "RefreshAccessTokenError") {
          return working;
        }
      }

      if (trigger === "update" && working.accessToken) {
        try {
          const profile = await getMe(working.accessToken as string);
          return {
            ...working,
            user: profileFromApi(profile),
          };
        } catch {
          return working;
        }
      }

      if (
        working.accessToken &&
        !isAccessExpired(working.accessTokenExpires) &&
        working.user
      ) {
        return working;
      }

      if (working.accessToken && working.user) {
        return working;
      }

      if (working.accessToken) {
        try {
          const profile = await getMe(working.accessToken as string);
          return {
            ...working,
            user: profileFromApi(profile),
          };
        } catch {
          return working;
        }
      }

      return working;
    },

    async session({ session, token }: any) {
      session.accessToken = token.accessToken as string | undefined;
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
