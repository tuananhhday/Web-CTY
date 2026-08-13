import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Plus, ArrowRight } from "lucide-react";
import { getActor } from "@/modules/auth/session";
import { listMyRequests } from "@/modules/service-requests/service";
import { listRequestsQuerySchema } from "@/modules/service-requests/schema";
import { RequestStatusBadge } from "@/components/shared/request-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/datetime";

export const metadata: Metadata = {
  title: "Yêu cầu của tôi",
  robots: { index: false, follow: false },
};

export default async function MyRequestsPage({ searchParams }: PageProps<"/tai-khoan/yeu-cau">) {
  const params = await searchParams;

  // Query không hợp lệ thì dùng mặc định thay vì báo lỗi — người dùng chỉnh URL không
  // nên làm hỏng trang.
  const parsed = listRequestsQuerySchema.safeParse(params);
  const query = parsed.success ? parsed.data : listRequestsQuerySchema.parse({});

  const actor = await getActor();
  const { items, total } = await listMyRequests(actor, query);

  const totalPages = Math.max(1, Math.ceil(total / query.limit));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-navy">Yêu cầu của tôi</h1>
          <p className="mt-1 text-sm text-foreground/70">
            {total > 0 ? `${total} yêu cầu` : "Chưa có yêu cầu nào"}
          </p>
        </div>
        <Button asChild>
          <Link href="/bao-gia">
            <Plus className="h-4 w-4" aria-hidden />
            Gửi yêu cầu mới
          </Link>
        </Button>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            <FileText className="mx-auto h-10 w-10 text-navy/25" aria-hidden />
            <p className="mt-4 font-medium text-navy">Bạn chưa gửi yêu cầu nào</p>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-foreground/65">
              Gửi thông tin hàng hóa để nhận báo giá. Mọi yêu cầu sẽ được lưu tại đây để bạn
              theo dõi và đối chiếu.
            </p>
            <Button asChild className="mt-6">
              <Link href="/bao-gia">Gửi yêu cầu đầu tiên</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((request) => {
            const pickup = request.stops.find((s) => s.kind === "PICKUP");
            const dropoff = request.stops.find((s) => s.kind === "DELIVERY");

            return (
              <li key={request.id}>
                <Link
                  href={`/tai-khoan/yeu-cau/${request.code}`}
                  className="flex flex-col gap-3 rounded-lg border border-border bg-white p-5 transition-colors hover:border-orange/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-mono text-sm font-bold text-navy">{request.code}</span>
                    <RequestStatusBadge status={request.status} />
                    <Badge variant="neutral">
                      {request.kind === "MOVING" ? "Chuyển nhà" : "Vận chuyển"}
                    </Badge>
                    <span className="ml-auto text-xs text-muted">
                      {formatDateTime(request.createdAt)}
                    </span>
                  </div>

                  {pickup && dropoff && (
                    <p className="flex flex-wrap items-center gap-2 text-sm text-foreground/75">
                      <span>{pickup.district ? `${pickup.district}, ` : ""}{pickup.province}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted" aria-hidden />
                      <span>{dropoff.district ? `${dropoff.district}, ` : ""}{dropoff.province}</span>
                    </p>
                  )}

                  <p className="text-xs text-muted">
                    {request.service?.name ?? "Chưa gán dịch vụ"}
                    {request._count.cargoItems > 0 && ` · ${request._count.cargoItems} loại hàng`}
                    {request._count.quotes > 0 && ` · ${request._count.quotes} báo giá`}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 && (
        <nav aria-label="Phân trang" className="flex items-center justify-center gap-2">
          {query.page > 1 && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/tai-khoan/yeu-cau?page=${query.page - 1}`}>Trang trước</Link>
            </Button>
          )}
          <span className="text-sm text-muted">
            Trang {query.page} / {totalPages}
          </span>
          {query.page < totalPages && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/tai-khoan/yeu-cau?page=${query.page + 1}`}>Trang sau</Link>
            </Button>
          )}
        </nav>
      )}
    </div>
  );
}
