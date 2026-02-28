import { format, subWeeks, subMonths, subYears, isWithinInterval } from "date-fns"

export interface InstagramMessage {
  sender: string
  text?: string
  timestamp: number
  photos?: string[]
  videos?: string[]
}

export interface Conversation {
  id: string
  title: string
  participants: string[]
  messages: InstagramMessage[]
  isGroup: boolean
  startTime: number
  endTime: number
  messageCount: number
}

export interface InstagramData {
  conversations: Conversation[]
  totalMessages: number
  dateRange: { start: number; end: number }
  userName: string
  precomputedContactStats: ContactStats[]
  contactStatsByMode: Partial<Record<TimeMode, ContactStats[]>>
  dailyCountsByContact: Record<string, Record<string, number>>
  zipFile?: File
}

export type TimeMode = "week" | "month" | "year" | "all" | "custom"
export type BucketSize = "day" | "week" | "month" | "year"

export function getTimeRange(mode: TimeMode, customRange?: { start: Date; end: Date }): { start: Date; end: Date } {
  if (mode === "custom" && customRange) return customRange

  const end = new Date()
  const start = new Date()

  switch (mode) {
    case "week":
      start.setTime(subWeeks(end, 1).getTime())
      break
    case "month":
      start.setTime(subMonths(end, 1).getTime())
      break
    case "year":
      start.setTime(subYears(end, 1).getTime())
      break
    case "all":
    case "custom":
      start.setFullYear(2000, 0, 1)
      break
  }

  return { start, end }
}

export function defaultBucketSize(mode: TimeMode, customRange?: { start: Date; end: Date }): BucketSize {
  switch (mode) {
    case "week":  return "day"
    case "month": return "day"
    case "year":  return "month"
    case "all":   return "year"
    case "custom": {
      if (!customRange) return "month"
      const days = (customRange.end.getTime() - customRange.start.getTime()) / 86400_000
      if (days <= 31)  return "day"
      if (days <= 365) return "month"
      return "year"
    }
  }
}

function formatTimeKey(date: Date, bucket: BucketSize): string {
  switch (bucket) {
    case "day":   return format(date, "yyyy-MM-dd")
    case "week":  return format(date, "yyyy-'W'ww")
    case "month": return format(date, "yyyy-MM")
    case "year":  return format(date, "yyyy")
  }
}

export async function parseInstagramExport(
  _file: File,
  _onProgress?: (progress: number) => void
): Promise<InstagramData> {
  throw new Error("Use the Web Worker for parsing")
}

export function getTopContacts(
  conversations: Conversation[],
  mode: TimeMode,
  limit: number = 10,
  userName: string = "You"
): { name: string; count: number }[] {
  const { start, end } = getTimeRange(mode)
  
  const contactCounts = new Map<string, number>()
  
  for (const conv of conversations) {
    // Get other participants excluding the current user
    const otherParticipants = conv.participants.filter(
      (p) => p !== userName
    )
    const contactName = otherParticipants.join(", ") || conv.title
    
    // Skip empty or invalid contact names
    if (!contactName || contactName === "Unknown") continue
    
    for (const msg of conv.messages) {
      const msgDate = new Date(msg.timestamp)
      if (isWithinInterval(msgDate, { start, end })) {
        contactCounts.set(contactName, (contactCounts.get(contactName) || 0) + 1)
      }
    }
  }
  
  return Array.from(contactCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

export function getMessagingTrend(
  dailyCountsByContact: Record<string, Record<string, number>>,
  mode: TimeMode,
  _topContacts?: { name: string }[],
  customRange?: { start: Date; end: Date },
  bucketSize?: BucketSize,
  rangeOverride?: { start: Date; end: Date },
  customBucketDays?: number
): { time: string; [contact: string]: number | string }[] {
  const contactNames = Object.keys(dailyCountsByContact)
  if (contactNames.length === 0) return []

  const { start, end } = rangeOverride ?? getTimeRange(mode, customRange)
  const bucket = bucketSize ?? defaultBucketSize(mode, customRange)
  const bucketMs = customBucketDays ? customBucketDays * 86400_000 : 0

  // Step 1: Bucket ALL contacts by time period
  const buckets = new Map<string, Record<string, number>>()

  for (const [name, daily] of Object.entries(dailyCountsByContact)) {
    for (const [dateStr, count] of Object.entries(daily)) {
      const date = new Date(dateStr + "T00:00:00")
      if (date < start || date > end) continue
      const key = customBucketDays
        ? format(new Date(start.getTime() + Math.floor((date.getTime() - start.getTime()) / bucketMs) * bucketMs), "yyyy-MM-dd")
        : formatTimeKey(date, bucket)
      if (!buckets.has(key)) buckets.set(key, {})
      buckets.get(key)![name] = (buckets.get(key)![name] ?? 0) + count
    }
  }

  if (buckets.size === 0) return []

  // Step 2: For each bucket, find the top 20 contacts; track how many
  // buckets each contact appears in as a top-20 and their total messages
  const contactScore = new Map<string, { appearances: number; total: number }>()
  for (const counts of buckets.values()) {
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
    for (let i = 0; i < Math.min(20, sorted.length); i++) {
      const [name, count] = sorted[i]
      const prev = contactScore.get(name) ?? { appearances: 0, total: 0 }
      contactScore.set(name, {
        appearances: prev.appearances + 1,
        total: prev.total + count,
      })
    }
  }

  // Step 3: Pick the top 20 contacts overall (by total messages in range)
  // from those that appeared in any bucket's top 20
  const topNames = new Set(
    [...contactScore.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 20)
      .map(([name]) => name)
  )

  // Step 4: Build chart data with only these contacts
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, counts]) => {
      const entry: Record<string, number | string> = { time }
      for (const name of topNames) {
        entry[name] = counts[name] ?? 0
      }
      return entry
    })
}

