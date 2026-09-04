#!/usr/bin/env node
/**
 * Smoke test da integração com a Evolution API.
 *
 * Fala com a instância REAL configurada em .env.local e exercita o ciclo de
 * vida inteiro que o app usa: criar, pedir QR, ler estado, registrar webhook,
 * conferir número, enviar, desconectar, excluir. Serve para responder à
 * pergunta que teste unitário não responde — "o gateway desta VPS, nesta
 * versão, se comporta como o adaptador espera?".
 *
 * Roda contra uma instância DESCARTÁVEL (prefixo `smoke_`), nunca contra a de
 * um estúdio real, e a apaga no fim mesmo se algo falhar no meio.
 *
 *   node --env-file=.env.local scripts/whatsapp-smoke.mjs
 *
 * O que ele NÃO cobre, por não ser automatizável: a leitura do QR code no
 * aparelho. Isso exige um celular; o roteiro está no README.
 */

const base = process.env.EVOLUTION_API_URL?.replace(/\/+$/, "");
const key = process.env.EVOLUTION_API_KEY;

if (!base || !key) {
  console.error("Defina EVOLUTION_API_URL e EVOLUTION_API_KEY (use --env-file=.env.local).");
  process.exit(1);
}

const instance = `smoke_${Date.now()}`;
let passed = 0;
let failed = 0;

async function call(path, { method = "GET", body, timeoutMs = 20_000 } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { apikey: key, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: response.status, data };
}

