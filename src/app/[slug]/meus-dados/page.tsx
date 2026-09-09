import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { getPublicStudioBySlug } from "@/lib/data/studios";
import { DataRequestForm } from "@/components/public/data-request-form";
import { SystemLogo } from "@/components/system-logo";

/**
 * Canal do titular (LGPD art. 18), por estúdio.
 *
 * Fica sob `/[slug]` e não numa rota geral da plataforma porque o CONTROLADOR
 * dos dados de agendamento é o estúdio, não o Timely (ver a seção 1 de
 * /politica-de-privacidade). Um canal único da plataforma daria a impressão
 * errada de quem decide, e ainda obrigaria a cliente a saber em qual estúdio
 * ela marcou — o link já carrega essa informação.
 *
 * Server Component; só o formulário desce como JavaScript.
 */

interface MeusDadosPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata(props: MeusDadosPageProps): Promise<Metadata> {
  const { slug } = await props.params;
  const studio = await getPublicStudioBySlug(slug);
  if (!studio) return {};
  return {
    title: `Meus dados — ${studio.name}`,
    description: `Peça acesso, correção ou exclusão dos seus dados em ${studio.name}.`,
    // Fora do índice: é um formulário de serviço, não conteúdo de busca, e
    // indexá-lo só traria robô preenchendo pedido de exclusão.
    robots: { index: false, follow: false },
  };
}

export default async function MeusDadosPage(props: MeusDadosPageProps) {
  const { slug } = await props.params;
  const studio = await getPublicStudioBySlug(slug);
  if (!studio) notFound();

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-lg items-center justify-between gap-4 px-4 py-4">
          <span className="flex items-center gap-2.5">
            <SystemLogo className="size-8" size={64} />
            <span className="font-semibold tracking-tight">{studio.name}</span>
          </span>
          <Link
            href={`/${slug}`}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Agendar
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10">
        <h1 className="text-[1.75rem] leading-tight font-semibold text-balance">
          Seus dados em {studio.name}
        </h1>
        <p className="mt-3 leading-7 text-muted-foreground">
          A Lei Geral de Proteção de Dados garante a você pedir acesso, correção
          ou exclusão dos seus dados, e se opor ao recebimento de mensagens.
          Preencha abaixo e {studio.name} responde em até 15 dias.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Para entender como esses dados são usados, veja a{" "}
          <Link
            href="/politica-de-privacidade"
            className="text-primary underline underline-offset-4"
          >
            Política de Privacidade
          </Link>
          .
        </p>

        <div className="mt-8">
          <DataRequestForm slug={slug} studioName={studio.name} />
        </div>
      </main>
    </div>
  );
}
