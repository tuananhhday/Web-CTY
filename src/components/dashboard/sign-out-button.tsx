"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const handleSignOut = async () => {
    setPending(true);
    await signOut();
    // refresh() để Server Component nhận biết phiên đã kết thúc trước khi rời trang.
    router.refresh();
    router.push("/");
  };

  return (
    <Button variant="outline" size="sm" onClick={handleSignOut} disabled={pending}>
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <LogOut className="h-4 w-4" aria-hidden />
      )}
      <span className="hidden sm:inline">{pending ? "Đang thoát..." : "Đăng xuất"}</span>
    </Button>
  );
}
