import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicStudioBySlug } from "@/lib/data/studios";
import { listPublicServices } from "@/lib/data/services";
import { BookingFlow } from "@/components/public/booking-flow";
import { CalendarCheck2, ShieldCheck, Sparkles } from "lucide-react";

interface StudioPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata(props: StudioPageProps): Promise<Metadata> {
  const { slug } = await props.params;
  const studio = await getPublicStudioBySlug(slug);
  if (!studio) return {};
  return {
    title: `Agendar horário — ${studio.name}`,
    description: `Marque seu horário em ${studio.name} em poucos cliques.`,
  };
}

export default async function PublicStudioPage(props: StudioPageProps) {
  const { slug } = await props.params;
  const studio = await getPublicStudioBySlug(slug);
  if (!studio) notFound();

  const services = await listPublicServices(studio.id);

  return (
    <div className="public-booking-page relative flex flex-1 flex-col overflow-hidden bg-[#f8f7ff]">
      <div aria-hidden className="public-orb public-orb-one" />
      <div aria-hidden className="public-orb public-orb-two" />
      <header
        className="relative mx-3 mt-3 flex flex-col items-center gap-4 overflow-hidden rounded-[2rem] px-5 pt-10 pb-20 text-center text-white shadow-2xl shadow-violet-950/15 sm:mx-5 sm:rounded-[2.5rem]"
        style={{ backgroundColor: studio.brand_color }}
      >
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(255,255,255,.3),transparent_32%),radial-gradient(circle_at_90%_95%,rgba(21,7,47,.35),transparent_45%)]" />
        <div className="relative inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold tracking-[0.12em] uppercase backdrop-blur">
          <Sparkles className="size-3" /> agenda online
        </div>
        {studio.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- logo hospedado externamente pelo dono
          <img
            src={studio.logo_url}
            alt={studio.name}
            className="size-20 rounded-full border-2 border-white/40 object-cover shadow-lg"
          />
        ) : (
          <span className="flex size-20 items-center justify-center rounded-full bg-white/15 font-heading text-3xl font-semibold shadow-lg ring-4 ring-white/15">
            {studio.name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">{studio.name}</h1>
          <p className="mt-1 text-sm text-white/80">Seu próximo momento começa por aqui.</p>
        </div>
        <div className="relative mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-medium text-white/80">
          <span className="flex items-center gap-1.5"><CalendarCheck2 className="size-3.5" /> reserva em poucos passos</span>
          <span className="flex items-center gap-1.5"><ShieldCheck className="size-3.5" /> confirmação imediata</span>
        </div>
      </header>

      <main className="relative mx-auto -mt-12 w-full max-w-xl flex-1 px-4 pb-10 sm:px-5">
        {services.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-plum-900/15 bg-card p-8 text-center text-muted-foreground shadow-sm">
            Nenhum serviço disponível para agendamento no momento.
          </p>
        ) : (
          <BookingFlow studio={studio} services={services} />
        )}
      </main>

      <footer className="relative px-4 py-7 text-center text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-950/8 bg-white/60 px-3 py-1.5 shadow-sm">
          <Sparkles className="size-3 text-violet-600" /> Agendamento por <span className="font-semibold text-plum-900">Agenda Online</span>
        </span>
      </footer>
    </div>
  );
}
