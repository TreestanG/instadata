import { useState } from "react"
import { format } from "date-fns"
import { Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import type { TimeMode } from "@/lib/instagram-parser"

interface TimeModeSelectorProps {
  mode: TimeMode
  onModeChange: (mode: TimeMode) => void
  customRange?: { start: Date; end: Date }
  onCustomRangeChange?: (range: { start: Date; end: Date }) => void
}

const presetModes: { value: TimeMode; label: string }[] = [
  { value: "week", label: "Past Week" },
  { value: "month", label: "Past Month" },
  { value: "year", label: "Past Year" },
  { value: "all", label: "All Time" },
]

export function TimeModeSelector({ mode, onModeChange, customRange, onCustomRangeChange }: TimeModeSelectorProps) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [startInput, setStartInput] = useState(
    customRange ? format(customRange.start, "yyyy-MM-dd") : ""
  )
  const [endInput, setEndInput] = useState(
    customRange ? format(customRange.end, "yyyy-MM-dd") : ""
  )

  const handleApply = () => {
    if (startInput && endInput) {
      const start = new Date(startInput)
      const end = new Date(endInput)
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end) {
        onCustomRangeChange?.({ start, end })
        onModeChange("custom")
        setPopoverOpen(false)
      }
    }
  }

  return (
    <div className="flex gap-2 flex-wrap">
      {presetModes.map((m) => (
        <Button
          key={m.value}
          variant={mode === m.value ? "default" : "outline"}
          size="sm"
          onClick={() => onModeChange(m.value)}
        >
          {m.label}
        </Button>
      ))}
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={mode === "custom" ? "default" : "outline"}
            size="sm"
          >
            <Calendar className="h-4 w-4 mr-1" />
            {mode === "custom" && customRange
              ? `${format(customRange.start, "MMM d, yyyy")} - ${format(customRange.end, "MMM d, yyyy")}`
              : "Custom Range"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-4" align="end">
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Start Date</label>
              <Input
                type="date"
                value={startInput}
                onChange={(e) => setStartInput(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">End Date</label>
              <Input
                type="date"
                value={endInput}
                onChange={(e) => setEndInput(e.target.value)}
                className="mt-1"
              />
            </div>
            <Button size="sm" className="w-full" onClick={handleApply}>
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
