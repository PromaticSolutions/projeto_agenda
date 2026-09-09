import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";

/**
 * Renova a sessão do Supabase Auth a cada request e protege /app.
 * Next.js 16 renomeou middleware.ts -> proxy.ts (função exportada "proxy").
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!isSupabaseConfigured) {
    // Supabase ainda não configurado: não bloqueia nada, /app usa dados mockados.
    return response;
  }

  const supabase = createServerClient(supabaseUrl!, supabaseAnonKey!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  /* /superadmin entra aqui junto com /app por causa da RENOVAÇÃO, não do
     redirect: o layout do painel já barra quem não é `platform_admin`, mas
     quem passasse uma hora inteira dentro do /superadmin sem tocar em nenhuma
     rota do /app via o access token expirar sem ninguém renovar — e caía no
     login no meio do trabalho. É este handler que atualiza o cookie. */
  const path = request.nextUrl.pathname;
  const isProtected = path.startsWith("/app") || path.startsWith("/superadmin");
  if (isProtected && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", path);
    return NextResponse.redirect(loginUrl);
  }

  const isAuthPage =
    request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/signup";
  if (isAuthPage && user) {
    return NextResponse.redirect(new URL("/app", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/app/:path*",
    "/superadmin/:path*",
    "/login",
    "/signup",
  ],
};
