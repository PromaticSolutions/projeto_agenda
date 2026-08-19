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
};

export default nextConfig;
