import { useRef, useMemo, useState, useEffect } from "react"
import { Download, ChevronLeft, ChevronRight } from "lucide-react"
import { addDays, addWeeks, addMonths, addYears } from "date-fns"
import html2canvas from "html2canvas"
import { LineChart } from "@/components/chart/line-chart"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getMessagingTrend, defaultBucketSize, getTimeRange } from "@/lib/instagram-parser"
import type { TimeMode, BucketSize } from "@/lib/instagram-parser"

const COLORS = [
  "hsl(221.2 83.2% 53.3%)",
  "hsl(142.1 76.2% 36.3%)",
  "hsl(348.6 83.3% 53.3%)",
  "hsl(38.4 89.5% 56.5%)",
  "hsl(271.1 91% 71%)",
  "hsl(190.1 94.4% 42.2%)",
  "hsl(15.9 94.9% 59.6%)",
  "hsl(320.7 91.3% 68.8%)",
  "hsl(47.9 95.4% 53.1%)",
  "hsl(156.1 73.2% 46.5%)",
  "hsl(199.4 84.5% 55.5%)",
  "hsl(32.1 94.6% 43.7%)",
  "hsl(262.1 83.3% 57.8%)",
  "hsl(168.4 76.5% 36.3%)",
  "hsl(0 72.2% 50.6%)",
  "hsl(217.2 91.2% 59.8%)",
  "hsl(84.1 73.2% 36.3%)",
  "hsl(291.1 93.3% 66.8%)",
  "hsl(54.9 88.5% 48.5%)",
  "hsl(234.1 89.5% 63.5%)",
]

const BUCKET_LABELS: Record<BucketSize, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
  year: "Year",
}

interface MessagingChartProps {
  dailyCountsByContact: Record<string, Record<string, number>>
  mode: TimeMode
  customRange?: { start: Date; end: Date }
}

