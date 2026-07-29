import { getMyStudio } from "@/lib/data/studios";
import { AccountSettings } from "@/components/app/account-settings";

export const metadata = { title: "Conta — Agenda Online" };
export default async function AccountPage() { const studio = await getMyStudio(); if (!studio) return null; return <div className="mx-auto w-full max-w-[1500px]"><p className="text-xs font-bold tracking-[.14em] text-violet-600 uppercase">Configurações</p><h1 className="mt-1 font-heading text-3xl font-semibold text-plum-900 dark:text-foreground">Conta e identidade</h1><p className="mt-2 max-w-2xl text-muted-foreground">Gerencie como seu estúdio aparece para os clientes e mantenha o acesso seguro.</p><div className="mt-7"><AccountSettings studio={studio} /></div></div>; }
