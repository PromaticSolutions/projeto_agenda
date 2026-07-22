import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignupForm } from "@/components/auth/signup-form";
import { DemoModeNotice } from "@/components/auth/demo-mode-notice";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata = { title: "Criar conta — Agenda Online" };

export default function SignupPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16">
      <Link href="/" className="font-heading text-2xl font-semibold text-plum-900 dark:text-blush-50">
        Agenda Online
      </Link>
      {!isSupabaseConfigured && <div className="w-full max-w-sm"><DemoModeNotice /></div>}
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Criar seu estúdio</CardTitle>
          <CardDescription>Comece a receber agendamentos online hoje.</CardDescription>
        </CardHeader>
        <CardContent>
          <SignupForm />
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Já tem conta?{" "}
            <Link href="/login" className="text-violet-600 underline underline-offset-4">
              Entrar
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
