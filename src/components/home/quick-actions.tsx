import { Calculator, Search } from "lucide-react";
import { Container } from "@/components/shared/container";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EstimateForm } from "@/components/shared/estimate-form";
import { TrackingForm } from "@/components/shared/tracking-form";
import { DemoBadge } from "@/components/shared/demo-badge";

export function QuickActions() {
  return (
    <section aria-labelledby="thao-tac-nhanh" className="relative z-10 -mt-10 md:-mt-14">
      <Container>
        <div className="rounded-xl border border-border bg-white p-5 shadow-[0_8px_30px_rgba(11,31,51,0.08)] sm:p-7">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 id="thao-tac-nhanh" className="text-lg font-bold text-navy">
              Bắt đầu nhanh
            </h2>
            <DemoBadge label="DEMO_MODE · dữ liệu mô phỏng" />
          </div>

          <Tabs defaultValue="uoc-tinh">
            <TabsList>
              <TabsTrigger value="uoc-tinh">
                <Calculator className="mr-2 h-4 w-4" aria-hidden />
                Ước tính chi phí
              </TabsTrigger>
              <TabsTrigger value="tra-cuu">
                <Search className="mr-2 h-4 w-4" aria-hidden />
                Tra cứu vận đơn
              </TabsTrigger>
            </TabsList>

            <TabsContent value="uoc-tinh">
              <EstimateForm />
            </TabsContent>

            <TabsContent value="tra-cuu">
              <TrackingForm />
            </TabsContent>
          </Tabs>
        </div>
      </Container>
    </section>
  );
}
