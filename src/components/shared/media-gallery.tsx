import { FileText, Video, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MEDIA_STAGE_LABELS, type MediaStage } from "@/modules/media/schema";
import { formatDateTime } from "@/lib/datetime";

/**
 * Thư viện ảnh/video theo giai đoạn (§16.2).
 *
 * Dùng chung cho màn hình tài xế, điều phối và khách hàng. Việc lọc tệp nào được thấy đã
 * xong ở tầng service (`listShipmentMedia`) — component này chỉ hiển thị đúng thứ nhận được,
 * không tự quyết định quyền.
 *
 * Ảnh tải qua `/api/media/[id]`, là proxy kiểm tra quyền ở từng lần gọi. Vì vậy dùng thẻ
 * `<img>` thường thay vì `next/image`: bộ tối ưu ảnh của Next sẽ fetch không kèm cookie
 * phiên nên không qua được lớp xác thực.
 */

export interface GalleryItem {
  id: string;
  stage: string;
  kind: string;
  mimeType: string;
  caption: string | null;
  visibility: string;
  capturedAt: Date | null;
  uploadedAt: Date;
}

export function MediaGallery({
  items,
  showVisibility = false,
}: {
  items: GalleryItem[];
  /** Nhân viên và tài xế cần biết tệp nào khách xem được; khách thì không cần. */
  showVisibility?: boolean;
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-foreground/65">
        Chưa có hình ảnh nào cho chuyến này.
      </p>
    );
  }

  // Gom theo giai đoạn, giữ nguyên thứ tự service đã sắp xếp.
  const groups = new Map<string, GalleryItem[]>();
  for (const item of items) {
    const bucket = groups.get(item.stage) ?? [];
    bucket.push(item);
    groups.set(item.stage, bucket);
  }

  return (
    <div className="flex flex-col gap-5">
      {[...groups.entries()].map(([stage, group]) => (
        <section key={stage} aria-labelledby={`media-${stage}`}>
          <h3
            id={`media-${stage}`}
            className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted"
          >
            {MEDIA_STAGE_LABELS[stage as MediaStage] ?? stage} ({group.length})
          </h3>

          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {group.map((item) => (
              <li key={item.id}>
                <figure className="overflow-hidden rounded-md border border-border bg-white">
                  <a
                    href={`/api/media/${item.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text"
                  >
                    {item.kind === "IMAGE" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/media/${item.id}`}
                        alt={
                          item.caption ??
                          `Ảnh giai đoạn ${MEDIA_STAGE_LABELS[item.stage as MediaStage] ?? item.stage}`
                        }
                        loading="lazy"
                        className="aspect-square w-full bg-navy/5 object-cover"
                      />
                    ) : (
                      <span className="flex aspect-square w-full flex-col items-center justify-center gap-2 bg-navy/5 text-navy/50">
                        {item.kind === "VIDEO" ? (
                          <Video className="h-7 w-7" aria-hidden />
                        ) : (
                          <FileText className="h-7 w-7" aria-hidden />
                        )}
                        <span className="px-2 text-center text-xs">
                          {item.kind === "VIDEO" ? "Video" : "Tài liệu"}
                        </span>
                      </span>
                    )}
                  </a>

                  <figcaption className="border-t border-border p-2">
                    {item.caption && (
                      <p className="line-clamp-2 text-xs text-foreground/80">{item.caption}</p>
                    )}
                    <time
                      dateTime={(item.capturedAt ?? item.uploadedAt).toISOString()}
                      className="mt-0.5 block text-[11px] text-muted"
                    >
                      {formatDateTime(item.capturedAt ?? item.uploadedAt)}
                    </time>
                    {showVisibility && item.visibility === "INTERNAL" && (
                      <Badge variant="neutral" className="mt-1.5">
                        <Lock className="h-3 w-3" aria-hidden />
                        Nội bộ
                      </Badge>
                    )}
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
