import type { Metadata } from "next";
import Link from "next/link";
import { FileText, ArrowRight } from "lucide-react";
import { getActor } from "@/modules/auth/session";
import { can } from "@/modules/auth/policy";
import { countRequestsByStatus } from "@/modules/service-requests/repository";
import { REQUEST_STATUS_LABELS, type RequestStatus } from "@/modules/service-requests/state-machine";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Tổng quan" };

/** Trạng thái cần nhân viên xử lý, hiển thị nổi bật ở tổng quan. */
const ACTIONABLE: RequestStatus[] = ["SUBMITTED", "UNDER_REVIEW", "NEED_MORE_INFO", "NEGOTIATING"];

export default async function AdminOverviewPage() {
  const actor = await getActor();
  const canReadRequests = can(actor, "request.read_all");

  const counts = canReadRequests ? await countRequestsByStatus() : {};

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold text-navy">Tổng quan</h1>

      {!canReadRequests ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="font-medium text-navy">Không có widget nào cho vai trò của bạn</p>
            <p className="mt-1.5 text-sm text-foreground/65">
              Dùng thanh điều hướng phía trên để tới khu vực bạn được phân quyền.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <section aria-labelledby="can-xu-ly">
            <h2 id="can-xu-ly" className="text-sm font-bold uppercase tracking-wide text-muted">
              Yêu cầu cần xử lý
            </h2>
            <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {ACTIONABLE.map((status) => (
                <li key={status}>
                  <Link
                    href={`/quan-tri/yeu-cau?status=${status}`}
                    className="block rounded-lg border border-border bg-white p-5 transition-colors hover:border-orange/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text"
                  >
                    <p className="text-sm text-foreground/70">{REQUEST_STATUS_LABELS[status]}</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-navy">
                      {counts[status] ?? 0}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-navy/5 text-navy">
                  <FileText className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="font-semibold text-navy">Hộp thư yêu cầu</p>
                  <p className="text-sm text-foreground/65">
                    Xem toàn bộ yêu cầu và cập nhật trạng thái xử lý.
                  </p>
                </div>
              </div>
              <Button asChild>
                <Link href="/quan-tri/yeu-cau">
                  Mở hộp thư
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
