import { SkeletonCard } from "@/components/PortalSkeleton";

// Skeleton del home (header propio: logo + acciones + saludo).
export default function Loading() {
  return (
    <div className="min-h-screen relative font-sans">
      <header className="relative z-10 max-w-xl mx-auto px-6 pt-12 pb-4">
        <div className="flex items-center justify-between mb-5">
          <div className="h-7 w-20 rounded-lg bg-[#120A2B]/10 animate-pulse" />
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-[14px] bg-[#120A2B]/10 animate-pulse" />
            <div className="w-10 h-10 rounded-[14px] bg-[#120A2B]/10 animate-pulse" />
          </div>
        </div>
        <div className="space-y-2.5">
          <div className="h-2.5 w-24 rounded-full bg-[#120A2B]/10 animate-pulse" />
          <div className="h-11 w-52 rounded-2xl bg-[#120A2B]/10 animate-pulse" />
        </div>
      </header>
      <main className="relative z-10 max-w-xl mx-auto px-6 space-y-4 pb-10">
        <SkeletonCard lines={2} />
        <SkeletonCard lines={3} />
        <SkeletonCard lines={2} />
      </main>
    </div>
  );
}
