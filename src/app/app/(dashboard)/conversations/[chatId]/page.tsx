import { notFound } from "next/navigation";
import { ConversationsShell } from "@/app/app/(dashboard)/conversations/conversations-shell";
import { ConversationsHeader } from "@/app/app/(dashboard)/conversations/conversations-header";
import { ConversationComposer, type ComposerBlock } from "@/components/app/conversation-composer";
import { MarkConversationRead, ThreadViewport } from "@/components/app/conversation-live";
import { MESSAGE_TYPE_ICONS } from "@/components/app/conversation-parts";
import { MessageMedia } from "@/components/app/conversation-media";
import { ContactAvatar } from "@/components/app/contact-avatar";
import { CheckCheck } from "lucide-react";
import {
  ConversationWorkspace,
  type ConversationContact,
} from "@/components/app/conversation-workspace";
import { getMyStudio } from "@/lib/data/studios";
import { getMyClientByPhone } from "@/lib/data/clients";
import {
  getConversation,
  listConversationMessages,
  THREAD_MESSAGE_LIMIT,
} from "@/lib/data/conversations";
import { getWhatsAppConnection } from "@/lib/data/whatsapp";
import {
  MESSAGE_TYPE_LABELS,
  conversationTitle,
  formatConversationDay,
  formatMessageTime,
  localDayKey,
} from "@/lib/conversations";
import { chatFromJid } from "@/lib/whatsapp/inbound";
import { formatPhoneDisplay } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { WhatsAppMessage } from "@/lib/types";

export const metadata = { title: "Conversas — Timely" };

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = await params;

  const studio = await getMyStudio();
  if (!studio) return null;

  // Normaliza antes de qualquer consulta: o id vem da URL, e "5511...@x" ou
  // um telefone solto não são conversa.
  const chat = chatFromJid(decodeURIComponent(chatId));
  if (!chat) notFound();

  const [conversation, { messages, truncated }, connection] = await Promise.all([
    getConversation(studio.id, chat.chatId),
    listConversationMessages(studio.id, chat.chatId),
    getWhatsAppConnection(studio.id),
  ]);

  // "Nova conversa" abre uma cliente que ainda não escreveu: não há linha na
  // lista, mas a conversa existe para o dono começar.
  const client = chat.phone ? await getMyClientByPhone(studio.id, chat.phone) : null;
  if (!conversation && !client) notFound();

  const title = conversation
    ? conversationTitle(conversation)
    : (client?.name ?? "Conversa");
  const phone = conversation?.chat_phone ?? client?.phone ?? chat.phone;
  const clientId = conversation?.client_id ?? client?.id ?? null;

  // As não lidas saem das próprias mensagens carregadas — evita uma segunda
  // consulta só para o contador que o efeito vai zerar em seguida.
  const unreadCount = messages.filter(
    (message) => message.direction === "recebida" && !message.read_at
  ).length;

  const blocked: ComposerBlock | null = chat.isGroup
    ? {
        // O envio manual passa pelo outbox, cuja coluna de telefone só aceita
        // dígitos (0010) — JID de grupo não cabe ali. Ler grupo funciona;
        // responder, por enquanto, é no celular.
        message: "Responder grupo pelo painel ainda não funciona. Responda pelo celular.",
      }
    : connection.status === "conectado"
      ? null
      : {
          message: "O WhatsApp do estúdio está desconectado, então não dá para responder por aqui.",
          href: "/app/whatsapp",
          cta: "Conectar",
        };

  const now = new Date();
  const last = messages[messages.length - 1];

  const contact: ConversationContact = {
    chatId: chat.chatId,
    name: title,
    phone: chat.isGroup ? null : (phone ?? null),
    phoneLabel: chat.isGroup
      ? "Conversa em grupo"
      : phone
        ? formatPhoneDisplay(phone)
        : "Sem número",
    isGroup: chat.isGroup,
    clientId,
  };

  return (
    <div className="flex flex-col gap-6">
      <ConversationsHeader hasConversations />

      <ConversationsShell activeChatId={chat.chatId}>
        <ConversationWorkspace
          contact={contact}
          connected={connection.status === "conectado"}
          sendBlockedReason={blocked && !chat.isGroup ? blocked.message : null}
          thread={
            <ThreadViewport lastMessageKey={last?.id ?? null}>
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-center">
                  <p className="rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground">
                    Nenhuma mensagem ainda. Escreva abaixo para começar a conversa.
                  </p>
                </div>
              ) : (
                <>
                  {truncated && (
                    <p className="pb-4 text-center text-xs text-muted-foreground">
                      Mostrando as {THREAD_MESSAGE_LIMIT} mensagens mais recentes.
                    </p>
                  )}
                  <ol className="flex flex-col">
                    {messages.map((message, index) => (
                      <MessageItem
                        key={message.id}
                        message={message}
                        previous={messages[index - 1]}
                        now={now}
                        studioName={studio.name}
                        contactName={title}
                        contactChatId={chat.isGroup ? null : chat.chatId}
                      />
                    ))}
                  </ol>
                </>
              )}
            </ThreadViewport>
          }
          composer={
            <ConversationComposer
              chatId={chat.chatId}
              blocked={blocked}
              recipientLabel={contact.phoneLabel}
            />
          }
        >
          <MarkConversationRead chatId={chat.chatId} unreadCount={unreadCount} />
        </ConversationWorkspace>
      </ConversationsShell>
    </div>
  );
}

