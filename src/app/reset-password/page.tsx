import { ShieldCheck } from "lucide-react";
import { BrandMark, AuthBackdrop } from "@/components/auth/brand-mark";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Nova senha — Agenda Online" };
export default function ResetPasswordPage() { return <div className="auth-motion-bg relative flex flex-1 flex-col items-center justify-center gap-6 overflow-hidden px-4 py-16"><AuthBackdrop /><BrandMark /><Card className="relative w-full max-w-sm border-violet-950/8 bg-white/85 shadow-2xl shadow-violet-950/10 backdrop-blur-xl"><CardHeader><span className="mb-2 flex size-10 items-center justify-center rounded-xl bg-violet-600/10 text-violet-600"><ShieldCheck className="size-5" /></span><CardTitle className="font-heading text-2xl">Defina uma nova senha</CardTitle><CardDescription>Escolha uma senha segura para voltar ao seu painel.</CardDescription></CardHeader><CardContent><ResetPasswordForm /></CardContent></Card></div>; }
