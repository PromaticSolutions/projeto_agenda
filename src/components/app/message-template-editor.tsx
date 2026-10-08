"use client";

import { useRef, useState, type ClipboardEvent, type MouseEvent } from "react";
import { Plus } from "lucide-react";

export interface TemplateToken {
  /** O que fica gravado no texto: `{cliente}`. Nunca aparece na tela. */
  marker: string;
  /** O que a pessoa lê: "nome da cliente". */
  label: string;
  /** O que o marcador vira no envio, mostrado ao parar o cursor sobre o botão. */
  example: string;
}

/**
 * Campo de mensagem em que os marcadores aparecem como etiquetas.
 *
 * O valor que entra e sai continua sendo o texto com `{cliente}` — é o que o
 * banco guarda e o que o disparador substitui. A conversão para etiqueta
 * acontece só aqui dentro, na fronteira com a tela. Nenhuma camada abaixo
 * sabe que existe etiqueta.
 *
 * É um `contenteditable`, e não um `<textarea>`, por um motivo que não tem
 * contorno: textarea só desenha texto puro, então `{cliente}` apareceria do
 * jeito que está — e essa string é exatamente o que a dona do salão não
 * entende. A etiqueta precisa ser um elemento com fundo, cor e um × para
 * remover, e isso exige markup dentro do campo.
 */