/** Mensagens da mesma pessoa com menos disso de intervalo formam um bloco. */
const GROUP_WINDOW_MS = 5 * 60_000;

/**
 * Uma mensagem, precedida do separador de dia quando o dia vira.
 *
 * Desenho de caixa de atendimento: o nome de quem falou em cima, o balão, e
 * o horário embaixo, fora dele; a foto ao lado do balão. As suas ficam à
 * direita em balão branco, as da cliente à esquerda em azul claro — duas
 * cores que se distinguem sem depender do lado.
 *
 * Mensagens seguidas do mesmo lado formam um bloco: só a primeira repete
 * nome e foto, e as outras alinham pelo espaço que a foto ocuparia.
 */
function MessageItem({
  message,
  previous,
  now,
  studioName,
  contactName,
  contactChatId,
}: {
  message: WhatsAppMessage;
  previous: WhatsAppMessage | undefined;
  now: Date;
  studioName: string;
  contactName: string;
  /** Nulo em grupo: cada mensagem é de uma pessoa diferente, sem foto. */
  contactChatId: string | null;
}) {
  const sentAt = new Date(message.sent_at);
  const dayChanged = !previous || localDayKey(new Date(previous.sent_at)) !== localDayKey(sentAt);
  const fromMe = message.direction === "enviada";
  const continued =
    !dayChanged &&
    previous !== undefined &&
    previous.direction === message.direction &&
    previous.sender_name === message.sender_name &&
    sentAt.getTime() - new Date(previous.sent_at).getTime() < GROUP_WINDOW_MS;

  const type = message.message_type;
  const hasMedia = MEDIA_TYPES.has(type);
  const Icon = MESSAGE_TYPE_ICONS[type];
  // Documento: o corpo é o nome do arquivo (ou a legenda), mostrado no cartão.
  const caption = type === "documento" ? null : message.body;
  const author = fromMe ? studioName : (message.sender_name ?? contactName);

  return (
    <>
      {dayChanged && (
        <li className="my-4 flex items-center gap-3 first:mt-0" aria-label={formatConversationDay(sentAt, now)}>
          <span aria-hidden className="h-px flex-1 bg-border" />
          <span className="text-xs font-medium text-muted-foreground">{formatConversationDay(sentAt, now)}</span>
          <span aria-hidden className="h-px flex-1 bg-border" />
        </li>
      )}

      <li className={cn("flex items-start gap-2.5", fromMe && "flex-row-reverse", continued ? "mt-1.5" : "mt-5")}>
        {/* A foto só na primeira do bloco; nas outras, o mesmo espaço vazio
            mantém os balões alinhados. */}
        <span className="w-9 shrink-0">
          {!continued && (
            <ContactAvatar
              name={author}
              chatId={fromMe ? null : contactChatId}
              size="sm"
              className={cn("size-9", fromMe && "bg-[var(--plum-900)] text-white dark:bg-primary/25 dark:text-violet-200")}
            />
          )}
        </span>

        <div className={cn("flex min-w-0 max-w-[80%] flex-col sm:max-w-[68%]", fromMe ? "items-end" : "items-start")}>
          {!continued && (
            <p
              className={cn(
                "mb-1 text-xs font-medium",
                fromMe ? "text-muted-foreground" : "text-primary dark:text-violet-300"
              )}
            >
              {author}
            </p>
          )}

          <div
            className={cn(
              "rounded-xl text-[0.9375rem] leading-[1.45]",
              hasMedia ? "p-1.5" : "px-3.5 py-2.5",
              fromMe
                ? "border border-border bg-card text-foreground shadow-[0_1px_2px_rgb(16_24_40/0.06)]"
                : "bg-[#d6e7fc] text-[#12263f] dark:bg-sky-900/45 dark:text-sky-50"
            )}
          >
            {hasMedia ? (
              // `fromMe` na mídia escolhe as cores de balão ESCURO; os dois
              // balões aqui são claros.
              <MessageMedia
                messageId={message.id}
                type={type}
                fromMe={false}
                fileLabel={type === "documento" ? message.body : null}
              />
            ) : (
              type !== "texto" && (
                // Localização, contato e o que só abre no celular: o app não tem
                // como mostrar, então diz o que é.
                <p className="mb-0.5 flex items-center gap-1.5 text-xs font-medium opacity-75">
                  {Icon && <Icon className="size-3.5" aria-hidden />}
                  {MESSAGE_TYPE_LABELS[type]}
                </p>
              )
            )}

            {caption && (
              <p className={cn("whitespace-pre-wrap break-words", hasMedia && "px-1.5 pt-1.5")}>{caption}</p>
            )}
          </div>

          <p className="mt-1 flex items-center gap-1 text-[0.6875rem] text-muted-foreground italic tabular-nums">
            <time dateTime={message.sent_at}>{formatMessageTime(sentAt)}</time>
            {fromMe && <CheckCheck className="size-3.5 not-italic" aria-label="Enviada" />}
          </p>
        </div>
      </li>
    </>
  );
}

const MEDIA_TYPES = new Set<WhatsAppMessage["message_type"]>([
  "imagem",
  "figurinha",
  "audio",
  "video",
  "documento",
]);