export function getConversationMessages(
  conversation: Conversation,
  startDate?: Date,
  endDate?: Date
): InstagramMessage[] {
  let messages = conversation.messages
  
  if (startDate && endDate) {
    messages = messages.filter((msg) =>
      isWithinInterval(new Date(msg.timestamp), { start: startDate, end: endDate })
    )
  }
  
  return messages
}

export function getGroupMemberStats(conversation: Conversation): { member: string; count: number }[] {
  if (!conversation.isGroup) return []
  
  const counts = new Map<string, number>()
  
  for (const msg of conversation.messages) {
    counts.set(msg.sender, (counts.get(msg.sender) || 0) + 1)
  }
  
  return Array.from(counts.entries())
    .map(([member, count]) => ({ member, count }))
    .sort((a, b) => b.count - a.count)
}

export function searchMessages(
  conversations: Conversation[],
  query: string,
  conversationId?: string
): { conversation: Conversation; message: InstagramMessage }[] {
  const results: { conversation: Conversation; message: InstagramMessage }[] = []
  const lowerQuery = query.toLowerCase()
  
  const searchConvs = conversationId
    ? conversations.filter((c) => c.id === conversationId)
    : conversations
  
  for (const conv of searchConvs) {
    for (const msg of conv.messages) {
      if (msg.text?.toLowerCase().includes(lowerQuery)) {
        results.push({ conversation: conv, message: msg })
      }
    }
  }
  
  return results
}

export function getAvailableMonths(conversations: Conversation[]): { year: number; month: number }[] {
  const months = new Set<string>()
  
  for (const conv of conversations) {
    for (const msg of conv.messages) {
      months.add(format(new Date(msg.timestamp), "yyyy-MM"))
    }
  }
  
  return Array.from(months)
    .sort()
    .map((s) => {
      const [year, month] = s.split("-").map(Number)
      return { year, month }
    })
}

export interface ContactStats {
  name: string
  totalMessages: number
  messagesYouSent: number
  messagesTheySent: number
  hourlyDistribution: number[]
  firstMessage: number
  lastMessage: number
}

export function getContactStats(conversations: Conversation[], contactName: string, userName: string = "You"): ContactStats | null {
  let totalMessages = 0
  let messagesYouSent = 0
  let messagesTheySent = 0
  const hourlyDistribution = new Array(24).fill(0)
  let firstMessage = Infinity
  let lastMessage = -Infinity

  for (const conv of conversations) {
    // Find the contact in this conversation - exclude user from participants
    const otherParticipants = conv.participants.filter(
      (p) => p !== userName && p !== undefined
    )
    const convKey = otherParticipants.join(", ") || conv.title

    if (convKey !== contactName) continue

    for (const msg of conv.messages) {
      totalMessages++
      const hour = new Date(msg.timestamp).getHours()
      hourlyDistribution[hour]++

      if (msg.sender === userName) {
        messagesYouSent++
      } else {
        messagesTheySent++
      }

      if (msg.timestamp < firstMessage) firstMessage = msg.timestamp
      if (msg.timestamp > lastMessage) lastMessage = msg.timestamp
    }
  }

  if (totalMessages === 0) return null

  return {
    name: contactName,
    totalMessages,
    messagesYouSent,
    messagesTheySent,
    hourlyDistribution,
    firstMessage: firstMessage === Infinity ? 0 : firstMessage,
    lastMessage: lastMessage === -Infinity ? 0 : lastMessage,
  }
}

export function getAllContactStats(conversations: Conversation[], limit: number = 20, userName: string = "You"): ContactStats[] {
  const contactMap = new Map<string, {
    totalMessages: number
    messagesYouSent: number
    messagesTheySent: number
    hourlyDistribution: number[]
    firstMessage: number
    lastMessage: number
  }>()

  for (const conv of conversations) {
    // Get other participants excluding the current user
    const otherParticipants = conv.participants.filter((p) => p !== userName)
    const contactName = otherParticipants.join(", ") || conv.title

    // Skip if contact name is empty or just "Unknown"
    if (!contactName || contactName === "Unknown") continue

    if (!contactMap.has(contactName)) {
      contactMap.set(contactName, {
        totalMessages: 0,
        messagesYouSent: 0,
        messagesTheySent: 0,
        hourlyDistribution: new Array(24).fill(0),
        firstMessage: Infinity,
        lastMessage: -Infinity,
      })
    }

    const stats = contactMap.get(contactName)!

    for (const msg of conv.messages) {
      stats.totalMessages++
      const hour = new Date(msg.timestamp).getHours()
      stats.hourlyDistribution[hour]++

      if (msg.sender === userName) {
        stats.messagesYouSent++
      } else {
        stats.messagesTheySent++
      }

      if (msg.timestamp < stats.firstMessage) stats.firstMessage = msg.timestamp
      if (msg.timestamp > stats.lastMessage) stats.lastMessage = msg.timestamp
    }
  }

  return Array.from(contactMap.entries())
    .map(([name, stats]) => ({
      name,
      totalMessages: stats.totalMessages,
      messagesYouSent: stats.messagesYouSent,
      messagesTheySent: stats.messagesTheySent,
      hourlyDistribution: stats.hourlyDistribution,
      firstMessage: stats.firstMessage,
      lastMessage: stats.lastMessage,
    }))
    .sort((a, b) => b.totalMessages - a.totalMessages)
    .slice(0, limit)
}