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
      <div className="auth-motion-bg relative flex flex-1 flex-col items-center justify-center gap-8 overflow-hidden px-4 py-16 sm:px-6 lg:px-8">
        <AuthBackdrop />
        <div aria-hidden className="auth-float auth-float-one"><Sparkles className="size-4" /></div>
        <div aria-hidden className="auth-float auth-float-two" />
        <div aria-hidden className="auth-float auth-float-three" />
        <BrandMark />
        {!isSupabaseConfigured && <div className="w-full max-w-sm"><DemoModeNotice /></div>}
        <Card className="relative w-full max-w-sm overflow-hidden border border-violet-500/20 bg-violet-950/100 shadow-[0_24px_70px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <div className="h-1 bg-cta" />
          <CardHeader className="px-6 pb-5 pt-6">
            <p className="mb-2 text-[11px] font-bold tracking-[.18em] text-violet-300 uppercase">Bem-vindo de volta</p>
            <CardTitle className="font-heading text-[1.7rem] leading-tight text-white">Sua agenda te espera.</CardTitle>
            <CardDescription className="mt-2 text-sm leading-6 text-violet-200/80">Entre para acompanhar cada atendimento em tempo real.</CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <Suspense>
              <LoginForm />
            </Suspense>
            <p className="mt-4 text-center text-sm text-violet-200/80">
              Ainda não tem conta?{" "}
              <Link href="/signup" className="font-medium text-violet-300 underline underline-offset-4 hover:text-violet-200">
                Criar estúdio
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
