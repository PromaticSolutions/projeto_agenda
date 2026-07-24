import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicStudioBySlug } from "@/lib/data/studios";
import { listPublicServices } from "@/lib/data/services";
import { BookingFlow } from "@/components/public/booking-flow";

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
    <div className="flex flex-1 flex-col bg-blush-50">
      <header
        className="relative flex flex-col items-center gap-3 rounded-b-[2.5rem] px-4 pt-12 pb-16 text-center text-white"
        style={{ backgroundColor: studio.brand_color }}
      >
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
          <h1 className="font-heading text-2xl font-semibold">{studio.name}</h1>
          <p className="mt-1 text-sm text-white/80">Escolha o serviço, o dia e o horário</p>
        </div>
      </header>

      <main className="relative mx-auto -mt-9 w-full max-w-lg flex-1 px-4 pb-10">
        {services.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-plum-900/15 bg-card p-8 text-center text-muted-foreground shadow-sm">
            Nenhum serviço disponível para agendamento no momento.
          </p>
        ) : (
          <BookingFlow studio={studio} services={services} />
        )}
      </main>

      <footer className="px-4 py-6 text-center text-xs text-muted-foreground">
        Agendamento por{" "}
        <span className="font-medium text-plum-900">Agenda Online</span>
      </footer>
    </div>
  );
}
