"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-12 items-center gap-1 rounded-lg bg-navy/5 p-1",
      className
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      // Tab chưa chọn dùng token muted: text-navy/60 chỉ đạt 4.3:1 trên nền bg-navy/5,
      // dưới ngưỡng WCAG AA 4.5:1 (§29).
      "inline-flex h-full items-center justify-center rounded-md px-4 text-sm font-semibold text-muted transition-colors hover:text-navy data-[state=active]:bg-white data-[state=active]:text-navy data-[state=active]:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text",
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    // Radix đặt tabIndex=0 lên panel để người dùng bàn phím tới được nội dung bên trong.
    // Vì vậy panel PHẢI có focus nhìn thấy được — không được tắt outline mà không thay thế (§29).
    className={cn(
      "mt-4 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-text focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
