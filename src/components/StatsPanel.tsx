import { useState, useMemo } from "react"
import { format } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import type { ContactStats, TimeMode } from "@/lib/instagram-parser"
import { MessageCircle, TrendingUp, Search } from "lucide-react"
import { LineChart } from "@/components/chart/line-chart"
import { getMessagingTrend } from "@/lib/instagram-parser"

interface StatsPanelProps {
  conversations: any[]
  userName: string
  precomputedStats: ContactStats[]
  onSelectContact: (contactName: string) => void
  dailyCountsByContact: Record<string, Record<string, number>>
  timeMode: TimeMode
  customRange?: { start: Date; end: Date }
}

function formatHour(hour: number): string {
  if (hour === 0) return "12 AM"
  if (hour === 12) return "12 PM"
  if (hour < 12) return `${hour} AM`
  return `${hour - 12} PM`
}

function ContactCard({ stats, onClick }: { stats: ContactStats; onClick: () => void }) {
  const maxCount = Math.max(...stats.hourlyDistribution)
  const topHour = maxCount > 0 ? stats.hourlyDistribution.indexOf(maxCount) : 0

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 rounded-lg border hover:bg-muted transition-colors"
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-medium truncate">{stats.name}</h3>
          <p className="text-sm text-muted-foreground">
            {stats.totalMessages.toLocaleString()} messages
          </p>
        </div>
        <div className="text-right text-sm text-muted-foreground">
          {formatHour(topHour)}
        </div>
      </div>
      <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
        <span>You: {stats.messagesYouSent.toLocaleString()}</span>
        <span>Them: {stats.messagesTheySent.toLocaleString()}</span>
      </div>
    </button>
  )
}

function HourlyHistogram({ distribution }: { distribution: number[] }) {
  const maxCount = Math.max(...distribution)
  const hours = Array.from({ length: 24 }, (_, i) => i)

  return (
    <div className="space-y-1">
      <div className="flex items-end gap-0.5 h-20">
        {hours.map((hour) => {
          const count = distribution[hour]
          const height = maxCount > 0 ? (count / maxCount) * 100 : 0
          return (
            <div
              key={hour}
              className="flex-1 bg-primary rounded-t hover:bg-primary/80 transition-colors"
              style={{ height: `${height}%`, minHeight: count > 0 ? '2px' : '0' }}
              title={`${formatHour(hour)}: ${count.toLocaleString()} messages`}
            />
          )
        })}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>12 AM</span>
        <span>6 AM</span>
        <span>12 PM</span>
        <span>6 PM</span>
        <span>12 AM</span>
      </div>
    </div>
  )
}

function ContactDetail({ 
  stats,
  dailyCountsByContact,
  timeMode,
  customRange
}: { 
  stats: ContactStats
  dailyCountsByContact: Record<string, Record<string, number>>
  timeMode: TimeMode
  customRange?: { start: Date; end: Date }
}) {
  const firstMsg = stats.firstMessage > 0 ? new Date(stats.firstMessage) : null
  const lastMsg = stats.lastMessage > 0 ? new Date(stats.lastMessage) : null

  const trendData = useMemo(() => {
    const contactData = { [stats.name]: dailyCountsByContact[stats.name] ?? {} }
    return getMessagingTrend(contactData, timeMode, undefined, customRange)
  }, [stats.name, dailyCountsByContact, timeMode, customRange])

  const chartMax = useMemo(() => {
    let max = 0
    for (const entry of trendData) {
      const val = entry[stats.name]
      if (typeof val === "number" && val > max) max = val
    }
    return Math.ceil(max * 1.1) || 10
  }, [trendData, stats.name])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded-lg bg-muted">
          <p className="text-sm text-muted-foreground">Total Messages</p>
          <p className="text-2xl font-bold">{stats.totalMessages.toLocaleString()}</p>
        </div>
        <div className="p-4 rounded-lg bg-muted">
          <p className="text-sm text-muted-foreground">Active Period</p>
          <p className="text-sm font-medium">
            {firstMsg ? format(firstMsg, "MMM yyyy") : "N/A"} - {lastMsg ? format(lastMsg, "MMM yyyy") : "N/A"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded-lg bg-muted">
          <p className="text-sm text-muted-foreground">You Sent</p>
          <p className="text-2xl font-bold">{stats.messagesYouSent.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">
            {stats.totalMessages > 0 ? Math.round((stats.messagesYouSent / stats.totalMessages) * 100) : 0}%
          </p>
        </div>
        <div className="p-4 rounded-lg bg-muted">
          <p className="text-sm text-muted-foreground">They Sent</p>
          <p className="text-2xl font-bold">{stats.messagesTheySent.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">
            {stats.totalMessages > 0 ? Math.round((stats.messagesTheySent / stats.totalMessages) * 100) : 0}%
          </p>
        </div>
      </div>

      <div className="p-4 rounded-lg border">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4" />
          <h4 className="font-medium">Messaging Trend</h4>
        </div>
        {trendData.length > 0 ? (
          <LineChart
            data={trendData}
            dataKey={[stats.name]}
            xAxisKey="time"
            colors={["hsl(221.2 83.2% 53.3%)"]}
            yAxisDomain={[0, chartMax]}
            height={200}
            showGrid
            showXAxis
            showYAxis
            showLegend={false}
            showTooltip
          />
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">No data for this period</p>
        )}
      </div>

      <div className="p-4 rounded-lg border">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4" />
          <h4 className="font-medium">Messages by Hour</h4>
        </div>
        <HourlyHistogram distribution={stats.hourlyDistribution} />
      </div>
    </div>
  )
}

export function StatsPanel({ 
  precomputedStats, 
  onSelectContact, 
  dailyCountsByContact, 
  timeMode, 
  customRange 
}: StatsPanelProps) {
  const [selectedContact, setSelectedContact] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  const selectedStats = useMemo(() => {
    if (!selectedContact) return null
    return precomputedStats.find(s => s.name === selectedContact) || null
  }, [precomputedStats, selectedContact])

  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return precomputedStats
    const lowerQuery = searchQuery.toLowerCase()
    return precomputedStats.filter(s => s.name.toLowerCase().includes(lowerQuery))
  }, [precomputedStats, searchQuery])

  const handleSelect = (name: string) => {
    setSelectedContact(name)
    onSelectContact(name)
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Contacts
            </CardTitle>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contacts..."
              className="pl-8 h-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-345px)]">
            <div className="space-y-2 p-4">
              {filteredContacts.map((stats) => (
                <ContactCard
                  key={stats.name}
                  stats={stats}
                  onClick={() => handleSelect(stats.name)}
                />
              ))}
              {filteredContacts.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No contacts found
                </p>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {selectedContact ? selectedContact : "Select a Contact"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedStats ? (
            <div className="h-[calc(100vh-230px)] overflow-y-auto pr-4 -mr-4">
              <ContactDetail 
                stats={selectedStats} 
                dailyCountsByContact={dailyCountsByContact}
                timeMode={timeMode}
                customRange={customRange}
              />
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              Click on a contact to see detailed stats
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}