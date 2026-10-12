import {NextResponse} from "next/server";

export const guestSessionCookie = "foliant_guest_session";

export function guestSessionId(request: Request) {
  const value = request.headers.get("cookie")?.split(";")
    .map((part) => part.trim()).find((part) => part.startsWith(`${guestSessionCookie}=`))
    ?.slice(guestSessionCookie.length + 1);
  return value && /^[a-f0-9-]{36}$/.test(value) ? value : undefined;
}

export function withGuestSession<T>(request: Request, sessionId: string, body: T) {
  const response = NextResponse.json(body, {headers: {"Cache-Control": "private, no-store"}});
  if (guestSessionId(request) !== sessionId) {
    response.cookies.set(guestSessionCookie, sessionId, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/"
    });
  }
  return response;
}
