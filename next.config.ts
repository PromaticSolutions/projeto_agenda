import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      /**
       * Upload de logo e banner (Conta) chega por Server Action em
       * multipart/form-data. O padrão do Next é 1 MB, insuficiente para uma
       * foto de celular.
       *
       * O teto real de arquivo é 4 MB, checado no servidor
       * (MAX_IMAGE_UPLOAD_BYTES em src/lib/validation.ts) e também pelo
       * bucket do Supabase (0007_storage_studio_media.sql). Os 5 MB aqui
       * deixam folga para o overhead de boundaries e headers do multipart,
       * que conta para este limite.
       */
      bodySizeLimit: "5mb",
    },
  },

  /**
   * Cabeçalhos de segurança em toda resposta.
   *
   * Nada aqui é exótico — é o mínimo que um app que coleta nome, telefone e
   * e-mail de terceiros deveria mandar, e que nem a Vercel nem o Next colocam
   * sozinhos.
   *
   * O que NÃO está aqui, de propósito: `Content-Security-Policy`. Uma CSP útil
   * neste app precisa de nonce por requisição (o Next injeta script inline) e
   * de uma lista de origens que inclui o Supabase e o Storage; escrita no
   * chute, ela quebra a página pública em produção sem aviso. Fica como
   * trabalho próprio, não como linha copiada.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Impede o navegador de "adivinhar" o tipo de um upload e executá-lo
          // como script — o bucket de logo/banner aceita imagem enviada pelo
          // dono do estúdio.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Sem isso, a página de agendamento de um estúdio pode ser embutida
          // em iframe num site de terceiro e usada para clickjacking.
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // O caminho `/[slug]` identifica o estúdio; mandá-lo inteiro para
          // qualquer domínio externo que a pessoa visite depois é vazamento
          // desnecessário.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // O produto não usa nenhuma das três. Negar por padrão evita que um
          // script de terceiro peça.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // HSTS só faz sentido em HTTPS, e é ignorado pelo navegador em
          // localhost — não atrapalha o desenvolvimento.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
