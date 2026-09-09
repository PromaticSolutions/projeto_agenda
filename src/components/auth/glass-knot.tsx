"use client";

import { useEffect, useRef } from "react";
/* Só os tipos: `import type` é apagado na compilação, então o `three` continua
   entrando exclusivamente pelo import dinâmico lá embaixo. */
import type * as Three from "three";
import { cn } from "@/lib/utils";

/**
 * A marca do produto é um nó de toro em vidro, renderizado ao vivo em WebGL —
 * o mesmo objeto aparece pequeno ao lado do nome ({@link GlassKnotMark}) e
 * grande ao fundo de toda superfície plum ({@link GlassKnotBackdrop}): as
 * telas de autenticação e, na landing, o hero e as seções escuras.
 *
 * Cada fundo é um <canvas> independente, com o próprio contexto WebGL, e cada
 * um mede a PRÓPRIA caixa. Compartilhar um renderizador entre seções exigiria
 * um canvas fixo por cima do layout inteiro, recortado por seção — o que
 * amarraria cada peça à posição das outras e quebraria na primeira rolagem.
 * O preço dessa independência é o laço de animação: ver `setActive`, que
 * garante que só o que está em tela gasta quadro.
 *
 * O `three` é carregado por import dinâmico DENTRO do efeito: mesmo depois do
 * tree-shaking é a maior dependência do projeto, e assim ela não entra no
 * bundle inicial da rota nem roda no servidor, onde não existe WebGL. Enquanto
 * ele não chega — e em aparelho sem WebGL, onde a criação do renderizador
 * lança — o canvas fica transparente. O layout já está no lugar nos dois
 * casos, então nada salta quando (ou se) a peça aparece.
 */

/* Tokens da marca repetidos aqui porque nem o WebGL nem o canvas 2D leem
   custom properties do CSS. Espelham --plum-900, --violet-600, --violet-500 e
   --magenta em globals.css; se um mudar lá, muda aqui também. */
const PLUM_900 = "#241238";
const VIOLET_600 = "109, 58, 212";
const VIOLET_500 = "139, 92, 246";
const MAGENTA = "198, 47, 134";

/** Distância da câmera. O plano de fundo fica em z=0 e o nó à frente dele, em
 *  {@link KNOT_Z}, para que a refração tenha profundidade real para deslocar. */
const CAMERA_Z = 5;
const KNOT_Z = 2.2;

/** Fração da menor dimensão visível ocupada pelo nó no fundo. Acima de ~0.1
 *  ele começa a disputar atenção com o formulário. */
const BACKDROP_KNOT_RATIO = 0.075;

type KnotSetup = {
  canvas: HTMLCanvasElement;
  /** Fundo: opaco, com plano de fundo próprio, seguindo o ponteiro.
   *  Marca: canvas pequeno e transparente, só com a rotação. */
  fullscreen: boolean;
  /** Multiplicador sobre {@link BACKDROP_KNOT_RATIO}. Existe porque a peça
   *  agora ocupa recortes de alturas muito diferentes: a tela inteira do
   *  login, o hero, uma faixa de conteúdo no meio da landing. O mesmo valor
   *  em todos deixaria o nó dominante numa e invisível na outra. */
  scale: number;
  /** Onde a peça fica, em fração da caixa (0..1, canto superior esquerdo na
   *  origem). O nó E o halo que ele refrata andam JUNTOS para cá — mover só um
   *  dos dois tira do vidro a fonte de luz que ele deforma, e o cristal vira
   *  silhueta cinza. Dois números soltos, e não um objeto: um `{x, y}` como
   *  prop trocaria de identidade a cada render e remontaria o WebGL junto. */
  focusX: number;
  focusY: number;
  /** O mesmo ponto, para quando a caixa está em RETRATO — o celular, onde a
   *  seção vira uma coluna só e o vazio muda de lugar junto. Sem isto, um
   *  ponto escolhido para a folga entre duas colunas cai em cima do texto
   *  assim que as colunas viram uma. */
  portraitX: number;
  portraitY: number;
};

/**
 * O que a montagem devolve. `setActive` liga e desliga o laço de animação sem
 * derrubar o contexto WebGL — recriar o contexto a cada rolagem custaria o
 * mapa de ambiente inteiro de novo, que é a parte cara da montagem.
 */
