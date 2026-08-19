import Link from "next/link";
import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/login-form";
import { DemoModeNotice } from "@/components/auth/demo-mode-notice";
import { BrandMark } from "@/components/auth/brand-mark";
import { AuthShell, AUTH_CARD_CLASS } from "@/components/auth/auth-shell";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata = { title: "Entrar — Agenda Online" };

export default function LoginPage() {
  return (
    <AuthShell>
      <BrandMark />
      {!isSupabaseConfigured && (
        <div className="w-full max-w-sm">
          <DemoModeNotice />
        </div>
      )}

      <Card className={AUTH_CARD_CLASS}>
        <CardHeader className="px-6 pt-6 pb-5">
          <CardTitle className="text-2xl leading-tight text-white">Entrar</CardTitle>
          <CardDescription className="mt-1.5 text-sm leading-6 text-blush-50/70">
            Acompanhe cada atendimento do dia.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <Suspense>
            <LoginForm />
          </Suspense>
          <p className="mt-4 text-center text-sm text-blush-50/70">
            Ainda não tem conta?{" "}
            <Link
              href="/signup"
              className="font-medium text-blush-50 underline underline-offset-4 hover:text-white"
            >
              Criar estúdio
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
