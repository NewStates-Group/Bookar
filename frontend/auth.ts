import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { authDebug } from "@/lib/auth-debug";
import { jwtDecode } from "jwt-decode";

import GoogleProvider from "next-auth/providers/google";

const apiUrlRaw =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL;

const apiUrl = apiUrlRaw?.endsWith("/")
  ? apiUrlRaw.slice(0, -1)
  : apiUrlRaw;

const origin =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://api.bookar.study";

const SESSION_MAX_AGE_SEC = 7 * 24 * 60 * 60;
const BACKEND_FETCH_TIMEOUT_MS = 12_000;
const REFRESH_SKEW_MS = 60 * 1000;

/* -------------------------- UTILS -------------------------- */

function backendFetch(url: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    BACKEND_FETCH_TIMEOUT_MS
  );

  return fetch(url, {
    ...init,
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));
}

function getAccessTokenExpires(access: string): number {
  const decoded = jwtDecode<{ exp: number }>(access);
  return decoded.exp * 1000;
}

function isExpired(expires?: number | null): boolean {
  if (!expires) return true;
  return Date.now() >= expires - REFRESH_SKEW_MS;
}

function profileFromApi(profile: any) {
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

/* -------------------------- REFRESH -------------------------- */

async function refreshAccessToken(token: any) {
  try {
    if (!token.refreshToken) {
      return { ...token, error: "RefreshAccessTokenError" };
    }

    const res = await backendFetch(`${apiUrl}/auth/refresh`, {
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
      const msg = String(
        data?.detail || data?.message || ""
      ).toLowerCase();

      const invalid =
        res.status === 401 ||
        res.status === 400 ||
        msg.includes("token") ||
        msg.includes("blacklist");

      if (invalid) {
        return {
          ...token,
          error: "RefreshAccessTokenError",
        };
      }

      return token;
    }

    const newAccess = data.access;

    return {
      ...token,
      accessToken: newAccess,
      refreshToken: data.refresh ?? token.refreshToken,
      accessTokenExpires: getAccessTokenExpires(newAccess),
      error: undefined,
    };
  } catch (err) {
    authDebug("Refresh error", {
      error:
        err instanceof Error
          ? err.message
          : String(err),
    });

    return {
      ...token,
      error: "RefreshTemporaryError",
    };
  }
}

/* -------------------------- AUTH OPTIONS -------------------------- */

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

        const res = await backendFetch(
          `${apiUrl}/auth/pair`,
          {
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
          }
        );

        if (!res.ok) {
          const text = await res.text();
          console.error("[AUTH] login failed:", text);
          throw new Error("Login inválido");
        }

        const data = await res.json();

        return {
          accessToken: data.access,
          refreshToken: data.refresh,
        } as any;
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      httpOptions: {
        timeout: 15000,
      },
    })
  ],

  callbacks: {
    async jwt({ token, user, account, profile, trigger }: any) {
      try {
        /**
         * =========================
         * 1. LOGIN GOOGLE (SÓ 1x)
         * =========================
         */
        if (account?.provider === "google" && account?.access_token) {
          const res = await backendFetch(`${apiUrl}/auth/google`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: profile?.email,
              name: profile?.name,
              avatar: profile?.picture,
              googleAccessToken: account.access_token,
            }),
          });

          const data = await res.json();

          return {
            accessToken: data.access,
            refreshToken: data.refresh,
            accessTokenExpires: getAccessTokenExpires(data.access),
            user: data.user,
          };
        }

        /**
         * =========================
         * 2. LOGIN CREDENTIALS
         * =========================
         */
        if (user) {
          let profileData = null;
          try {
            const res = await backendFetch(`${apiUrl}/auth/me`, {
              headers: {
                Authorization: `Bearer ${user.accessToken}`,
                Origin: origin,
              },
            });
            if (res.ok) {
              const apiProfile = await res.json();
              profileData = profileFromApi(apiProfile);
            }
          } catch (e) {
            console.error("[AUTH] failed to fetch profile on login:", e);
          }

          return {
            accessToken: user.accessToken,
            refreshToken: user.refreshToken,
            accessTokenExpires: getAccessTokenExpires(user.accessToken),
            user: profileData || token.user || null,
          };
        }

        /**
         * =========================
         * 3. ESTADO DE ERRO
         * =========================
         */
        if (token.error === "RefreshAccessTokenError") {
          return token;
        }

        let working = { ...token };

        /**
         * =========================
         * 4. REFRESH TOKEN (SÓ SE PRECISAR)
         * =========================
         */
        if (
          working.refreshToken &&
          isExpired(working.accessTokenExpires)
        ) {
          authDebug("REFRESHING ACCESS TOKEN");

          working = await refreshAccessToken(working);

          if (working.error === "RefreshAccessTokenError") {
            return working;
          }
        }

        /**
         * =========================
         * 5. UPDATE MANUAL (profile refresh)
         * =========================
         */
        if (trigger === "update" && working.accessToken) {
          try {
            const res = await backendFetch(`${apiUrl}/auth/me`, {
              headers: {
                Authorization: `Bearer ${working.accessToken}`,
                Origin: origin,
              },
            });

            if (res.ok) {
              const profile = await res.json();

              return {
                ...working,
                user: profileFromApi(profile),
              };
            }
          } catch (meErr) {
            console.error("[AUTH] manual update /auth/me failed:", meErr);
          }
        }

        return working;
      } catch (err) {
        console.error("[AUTH JWT ERROR]", err);
        return token;
      }
    },

    async session({ session, token }: any) {
      session.accessToken = token.accessToken;
      session.error = token.error;
      session.user = token.user;
      return session;
    },
  },

  pages: {
    signIn: "/login",
  },

  secret: process.env.AUTH_SECRET,
};