export function MessageTemplateEditor({
  value,
  onChange,
  revision,
  tokens,
  id,
  name,
  labelledBy,
  describedBy,
}: {
  value: string;
  onChange: (next: string) => void;
  /**
   * Muda quando o texto é trocado DE FORA (aplicar um modelo pronto). É o que
   * manda o campo se redesenhar.
   *
   * O campo é deliberadamente não-controlado enquanto a pessoa digita: se o
   * HTML fosse recalculado a cada tecla, o cursor voltaria para o começo a
   * cada letra — o React recria os nós e o navegador perde a posição.
   */
  revision: number;
  tokens: readonly TemplateToken[];
  id: string;
  name: string;
  labelledBy?: string;
  describedBy?: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [seed, setSeed] = useState(() => ({ revision, html: toHtml(value, tokens) }));

  if (seed.revision !== revision) {
    setSeed({ revision, html: toHtml(value, tokens) });
  }

  function emitChange() {
    const el = editorRef.current;
    if (el) onChange(serialize(el));
  }

  function insertToken(token: TemplateToken) {
    const el = editorRef.current;
    if (!el) return;
    el.focus();

    const selection = window.getSelection();
    const current = selection?.rangeCount ? selection.getRangeAt(0) : null;
    // Sem cursor dentro do campo (primeiro clique no botão, ou foco em outro
    // lugar da página), a etiqueta vai para o fim — nunca para o começo, que
    // é onde um range zerado cairia.
    const range =
      current && el.contains(current.commonAncestorContainer)
        ? current
        : collapsedRangeAtEnd(el);

    range.deleteContents();
    const chip = chipNode(token);
    range.insertNode(chip);

    // Âncora vazia logo depois: sem ela o cursor fica "dentro" da etiqueta e a
    // próxima letra digitada entraria no meio do rótulo.
    const anchor = document.createTextNode("");
    chip.parentNode?.insertBefore(anchor, chip.nextSibling);

    const after = document.createRange();
    after.setStart(anchor, 0);
    after.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(after);

    emitChange();
  }

  function handleMouseDown(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement | null;
    const remove = target?.closest("[data-remove]");
    if (!remove) return;
    // preventDefault antes de mexer no DOM: o clique não pode virar seleção de
    // texto num nó que está prestes a sumir.
    event.preventDefault();
    remove.closest("[data-marker]")?.remove();
    emitChange();
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    const text = event.clipboardData.getData("text/plain");
    event.preventDefault();
    if (!text) return;
    // `insertText` preserva o desfazer nativo (Ctrl+Z), que uma inserção
    // manual por Range zeraria. Se o navegador recusar, cai no caminho manual.
    if (document.execCommand("insertText", false, text)) return;

    const selection = window.getSelection();
    const range = selection?.rangeCount
      ? selection.getRangeAt(0)
      : collapsedRangeAtEnd(event.currentTarget);
    range.deleteContents();
    range.insertNode(document.createTextNode(text));
    range.collapse(false);
    emitChange();
  }

  function handleBlur() {
    const el = editorRef.current;
    if (!el || !hasRawMarker(el, tokens)) return;
    // Mensagem colada de um caderno ou de outro sistema pode trazer
    // `{cliente}` escrito à mão. Ao sair do campo ela vira etiqueta, em vez de
    // ficar como texto cru que só o envio entende.
    el.innerHTML = toHtml(serialize(el), tokens);
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div
        key={seed.revision}
        ref={editorRef}
        id={id}
        role="textbox"
        aria-multiline="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        contentEditable
        suppressContentEditableWarning
        onInput={emitChange}
        onBlur={handleBlur}
        onPaste={handlePaste}
        onMouseDown={handleMouseDown}
        dangerouslySetInnerHTML={{ __html: seed.html }}
        className="min-h-28 w-full whitespace-pre-wrap break-words rounded-lg border border-input bg-transparent px-3 py-2.5 text-sm leading-7 text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />

      {/* O valor vai para a Server Action pelo campo escondido, no formato que
          o banco guarda. A action e o schema não mudaram por causa da tela. */}
      <input type="hidden" name={name} value={value} />

      <div className="flex flex-wrap gap-1.5">
        {tokens.map((token) => (
          <button
            key={token.marker}
            type="button"
            // O botão não pode roubar o foco do campo: sem isto o cursor some
            // e toda etiqueta cairia no fim do texto.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => insertToken(token)}
            title={`Vira "${token.example}" na mensagem enviada`}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Plus className="size-3 text-muted-foreground" aria-hidden />
            {token.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Conversão entre o texto guardado e o que aparece na tela                   */
/* -------------------------------------------------------------------------- */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function markerPattern(tokens: readonly TemplateToken[]): RegExp {
  return new RegExp(tokens.map((t) => t.marker.replace(/[{}]/g, "\\$&")).join("|"), "g");
}

/** HTML da etiqueta. `contenteditable="false"` é o que a faz apagar inteira. */
function chipMarkup(token: TemplateToken): string {
  return (
    `<span contenteditable="false" data-marker="${escapeHtml(token.marker)}"` +
    ` class="mx-px inline-flex select-none items-center gap-0.5 rounded-md bg-primary/10 px-1.5 py-0.5 text-[0.8125rem] font-medium text-primary dark:text-violet-300">` +
    escapeHtml(token.label) +
    `<span data-remove="1" role="button" aria-label="Remover ${escapeHtml(token.label)}"` +
    ` class="cursor-pointer px-0.5 leading-none opacity-50 hover:opacity-100">&times;</span>` +
    `</span>`
  );
}

function chipNode(token: TemplateToken): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = chipMarkup(token);
  return host.firstElementChild as HTMLElement;
}

/** Texto guardado → HTML do campo. */
function toHtml(value: string, tokens: readonly TemplateToken[]): string {
  const byMarker = new Map(tokens.map((token) => [token.marker, token]));
  // Escapar primeiro é seguro: o escape não mexe em `{` nem `}`, então os
  // marcadores continuam inteiros para a troca seguinte.
  return escapeHtml(value)
    .replace(markerPattern(tokens), (marker) => {
      const token = byMarker.get(marker);
      return token ? chipMarkup(token) : marker;
    })
    .replace(/\n/g, "<br>");
}

/**
 * HTML do campo → texto guardado.
 *
 * Cada navegador tem a sua forma de representar uma quebra de linha num
 * `contenteditable` (o Chrome embrulha em `<div>`, o Firefox solta um `<br>`),
 * e as duas precisam virar o mesmo `\n` — senão a mensagem sai com a
 * formatação de quem a escreveu, não com a que foi vista na tela.
 */
function serialize(root: HTMLElement): string {
  let out = "";

  const visit = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        out += child.textContent ?? "";
        continue;
      }
      if (!(child instanceof HTMLElement)) continue;

      const marker = child.dataset.marker;
      if (marker) {
        // O rótulo visível e o × não entram no texto: a etiqueta vale pelo
        // marcador e por mais nada.
        out += marker;
        continue;
      }

      if (child.tagName === "BR") {
        // `<br>` no fim de um bloco é só o recheio que o navegador põe para a
        // linha vazia ter altura; contá-lo dobraria toda quebra de linha.
        if (node !== root && child === node.lastChild) continue;
        out += "\n";
        continue;
      }

      if (child.tagName === "DIV" || child.tagName === "P") {
        if (out !== "") out += "\n";
      }
      visit(child);
    }
  };

  visit(root);
  return out;
}

/** Há marcador escrito como texto solto, fora de uma etiqueta? */
function hasRawMarker(root: HTMLElement, tokens: readonly TemplateToken[]): boolean {
  const clone = root.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("[data-marker]").forEach((chip) => chip.remove());
  const text = clone.textContent ?? "";
  return tokens.some((token) => text.includes(token.marker));
}

function collapsedRangeAtEnd(el: HTMLElement): Range {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  return range;
}
