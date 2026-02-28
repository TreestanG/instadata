import { useState, useMemo, useEffect } from "react"
import { format, startOfMonth, endOfMonth, addMonths } from "date-fns"
import { Calendar } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import type {
  Conversation,
  InstagramMessage,
} from "@/lib/instagram-parser"
import {
  getConversationMessages,
  getAvailableMonths,
} from "@/lib/instagram-parser"
import { GroupChatBreakdown } from "./GroupChatBreakdown"
import { getMediaUrl } from "@/lib/zip-media"

function MediaAttachment({ path, zipFile }: { path: string; zipFile?: File }) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!zipFile) return
    let cancelled = false
    getMediaUrl(zipFile, path).then(u => {
      if (!cancelled) { setUrl(u); setLoading(false) }
    }).catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [zipFile, path])

  if (!zipFile) return null
  if (loading) return <div className="h-32 w-48 rounded bg-muted animate-pulse" />
  if (!url) return <p className="text-xs text-muted-foreground">Media unavailable</p>
  if (path.match(/\.(mp4|mov|webm)$/i)) {
    return <video src={url} controls className="max-w-full max-h-80 rounded mt-1 block" />
  }
  return <img src={url} alt="" className="max-w-full max-h-80 rounded mt-1 block" loading="lazy" />
}

interface MessageViewerProps {
  conversation: Conversation
  userName: string
  zipFile?: File
  targetTimestamp?: number
}

