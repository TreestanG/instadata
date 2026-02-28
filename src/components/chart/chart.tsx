import * as React from "react"

import { cn } from "@/lib/utils"

const RECHARTS_PROPS = new Set([
  'data', 'dataKey', 'width', 'height', 'margin', 'children',
  'style', 'className', 'id', 'role', 'aria-label',
  'isAnimationActive', 'isTooltipActive', 'activeDot', 'activeIndex',
  'label', 'labelFormatter', 'labelStyle', 'itemSorter', 'itemStyle',
  'filterNull', 'includeHidden', 'reverseDirection', 'useTranslate3d',
  'wrapperStyle', 'accessibilityLayer', 'active'
])

function filterChartProps(props: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(props).filter(([key]) => !RECHARTS_PROPS.has(key))
  )
}

const Chart = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const filtered = filterChartProps(props)
  return (
    <div
      ref={ref}
      className={cn(
        "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-legend-item-text]:fill-foreground [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border/50 [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border",
        className
      )}
      {...filtered}
    />
  )
})
Chart.displayName = "Chart"

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const filtered = filterChartProps(props)
  return (
    <div
      ref={ref}
      className={cn("w-full", className)}
      {...filtered}
    >
      {children}
    </div>
  )
})
ChartContainer.displayName = "ChartContainer"

const ChartTooltip = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, _ref) => {
  const filtered = filterChartProps(props)
  return (
    <div
      className={cn(
        "rounded-lg border bg-background p-3 text-sm shadow-md",
        className
      )}
      {...filtered}
    />
  )
})
ChartTooltip.displayName = "ChartTooltip"

const ChartTooltipContent = ({
  className,
  hideLabel,
  label,
  labelKey,
  items,
  payload,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  hideLabel?: boolean
  label?: string
  labelKey?: string
  payload?: { name: string; value: number; color?: string }[]
  items?: {
    name: string
    value: number
    color?: string
    indicator?: "dot" | "line" | "dashed"
  }[]
}) => {
  const filtered = filterChartProps(props)
  const formattedItems = React.useMemo(() => {
    if (items?.length) return items
    // Use Recharts payload if no explicit items
    if (payload?.length) {
      return payload
        .filter(p => typeof p.value === "number" && p.value > 0)
        .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
        .slice(0, 5)
        .map(p => ({
          name: p.name,
          value: p.value,
          color: p.color,
        }))
    }
    return []
  }, [items, payload])

  if (hideLabel && !formattedItems.length) return null

  return (
    <div className={cn("rounded-lg border bg-background p-3 text-sm shadow-md max-h-[300px] overflow-y-auto", className)} {...filtered}>
      {(label || labelKey) && (
        <div className="mb-2 font-medium">
          {label || labelKey}
        </div>
      )}
      <div className="space-y-1">
        {formattedItems.map((item, index) => (
          <div
            key={index}
            className="flex items-center gap-2 text-xs"
          >
            <div
              className="w-2 h-2 shrink-0 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="flex-1 truncate">{item.name}</span>
            {typeof item.value === "number" && (
              <span className="font-mono font-medium">
                {item.value.toLocaleString()}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
ChartTooltipContent.displayName = "ChartTooltipContent"

const ChartLegend = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const filtered = filterChartProps(props)
  return (
    <div
      ref={ref}
      className={cn("flex items-center justify-center gap-4", className)}
      {...filtered}
    />
  )
})
ChartLegend.displayName = "ChartLegend"

const ChartLegendContent = ({
  className,
  hideIcon,
  items,
  payload,
}: React.HTMLAttributes<HTMLDivElement> & {
  hideIcon?: boolean
  payload?: { value: string; color?: string }[]
  items?: {
    value: string
    label?: string
    color?: string
  }[]
}) => {
  const itemsToRender = items?.length
    ? items.map(i => ({ value: i.value, label: i.label ?? i.value, color: i.color }))
    : (payload ?? []).map(p => ({ value: p.value, label: p.value, color: p.color }))

  return (
    <div className={cn("flex flex-wrap justify-center gap-x-4 gap-y-1 px-4 pt-2", className)}>
      {itemsToRender.map((item, index) => (
        <div key={index} className="flex items-center gap-1.5 text-xs">
          {!hideIcon && (
            <div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
          )}
          <span className="truncate max-w-[120px]">{item.label}</span>
        </div>
      ))}
    </div>
  )
}
ChartLegendContent.displayName = "ChartLegendContent"

export {
  Chart,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
}