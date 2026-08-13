import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative flex gap-3 rounded-md border p-4 text-sm [&_svg]:size-5 [&_svg]:shrink-0 [&_svg]:mt-0.5",
  {
    variants: {
      variant: {
        info: "border-navy/15 bg-navy/5 text-navy [&_svg]:text-navy",
        success: "border-success/20 bg-success-bg text-success [&_svg]:text-success",
        warning: "border-warning/20 bg-warning-bg text-warning [&_svg]:text-warning",
        error: "border-error/20 bg-error-bg text-error [&_svg]:text-error",
      },
    },
    defaultVariants: { variant: "info" },
  }
);

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

function Alert({ className, variant, ...props }: AlertProps) {
  return (
    <div role="status" className={cn(alertVariants({ variant, className }))} {...props} />
  );
}

export { Alert, alertVariants };
