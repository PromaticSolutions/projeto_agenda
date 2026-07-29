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
      <div className="relative flex flex-1 flex-col items-center justify-center gap-6 px-4 py-12 sm:py-16">
        <AuthBackdrop />
        <BrandMark />
        {!isSupabaseConfigured && <div className="w-full max-w-sm"><DemoModeNotice /></div>}
        <Card className="w-full max-w-sm overflow-hidden border-violet-950/8 shadow-2xl shadow-violet-950/10">
          <div className="relative overflow-hidden bg-plum-900 px-6 py-5 text-white">
            <div aria-hidden className="absolute -right-8 -bottom-12 size-36 rounded-full bg-violet-500/45 blur-2xl" />
            <p className="relative flex items-center gap-1.5 text-[11px] font-bold tracking-[.14em] text-white/60 uppercase"><Sparkles className="size-3.5 text-magenta" /> primeiros passos</p>
            <div className="relative mt-3 flex items-center gap-2 text-sm font-medium"><CheckCircle2 className="size-4 text-[#8ff0bb]" /> 1. Crie sua conta <span className="h-px flex-1 bg-white/15" /> 2. Configure</div>
          </div>
          <CardHeader className="pb-4">
            <CardTitle className="font-heading text-2xl">Crie seu espaço online</CardTitle>
            <CardDescription>Em poucos minutos, seu link de agendamento estará pronto para compartilhar.</CardDescription>
          </CardHeader>
          <CardContent>
            <SignupForm />
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Já tem conta?{" "}
              <Link href="/login" className="font-medium text-violet-600 underline underline-offset-4">
                Entrar
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
