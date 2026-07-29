import Link from "next/link";
import { Suspense } from "react";
import { Sparkles } from "lucide-react";
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
      <div className="auth-motion-bg relative flex flex-1 flex-col items-center justify-center gap-6 overflow-hidden px-4 py-16">
        <AuthBackdrop />
        <div aria-hidden className="auth-float auth-float-one"><Sparkles className="size-4" /></div>
        <div aria-hidden className="auth-float auth-float-two" />
        <div aria-hidden className="auth-float auth-float-three" />
        <BrandMark />
        {!isSupabaseConfigured && <div className="w-full max-w-sm"><DemoModeNotice /></div>}
        <Card className="relative w-full max-w-sm overflow-hidden border-violet-950/8 bg-white/85 shadow-2xl shadow-violet-950/10 backdrop-blur-xl">
          <div className="h-1 bg-cta" />
          <CardHeader className="pb-4">
            <p className="mb-2 text-[11px] font-bold tracking-[.14em] text-violet-600 uppercase">Bem-vindo de volta</p>
            <CardTitle className="font-heading text-2xl">Sua agenda te espera.</CardTitle>
            <CardDescription>Entre para acompanhar cada atendimento em tempo real.</CardDescription>
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
