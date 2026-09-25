"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarPlus,
  CalendarSearch,
  ChevronDown,
  Contact,
  EllipsisVertical,
  Images,
  MessageSquareMore,
  PanelRightClose,
  PanelRightOpen,
  Phone,
  Receipt,
  SquarePen,
  UserRound,
  UserRoundPlus,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WhatsAppGlyph } from "@/components/app/conversation-parts";
import { ContactAvatar } from "@/components/app/contact-avatar";
import { BookingTool } from "@/components/app/conversation-tools/booking-tool";
import { AvailabilityTool } from "@/components/app/conversation-tools/availability-tool";
import { PhotosTool } from "@/components/app/conversation-tools/photos-tool";
import { QuoteTool } from "@/components/app/conversation-tools/quote-tool";
import { useConversationToolsData } from "@/components/app/conversation-tools/use-tools-data";
import { useChatDraft, usePanelPreference } from "@/lib/chat-drafts";
import { cn } from "@/lib/utils";

/**
 * A conversa aberta, no desenho de caixa de atendimento: o chat no centro e,
 * à direita, a coluna do contato — os dados da pessoa e as ferramentas de
 * atendimento em cartões — com uma trilha fina de ícones na borda.
 *
 * As ferramentas juntam o que o dono faz DURANTE a conversa — agendar,
 * consultar a agenda, mandar foto de procedimento, mandar orçamento — para
 * que nada disso exija sair do chat. O que está aberto e o que foi preenchido
 * pertencem À CONVERSA (ver `useChatDraft`): trocar de cliente troca o painel
 * inteiro, e voltar traz o rascunho de volta.
 *
 * Em tela larga (xl) a coluna fica ao lado do chat e pode ser recolhida pela
 * trilha. Abaixo disso não cabe: ela abre por cima do chat, pelo botão do
 * cabeçalho.
 */

export type ToolId = "agendar" | "disponibilidade" | "fotos" | "orcamento";

export interface ConversationContact {
  chatId: string;
  name: string;
  /** Só dígitos, com DDI. Nulo em grupo. */
  phone: string | null;
  phoneLabel: string;
  isGroup: boolean;
  clientId: string | null;
}

interface ToolsContextValue {
  contact: ConversationContact;
  /** Motivo de não dar para enviar nada agora; nulo = pode enviar. */
  sendBlockedReason: string | null;
  openTool: (id: ToolId) => void;
}

const ToolsContext = createContext<ToolsContextValue | null>(null);

export function useConversationTools(): ToolsContextValue | null {
  return useContext(ToolsContext);
}

const TOOLS: { id: ToolId; icon: LucideIcon; title: string; hint: string }[] = [
  { id: "agendar", icon: CalendarPlus, title: "Criar agendamento", hint: "Marque sem sair da conversa" },
  { id: "disponibilidade", icon: CalendarSearch, title: "Disponibilidade", hint: "Dias e horários livres" },
  { id: "fotos", icon: Images, title: "Fotos dos procedimentos", hint: "As fotos cadastradas nos serviços" },
  { id: "orcamento", icon: Receipt, title: "Enviar orçamento", hint: "Monte com os seus serviços" },
];

const WIDE_QUERY = "(min-width: 1280px)";