type KnotHandle = {
  dispose: () => void;
  setActive: (active: boolean) => void;
};

/**
 * Monta a cena e devolve a função que a desfaz. Fora do React de propósito:
 * nada aqui depende de estado ou de re-render, e manter o ciclo de vida do
 * WebGL num único par montar/desmontar evita vazar contexto gráfico.
 */
async function mountGlassKnot({
  canvas,
  fullscreen,
  scale,
  focusX,
  focusY,
  portraitX,
  portraitY,
}: KnotSetup): Promise<KnotHandle> {
  const THREE = await import("three");
  const { RoomEnvironment } = await import("three/addons/environments/RoomEnvironment.js");

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    // A marca flutua sobre o fundo da página; o fundo pinta o próprio plum.
    alpha: !fullscreen,
  });
  /* Dois pesos opostos.
     A marca tem 40px de lado: renderizar a 3× e deixar o navegador reduzir é
     supersampling barato, e sem ele as bordas do nó viram um borrão.
     O fundo ocupa a janela inteira e a refração redesenha a cena num alvo à
     parte a cada quadro — o custo cresce com o quadrado da densidade. Teto em
     1.5 em vez de 2: num objeto sem aresta viva a diferença não aparece, e
     num celular mediano é o que separa 60 quadros de um login que esquenta. */
  renderer.setPixelRatio(
    fullscreen ? Math.min(window.devicePixelRatio, 1.5) : 3
  );

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.z = CAMERA_Z;

  /* O vidro não tem cor própria: tudo que se vê nele é ambiente refletido.
     Sem um envMap ele sairia como uma silhueta cinza. */
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = environment.texture;

  /* O ambiente sozinho dá volume, mas não dá aresta. Estas duas luzes existem
     só pelo brilho especular: são elas que desenham o contorno do nó contra o
     plum e fazem a marca de 40px ainda ter forma legível. */
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
  keyLight.position.set(2, 3, 4);
  const rimLight = new THREE.DirectionalLight(0xc9a8ff, 1.6);
  rimLight.position.set(-3, -2, 1);
  scene.add(keyLight, rimLight);

  const knot = new THREE.Mesh(
    /* Nó (2,3) — o trevo da marca. Os segmentos ao longo do tubo são o que
       define a silhueta: abaixo de ~300 o facetamento aparece nas bordas, que
       é justamente onde a dispersão concentra o brilho. A marca, com 40px, se
       contenta com bem menos. */
    new THREE.TorusKnotGeometry(1, 0.3, fullscreen ? 300 : 192, 48, 2, 3),
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0,
      /* Zero, não "quase zero": qualquer rugosidade borra o que passa pelo
         vidro, e é justamente o desenho nítido do fundo deslocado que faz o
         olho ler cristal em vez de plástico colorido. */
      roughness: 0,
      transmission: 1,
      thickness: 0.7,
      ior: 1.45,
      /* Separa os canais de cor por índice de refração — é o que produz as
         franjas coloridas nas bordas, e o que faz o objeto parecer cristal
         e não plástico transparente. */
      dispersion: 5,
      envMapIntensity: 1.6,
      toneMapped: false,
      /* No fundo, o vidro NÃO leva cor própria: tingir o corpo foi o que mais
         o aproximou de borracha roxa. Toda a cor vem do que está atrás dele.
         Na marca é o contrário. Sem plano atrás, o three usa branco a meia
         opacidade como fundo da refração, e um cristal branco de 40px some
         sobre o claro do onboarding. Tingir de violeta dá à peça um valor
         próprio, que se destaca tanto do plum quanto do cinza-claro — e num
         tamanho desses "cristal violeta" lê melhor do que vidro incolor. */
      ...(fullscreen
        ? {}
        : {
            attenuationColor: new THREE.Color(0x8b5cf6),
            attenuationDistance: 0.6,
          }),
    })
  );
  scene.add(knot);

  /* ---- Plano de fundo (só na versão de tela cheia) -----------------------
     O vidro precisa de algo ATRÁS para deslocar; contra um fundo chapado ele
     some. Este plano é o que a tipografia gigante era na referência: um
     desenho discreto no aberto, que a refração amplia em faixas dentro do nó.
     Ver `drawBackdrop` para o que ele carrega. */
  let backdropPlane: Three.Mesh<Three.PlaneGeometry, Three.MeshBasicMaterial> | null = null;
  let backdropTexture: Three.CanvasTexture | null = null;
  const backdropCanvas = fullscreen ? document.createElement("canvas") : null;

  if (fullscreen && backdropCanvas) {
    scene.background = new THREE.Color(PLUM_900);
    knot.position.z = KNOT_Z;
    backdropPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ toneMapped: false })
    );
    scene.add(backdropPlane);
  } else {
    // Sem plano atrás, a marca fica só com o nó — grande dentro do próprio
    // quadro, com uma folga que a rotação nunca chega a estourar.
    knot.scale.setScalar(1.3);
  }

  function drawBackdrop(width: number, height: number) {
    if (!backdropCanvas) return;
    const ctx = backdropCanvas.getContext("2d");
    if (!ctx) return;

    /* Resolução propositalmente baixa: são só degradês, e a textura ainda
       passa pela refração antes de chegar à tela. */
    const w = Math.min(width, 1024);
    const h = Math.max(1, Math.round((w * height) / width));
    backdropCanvas.width = w;
    backdropCanvas.height = h;

    ctx.fillStyle = PLUM_900;
    ctx.fillRect(0, 0, w, h);

    // Camada de cor: paradas alternando cor e transparência num único
    // degradê, em vez de formas desenhadas — sai suave sem custo de blur.
    // É o que dá ao plum chapado uma variação de tom em toda a tela.
    const bands = ctx.createLinearGradient(0, h, w, 0);
    bands.addColorStop(0.0, `rgba(${VIOLET_600}, 0)`);
    bands.addColorStop(0.18, `rgba(${VIOLET_600}, 0.34)`);
    bands.addColorStop(0.34, `rgba(${VIOLET_600}, 0)`);
    bands.addColorStop(0.52, `rgba(${MAGENTA}, 0.28)`);
    bands.addColorStop(0.7, `rgba(${MAGENTA}, 0)`);
    bands.addColorStop(0.86, `rgba(${VIOLET_500}, 0.2)`);
    bands.addColorStop(1.0, `rgba(${VIOLET_500}, 0)`);
    ctx.fillStyle = bands;
    ctx.fillRect(0, 0, w, h);

    /* Halo atrás do nó. É a fonte de luz que a refração vai deslocar: contra
       um fundo uniformemente escuro o vidro não teria o que dobrar e sumiria. */
    const halo = ctx.createRadialGradient(
      w * atX,
      h * atY,
      0,
      w * atX,
      h * atY,
      Math.max(w, h) * 0.42
    );
    halo.addColorStop(0, "rgba(226, 210, 255, 0.3)");
    halo.addColorStop(0.4, `rgba(${VIOLET_500}, 0.22)`);
    halo.addColorStop(1, `rgba(${VIOLET_500}, 0)`);
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);

    /* Listras diagonais — a peça central deste fundo.
       Degradê sozinho é liso demais: o vidro deslocaria uma cor uniforme e o
       resultado leria como plástico. São as ARESTAS destas faixas que, dobradas
       pela refração, viram as barras contrastadas dentro do nó — o mesmo papel
       que a tipografia gigante cumpria na referência.
       Elas vivem numa camada à parte porque precisam ser recortadas por uma
       máscara suave em volta do nó: em contraste alto no miolo, para o vidro
       ter o que desenhar, e dissolvidas antes de chegarem ao formulário, para
       o fundo não virar papel de parede listrado. */
    const stripes = document.createElement("canvas");
    stripes.width = w;
    stripes.height = h;
    const sctx = stripes.getContext("2d");
    if (sctx) {
      sctx.translate(w / 2, h / 2);
      sctx.rotate(-Math.PI / 5);
      // Blur tira o serrilhado das diagonais; onde `ctx.filter` não existe
      // (Safari antigo) as faixas só saem mais duras.
      if ("filter" in sctx) sctx.filter = `blur(${Math.max(2, Math.round(w * 0.006))}px)`;
      const span = Math.hypot(w, h);
      const stripe = span / 11;
      for (let i = -6; i <= 6; i += 1) {
        const light = i % 2 === 0;
        sctx.fillStyle = light ? "rgba(233, 224, 255, 0.66)" : "rgba(10, 3, 18, 0.85)";
        sctx.fillRect(-span / 2, i * stripe * 1.5, span, stripe * (light ? 0.9 : 0.75));
      }
      sctx.setTransform(1, 0, 0, 1, 0, 0);
      sctx.filter = "none";
      sctx.globalCompositeOperation = "destination-in";
      const mask = sctx.createRadialGradient(
        w * atX,
        h * atY,
        0,
        w * atX,
        h * atY,
        Math.max(w, h) * 0.24
      );
      /* O raio mal ultrapassa a silhueta do nó: o que vaza para fora lê como
         um facho de luz atrás da peça, não como listra no formulário. */
      mask.addColorStop(0, "rgba(0, 0, 0, 1)");
      mask.addColorStop(0.6, "rgba(0, 0, 0, 0.45)");
      mask.addColorStop(1, "rgba(0, 0, 0, 0)");
      sctx.fillStyle = mask;
      sctx.fillRect(0, 0, w, h);
      ctx.drawImage(stripes, 0, 0);
    }

    // Vinheta: escurece as bordas, onde ficam o painel de texto e o cartão.
    const vignette = ctx.createRadialGradient(
      w * 0.5,
      h * 0.5,
      Math.min(w, h) * 0.25,
      w * 0.5,
      h * 0.5,
      Math.max(w, h) * 0.75
    );
    vignette.addColorStop(0, "rgba(36, 18, 56, 0)");
    vignette.addColorStop(1, "rgba(20, 9, 32, 0.85)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);

    backdropTexture?.dispose();
    backdropTexture = new THREE.CanvasTexture(backdropCanvas);
    backdropTexture.colorSpace = THREE.SRGBColorSpace;
    backdropTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    if (backdropPlane) {
      backdropPlane.material.map = backdropTexture;
      backdropPlane.material.needsUpdate = true;
    }
  }

  /** Se o laço de animação está correndo. Ver `setActive`. */
  let running = false;

  /* O ponto em vigor. `resize` escolhe entre paisagem e retrato e `drawBackdrop`
     lê daqui, para que o halo e o nó nunca saiam de sincronia. */
  let atX = focusX;
  let atY = focusY;

  /** Reajusta câmera, renderizador e escala do nó ao tamanho atual do canvas. */
  function resize(redrawBackdrop: boolean) {
    // Retrato é a caixa mais alta que larga — a mesma medida que decide se o
    // nó é limitado pela largura ou pela altura, logo abaixo.
    const portrait = (canvas.clientHeight || 1) > (canvas.clientWidth || 1);
    atX = portrait ? portraitX : focusX;
    atY = portrait ? portraitY : focusY;
    /* A MEDIDA É A DO CANVAS, nos dois modos — não a da janela.
       O buffer de desenho é esticado para caber na caixa CSS do elemento, então
       medir a janela só dava certo enquanto o único fundo existente ocupava a
       tela inteira. Numa seção mais baixa que a janela, o nó saía achatado na
       horizontal. Com o elemento como referência a proporção fecha em qualquer
       recorte, e é o que permite a mesma peça no hero e no meio da página. */
    const width = canvas.clientWidth || 1;
    const height = canvas.clientHeight || 1;

    // `false`: não mexer no style do canvas — quem manda no tamanho em CSS é
    // o layout (inset-0 no fundo, size-* na marca).
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    if (fullscreen) {
      const visibleHeight =
        2 * CAMERA_Z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const visibleWidth = visibleHeight * camera.aspect;
      backdropPlane?.scale.set(visibleWidth, visibleHeight, 1);
      knot.scale.setScalar(
        Math.min(visibleWidth, visibleHeight) * BACKDROP_KNOT_RATIO * scale
      );

      /* O nó vive em {@link KNOT_Z}, mais PERTO da câmera que o plano de
         fundo — então o pedaço de mundo visível na altura dele é menor que o
         do plano, e converter a fração da tela com o frustum do fundo jogaria
         a peça para fora do ponto. Daí a medida própria. */
      const knotHeight =
        2 * (CAMERA_Z - KNOT_Z) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      knot.position.x = knotHeight * camera.aspect * (atX - 0.5);
      knot.position.y = knotHeight * (0.5 - atY);

      if (redrawBackdrop) drawBackdrop(width, height);
    }

    /* Trocar de tamanho descarta o conteúdo do buffer. Com o laço correndo o
       próximo quadro já repõe; parado não há próximo quadro, e o canvas ficaria
       em branco depois de girar o celular ou arrastar a janela. Vale para quem
       pediu menos movimento e também para a seção que foi redimensionada
       enquanto estava fora da tela. */
    if (!running) renderer.render(scene, camera);
  }

  /* Ponteiro em coordenadas normalizadas (-1..1) DENTRO do canvas, só no
     fundo: é ele que transforma a peça de enfeite em algo que responde a quem
     está lendo. Relativo ao elemento, e não à janela, para que cada seção
     reaja ao ponteiro sobre ela mesma — normalizar pela janela faria o nó do
     meio da página inclinar por causa de um cursor que está longe dele.
     O `return` antecipado é o que mantém a leitura de layout restrita à seção
     que está de fato animando. */
  const pointer = { x: 0, y: 0 };
  const handlePointerMove = (event: PointerEvent) => {
    if (!running) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
  };

  /* `Timer` e não `Clock` (que o three 0.185 marca como obsoleto): ligado ao
     document, ele ignora o tempo em que a aba ficou escondida, então voltar
     para a aba não faz a peça saltar meia volta de uma vez. */
  const timer = new THREE.Timer();
  timer.connect(document);

  function render() {
    timer.update();
    const t = timer.getElapsed();
    knot.rotation.x = t * 0.35 + pointer.y * 0.15;
    knot.rotation.y = t * 0.5 + pointer.x * 0.2;
    renderer.render(scene, camera);
  }

  if (reducedMotion) {
    /* Quem pediu menos movimento recebe a peça parada numa pose de três
       quartos, que mostra o nó por inteiro. Definida ANTES do primeiro
       `resize`, que é quem desenha o único quadro. */
    knot.rotation.set(0.6, 0.4, 0);
  }

  resize(true);

  let resizeTimer: ReturnType<typeof setTimeout> | undefined;
  /* Um ResizeObserver no canvas serve os dois modos agora que a medida saiu da
     janela. Ele cobre o que `window.onresize` cobria e mais o que ela não via:
     uma seção que muda de altura porque o carrossel trocou de slide ou porque
     uma pergunta do FAQ abriu. */
  const observer = new ResizeObserver(() => {
    // Reenquadra a cada evento (barato) e só redesenha a textura do fundo
    // quando o arrasto para — redesenhar a cada pixel trava o redimensionar.
    resize(false);
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => resize(true), 150);
  });
  observer.observe(canvas);

  if (fullscreen && !reducedMotion) {
    window.addEventListener("pointermove", handlePointerMove);
  }

  /**
   * Liga e desliga o laço. Quem chama é o hook, a partir do que o
   * IntersectionObserver diz — com uma instância por seção roxa, deixar as três
   * girando somaria três passagens de refração por quadro para desenhar duas
   * delas fora da vista.
   */
  const setActive = (active: boolean) => {
    // Sem movimento não há laço para pausar: a pose única já foi desenhada.
    if (reducedMotion || active === running) return;
    running = active;
    renderer.setAnimationLoop(active ? render : null);
  };

  const dispose = () => {
    renderer.setAnimationLoop(null);
    running = false;
    timer.disconnect();
    clearTimeout(resizeTimer);
    window.removeEventListener("pointermove", handlePointerMove);
    observer.disconnect();

    knot.geometry.dispose();
    knot.material.dispose();
    backdropPlane?.geometry.dispose();
    backdropPlane?.material.dispose();
    backdropTexture?.dispose();
    environment.dispose();
    pmrem.dispose();
    renderer.dispose();
  };

  return { dispose, setActive };
}

