import { Phone, Mail, Clock } from "lucide-react";
import { company } from "@/config/company";
import { Container } from "@/components/shared/container";

export function TopBar() {
  return (
    <div className="hidden bg-navy text-xs text-white/85 md:block">
      <Container className="flex h-9 items-center justify-between">
        <div className="flex items-center gap-5">
          <a href={`tel:${company.phone.replace(/\s/g, "")}`} className="flex items-center gap-1.5 hover:text-white">
            <Phone className="h-3.5 w-3.5" aria-hidden />
            {company.phone}
          </a>
          <a href={`mailto:${company.email}`} className="flex items-center gap-1.5 hover:text-white">
            <Mail className="h-3.5 w-3.5" aria-hidden />
            {company.email}
          </a>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" aria-hidden />
          {company.workingHours}
        </div>
      </Container>
    </div>
  );
}
