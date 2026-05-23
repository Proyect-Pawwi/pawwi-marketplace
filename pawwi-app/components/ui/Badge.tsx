import { type HTMLAttributes } from "react";

type BadgeVariant =
  | "verified"   // Pawwi verificado
  | "service"    // chip de servicio (Daycare, Nightcare, etc.)
  | "status-confirmed"
  | "status-active"
  | "status-completed"
  | "status-cancelled"
  | "status-pending"
  | "new"        // "Nuevo Pawwer"
  | "default";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  verified: "bg-blue-ice/20 text-[#2a6496] border border-blue-ice",
  service: "bg-plum/30 text-midnight border border-plum",
  "status-confirmed": "bg-blue-ice/20 text-[#2a6496]",
  "status-active": "bg-green-100 text-green-700",
  "status-completed": "bg-[#ede9fe] text-[#5b21b6]",
  "status-cancelled": "bg-red-100 text-red-600",
  "status-pending": "bg-midnight/8 text-midnight/60",
  new: "bg-tangerine/10 text-tangerine border border-tangerine/30",
  default: "bg-midnight/8 text-midnight",
};

function Badge({ variant = "default", className = "", children, ...props }: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold font-body",
        variantClasses[variant],
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </span>
  );
}

export { Badge };
export type { BadgeProps, BadgeVariant };
