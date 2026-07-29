import { NextRequest } from "next/server";
import { ADMIN_COOKIE, adminEnabled, isAdminToken } from "@/server/admin";

export const dynamic = "force-dynamic";

/** Exchanges the shared admin token for a session cookie. */
export async function POST(request: NextRequest) {
  if (!adminEnabled()) {
    return new Response("Not found", { status: 404 });
  }

  const { token } = (await request.json().catch(() => ({}))) as { token?: string };

  if (typeof token !== "string" || !isAdminToken(token)) {
    // Deliberately vague: a wrong token and a disabled admin surface should
    // look the same from outside.
    return Response.json({ error: "That token was not accepted." }, { status: 401 });
  }

  const response = Response.json({ ok: true });
  response.headers.append(
    "Set-Cookie",
    [
      `${ADMIN_COOKIE}=${encodeURIComponent(token)}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Strict",
      "Max-Age=43200",
      process.env.NODE_ENV === "production" ? "Secure" : ""
    ]
      .filter(Boolean)
      .join("; ")
  );
  return response;
}

/** Signs the admin session out. */
export async function DELETE() {
  const response = Response.json({ ok: true });
  response.headers.append("Set-Cookie", `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
  return response;
}
