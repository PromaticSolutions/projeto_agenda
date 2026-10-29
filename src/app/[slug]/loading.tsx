import { Skeleton } from "@/components/ui/skeleton";

/** Mesmo esqueleto da página: faixa, logo, nome e a lista de serviços. */
export default function StudioLoading() {
  return (
    <div className="flex flex-1 flex-col bg-background">
      <Skeleton className="h-24 w-full rounded-none sm:h-32" />
      <div className="mx-auto w-full max-w-5xl px-4">
        <Skeleton className="-mt-10 size-20 rounded-full border-4 border-background" />
        <div className="mt-3 flex flex-col gap-2 border-b border-border pb-5">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="mt-8 flex max-w-2xl flex-col gap-4">
          <Skeleton className="h-5 w-48" />
          <div className="divide-y divide-border rounded-xl border border-border">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-4">
                <Skeleton className="size-2.5 rounded-full" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
