"use client";

import { useActionState, useState, type FormEvent } from "react";
import { Check, ExternalLink, ImagePlus, KeyRound, LoaderCircle, Palette, Save, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { updateAccountAction, type AccountActionState } from "@/app/app/(dashboard)/account/actions";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { getStudioPublicUrl } from "@/lib/format";
import type { Studio } from "@/lib/types";

function PasswordPanel() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isSupabaseConfigured) return toast.info("A troca de senha só fica disponível com o Supabase configurado.");
    if (password.length < 6) return toast.error("Use pelo menos 6 caracteres na nova senha.");
    if (password !== confirmation) return toast.error("As senhas não coincidem.");
    setPending(true);
    const { error } = await createBrowserSupabaseClient().auth.updateUser({ password });
    setPending(false);
    if (error) return toast.error(error.message);
    setPassword(""); setConfirmation(""); setSuccess(true); toast.success("Senha atualizada com segurança.");
  }
  return <section className="account-card rounded-[1.75rem] border border-violet-950/6 bg-card p-5 shadow-sm dark:border-white/8 sm:p-6"><div className="flex items-start gap-3"><span className="flex size-10 items-center justify-center rounded-2xl bg-magenta/10 text-magenta"><KeyRound className="size-5" /></span><div><p className="font-heading text-xl font-semibold text-plum-900 dark:text-foreground">Segurança</p><p className="mt-1 text-sm text-muted-foreground">Troque sua senha sempre que precisar.</p></div></div><form onSubmit={handleSubmit} className="mt-5 grid gap-3 sm:grid-cols-2"><div className="flex flex-col gap-1.5"><Label htmlFor="new-password">Nova senha</Label><Input id="new-password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div><div className="flex flex-col gap-1.5"><Label htmlFor="confirm-password">Confirmar nova senha</Label><Input id="confirm-password" type="password" autoComplete="new-password" required value={confirmation} onChange={(e) => setConfirmation(e.target.value)} /></div><div className="flex items-center justify-between gap-3 sm:col-span-2"><p className="text-xs text-muted-foreground">Use ao menos 6 caracteres.</p><Button type="submit" disabled={pending} className="bg-cta text-white shadow-md shadow-violet-600/20">{pending ? <LoaderCircle className="size-4 animate-spin" /> : success ? <Check className="size-4" /> : <ShieldCheck className="size-4" />}{pending ? "Atualizando..." : success ? "Senha atualizada" : "Atualizar senha"}</Button></div></form></section>;
}

export function AccountSettings({ studio }: { studio: Studio }) {
  const [state, formAction, pending] = useActionState<AccountActionState, FormData>(updateAccountAction, null);
  const [name, setName] = useState(studio.name);
  const [slug, setSlug] = useState(studio.slug);
  const [color, setColor] = useState(studio.brand_color);
  const [logo, setLogo] = useState(studio.logo_url ?? "");
  const publicUrl = getStudioPublicUrl(slug || studio.slug);
  return <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start"><form action={formAction} className="account-card rounded-[1.75rem] border border-violet-950/6 bg-card p-5 shadow-sm dark:border-white/8 sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold tracking-[.13em] text-violet-600 uppercase">Informações públicas</p><h2 className="mt-1 font-heading text-2xl font-semibold text-plum-900 dark:text-foreground">Seu estúdio</h2><p className="mt-1 text-sm text-muted-foreground">Esses dados aparecem para os clientes na página de agendamento.</p></div><span className="hidden size-10 items-center justify-center rounded-2xl bg-violet-600/10 text-violet-600 sm:flex"><Sparkles className="size-5" /></span></div><div className="mt-7 grid gap-5 sm:grid-cols-2"><div className="flex flex-col gap-2"><Label htmlFor="account-name">Nome do estúdio</Label><Input id="account-name" name="name" required value={name} onChange={(e) => setName(e.target.value)} /></div><div className="flex flex-col gap-2"><Label htmlFor="account-whatsapp">WhatsApp</Label><PhoneInput id="account-whatsapp" name="whatsapp" required defaultValue={studio.whatsapp.replace(/^55/, "")} /></div><div className="flex flex-col gap-2 sm:col-span-2"><Label htmlFor="account-slug">Link público</Label><div className="flex overflow-hidden rounded-xl border border-input bg-background focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50"><span className="flex items-center bg-muted px-3 text-sm text-muted-foreground">/</span><Input id="account-slug" name="slug" required value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} className="rounded-none border-0 focus-visible:ring-0" /></div></div><div className="flex flex-col gap-2"><Label htmlFor="account-logo">URL do logo</Label><div className="relative"><ImagePlus className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input id="account-logo" name="logo_url" type="url" value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="https://..." className="pl-10" /></div></div><div className="flex flex-col gap-2"><Label htmlFor="account-color">Cor da marca</Label><div className="flex h-9 items-center gap-3 rounded-xl border border-input px-2"><input id="account-color" name="brand_color" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="size-6 cursor-pointer rounded-md border-0 bg-transparent p-0" /><span className="flex items-center gap-1.5 font-mono text-sm uppercase text-muted-foreground"><Palette className="size-3.5" />{color}</span></div></div></div>{state && !state.ok && <p className="mt-4 text-sm text-destructive">{state.error}</p>}{state?.ok && <p className="mt-4 flex items-center gap-1.5 text-sm font-medium text-wa"><Check className="size-4" />{state.message}</p>}<div className="mt-7 flex justify-end border-t border-border/70 pt-5 dark:border-white/8"><Button type="submit" disabled={pending} className="bg-cta text-white shadow-lg shadow-violet-600/20">{pending ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}{pending ? "Salvando..." : "Salvar alterações"}</Button></div></form><aside className="account-card relative overflow-hidden rounded-[1.75rem] bg-plum-900 p-6 text-white shadow-xl shadow-violet-950/15"><div aria-hidden className="absolute -right-16 -top-12 size-48 rounded-full bg-violet-500/40 blur-3xl" /><p className="relative text-xs font-bold tracking-[.13em] text-white/55 uppercase">Prévia pública</p><div className="relative mt-5 flex flex-col items-center rounded-2xl border border-white/10 bg-white/7 p-5 text-center"><span className="flex size-16 items-center justify-center overflow-hidden rounded-2xl bg-white/12 font-heading text-2xl font-semibold">{logo ? <img src={logo} alt="Logo" className="size-full object-cover" /> : name.slice(0, 1).toUpperCase()}</span><p className="mt-3 font-heading text-xl font-semibold">{name || "Seu estúdio"}</p><span className="mt-3 rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: color }}>Agendar agora</span></div><a href={publicUrl} target="_blank" rel="noreferrer" className="relative mt-5 flex items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2.5 text-sm font-semibold transition-all hover:-translate-y-0.5 hover:bg-white/15"><ExternalLink className="size-4" />Abrir página pública</a></aside><PasswordPanel /></div>;
}
