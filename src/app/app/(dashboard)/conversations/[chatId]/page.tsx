import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCheck } from "lucide-react";
import { ConversationsShell } from "@/app/app/(dashboard)/conversations/conversations-shell";
import { ConversationsHeader } from "@/app/app/(dashboard)/conversations/conversations-header";
import { ConversationComposer, type ComposerBlock } from "@/components/app/conversation-composer";
import { MarkConversationRead, ThreadViewport } from "@/components/app/conversation-live";
import { ConversationAvatar, MESSAGE_TYPE_ICONS } from "@/components/app/conversation-parts";
import { Button } from "@/components/ui/button";
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

  return (
    <div className="flex flex-col gap-6">
      <ConversationsHeader hasConversations />

      <ConversationsShell activeChatId={chat.chatId}>
        <MarkConversationRead chatId={chat.chatId} unreadCount={unreadCount} />

        <div className="flex items-center gap-3 border-b border-border px-3 py-2.5 sm:px-4">
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            aria-label="Voltar para a lista"
            render={<Link href="/app/conversations" />}
          >
            <ArrowLeft className="size-4" />
          </Button>

          <ConversationAvatar name={title} size="sm" />

          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-foreground">{title}</p>
            <p className="truncate text-xs text-muted-foreground">
              {chat.isGroup
                ? "Conversa em grupo"
                : phone
                  ? formatPhoneDisplay(phone)
                  : "Sem número"}
              {!chat.isGroup && !clientId && " · não é cliente cadastrada"}
            </p>
          </div>

          {/* Quem não está no cadastro tem o caminho de entrar nele; quem está
              tem o caminho para a ficha. */}
          {clientId ? (
            <Button variant="outline" size="sm" render={<Link href={`/app/clients/${clientId}`} />}>
              Ver ficha
            </Button>
          ) : (
            !chat.isGroup &&
            phone && (
              <Button
                variant="outline"
                size="sm"
                render={<Link href="/app/clients" />}
              >
                Cadastrar
              </Button>
            )
          )}
        </div>

        <ThreadViewport lastMessageKey={last?.id ?? null}>
          {messages.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Nenhuma mensagem ainda. Escreva abaixo para começar a conversa.
            </p>
          ) : (
            <>
              {truncated && (
                <p className="pb-4 text-center text-xs text-muted-foreground">
                  Mostrando as {THREAD_MESSAGE_LIMIT} mensagens mais recentes.
                </p>
              )}
              <ol className="flex flex-col gap-1.5">
                {messages.map((message, index) => (
                  <MessageItem
                    key={message.id}
                    message={message}
                    previous={messages[index - 1]}
                    now={now}
                    showSender={chat.isGroup}
                  />
                ))}
              </ol>
            </>
          )}
        </ThreadViewport>

        <ConversationComposer chatId={chat.chatId} blocked={blocked} />
      </ConversationsShell>
    </div>
  );
}

/** Uma mensagem, precedida do separador de dia quando o dia vira. */
function MessageItem({
  message,
  previous,
  now,
  showSender,
}: {
  message: WhatsAppMessage;
  previous: WhatsAppMessage | undefined;
  now: Date;
  /** Em grupo, sem o nome de quem falou a conversa vira balão anônimo. */
  showSender: boolean;
}) {
  const sentAt = new Date(message.sent_at);
  const dayChanged = !previous || localDayKey(new Date(previous.sent_at)) !== localDayKey(sentAt);
  const fromMe = message.direction === "enviada";
  const Icon = MESSAGE_TYPE_ICONS[message.message_type];

  return (
    <>
      {dayChanged && (
        <li className="my-3 flex justify-center">
          <span className="rounded-full bg-background px-3 py-1 text-xs text-muted-foreground shadow-sm">
            {formatConversationDay(sentAt, now)}
          </span>
        </li>
      )}

      <li className={cn("flex", fromMe ? "justify-end" : "justify-start")}>
        <div
          className={cn(
            "max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm sm:max-w-[70%]",
            fromMe
              ? "rounded-br-sm bg-primary text-primary-foreground"
              : "rounded-bl-sm bg-background text-foreground"
          )}
        >
          {showSender && !fromMe && message.sender_name && (
            <p className="mb-0.5 text-xs font-medium text-primary">{message.sender_name}</p>
          )}

          {/* Mídia não é guardada (ver 0019): a tela diz o que era e, quando
              havia legenda, mostra a legenda. */}
          {message.message_type !== "texto" && (
            <p
              className={cn(
                "mb-0.5 flex items-center gap-1.5 text-xs font-medium",
                fromMe ? "text-primary-foreground/80" : "text-muted-foreground"
              )}
            >
              {Icon && <Icon className="size-3.5" aria-hidden />}
              {MESSAGE_TYPE_LABELS[message.message_type]}
            </p>
          )}

          {message.body && <p className="whitespace-pre-wrap break-words">{message.body}</p>}

          <p
            className={cn(
              "mt-0.5 flex items-center justify-end gap-1 text-[0.6875rem] tabular-nums",
              fromMe ? "text-primary-foreground/70" : "text-muted-foreground"
            )}
          >
            {formatMessageTime(sentAt)}
            {!fromMe && message.read_at && <CheckCheck className="size-3" aria-hidden />}
          </p>
        </div>
      </li>
    </>
  );
}