function useGlassKnot(
  fullscreen: boolean,
  scale: number,
  focusX: number,
  focusY: number,
  portraitX: number,
  portraitY: number
) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    let handle: KnotHandle | null = null;
    let cancelled = false;
    let onScreen = false;

    // "Girando": em tela e com a aba à frente. É a mesma chave do
    // `landing/agenda-preview.tsx` — um laço que ninguém vê é bateria gasta.
    const sync = () => handle?.setActive(onScreen && !document.hidden);

    /* As DUAS condições para montar: em tela e com tamanho. Nenhuma sozinha
       basta — um elemento pode estar na vista e ainda medir zero (o painel de
       apresentação do login enquanto o breakpoint não vira), e pode ter
       tamanho estando a três seções de distância. Montar sem tamanho gastaria
       um contexto WebGL e um mapa de ambiente para desenhar em canvas nenhum;
       montar fora da vista gastaria os dois adiantado, em celular, que é onde
       sobra menos fôlego. */
    let started = false;
    const maybeStart = () => {
      if (started || cancelled || !onScreen || canvas.clientWidth === 0) return;
      started = true;
      mountGlassKnot({ canvas, fullscreen, scale, focusX, focusY, portraitX, portraitY })
        .then((mounted) => {
          // O efeito pode ter sido desfeito enquanto o `three` carregava; sem
          // isto o contexto WebGL ficaria órfão a cada navegação.
          if (cancelled) mounted.dispose();
          else {
            handle = mounted;
            sync();
          }
        })
        .catch(() => {
          // Sem WebGL não há peça 3D — e nada na tela depende dela.
        });
    };

    /* A margem adianta a montagem o suficiente para a peça já estar girando
       quando a seção encosta na tela, em vez de aparecer parada e ganhar
       movimento um quadro depois. */
    const visibility = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        maybeStart();
        sync();
      },
      { rootMargin: "200px" }
    );
    visibility.observe(canvas);

    // O outro lado da condição: o elemento ganhar tamanho depois de já estar
    // na vista. Depois de montado quem cuida do tamanho é o próprio `resize`.
    const sizing = new ResizeObserver(() => {
      maybeStart();
      if (started) sizing.disconnect();
    });
    sizing.observe(canvas);

    document.addEventListener("visibilitychange", sync);

    return () => {
      cancelled = true;
      visibility.disconnect();
      sizing.disconnect();
      document.removeEventListener("visibilitychange", sync);
      handle?.dispose();
    };
  }, [fullscreen, scale, focusX, focusY, portraitX, portraitY]);

  return ref;
}

