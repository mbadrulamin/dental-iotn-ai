import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { cn } from "@/lib/utils"

const Progress = React.forwardRef<
    React.ElementRef<typeof ProgressPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
        value?: number | null | undefined;
        max?: number;
    }
>(({ className, value = 0, max = 100, ...props }, ref) => {
    // Handle null/undefined value gracefully
    const safeValue = value ?? 0
    const safeMax = max ?? 100

    return (
        <ProgressPrimitive.Root
            ref={ref}
            className={cn("relative h-2.5 w-full overflow-hidden rounded-full bg-primary/20", className)}
            {...props}
        >
            <ProgressPrimitive.Indicator
                className="h-full w-full flex-1 bg-primary transition-all duration-500 ease-in-out"
                style={{ transform: `translateX(-${100 - (safeValue / safeMax) * 100}%)` }}
            />
        </ProgressPrimitive.Root>
    )
})
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }