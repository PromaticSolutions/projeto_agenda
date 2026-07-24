import Link from "next/link";
import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/login-form";
import { DemoModeNotice } from "@/components/auth/demo-mode-notice";
import { BrandMark, AuthBackdrop, AuthShowcasePanel } from "@/components/auth/brand-mark";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata = { title: "Entrar — Agenda Online" };

export default function LoginPage() {
  return (
    <div className="flex flex-1 lg:grid lg:grid-cols-2">
      <AuthShowcasePanel className="hidden lg:flex" />
      <div className="relative flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16">
        <AuthBackdrop />
        <BrandMark />
        {!isSupabaseConfigured && <div className="w-full max-w-sm"><DemoModeNotice /></div>}
        <Card className="w-full max-w-sm shadow-xl shadow-plum-900/5">
          <CardHeader>
            <CardTitle className="font-heading text-xl">Entrar</CardTitle>
            <CardDescription>Acesse o painel do seu estúdio.</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense>
              <LoginForm />
            </Suspense>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Ainda não tem conta?{" "}
              <Link href="/signup" className="font-medium text-violet-600 underline underline-offset-4">
                Criar estúdio
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