export function MessagingChart({ dailyCountsByContact, mode, customRange }: MessagingChartProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [bucketSize, setBucketSize] = useState<BucketSize>(() => defaultBucketSize(mode, customRange))
  const [shift, setShift] = useState(0)

  // Reset to smart default when time mode or range changes
  useEffect(() => {
    setBucketSize(defaultBucketSize(mode, customRange))
    setHidden(new Set())
    setShift(0)
  }, [mode, customRange])

  // Compute the shifted time range
  const shiftedRange = useMemo(() => {
    const base = getTimeRange(mode, customRange)
    if (shift === 0) return base
    const fn = {
      day:   (d: Date, n: number) => addDays(d, n),
      week:  (d: Date, n: number) => addWeeks(d, n),
      month: (d: Date, n: number) => addMonths(d, n),
      year:  (d: Date, n: number) => addYears(d, n),
    }[bucketSize]
    return { start: fn(base.start, shift), end: fn(base.end, shift) }
  }, [mode, customRange, bucketSize, shift])

  const canShiftRight = shiftedRange.end < new Date()

  const toggleLine = (name: string) => {
    setHidden(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const data = useMemo(
    () => getMessagingTrend(dailyCountsByContact, mode, undefined, customRange, bucketSize, shiftedRange),
    [dailyCountsByContact, mode, customRange, bucketSize, shiftedRange]
  )

  // Sorted contact names by total messages
  const dataKey = useMemo(() => {
    if (data.length === 0) return []
    const totals = new Map<string, number>()
    for (const entry of data) {
      for (const [k, v] of Object.entries(entry)) {
        if (k !== "time" && typeof v === "number") {
          totals.set(k, (totals.get(k) ?? 0) + v)
        }
      }
    }
    return [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name)
  }, [data])

  const visibleKeys = useMemo(() => dataKey.filter(k => !hidden.has(k)), [dataKey, hidden])
  const visibleColors = useMemo(
    () => visibleKeys.map(k => COLORS[dataKey.indexOf(k) % COLORS.length]),
    [visibleKeys, dataKey]
  )

  // Compute max from visible lines only (used when recalibrating)
  const visibleMax = useMemo(() => {
    const visibleSet = new Set(visibleKeys)
    let max = 0
    for (const entry of data) {
      for (const [k, v] of Object.entries(entry)) {
        if (visibleSet.has(k) && typeof v === "number" && v > max) max = v
      }
    }
    return Math.ceil(max * 1.1)
  }, [data, visibleKeys])

  // yAxisMax is frozen state — only updates when data changes or user recalibrates
  const [yAxisMax, setYAxisMax] = useState(() => visibleMax)
  const [yAxisLocked, setYAxisLocked] = useState(false)

  // Auto-update when data changes (new time window / mode) unless locked
  useEffect(() => {
    if (!yAxisLocked) setYAxisMax(visibleMax)
  }, [data])  // eslint-disable-line react-hooks/exhaustive-deps

  // Unlock when mode/range changes
  useEffect(() => {
    setYAxisLocked(false)
  }, [mode, customRange])

  const recalibrateY = () => {
    setYAxisMax(visibleMax)
    setYAxisLocked(true)
  }

  // Available bucket sizes — filter out options that would produce too many or too few points
  const availableBuckets = useMemo((): BucketSize[] => {
    switch (mode) {
      case "week":   return ["day"]
      case "month":  return ["day", "week", "month"]
      case "year":   return ["week", "month"]
      case "all":    return ["month", "year"]
      case "custom": {
        if (!customRange) return ["day", "week", "month", "year"]
        const days = (customRange.end.getTime() - customRange.start.getTime()) / 86400_000
        if (days <= 14)  return ["day"]
        if (days <= 90)  return ["day", "week", "month"]
        if (days <= 730) return ["week", "month", "year"]
        return ["month", "year"]
      }
    }
  }, [mode, customRange])

  const handleExport = async () => {
    if (!chartRef.current) return
    try {
      const canvas = await html2canvas(chartRef.current, { backgroundColor: "#ffffff", scale: 2 })
      const link = document.createElement("a")
      link.download = `messaging-trend-${mode}-${new Date().toISOString().split("T")[0]}.png`
      link.href = canvas.toDataURL("image/png")
      link.click()
    } catch (err) {
      console.error("Failed to export chart:", err)
    }
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Messaging Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No message data available for this time period
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Messaging Trends</CardTitle>
        <div className="flex items-center gap-3">
          {/* Bucket size selector — only shown when multiple options exist */}
          {availableBuckets.length > 1 && (
            <div className="flex items-center gap-1 rounded-md border p-0.5">
              {availableBuckets.map(b => (
                <button
                  key={b}
                  onClick={() => setBucketSize(b)}
                  className={`px-2.5 py-1 text-xs rounded transition-colors ${
                    bucketSize === b
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {BUCKET_LABELS[b]}
                </button>
              ))}
            </div>
          )}
          <Button
            variant={yAxisLocked ? "secondary" : "outline"}
            size="sm"
            onClick={recalibrateY}
            title={yAxisLocked ? `Y max locked at ${yAxisMax}` : "Recalibrate Y axis to visible lines"}
          >
            {yAxisLocked ? `Y: ${yAxisMax.toLocaleString()}` : "Recalibrate Y"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </CardHeader>
      <CardContent ref={chartRef} className="p-6 bg-background space-y-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="shrink-0"
            onClick={() => setShift(s => s - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <LineChart
              data={data}
              dataKey={visibleKeys}
              xAxisKey="time"
              colors={visibleColors}
              yAxisDomain={[0, yAxisMax]}
              height={400}
              showGrid
              showXAxis
              showYAxis
              showLegend={false}
              showTooltip
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            className="shrink-0"
            onClick={() => setShift(s => s + 1)}
            disabled={!canShiftRight}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {/* Clickable legend — click to toggle a line */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center">
          {dataKey.map((name, i) => {
            const isHidden = hidden.has(name)
            return (
              <button
                key={name}
                onClick={() => toggleLine(name)}
                className="flex items-center gap-1.5 text-xs rounded px-1 py-0.5 hover:bg-muted transition-colors"
                title={isHidden ? `Show ${name}` : `Hide ${name}`}
              >
                <div
                  className="h-2.5 w-2.5 shrink-0 rounded-full transition-opacity"
                  style={{ backgroundColor: COLORS[i % COLORS.length], opacity: isHidden ? 0.25 : 1 }}
                />
                <span
                  className="max-w-[140px] truncate transition-opacity"
                  style={{ opacity: isHidden ? 0.4 : 1 }}
                >
                  {name}
                </span>
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
