import {NextResponse} from "next/server";
import {confirmLoginAttempt} from "@/lib/auth/login-attempts";
import {createAuthClient} from "@/lib/auth/server";

const copy = {
  fr: {title: "Connexion réussie", text: "Votre connexion a été confirmée. Retournez à votre page Foliant pour continuer.", close: "Fermer cette page", return: "Retourner vers Foliant", failed: "Cette demande de connexion n'est plus valide."},
  en: {title: "Signed in successfully", text: "Your sign-in was confirmed. Return to your Foliant page to continue.", close: "Close this page", return: "Return to Foliant", failed: "This sign-in request is no longer valid."},
  es: {title: "Conexión confirmada", text: "Tu conexión fue confirmada. Vuelve a tu página de Foliant para continuar.", close: "Cerrar esta página", return: "Volver a Foliant", failed: "Esta solicitud de acceso ya no es válida."},
  pt: {title: "Login confirmado", text: "Seu login foi confirmado. Volte à sua página do Foliant para continuar.", close: "Fechar esta página", return: "Voltar ao Foliant", failed: "Esta solicitação de login não é mais válida."}
} as const;

function safeNext(value: string | null, locale: keyof typeof copy) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : `/${locale}/studio`;
}

function locale(value: string | null): keyof typeof copy {
  return value === "en" || value === "es" || value === "pt" ? value : "fr";
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"]/g, (character) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;"})[character] ?? character);
}

function page(input: {locale: keyof typeof copy; next: string; success: boolean; attempt?: string}) {
  const text = copy[input.locale];
  const heading = input.success ? text.title : text.failed;
  const body = input.success ? text.text : text.failed;
  const signal = input.success && input.attempt ? `<script>
    try { localStorage.setItem("foliant-auth-complete", ${JSON.stringify(input.attempt)}); } catch {}
    try { new BroadcastChannel("foliant-auth").postMessage({attempt: ${JSON.stringify(input.attempt)}}); } catch {}
    window.setTimeout(() => window.close(), 1200);
  </script>` : "";
  return `<!doctype html><html lang="${input.locale}"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>${heading}</title><style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f7f4;color:#141412;font-family:Inter,system-ui,sans-serif}.card{width:min(440px,calc(100% - 40px));padding:34px;border:1px solid #e7e5df;border-radius:10px;background:#fff;text-align:center;box-shadow:0 24px 70px #14141214}.icon{display:grid;width:52px;height:52px;margin:0 auto 18px;place-items:center;border-radius:50%;background:#e1f5ee;color:#189a4e;font-size:27px;font-weight:800}h1{margin:0;font-size:25px}p{margin:12px 0 24px;color:#6b6a64;line-height:1.5}a,button{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 16px;border-radius:7px;font:inherit;font-weight:700;cursor:pointer}a{background:#189a4e;color:#fff;text-decoration:none}button{margin-top:12px;border:0;background:transparent;color:#286b41}button:hover{text-decoration:underline}</style></head><body><main class="card"><div class="icon">✓</div><h1>${heading}</h1><p>${body}</p><a href="${escapeHtml(input.next)}">${text.return}</a><br><button type="button" onclick="window.close()">${text.close}</button></main>${signal}</body></html>`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const currentLocale = locale(url.searchParams.get("locale"));
  const next = safeNext(url.searchParams.get("next"), currentLocale);
  const code = url.searchParams.get("code");
  const attempt = url.searchParams.get("attempt");
  if (!code || !attempt || !/^[a-f0-9-]{36}$/.test(attempt)) {
    return new NextResponse(page({locale: currentLocale, next, success: false}), {status: 400, headers: {"Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store"}});
  }

  const client = await createAuthClient(request);
  const result = client ? await client.auth.exchangeCodeForSession(code) : {data: {session: null}, error: new Error("Auth unavailable")};
  const session = result.data.session;
  let success = false;
  if (!result.error && session?.access_token && session.refresh_token) {
    try {
      success = await confirmLoginAttempt(attempt, {
        access_token: session.access_token,
        refresh_token: session.refresh_token
      });
    } catch {
      success = false;
    }
  }
  return new NextResponse(page({locale: currentLocale, next, success, attempt}), {status: success ? 200 : 400, headers: {"Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store"}});
}
