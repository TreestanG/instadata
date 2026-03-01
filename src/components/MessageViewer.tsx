import { useState, useMemo, useEffect, useRef } from "react"
import { format, startOfMonth, endOfMonth, addMonths } from "date-fns"
import { Calendar, ArrowUp, ArrowDown } from "lucide-react"
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
  const [isAtTop, setIsAtTop] = useState(true)
  const [isAtBottom, setIsAtBottom] = useState(false)
  const viewportRef = useRef<HTMLDivElement>(null)
  
  // Refs to preserve scroll position when expanding earlier
  const previousScrollHeight = useRef<number>(0)
  const previousScrollTop = useRef<number>(0)
  const isExpandingEarlier = useRef<boolean>(false)

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

  // Jump to a focused range when a search result is clicked
  useEffect(() => {
    if (!targetTimestamp) return
    const ONE_WEEK = 7 * 86400_000
    const start = new Date(targetTimestamp - ONE_WEEK)
    const end = new Date(targetTimestamp + ONE_WEEK)
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

  // Scroll to the specific message when targetTimestamp changes
  useEffect(() => {
    if (!targetTimestamp) return
    // Small timeout to allow render
    const timer = setTimeout(() => {
      const element = document.getElementById(`message-${targetTimestamp}`)
      if (element && viewportRef.current) {
        element.scrollIntoView({ behavior: "smooth", block: "center" })
      }
    }, 100)
    return () => clearTimeout(timer)
  }, [targetTimestamp, filteredMessages])

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

  // Check scroll position when messages change, and preserve scroll if we expanded earlier
  useEffect(() => {
    if (viewportRef.current) {
      const target = viewportRef.current
      
      // If we just loaded earlier messages, adjust the scroll position down
      // by the height of the newly inserted content so the user stays looking
      // at the exact same message they were before clicking "Load previous month"
      if (isExpandingEarlier.current) {
        const heightDifference = target.scrollHeight - previousScrollHeight.current
        if (heightDifference > 0) {
          target.scrollTop = previousScrollTop.current + heightDifference
        }
        isExpandingEarlier.current = false
      }

      const threshold = 5
      setIsAtTop(target.scrollTop <= threshold)
      setIsAtBottom(Math.abs(target.scrollHeight - target.clientHeight - target.scrollTop) <= threshold)
    }
  }, [filteredMessages])

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget
    const threshold = 5
    setIsAtTop(target.scrollTop <= threshold)
    setIsAtBottom(Math.abs(target.scrollHeight - target.clientHeight - target.scrollTop) <= threshold)
  }

  const expandEarlier = () => {
    let newStart: Date;
    let newEnd: Date;

    if (selectedMonth !== "all") {
      const [year, month] = selectedMonth.split("-").map(Number)
      newStart = addMonths(startOfMonth(new Date(year, month - 1)), -1)
      newEnd = endOfMonth(new Date(year, month - 1))
    } else if (startDate && endDate) {
      newStart = addMonths(startDate, -1)
      newEnd = endDate
    } else {
      return
    }

    // Save current scroll metrics before state updates trigger re-render
    if (viewportRef.current) {
      const target = viewportRef.current
      previousScrollHeight.current = target.scrollHeight
      previousScrollTop.current = target.scrollTop
    }
    
    isExpandingEarlier.current = true

    setStartDate(newStart)
    setEndDate(newEnd)
    setSelectedMonth("all")
    setDraftStart(format(newStart, "yyyy-MM-dd"))
    setDraftEnd(format(newEnd, "yyyy-MM-dd"))
    setShowingRecentOnly(false)
  }

  const expandLater = () => {
    let newStart: Date;
    let newEnd: Date;

    if (selectedMonth !== "all") {
      const [year, month] = selectedMonth.split("-").map(Number)
      newStart = startOfMonth(new Date(year, month - 1))
      newEnd = addMonths(endOfMonth(new Date(year, month - 1)), 1)
    } else if (startDate && endDate) {
      newStart = startDate
      newEnd = addMonths(endDate, 1)
    } else {
      return
    }

    setStartDate(newStart)
    setEndDate(newEnd)
    setSelectedMonth("all")
    setDraftStart(format(newStart, "yyyy-MM-dd"))
    setDraftEnd(format(newEnd, "yyyy-MM-dd"))
    setShowingRecentOnly(false)
  }

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
        <ScrollArea 
          className="h-[calc(100vh-420px)]"
          viewportRef={viewportRef}
          onScroll={handleScroll}
        >
          <div className="space-y-4 p-4 w-full overflow-x-hidden">
            {isAtTop && (selectedMonth !== "all" || (startDate && endDate)) && (
              <div className="flex justify-center py-2">
                <Button variant="ghost" size="sm" onClick={expandEarlier} className="text-muted-foreground hover:text-foreground">
                  <ArrowUp className="mr-2 h-4 w-4" />
                  Load previous month
                </Button>
              </div>
            )}
            
            {groupedMessages.map((group) => (
              <div key={group.date}>
                <div className="sticky top-0 bg-background py-2 text-center text-xs text-muted-foreground border-b mb-2">
                  {group.date}
                </div>
                <div className="space-y-3">
                  {group.messages.map((msg, idx) => (
                    <div
                      key={idx}
                      id={`message-${msg.timestamp}`}
                      className={`flex w-full ${msg.sender === userName ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[70%] min-w-0 overflow-hidden rounded-lg p-3 transition-colors duration-500 ${
                          msg.timestamp === targetTimestamp 
                            ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                            : ""
                        } ${
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
                        <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
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

            {isAtBottom && (selectedMonth !== "all" || (startDate && endDate)) && groupedMessages.length > 0 && (
              <div className="flex justify-center py-2">
                <Button variant="ghost" size="sm" onClick={expandLater} className="text-muted-foreground hover:text-foreground">
                  <ArrowDown className="mr-2 h-4 w-4" />
                  Load next month
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
      {conversation.isGroup && <GroupChatBreakdown conversation={conversation} />}
    </Card>
  )
}
