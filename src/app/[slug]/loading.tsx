import { Skeleton } from "@/components/ui/skeleton";

export default function StudioLoading() {
  return (
    <div className="flex flex-1 flex-col bg-blush-50">
      <div className="flex flex-col items-center gap-3 rounded-b-[2.5rem] bg-plum-900/10 px-4 pt-12 pb-16">
        <Skeleton className="size-20 rounded-full" />
        <Skeleton className="h-6 w-40" />
      </div>
      <div className="relative mx-auto -mt-9 flex w-full max-w-lg flex-1 flex-col gap-3 rounded-3xl bg-card p-5 shadow-xl shadow-plum-900/10 ring-1 ring-plum-900/5">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
