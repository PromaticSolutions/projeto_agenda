import { CalendarDays } from "lucide-react";
import { SignOutButton } from "@/components/app/sign-out-button";

export function SuperAdminShell({
  adminEmail,
  children,
}: {
  adminEmail: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f7f5fc]">
      <header className="border-b border-black/10 bg-plum-900 px-4 py-3 text-white md:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-cta">
              <CalendarDays className="size-4" />
            </span>
            <div>
              <p className="font-heading text-sm leading-none font-semibold">Promatic Admin</p>
              <p className="mt-0.5 text-[11px] text-white/45">Visão geral da plataforma</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {adminEmail && <span className="hidden text-xs text-white/50 sm:inline">{adminEmail}</span>}
            <SignOutButton className="text-white/70 hover:bg-white/10 hover:text-white" />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-8">{children}</main>
    </div>
  );
}
