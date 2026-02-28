import * as React from "react"
import {
  Line,
  LineChart as RechartsLineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts"

import { cn } from "@/lib/utils"
import { ChartContainer, ChartTooltipContent, ChartLegendContent } from "./chart"

interface LineChartProps extends React.HTMLAttributes<HTMLDivElement> {
  data: any[]
  dataKey: string | string[]
  xAxisKey: string
  colors?: string[]
  yAxisLabel?: string
  xAxisLabel?: string
  yAxisDomain?: [number, number]
  height?: number
  showGrid?: boolean
  showXAxis?: boolean
  showYAxis?: boolean
  showLegend?: boolean
  showTooltip?: boolean
}

const defaultColors = [
  "hsl(221.2 83.2% 53.3%)",
  "hsl(142.1 76.2% 36.3%)",
  "hsl(38.4 89.5% 56.5%)",
  "hsl(348.6 83.3% 53.3%)",
  "hsl(271.1 91% 71%)",
  "hsl(47.9 95.4% 53.1%)",
  "hsl(190.1 94.4% 42.2%)",
  "hsl(320.7 91.3% 68.8%)",
  "hsl(156.1 73.2% 46.5%)",
  "hsl(15.9 94.9% 59.6%)",
]

const CHART_PROPS = new Set([
  'data', 'dataKey', 'xAxisKey', 'colors', 'yAxisLabel', 'xAxisLabel',
  'yAxisDomain', 'height', 'showGrid', 'showXAxis', 'showYAxis', 'showLegend', 'showTooltip'
])

const LineChart = React.forwardRef<HTMLDivElement, LineChartProps>(
  (
    {
      className,
      data,
      dataKey,
      xAxisKey,
      colors = defaultColors,
      yAxisDomain,
      height = 400,
      showGrid = true,
      showXAxis = true,
      showYAxis = true,
      showLegend = true,
      showTooltip = true,
      ...props
    },
    ref
  ) => {
    const dataKeys = Array.isArray(dataKey) ? dataKey : [dataKey]
    const allKeys = new Set(data.flatMap(d => Object.keys(d)))
    const keys = dataKeys.filter((key) => key && allKeys.has(key))

const filteredProps = Object.fromEntries(
      Object.entries(props).filter(([key]) => !CHART_PROPS.has(key))
    )

    return (
      <ChartContainer ref={ref} className={cn("w-full", className)} {...filteredProps}>
        {data.length === 0 ? (
          <div className="flex items-center justify-center text-muted-foreground" style={{ height }}>
            No data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            <RechartsLineChart
              data={data}
              margin={{
                top: 20,
                right: 20,
                bottom: 20,
                left: 20,
              }}
            >
              {showGrid && (
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border"
                />
              )}
              {showXAxis && (
                <XAxis
                  dataKey={xAxisKey}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  className="text-xs fill-muted-foreground"
                />
              )}
              {showYAxis && (
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value) => value.toLocaleString()}
                  className="text-xs fill-muted-foreground"
                  domain={yAxisDomain ?? [0, 'auto']}
                  allowDataOverflow={false}
                />
              )}
              {showTooltip && (
                <Tooltip
                  content={<ChartTooltipContent />}
                />
              )}
              {showLegend && (
                <Legend
                  content={<ChartLegendContent />}
                  wrapperStyle={{ paddingTop: "10px" }}
                />
              )}
              {keys.map((key, index) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={colors[index % colors.length]}
                  strokeWidth={2}
                  dot={{ r: 3, fill: colors[index % colors.length] }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              ))}
            </RechartsLineChart>
          </ResponsiveContainer>
        )}
      </ChartContainer>
    )
  }
)
LineChart.displayName = "LineChart"

export { LineChart }