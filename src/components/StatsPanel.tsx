import { useState, useMemo } from "react"
import { format } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { ContactStats } from "@/lib/instagram-parser"
import { MessageCircle, TrendingUp } from "lucide-react"

interface StatsPanelProps {
  conversations: any[]
  userName: string
  precomputedStats: ContactStats[]
  onSelectContact: (contactName: string) => void
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

function ContactDetail({ stats }: { stats: ContactStats }) {
  const firstMsg = stats.firstMessage > 0 ? new Date(stats.firstMessage) : null
  const lastMsg = stats.lastMessage > 0 ? new Date(stats.lastMessage) : null

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
          <h4 className="font-medium">Messages by Hour</h4>
        </div>
        <HourlyHistogram distribution={stats.hourlyDistribution} />
      </div>
    </div>
  )
}

export function StatsPanel({ precomputedStats, onSelectContact }: StatsPanelProps) {
  const [selectedContact, setSelectedContact] = useState<string | null>(null)

  const selectedStats = useMemo(() => {
    if (!selectedContact) return null
    return precomputedStats.find(s => s.name === selectedContact) || null
  }, [precomputedStats, selectedContact])

  const handleSelect = (name: string) => {
    setSelectedContact(name)
    onSelectContact(name)
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Top Contacts
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-300px)]">
            <div className="space-y-2 p-4">
              {precomputedStats.map((stats) => (
                <ContactCard
                  key={stats.name}
                  stats={stats}
                  onClick={() => handleSelect(stats.name)}
                />
              ))}
              {precomputedStats.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No messages found in this time period
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
            <ContactDetail stats={selectedStats} />
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