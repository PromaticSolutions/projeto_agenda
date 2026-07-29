import { KeyRound } from "lucide-react";
import { BrandMark, AuthBackdrop } from "@/components/auth/brand-mark";
import { PasswordRecoveryForm } from "@/components/auth/password-recovery-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Recuperar senha — Agenda Online" };
export default function ForgotPasswordPage() { return <div className="auth-motion-bg relative flex flex-1 flex-col items-center justify-center gap-6 overflow-hidden px-4 py-16"><AuthBackdrop /><BrandMark /><Card className="relative w-full max-w-sm border-violet-950/8 bg-white/85 shadow-2xl shadow-violet-950/10 backdrop-blur-xl"><CardHeader><span className="mb-2 flex size-10 items-center justify-center rounded-xl bg-violet-600/10 text-violet-600"><KeyRound className="size-5" /></span><CardTitle className="font-heading text-2xl">Redefina sua senha</CardTitle><CardDescription>Enviaremos um link seguro para o seu e-mail.</CardDescription></CardHeader><CardContent><PasswordRecoveryForm /></CardContent></Card></div>; }
