"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function OnboardingPreview({
  name,
  slug,
  brandColor,
  logoUrl,
  className,
}: {
  name: string;
  slug: string;
  brandColor: string;
  logoUrl: string;
  className?: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const [lastLogoUrl, setLastLogoUrl] = useState(logoUrl);
  if (logoUrl !== lastLogoUrl) {
    setLastLogoUrl(logoUrl);
    setImgFailed(false);
  }

  const showImg = logoUrl.trim().startsWith("http") && !imgFailed;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <p className="text-[0.7rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
        Prévia da sua página
      </p>
      <div className="overflow-hidden rounded-3xl bg-white shadow-xl shadow-plum-900/10 ring-1 ring-plum-900/10">
        <div
          className="flex flex-col items-center gap-2 px-4 py-8 text-center text-white transition-colors duration-200"
          style={{ backgroundColor: brandColor }}
        >
          {showImg ? (
            // eslint-disable-next-line @next/next/no-img-element -- prévia de uma URL externa informada pelo usuário
            <img
              src={logoUrl}
              alt=""
              onError={() => setImgFailed(true)}
              className="size-12 rounded-full border-2 border-white/40 object-cover"
            />
          ) : (
            <span className="flex size-12 items-center justify-center rounded-full bg-white/15 font-heading text-lg font-semibold">
              {(name.trim() || "E").slice(0, 1).toUpperCase()}
            </span>
          )}
          <p className="font-heading text-sm font-semibold">{name.trim() || "Nome do estúdio"}</p>
        </div>
        <div className="bg-blush-50 px-4 py-3">
          <p className="truncate text-[11px] text-muted-foreground">
            agenda-online.app/{slug.trim() || "seu-link"}
          </p>
        </div>
      </div>
    </div>
  );
}
