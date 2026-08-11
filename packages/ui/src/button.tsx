import * as React from "react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-blue-600 text-[rgb(var(--inverse-ink))] hover:bg-blue-700 focus-visible:ring-blue-500",
  secondary: "bg-[rgb(var(--raised))] text-[rgb(var(--ink))] hover:bg-[rgb(var(--line))] focus-visible:ring-[rgb(var(--line-2))]",
  ghost: "bg-transparent text-[rgb(var(--ink-2))] hover:bg-[rgb(var(--raised))] focus-visible:ring-[rgb(var(--line-2))]",
  outline: "border border-[rgb(var(--line-2))] bg-[rgb(var(--surface))] text-[rgb(var(--ink-2))] hover:bg-[rgb(var(--raised))]",
  danger: "bg-rose-600 text-[rgb(var(--inverse-ink))] hover:bg-rose-700 focus-visible:ring-rose-500",
};

const sizes: Record<Size, string> = {
  sm: "h-7 px-2.5 text-xs",
  md: "h-9 px-4 text-sm",
  lg: "h-11 px-6 text-base",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