export function MessageViewer({ conversation, userName, zipFile, targetTimestamp }: MessageViewerProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>("all")
  const [selectedYear, setSelectedYear] = useState<string>("all")
  const [showingRecentOnly, setShowingRecentOnly] = useState(true)
  const [startDate, setStartDate] = useState<Date | undefined>(
    () => new Date(conversation.endTime - 7 * 86400_000)
  )
  const [endDate, setEndDate] = useState<Date | undefined>(
    () => new Date(conversation.endTime)
  )
  // Draft state for the popover inputs — only committed on Apply
  const [draftStart, setDraftStart] = useState<string>(
    () => format(new Date(conversation.endTime - 7 * 86400_000), "yyyy-MM-dd")
  )
  const [draftEnd, setDraftEnd] = useState<string>(
    () => format(new Date(conversation.endTime), "yyyy-MM-dd")
  )

  // Reset when conversation changes
  useEffect(() => {
    const defaultStart = new Date(conversation.endTime - 7 * 86400_000)
    const defaultEnd = new Date(conversation.endTime)
    setSelectedMonth("all")
    setSelectedYear("all")
    setShowingRecentOnly(true)
    setStartDate(defaultStart)
    setEndDate(defaultEnd)
    setDraftStart(format(defaultStart, "yyyy-MM-dd"))
    setDraftEnd(format(defaultEnd, "yyyy-MM-dd"))
  }, [conversation.id, conversation.endTime])

  // Jump to ±1 month when a search result is clicked
  useEffect(() => {
    if (!targetTimestamp) return
    const ONE_MONTH = 30 * 86400_000
    const start = new Date(targetTimestamp - ONE_MONTH)
    const end = new Date(targetTimestamp + ONE_MONTH)
    setSelectedMonth("all")
    setSelectedYear("all")
    setShowingRecentOnly(false)
    setStartDate(start)
    setEndDate(end)
    setDraftStart(format(start, "yyyy-MM-dd"))
    setDraftEnd(format(end, "yyyy-MM-dd"))
  }, [targetTimestamp])

  const availableMonths = useMemo(
    () => getAvailableMonths([conversation]),
    [conversation]
  )

  const years = useMemo(() => {
    const uniqueYears = new Set(availableMonths.map((m) => m.year))
    return Array.from(uniqueYears).sort((a, b) => b - a)
  }, [availableMonths])

  const months = useMemo(() => {
    if (selectedYear === "all") return availableMonths
    return availableMonths.filter((m) => m.year === parseInt(selectedYear))
  }, [availableMonths, selectedYear])

  const filteredMessages = useMemo(() => {
    let start: Date | undefined
    let end: Date | undefined

    if (selectedMonth !== "all") {
      const [year, month] = selectedMonth.split("-").map(Number)
      start = startOfMonth(new Date(year, month - 1))
      end = endOfMonth(new Date(year, month - 1))
    } else if (startDate && endDate) {
      start = startDate
      end = endDate
    }

    return getConversationMessages(conversation, start, end)
  }, [conversation, selectedMonth, startDate, endDate])

  const groupedMessages = useMemo(() => {
    const groups: { date: string; messages: InstagramMessage[] }[] = []
    let currentDate = ""

    for (const msg of filteredMessages) {
      const msgDate = format(new Date(msg.timestamp), "yyyy-MM-dd")
      if (msgDate !== currentDate) {
        currentDate = msgDate
        groups.push({
          date: format(new Date(msg.timestamp), "MMMM d, yyyy"),
          messages: [],
        })
      }
      groups[groups.length - 1].messages.push(msg)
    }

    return groups
  }, [filteredMessages])

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          {conversation.title}
          <span className="text-sm font-normal text-muted-foreground">
            ({filteredMessages.length.toLocaleString()} messages)
          </span>
        </CardTitle>
        <div className="flex flex-wrap gap-2 mt-4">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              {months.map((m) => (
                <SelectItem
                  key={`${m.year}-${m.month}`}
                  value={`${m.year}-${String(m.month).padStart(2, "0")}`}
                >
                  {format(new Date(m.year, m.month - 1), "MMMM yyyy")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {years.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[200px]">
                <Calendar className="h-4 w-4 mr-2" />
                {startDate && endDate
                  ? `${format(startDate, "MMM d")} - ${format(endDate, "MMM d")}`
                  : "Date Range"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4" align="start">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Start Date</label>
                  <Input
                    type="date"
                    value={draftStart}
                    onChange={(e) => setDraftStart(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">End Date</label>
                  <Input
                    type="date"
                    value={draftEnd}
                    onChange={(e) => setDraftEnd(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    if (draftStart) setStartDate(new Date(draftStart))
                    if (draftEnd) setEndDate(new Date(draftEnd))
                    setSelectedMonth("all")
                    setShowingRecentOnly(false)
                  }}
                  className="w-full"
                >
                  Apply
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setStartDate(undefined)
                    setEndDate(undefined)
                    setDraftStart("")
                    setDraftEnd("")
                  }}
                  className="w-full"
                >
                  Clear Range
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const start = new Date(conversation.startTime)
              const end = addMonths(start, 3)
              setShowingRecentOnly(false)
              setSelectedMonth("all")
              setStartDate(start)
              setEndDate(end)
              setDraftStart(format(start, "yyyy-MM-dd"))
              setDraftEnd(format(end, "yyyy-MM-dd"))
            }}
          >
            Jump to beginning
          </Button>

          {showingRecentOnly && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowingRecentOnly(false)
                setStartDate(undefined)
                setEndDate(undefined)
                setSelectedMonth("all")
              }}
            >
              Load full history
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[calc(100vh-420px)]">
          <div className="space-y-4 p-4 w-full overflow-x-auto">
            {groupedMessages.map((group) => (
              <div key={group.date}>
                <div className="sticky top-0 bg-background py-2 text-center text-xs text-muted-foreground border-b mb-2">
                  {group.date}
                </div>
                <div className="space-y-3">
                  {group.messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex w-full min-w-0 ${msg.sender === userName ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`w-fit max-w-[min(70%,42rem)] min-w-0 overflow-hidden rounded-lg p-3 ${
                          msg.sender === userName
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        {conversation.isGroup && (
                          <p className="text-xs font-medium mb-1 opacity-75">
                            {msg.sender}
                          </p>
                        )}
                        <p className="text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{msg.text}</p>
                        {msg.photos?.map((p, i) => <MediaAttachment key={`p${i}`} path={p} zipFile={zipFile} />)}
                        {msg.videos?.map((v, i) => <MediaAttachment key={`v${i}`} path={v} zipFile={zipFile} />)}
                        <p
                          className={`text-xs mt-1 ${
                            msg.sender === userName
                              ? "text-primary-foreground/70"
                              : "text-muted-foreground"
                          }`}
                        >
                          {format(new Date(msg.timestamp), "h:mm a")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {groupedMessages.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No messages found for this time period
              </p>
            )}
          </div>
        </ScrollArea>
      </CardContent>
      {conversation.isGroup && <GroupChatBreakdown conversation={conversation} />}
    </Card>
  )
}
