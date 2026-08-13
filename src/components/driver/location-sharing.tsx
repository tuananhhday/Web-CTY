"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, MapPinOff, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { MIN_INTERVAL_SECONDS } from "@/modules/locations/rules";

/**
 * Gửi vị trí chuyến từ thiết bị tài xế (§17).
 *
 * OPT-IN thật sự: không có gì chạy cho tới khi tài xế bấm bật. Không tự bật lại khi tải
 * lại trang — người dùng phải chủ động mỗi phiên, vì đây là vị trí của chính họ.
 *
 * Gom điểm rồi gửi theo lô để tiết kiệm pin và chịu được vùng mất sóng: điểm giữ lại trong
 * bộ nhớ, mất mạng thì lần gửi sau đi cùng lô.
 */

/** Gửi lô mỗi 60 giây. Ping vào lô theo nhịp của `watchPosition`. */
const FLUSH_INTERVAL_MS = 60_000;

/** Trần số điểm giữ trong bộ nhớ khi mất mạng lâu — khớp giới hạn của API. */
const MAX_BUFFER = 100;

interface BufferedPing {
  latitude: number;
  longitude: number;
  accuracyM?: number;
  speedKph?: number;
  heading?: number;
  recordedAt: string;
}

export function LocationSharing({ trackingCode }: { trackingCode: string }) {
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const buffer = useRef<BufferedPing[]>([]);
  const watchId = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastRecordedAt = useRef<number>(0);

  useEffect(() => {
    if (!active) return;

    const flush = async () => {
      if (buffer.current.length === 0) return;

      // Lấy ra và xoá buffer trước khi gửi: điểm mới ghi trong lúc chờ mạng vào lô sau,
      // không bị mất và cũng không bị gửi hai lần.
      const batch = buffer.current;
      buffer.current = [];

      try {
        const response = await fetch("/api/driver/locations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trackingCode, pings: batch }),
        });

        if (!response.ok) {
          const body = await response.json();
          setError(body?.error?.message ?? "Không gửi được vị trí.");
          return;
        }

        const result = await response.json();
        setError(null);
        setStatus(`Đã gửi ${result.accepted} điểm lúc ${new Date().toLocaleTimeString("vi-VN")}`);
      } catch {
        // Mất mạng: trả điểm về buffer để gửi lại ở lô sau.
        buffer.current = [...batch, ...buffer.current].slice(-MAX_BUFFER);
        setStatus("Chưa có mạng, sẽ gửi lại khi kết nối được.");
      }
    };

    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        const now = position.timestamp;

        // Giữ nhịp ngay tại thiết bị: server cũng loại điểm quá dày, gửi lên chỉ tốn pin.
        if (now - lastRecordedAt.current < MIN_INTERVAL_SECONDS * 1000) return;
        lastRecordedAt.current = now;

        const { latitude, longitude, accuracy, speed, heading } = position.coords;

        buffer.current.push({
          latitude,
          longitude,
          accuracyM: accuracy ?? undefined,
          speedKph: speed != null && speed >= 0 ? speed * 3.6 : undefined,
          heading: heading != null && heading >= 0 ? heading : undefined,
          recordedAt: new Date(now).toISOString(),
        });

        if (buffer.current.length > MAX_BUFFER) {
          buffer.current = buffer.current.slice(-MAX_BUFFER);
        }
      },
      (positionError) => {
        setError(
          positionError.code === positionError.PERMISSION_DENIED
            ? "Bạn đã từ chối quyền định vị. Có thể bật lại trong cài đặt trình duyệt."
            : "Không lấy được vị trí. Kiểm tra GPS đã bật chưa."
        );
        setActive(false);
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 30_000 }
    );

    timer.current = setInterval(flush, FLUSH_INTERVAL_MS);

    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
      if (timer.current) clearInterval(timer.current);
      // Gửi nốt những gì còn trong buffer khi tài xế tắt hoặc rời trang.
      void flush();
    };
  }, [active, trackingCode]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-2.5">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
        <p className="text-xs text-foreground/75">
          Bật chia sẻ để điều phối theo dõi được chuyến. Đây là vị trí <strong>xe của bạn</strong>,
          chỉ gửi trong lúc chuyến đang chạy và tự tắt khi bạn rời trang.
        </p>
      </div>

      <Button
        type="button"
        variant={active ? "outline" : "primary"}
        className="h-12 w-full"
        onClick={() => {
          setStatus(null);

          // Kiểm tra khả năng của thiết bị ngay tại thao tác bật, không phải trong effect:
          // báo lỗi ở đây là phản hồi trực tiếp cho hành động của người dùng.
          if (!active && !("geolocation" in navigator)) {
            setError("Thiết bị này không hỗ trợ định vị. Vui lòng báo vị trí qua điện thoại.");
            return;
          }

          setError(null);
          setActive((current) => !current);
        }}
      >
        {active ? (
          <>
            <MapPinOff className="h-4 w-4" aria-hidden />
            Tắt chia sẻ vị trí
          </>
        ) : (
          <>
            <MapPin className="h-4 w-4" aria-hidden />
            Bật chia sẻ vị trí
          </>
        )}
      </Button>

      <div aria-live="polite" className="flex flex-col gap-2">
        {active && !error && (
          <p className="flex items-center gap-2 text-xs text-success">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            {status ?? "Đang theo dõi vị trí..."}
          </p>
        )}

        {error && (
          <Alert variant="warning" role="alert">
            <AlertCircle aria-hidden />
            <p>{error}</p>
          </Alert>
        )}
      </div>
    </div>
  );
}
