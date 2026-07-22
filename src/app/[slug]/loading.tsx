import { Skeleton } from "@/components/ui/skeleton";

export default function StudioLoading() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-col items-center gap-3 px-4 py-10">
        <Skeleton className="size-16 rounded-full" />
        <Skeleton className="h-7 w-40" />
      </div>
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-3 px-4 py-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
