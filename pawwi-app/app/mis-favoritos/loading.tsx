import PortalSkeleton from "@/components/PortalSkeleton";

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#FFF1EB]">
      <PortalSkeleton cards={2} />
    </div>
  );
}