export function ConversationWorkspace({
  contact,
  connected,
  sendBlockedReason,
  thread,
  composer,
  children,
}: {
  contact: ConversationContact;
  /** O número do estúdio está conectado — a barra do canal mostra. */
  connected: boolean;
  sendBlockedReason: string | null;
  thread: React.ReactNode;
  composer: React.ReactNode;
  /** Efeitos sem tela (marcar como lida). */
  children?: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = usePanelPreference("recolhido", false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openSections, setOpenSections] = useChatDraft<ToolId[]>(contact.chatId, "secoes", []);
  const [contactOpen, setContactOpen] = useState(true);
  const [toolsOpen, setToolsOpen] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);

  const scrollPanelTo = useCallback((selector: string) => {
    // Rola só a coluna: `scrollIntoView` levaria a página inteira junto.
    requestAnimationFrame(() => {
      const panel = panelRef.current;
      const target = panel?.querySelector<HTMLElement>(selector);
      if (!panel || !target) return;
      const top =
        target.getBoundingClientRect().top - panel.getBoundingClientRect().top + panel.scrollTop - 12;
      panel.scrollTo({ top, behavior: "smooth" });
    });
  }, []);

  const showPanel = useCallback(() => {
    if (window.matchMedia(WIDE_QUERY).matches) setCollapsed(false);
    else setDrawerOpen(true);
  }, [setCollapsed]);

  const openTool = useCallback(
    (id: ToolId) => {
      setOpenSections((current) => (current.includes(id) ? current : [...current, id]));
      setToolsOpen(true);
      showPanel();
      scrollPanelTo(`[data-tool="${id}"]`);
    },
    [setOpenSections, showPanel, scrollPanelTo]
  );

  // Esc fecha a coluna sobreposta (abaixo de xl).
  useEffect(() => {
    if (!drawerOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setDrawerOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  function togglePanel() {
    if (window.matchMedia(WIDE_QUERY).matches) setCollapsed(!collapsed);
    else setDrawerOpen((open) => !open);
  }

  return (
    <ToolsContext.Provider value={{ contact, sendBlockedReason, openTool }}>
      {children}
      <div className="relative flex min-h-0 flex-1">
        <section
          aria-label={`Conversa com ${contact.name}`}
          className="flex min-w-0 flex-1 flex-col gap-2 p-2 sm:gap-3 sm:p-3"
        >
          <ChannelBar
            connected={connected}
            hasOpenTools={openSections.length > 0}
            onCollapseAll={() => setOpenSections([])}
          />
          <ChatHeader contact={contact} onTogglePanel={togglePanel} onSchedule={() => openTool("agendar")} />
          {/* O miolo: as mensagens no fundo cinza e o campo de resposta em
              cartão, colados — o cartão fecha a conversa por baixo. */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-panel)]">
            {thread}
            {composer}
          </div>
        </section>

        {/* Coluna sobreposta (abaixo de xl) — fundo escurecido fecha ao tocar. */}
        {drawerOpen && (
          <button
            type="button"
            aria-label="Fechar painel"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 z-20 bg-black/30 backdrop-blur-[1px] xl:hidden"
          />
        )}

        <aside
          ref={panelRef}
          aria-label="Contato e atendimento"
          className={cn(
            "flex-col gap-3 overflow-y-auto overscroll-contain border-l border-border bg-muted/60 p-3 dark:bg-background",
            // Abaixo de xl: gaveta pela direita, por cima do chat.
            "absolute inset-y-0 right-0 z-30 w-[min(23rem,calc(100%-2.5rem))] shadow-[var(--shadow-lift)]",
            drawerOpen ? "flex" : "hidden",
            // xl: coluna fixa ao lado do chat.
            "xl:static xl:z-auto xl:w-[19rem] xl:shrink-0 xl:shadow-none 2xl:w-[21.5rem]",
            collapsed ? "xl:hidden" : "xl:flex"
          )}
        >
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="Fechar painel"
            className="flex size-8 shrink-0 items-center justify-center self-end rounded-lg text-muted-foreground outline-none hover:bg-card hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 xl:hidden"
          >
            <X className="size-4" aria-hidden />
          </button>

          <SideCard
            id="contato"
            icon={Contact}
            title="Informações do contato"
            open={contactOpen}
            onToggle={() => setContactOpen((open) => !open)}
          >
            <ContactDetails contact={contact} />
          </SideCard>

          <SideCard
            id="atendimento"
            icon={MessageSquareMore}
            title="Atendimento"
            open={toolsOpen}
            onToggle={() => setToolsOpen((open) => !open)}
          >
            <ToolsBody
              contact={contact}
              openSections={openSections}
              onToggleSection={(id) =>
                setOpenSections((current) =>
                  current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
                )
              }
              sendBlockedReason={sendBlockedReason}
            />
          </SideCard>
        </aside>

        {/* A trilha da borda (só xl): liga e desliga a coluna e leva direto a
            cada cartão e ferramenta. */}
        <nav
          aria-label="Atalhos da conversa"
          className="hidden w-12 shrink-0 flex-col items-center gap-1 border-l border-border bg-card py-3 xl:flex"
        >
          <RailButton
            label={collapsed ? "Mostrar coluna do contato" : "Esconder coluna do contato"}
            onClick={() => setCollapsed(!collapsed)}
            active={!collapsed}
          >
            {collapsed ? <PanelRightOpen /> : <PanelRightClose />}
          </RailButton>
          <span aria-hidden className="my-1 h-px w-6 bg-border" />
          <RailButton
            label="Informações do contato"
            onClick={() => {
              setContactOpen(true);
              showPanel();
              scrollPanelTo('[data-card="contato"]');
            }}
          >
            <Contact />
          </RailButton>
          {!contact.isGroup &&
            TOOLS.map((tool) => (
              <RailButton key={tool.id} label={tool.title} onClick={() => openTool(tool.id)}>
                <tool.icon />
              </RailButton>
            ))}
        </nav>
      </div>
    </ToolsContext.Provider>
  );
}

function RailButton({
  label,
  onClick,
  active = false,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "flex size-9 items-center justify-center rounded-lg outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-[1.125rem]",
        active
          ? "text-primary dark:text-violet-300"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

/**
 * A faixa acima da conversa: o canal (e se ele está no ar) à esquerda e, à
 * direita, "Fechar ferramentas" — recolhe de uma vez tudo o que ficou aberto
 * na coluna de atendimento.
 */
function ChannelBar({
  connected,
  hasOpenTools,
  onCollapseAll,
}: {
  connected: boolean;
  hasOpenTools: boolean;
  onCollapseAll: () => void;
}) {
  return (
    <div className="hidden h-6 shrink-0 items-center gap-4 px-1 text-sm sm:flex">
      <span className="flex items-center gap-1.5 font-medium text-foreground">
        <WhatsAppGlyph className="size-4 text-[#25d366]" />
        WhatsApp
      </span>
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <span
          aria-hidden
          className={cn("size-1.5 rounded-full", connected ? "bg-emerald-500" : "bg-amber-500")}
        />
        {connected ? "Número conectado" : "Número desconectado"}
      </span>
      {hasOpenTools && (
        <button
          type="button"
          onClick={onCollapseAll}
          className="ml-auto rounded font-medium text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 dark:text-violet-300"
        >
          Fechar ferramentas
        </button>
      )}
    </div>
  );
}

function ChatHeader({
  contact,
  onTogglePanel,
  onSchedule,
}: {
  contact: ConversationContact;
  onTogglePanel: () => void;
  onSchedule: () => void;
}) {
  const tag = contact.isGroup ? "Grupo" : contact.clientId ? "Cliente cadastrada" : "Não cadastrada";

  return (
    <header className="flex shrink-0 items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 shadow-[var(--shadow-panel)] sm:px-4">
      <Button
        variant="ghost"
        size="icon"
        className="-ml-1 md:hidden"
        aria-label="Voltar para a lista"
        nativeButton={false}
        render={<Link href="/app/conversations" />}
      >
        <ArrowLeft className="size-4" />
      </Button>

      <WhatsAppGlyph className="size-5 shrink-0 text-[#25d366]" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.9375rem] font-semibold text-foreground">{contact.name}</p>
        {/* A trilha de contexto, como numa caixa de atendimento: o número e,
            depois da barra, a situação do contato. */}
        <p className="flex min-w-0 items-center gap-1.5 text-xs text-primary dark:text-violet-300">
          <span className="shrink-0 tabular-nums">{contact.phoneLabel}</span>
          <span aria-hidden className="text-muted-foreground">/</span>
          <span className="truncate">{tag}</span>
        </p>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="icon-sm" className="size-9" aria-label="Mais ações" title="Mais ações" />
          }
        >
          <EllipsisVertical className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          {contact.clientId ? (
            <DropdownMenuItem render={<Link href={`/app/clients/${contact.clientId}`} />}>
              <UserRound className="size-4" /> Ver ficha da cliente
            </DropdownMenuItem>
          ) : (
            !contact.isGroup && (
              <DropdownMenuItem render={<Link href="/app/clients" />}>
                <UserRoundPlus className="size-4" /> Cadastrar cliente
              </DropdownMenuItem>
            )
          )}
          <DropdownMenuItem onClick={onTogglePanel}>
            <PanelRightOpen className="size-4" /> Mostrar ou esconder o painel
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {!contact.isGroup ? (
        <Button onClick={onSchedule} className="h-9 gap-1.5 bg-[var(--plum-900)] px-3.5 text-white hover:bg-[var(--plum-900)]/90 dark:bg-primary dark:text-primary-foreground">
          <CalendarPlus className="size-4" />
          <span className="hidden sm:inline">Agendar</span>
        </Button>
      ) : (
        <Button variant="outline" onClick={onTogglePanel} className="h-9 xl:hidden">
          Contato
        </Button>
      )}
    </header>
  );
}

/** Cartão da coluna da direita: título com ícone, recolhível pela seta. */
function SideCard({
  id,
  icon: Icon,
  title,
  open,
  onToggle,
  children,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const bodyId = `cartao-${id}`;
  return (
    <section
      data-card={id}
      className="shrink-0 overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-panel)]"
    >
      <h2>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={bodyId}
          className={cn(
            "flex w-full items-center gap-2.5 px-4 py-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            open && "border-b border-border bg-muted/40"
          )}
        >
          <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="flex-1 text-sm font-semibold text-foreground">{title}</span>
          <ChevronDown
            className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </button>
      </h2>
      {open && (
        <div id={bodyId} className="p-4">
          {children}
        </div>
      )}
    </section>
  );
}

function ContactDetails({ contact }: { contact: ConversationContact }) {
  const tag = contact.isGroup ? "Conversa em grupo" : contact.clientId ? "Cliente cadastrada" : "Não cadastrada";

  return (
    <div className="flex flex-col">
      <div className="flex items-start gap-3">
        <ContactAvatar
          name={contact.name}
          chatId={contact.isGroup ? null : contact.chatId}
          isGroup={contact.isGroup}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-primary dark:text-violet-300">{contact.name}</p>
          <p className="truncate text-sm text-foreground tabular-nums">{contact.phoneLabel}</p>
          {contact.clientId && (
            <Link
              href={`/app/clients/${contact.clientId}`}
              className="text-xs font-medium text-primary hover:underline dark:text-violet-300"
            >
              Histórico de atendimentos
            </Link>
          )}
        </div>
      </div>

      {/* Ações de um toque, em botões quadrados de contorno. */}
      {!contact.isGroup && (
        <div className="mt-4 flex gap-2">
          {contact.phone && (
            <ContactAction label="Ligar" href={`tel:+${contact.phone}`}>
              <Phone />
            </ContactAction>
          )}
          {contact.phone && (
            <ContactAction label="Abrir no WhatsApp" href={`https://wa.me/${contact.phone}`} external>
              <WhatsAppGlyph />
            </ContactAction>
          )}
          <ContactAction
            label={contact.clientId ? "Ver ficha" : "Cadastrar cliente"}
            href={contact.clientId ? `/app/clients/${contact.clientId}` : "/app/clients"}
          >
            {contact.clientId ? <UserRound /> : <UserRoundPlus />}
          </ContactAction>
        </div>
      )}

      <dl className="mt-5 flex flex-col gap-4 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Telefone</dt>
          <dd className="mt-1 font-medium text-foreground tabular-nums">{contact.phoneLabel}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Situação</dt>
          <dd className="mt-1">
            <span
              className={cn(
                "inline-flex rounded-md px-2 py-0.5 text-xs font-medium",
                contact.clientId
                  ? "bg-emerald-500/12 text-[#0b6b37] dark:text-emerald-300"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {tag}
            </span>
          </dd>
        </div>
      </dl>

      {!contact.isGroup && (
        <Button
          variant="secondary"
          className="mt-5 h-9 w-full gap-1.5"
          nativeButton={false}
          render={<Link href={contact.clientId ? `/app/clients/${contact.clientId}` : "/app/clients"} />}
        >
          <SquarePen className="size-3.5" />
          {contact.clientId ? "Gerenciar cliente" : "Cadastrar cliente"}
        </Button>
      )}
    </div>
  );
}

function ContactAction({
  label,
  href,
  external = false,
  children,
}: {
  label: string;
  href: string;
  external?: boolean;
  children: React.ReactNode;
}) {
  const className =
    "flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground outline-none transition-colors hover:border-input hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-4";
  return external ? (
    <a href={href} target="_blank" rel="noreferrer" title={label} aria-label={label} className={className}>
      {children}
    </a>
  ) : (
    <Link href={href} title={label} aria-label={label} className={className}>
      {children}
    </Link>
  );
}

function ToolsBody({
  contact,
  openSections,
  onToggleSection,
  sendBlockedReason,
}: {
  contact: ConversationContact;
  openSections: ToolId[];
  onToggleSection: (id: ToolId) => void;
  sendBlockedReason: string | null;
}) {
  const data = useConversationToolsData();

  if (contact.isGroup) {
    return (
      <p className="text-sm text-muted-foreground">
        As ferramentas de atendimento são para conversas com uma pessoa. Em grupo, dá para ler as
        mensagens por aqui e responder pelo celular.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {sendBlockedReason && (
        <p className="mb-1 rounded-lg bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-800 dark:text-amber-200">
          {sendBlockedReason} Você ainda pode agendar e consultar a agenda.
        </p>
      )}
      {TOOLS.map((tool) => (
        <ToolSection
          key={tool.id}
          tool={tool}
          open={openSections.includes(tool.id)}
          onToggle={() => onToggleSection(tool.id)}
        >
          {tool.id === "agendar" && <BookingTool data={data} />}
          {tool.id === "disponibilidade" && <AvailabilityTool data={data} />}
          {tool.id === "fotos" && <PhotosTool data={data} />}
          {tool.id === "orcamento" && <QuoteTool data={data} />}
        </ToolSection>
      ))}
    </div>
  );
}

/**
 * Uma ferramenta, como um campo de propriedade: rótulo pequeno em cima e uma
 * caixa de contorno que abre o conteúdo embaixo.
 */
function ToolSection({
  tool,
  open,
  onToggle,
  children,
}: {
  tool: (typeof TOOLS)[number];
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const contentId = `ferramenta-${tool.id}`;
  return (
    <div
      data-tool={tool.id}
      className={cn(
        "scroll-mt-3 rounded-lg border bg-background transition-colors",
        open ? "border-input" : "border-border hover:border-input"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={contentId}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <tool.icon className="size-4 shrink-0 text-primary dark:text-violet-300" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">{tool.title}</span>
          <span className="block truncate text-xs text-muted-foreground">{tool.hint}</span>
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open && (
        <div id={contentId} className="border-t border-border px-3 pt-3 pb-3">
          {children}
        </div>
      )}
    </div>
  );
}
