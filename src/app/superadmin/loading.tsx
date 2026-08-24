import { Skeleton } from "@/components/ui/skeleton";

/**
 * As telas do superadmin fazem várias leituras agregadas antes do primeiro
 * byte. O esqueleto reserva o espaço dos KPIs e dos gráficos para a tela não
 * pular de layout quando os números chegam.
 */
export default function SuperAdminLoading() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="space-y-2 border-b border-border pb-5">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-md" />
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-md" />
        <Skeleton className="h-64 rounded-md" />
      </div>
    </div>
  );
}
