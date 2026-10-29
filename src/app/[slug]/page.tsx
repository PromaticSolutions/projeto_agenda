import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { MessageCircle } from "lucide-react";
import { getBookablePublicStudioBySlug } from "@/lib/data/studios";
import { listPublicServices } from "@/lib/data/services";
import { nextSlotByService } from "@/lib/data/publicAvailability";
import { BookingFlow } from "@/components/public/booking-flow";
import { SystemLogo } from "@/components/system-logo";
import { utcToLocalDate } from "@/lib/availability";
import { brandForeground } from "@/lib/public-booking";

interface StudioPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata(props: StudioPageProps): Promise<Metadata> {
  const { slug } = await props.params;
  const studio = await getBookablePublicStudioBySlug(slug);
  if (!studio) return {};
  return {
    title: `Agendar horário — ${studio.name}`,
    description: `Escolha o serviço, o dia e o horário e marque em ${studio.name} em menos de um minuto.`,
  };
}

/**
 * A página que o estúdio manda para as clientes marcarem horário.
 *
 * É a vitrine do estúdio, não do Timely: a cor e a capa são as do dono, e a
 * marca da plataforma fica só no rodapé. Visual sóbrio de propósito — fios
 * finos em vez de cartões flutuando, nada de selos e brilhos — porque quem
 * abre o link quer resolver uma coisa só: achar um horário e marcar.
 */
export default async function PublicStudioPage(props: StudioPageProps) {
  const { slug } = await props.params;
  const studio = await getBookablePublicStudioBySlug(slug);
  if (!studio) notFound();

  const services = await listPublicServices(studio.id);
  const nextSlots = await nextSlotByService(studio.id, services, utcToLocalDate(new Date()));

  const brandStyle = {
    "--brand": studio.brand_color,
    "--brand-fg": brandForeground(studio.brand_color),
  } as CSSProperties;

  return (
    <div className="flex flex-1 flex-col bg-background" style={brandStyle}>
      <header>
        {studio.banner_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- capa hospedada no storage do dono
          <img
            src={studio.banner_url}
            alt=""
            className="h-32 w-full object-cover sm:h-48"
          />
        ) : (
          <div aria-hidden className="h-24 sm:h-32" style={{ backgroundColor: studio.brand_color }} />
        )}

        <div className="mx-auto w-full max-w-5xl px-4">
          {studio.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo hospedado externamente pelo dono
            <img
              src={studio.logo_url}
              alt={studio.name}
              className="-mt-10 size-20 rounded-full border-4 border-background bg-background object-cover"
            />
          ) : (
            /* Sem logo próprio, entra a marca do Timely — e não a inicial do
               nome. Fundo sólido porque a cor da faixa é escolhida pelo dono:
               sobre um violeta parecido, a peça sumiria. */
            <span className="-mt-10 flex size-20 items-center justify-center rounded-full border-4 border-background bg-white">
              <SystemLogo className="size-12" size={96} />
            </span>
          )}

          <div className="mt-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-border pb-5">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">{studio.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Escolha o serviço, o dia e o horário. A confirmação é na hora.
              </p>
            </div>
            <a
              href={`https://wa.me/${studio.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <MessageCircle className="size-4 text-wa" aria-hidden />
              Falar no WhatsApp
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-6 sm:pt-8">
        {services.length === 0 ? (
          <div className="mx-auto max-w-5xl px-4">
            <p className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
              {studio.name} ainda não abriu horários para agendamento online. Fale pelo WhatsApp.
            </p>
          </div>
        ) : (
          <BookingFlow studio={studio} services={services} nextSlots={nextSlots} />
        )}
      </main>

      <footer className="mt-10 border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-5 text-xs text-muted-foreground">
          <span>
            Agendamento por <span className="font-medium text-foreground">Timely</span>
          </span>
          {/* O canal do art. 18 da LGPD precisa ser ALCANÇÁVEL, não só existir
              escrito na política. Aqui é o único lugar do produto por onde uma
              cliente do estúdio passa — ela não tem login nem painel. */}
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link href={`/${slug}/meus-dados`} className="underline underline-offset-4 hover:text-foreground">
              Meus dados
            </Link>
            <Link href="/politica-de-privacidade" className="underline underline-offset-4 hover:text-foreground">
              Privacidade
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
