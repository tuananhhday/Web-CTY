import type { Metadata } from "next";
import Link from "next/link";
import { Inbox, ArrowRight } from "lucide-react";
import { getActor } from "@/modules/auth/session";
import { listAllRequests } from "@/modules/service-requests/service";
import { listRequestsQuerySchema } from "@/modules/service-requests/schema";
import {
  REQUEST_STATUSES,
  REQUEST_STATUS_LABELS,
} from "@/modules/service-requests/state-machine";
import { RequestStatusBadge } from "@/components/shared/request-status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/datetime";
import { maskPhone } from "@/lib/normalize";

export const metadata: Metadata = { title: "Hộp thư yêu cầu" };

export default async function AdminRequestsPage({
  searchParams,
}: PageProps<"/quan-tri/yeu-cau">) {
  const params = await searchParams;

  const parsed = listRequestsQuerySchema.safeParse(params);
  const query = parsed.success ? parsed.data : listRequestsQuerySchema.parse({});

  const actor = await getActor();
  // Ném FORBIDDEN nếu thiếu quyền request.read_all.
  const { items, total } = await listAllRequests(actor, query);

  const totalPages = Math.max(1, Math.ceil(total / query.limit));

  const buildUrl = (overrides: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams();
    const merged = { ...params, ...overrides };
    for (const [key, value] of Object.entries(merged)) {
      if (value !== undefined && value !== "" && typeof value !== "object") {
        next.set(key, String(value));
      }
    }
    return `/quan-tri/yeu-cau?${next.toString()}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-navy">Hộp thư yêu cầu</h1>
        <p className="mt-1 text-sm text-foreground/70">{total} yêu cầu</p>
      </div>

      {/* Bộ lọc dùng liên kết thay vì form: URL phản ánh đúng trạng thái đang xem,
          chia sẻ được và bấm nút back của trình duyệt hoạt động đúng (§26.3). */}
      <nav aria-label="Lọc theo trạng thái" className="flex flex-wrap gap-2">
        <Link
          href={buildUrl({ status: undefined, page: 1 })}
          className={`rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text ${
            !query.status
              ? "border-navy bg-navy text-white"
              : "border-border bg-white text-foreground/75 hover:border-navy/30"
          }`}
        >
          Tất cả
        </Link>
        {REQUEST_STATUSES.map((status) => (
          <Link
            key={status}
            href={buildUrl({ status, page: 1 })}
            aria-current={query.status === status ? "page" : undefined}
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text ${
              query.status === status
                ? "border-navy bg-navy text-white"
                : "border-border bg-white text-foreground/75 hover:border-navy/30"
            }`}
          >
            {REQUEST_STATUS_LABELS[status]}
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            <Inbox className="mx-auto h-10 w-10 text-navy/25" aria-hidden />
            <p className="mt-4 font-medium text-navy">Không có yêu cầu nào</p>
            <p className="mt-1.5 text-sm text-foreground/65">
              {query.status
                ? "Thử bỏ bộ lọc để xem toàn bộ yêu cầu."
                : "Yêu cầu mới từ khách hàng sẽ xuất hiện tại đây."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-white">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Danh sách yêu cầu dịch vụ</caption>
            <thead>
              <tr className="border-b border-border bg-navy/5">
                <th scope="col" className="px-4 py-3 text-left font-semibold text-navy">Mã</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-navy">Khách hàng</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-navy">Tuyến</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-navy">Trạng thái</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-navy">Gửi lúc</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold text-navy">
                  <span className="sr-only">Thao tác</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((request) => {
                const pickup = request.stops.find((s) => s.kind === "PICKUP");
                const dropoff = request.stops.find((s) => s.kind === "DELIVERY");

                return (
                  <tr key={request.id} className="border-b border-border last:border-0">
                    <th scope="row" className="px-4 py-3 text-left">
                      <span className="font-mono text-xs font-bold text-navy">{request.code}</span>
                      <Badge variant="neutral" className="ml-2">
                        {request.kind === "MOVING" ? "Chuyển nhà" : "Vận chuyển"}
                      </Badge>
                    </th>
                    <td className="px-4 py-3">
                      <p className="font-medium text-navy">{request.contactName}</p>
                    </td>
                    <td className="px-4 py-3 text-foreground/75">
                      {pickup && dropoff
                        ? `${pickup.province} → ${dropoff.province}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <RequestStatusBadge status={request.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {formatDateTime(request.submittedAt ?? request.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/quan-tri/yeu-cau/${request.code}`}>
                          Xem
                          <ArrowRight className="h-4 w-4" aria-hidden />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <nav aria-label="Phân trang" className="flex items-center justify-center gap-3">
          {query.page > 1 && (
            <Button asChild variant="outline" size="sm">
              <Link href={buildUrl({ page: query.page - 1 })}>Trang trước</Link>
            </Button>
          )}
          <span className="text-sm text-muted">
            Trang {query.page} / {totalPages}
          </span>
          {query.page < totalPages && (
            <Button asChild variant="outline" size="sm">
              <Link href={buildUrl({ page: query.page + 1 })}>Trang sau</Link>
            </Button>
          )}
        </nav>
      )}

      <p className="text-xs text-muted">
        Số điện thoại khách hàng được che bớt trong danh sách. Mở chi tiết để xem đầy đủ (§31).
        Ví dụ: {maskPhone("+84912345678")}
      </p>
    </div>
  );
}
