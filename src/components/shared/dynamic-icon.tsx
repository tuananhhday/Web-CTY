import {
  Truck,
  MapPinned,
  CalendarClock,
  Building2,
  Warehouse,
  PackageSearch,
  ClipboardList,
  Radar,
  FileSearch,
  History,
  PhoneCall,
  Package,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  Truck,
  MapPinned,
  CalendarClock,
  Building2,
  Warehouse,
  PackageSearch,
  ClipboardList,
  Radar,
  FileSearch,
  History,
  PhoneCall,
};

export function DynamicIcon({ name, className }: { name: string; className?: string }) {
  const Icon = iconMap[name] ?? Package;
  return <Icon className={className} aria-hidden />;
}
