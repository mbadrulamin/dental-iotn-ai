import * as React from "react"
import { cn } from "@/lib/utils"

const Alert = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "destructive" }
>(({ className, variant = "default", ...props }, ref) => (
    <div
        ref={ref}
        role="alert"
        className={cn(
            "relative w-full rounded-lg border p-4",
            variant === "destructive"
                ? "border-destructive/50 text-destructive dark:border-destructive"
                : "border-border bg-background text-foreground",
            className
        )}
        {...props}
    />
))
Alert.displayName = "Alert"

export { Alert }