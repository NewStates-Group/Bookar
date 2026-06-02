import { authOptions } from "@/auth";
import NextAuth from "next-auth";

const handler = NextAuth(authOptions);

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ nextauth: string[] }> };

/** Garante JSON válido mesmo se o handler NextAuth falhar (evita CLIENT_FETCH_ERROR no cliente). */
async function safeAuthHandler(
  req: Request,
  context: RouteContext,
  method: "GET" | "POST"
) {
  try {
    return await handler(req, context);
  } catch (error) {
    console.error(`[NextAuth] ${method} route error:`, error);
    return Response.json(
      {},
      {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      }
    );
  }
}

export async function GET(req: Request, context: RouteContext) {
  return safeAuthHandler(req, context, "GET");
}

export async function POST(req: Request, context: RouteContext) {
  return safeAuthHandler(req, context, "POST");
}
