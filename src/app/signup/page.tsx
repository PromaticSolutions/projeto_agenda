import Link from "next/link";
import { CheckCircle2, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignupForm } from "@/components/auth/signup-form";
import { DemoModeNotice } from "@/components/auth/demo-mode-notice";
import { BrandMark, AuthBackdrop, AuthShowcasePanel } from "@/components/auth/brand-mark";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata = { title: "Criar conta — Agenda Online" };

export default function SignupPage() {
  return (
    <div className="flex flex-1 lg:grid lg:grid-cols-2">
      <AuthShowcasePanel className="hidden lg:flex" />
      <div className="relative flex flex-1 flex-col items-center justify-center gap-8 overflow-hidden px-4 py-16 sm:px-6 lg:px-8">
        <AuthBackdrop />
        <BrandMark />
        {!isSupabaseConfigured && <div className="w-full max-w-sm"><DemoModeNotice /></div>}
        <Card className="w-full max-w-sm overflow-hidden border border-violet-500/20 bg-violet-950/100 shadow-[0_24px_70px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <div className="relative overflow-hidden bg-plum-900 px-6 py-5 text-white">
            <div aria-hidden className="absolute -right-8 -bottom-12 size-36 rounded-full bg-violet-500/45 blur-2xl" />
            <p className="relative flex items-center gap-1.5 text-[11px] font-bold tracking-[.14em] text-white/70 uppercase"><Sparkles className="size-3.5 text-magenta" /> primeiros passos</p>
            <div className="relative mt-3 flex items-center gap-2 text-sm font-medium"><CheckCircle2 className="size-4 text-[#8ff0bb]" /> 1. Crie sua conta <span className="h-px flex-1 bg-white/15" /> 2. Configure</div>
          </div>
          <CardHeader className="px-6 pb-5 pt-6">
            <CardTitle className="font-heading text-[1.7rem] leading-tight text-white">Crie seu espaço online</CardTitle>
            <CardDescription className="mt-2 text-sm leading-6 text-violet-200/80">Em poucos minutos, seu link de agendamento estará pronto para compartilhar.</CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <SignupForm />
            <p className="mt-4 text-center text-sm text-violet-200/80">
              Já tem conta?{" "}
              <Link href="/login" className="font-medium text-violet-300 underline underline-offset-4 transition-colors hover:text-violet-100">
                Entrar
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