function check(name, condition, detail) {
  if (condition) {
    passed++;
    console.log(`  ok    ${name}`);
  } else {
    failed++;
    console.log(`  FALHA ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

async function main() {
  section("Versão do gateway");
  const root = await call("/");
  check("responde na raiz", root.status === 200, `HTTP ${root.status}`);
  console.log(`        versão relatada: ${root.data?.version}`);
  check(
    "é a linha 2.3.x que o adaptador assume",
    String(root.data?.version ?? "").startsWith("2.3."),
    `veio ${root.data?.version}`
  );

  section("Criar instância");
  const created = await call("/instance/create", {
    method: "POST",
    body: { instanceName: instance, qrcode: true, integration: "WHATSAPP-BAILEYS" },
  });
  check("cria com 201", created.status === 201, `HTTP ${created.status}`);

  const duplicate = await call("/instance/create", {
    method: "POST",
    body: { instanceName: instance, qrcode: true, integration: "WHATSAPP-BAILEYS" },
  });
  // O adaptador trata 403 como sucesso em `ensureInstance`; se isso mudar de
  // código, duas abas do painel viram erro na tela.
  check("nome repetido devolve 403", duplicate.status === 403, `HTTP ${duplicate.status}`);

  section("QR code");
  const connect = await call(`/instance/connect/${instance}`);
  check("connect responde 200", connect.status === 200, `HTTP ${connect.status}`);
  const qr = connect.data?.base64 ?? connect.data?.qrcode?.base64;
  check("devolve QR em base64", typeof qr === "string" && qr.length > 100);
  check(
    "QR vem como data URL (o adaptador remove o prefixo)",
    typeof qr === "string" && qr.startsWith("data:image/")
  );

  section("Estado da conexão");
  const state = await call(`/instance/connectionState/${instance}`);
  check("connectionState responde 200", state.status === 200, `HTTP ${state.status}`);
  check(
    "traz instance.state",
    typeof state.data?.instance?.state === "string",
    JSON.stringify(state.data)
  );
  // A descoberta que motivou a correção do adaptador: esta resposta NÃO traz o
  // número. Se um dia trouxer, este check falha e a segunda chamada a
  // fetchInstances pode ser removida.
  check(
    "NÃO traz o número (por isso status() consulta fetchInstances)",
    state.data?.instance?.owner === undefined && state.data?.instance?.number === undefined
  );

  section("fetchInstances");
  const fetched = await call(`/instance/fetchInstances?instanceName=${instance}`);
  check("responde 200", fetched.status === 200, `HTTP ${fetched.status}`);
  const rows = Array.isArray(fetched.data) ? fetched.data : [];
  const row = rows.find((r) => r?.name === instance);
  check("devolve array com a instância pelo nome", Boolean(row), JSON.stringify(fetched.data)?.slice(0, 200));
  check(
    "tem o campo ownerJid (de onde sai o número pareado)",
    row ? "ownerJid" in row : false,
    row ? `campos: ${Object.keys(row).slice(0, 12).join(", ")}` : ""
  );

  section("Webhook");
  const webhook = await call(`/webhook/set/${instance}`, {
    method: "POST",
    body: {
      webhook: {
        enabled: true,
        url: "https://exemplo.invalido/api/webhooks/evolution",
        headers: { "x-timely-webhook-secret": "smoke" },
        byEvents: false,
        base64: false,
        events: ["QRCODE_UPDATED", "CONNECTION_UPDATE", "LOGOUT_INSTANCE", "REMOVE_INSTANCE"],
      },
    },
  });
  check("aceita o corpo aninhado em `webhook`", webhook.status === 201, `HTTP ${webhook.status}`);

  const webhookRead = await call(`/webhook/find/${instance}`);
  check("find confirma a URL gravada", webhookRead.data?.url?.includes("exemplo.invalido"));
  check(
    "guarda os eventos assinados",
    Array.isArray(webhookRead.data?.events) &&
      webhookRead.data.events.includes("CONNECTION_UPDATE")
  );
  check(
    "não assina MESSAGES_UPSERT (produto só envia)",
    !webhookRead.data?.events?.includes("MESSAGES_UPSERT")
  );

  section("Envio com a sessão fechada");
  // COMPORTAMENTO REAL DA 2.3.7, medido aqui: o gateway não devolve 4xx — ele
  // simplesmente NÃO RESPONDE (a chamada estoura o timeout). O importante é
  // que ele não aceita a mensagem: se aceitasse, o histórico diria "enviado"
  // para algo que ninguém recebeu.
  //
  // É por isso que `sendManualWhatsAppMessage` e o disparador conferem o
  // estado da conexão ANTES de chamar o envio, em vez de tentar e tratar o
  // erro: "tentar e ver" custaria 15s de espera por mensagem, e num lote de
  // 25 estouraria o orçamento de tempo da rota de cron.
  let sendOutcome;
  try {
    const send = await call(`/message/sendText/${instance}`, {
      method: "POST",
      body: { number: "5511934476935", text: "smoke test" },
      timeoutMs: 8_000,
    });
    sendOutcome = { kind: "http", status: send.status, data: send.data };
  } catch (cause) {
    sendOutcome = { kind: "timeout", detail: cause?.message ?? String(cause) };
  }
  check(
    "gateway NÃO aceita envio sem sessão (4xx ou sem resposta)",
    sendOutcome.kind === "timeout" || sendOutcome.status >= 400,
    sendOutcome.kind === "timeout"
      ? "sem resposta — confirma por que o app checa o estado antes de enviar"
      : `HTTP ${sendOutcome.status} — ${JSON.stringify(sendOutcome.data)?.slice(0, 160)}`
  );
  if (sendOutcome.kind === "timeout") {
    console.log("        (travou em vez de recusar — comportamento esperado na 2.3.7)");
  }

  section("Instância inexistente");
  const ghost = await call("/instance/connectionState/nao_existe_smoke_xyz");
  check("devolve 404 (tratado como 'desconectado')", ghost.status === 404, `HTTP ${ghost.status}`);

  section("Desconectar");
  const logout = await call(`/instance/logout/${instance}`, { method: "DELETE" });
  // A sessão nunca abriu, então a 2.3.7 responde 400 "is not connected" — o
  // adaptador tolera exatamente isso.
  check(
    "logout de sessão fechada devolve 400 (tolerado)",
    logout.status === 400 || logout.status === 200,
    `HTTP ${logout.status} — ${JSON.stringify(logout.data)?.slice(0, 160)}`
  );

  section("Excluir");
  const removed = await call(`/instance/delete/${instance}`, { method: "DELETE" });
  // O 200 é aceite, não conclusão: a 2.3.7 emite `remove.instance` e responde
  // na hora. Instância já fechada costuma ficar pendurada no banco da
  // Evolution — ver o comentário em deleteInstance.
  check("delete é aceito", removed.status === 200, `HTTP ${removed.status}`);

  const after = await call(`/instance/connectionState/${instance}`);
  // O delete é EVENTUALMENTE consistente: normalmente 404 imediato, mas
  // enquanto o socket do Baileys termina de cair a instância pode responder
  // 200 com estado vazio (o guard olha um mapa em memória e o cache do Redis,
  // não só a tabela). O invariante que interessa ao app não é o código HTTP e
  // sim: a sessão não pode continuar se dizendo aberta — porque é `open` que
  // libera o disparador a enviar. Estado vazio cai em `mapState(null)`, que é
  // "desconectado".
  const afterState = after.data?.instance?.state ?? null;
  check(
    "sessão não continua aberta após excluir",
    after.status === 404 || afterState !== "open",
    `HTTP ${after.status} — state: ${JSON.stringify(afterState)}`
  );
  if (after.status !== 404) {
    console.log(`        (ainda visível com state ${JSON.stringify(afterState)} — mapeado para desconectado)`);
  }
}

try {
  await main();
} catch (cause) {
  failed++;
  console.error("\nErro inesperado:", cause?.message ?? cause);
} finally {
  // Limpeza incondicional: instância órfã na Evolution consome memória (uma
  // sessão do WhatsApp Web viva) até alguém notar.
  await call(`/instance/delete/${instance}`, { method: "DELETE" }).catch(() => {});
  console.log(`\n${passed} ok, ${failed} falha(s) — instância de teste: ${instance}`);
  process.exit(failed > 0 ? 1 : 0);
}
