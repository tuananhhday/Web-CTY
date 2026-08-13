"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input, type InputProps } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const PasswordInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? "text" : "password"}
          className={cn("pr-11", className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          aria-pressed={visible}
          className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted transition-colors hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text"
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
        </button>
      </div>
    );
  }
);
PasswordInput.displayName = "PasswordInput";

interface StrengthLevel {
  score: number;
  label: string;
  barClass: string;
  textClass: string;
}

export function getPasswordStrength(password: string): StrengthLevel {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (!password) return { score: 0, label: "", barClass: "", textClass: "" };
  if (score <= 2) return { score: 1, label: "Yếu", barClass: "bg-error", textClass: "text-error" };
  if (score <= 3)
    return { score: 2, label: "Trung bình", barClass: "bg-warning", textClass: "text-warning" };
  if (score === 4)
    return { score: 3, label: "Khá", barClass: "bg-orange", textClass: "text-orange-text-hover" };
  return { score: 4, label: "Mạnh", barClass: "bg-success", textClass: "text-success" };
}

export function PasswordStrength({ password }: { password: string }) {
  const strength = getPasswordStrength(password);
  if (!password) return null;

  return (
    <div className="flex flex-col gap-1.5" aria-live="polite">
      <div className="flex gap-1.5">
        {[1, 2, 3, 4].map((level) => (
          <span
            key={level}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              level <= strength.score ? strength.barClass : "bg-navy/10"
            )}
          />
        ))}
      </div>
      <p className={cn("text-xs font-medium", strength.textClass)}>
        Độ mạnh mật khẩu: {strength.label}
      </p>
    </div>
  );
}