/**
 * Fundo de uma superfície plum: o nó em tamanho grande, seguindo o ponteiro,
 * sobre o degradê que ele refrata.
 *
 * O canvas é `absolute inset-0`, então quem define o recorte é o elemento que
 * o contém — que precisa ser `relative` e, quase sempre, `overflow-hidden`. O
 * conteúdo da seção vem depois, em `relative z-10`.
 */
export function GlassKnotBackdrop({
  className,
  scale = 1,
  focusX = 0.5,
  focusY = 0.46,
  portraitX = focusX,
  portraitY = focusY,
}: {
  className?: string;
  /** Tamanho do nó em relação ao padrão. Ver {@link KnotSetup.scale}. */
  scale?: number;
  /** Onde a peça fica na seção, em fração da caixa. Ver {@link KnotSetup.focusX}. */
  focusX?: number;
  focusY?: number;
  /** O ponto para caixas em retrato. Sem valor, repete o de paisagem — que é o
   *  certo para o hero e para o login, onde a composição só muda de proporção,
   *  não de arranjo. */
  portraitX?: number;
  portraitY?: number;
}) {
  const ref = useGlassKnot(true, scale, focusX, focusY, portraitX, portraitY);
  return (
    <canvas
      ref={ref}
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 block size-full", className)}
    />
  );
}

/** A marca ao lado do nome — o mesmo objeto do fundo, em miniatura. */
export function GlassKnotMark({ className }: { className?: string }) {
  const ref = useGlassKnot(false, 1, 0.5, 0.5, 0.5, 0.5);
  return (
    <canvas
      ref={ref}
      aria-hidden
      className={cn("block size-10 shrink-0", className)}
    />
  );
}
