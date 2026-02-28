/* eslint-disable no-restricted-globals */
// @ts-ignore
import { ZipReader, BlobReader, TextWriter } from "@zip.js/zip.js"

const ctx: Worker = self as any

function decodeInstagramText(text: string): string {
  try {
    return decodeURIComponent(escape(text))
  } catch {
    return text
  }
}

function parseMessageJson(content: string): Record<string, unknown> {
  try {
    return JSON.parse(content)
  } catch {
    return {}
  }
}

ctx.onmessage = async (e: MessageEvent) => {
  const { file } = e.data

  let zipReader: ZipReader<BlobReader> | null = null

  try {
    ctx.postMessage({ type: "progress", progress: 5 })

    const blobReader = new BlobReader(file)
    zipReader = new ZipReader(blobReader)

    ctx.postMessage({ type: "progress", progress: 15 })

    const entries = await zipReader.getEntries()

    const messageFiles = entries.filter(
      (entry) => entry.filename.includes("message_") && entry.filename.endsWith(".json")
    )

    if (messageFiles.length === 0) {
      const allJsonFiles = entries
        .filter((entry) => entry.filename.endsWith(".json"))
        .map((entry) => entry.filename)
      await zipReader.close()
      ctx.postMessage({ 
        type: "error", 
        error: `No message files found. Found JSON files: ${allJsonFiles.join(", ")}` 
      })
      return
    }

    ctx.postMessage({ type: "progress", progress: 20 })

    // Use a map to merge conversations with the same title
    const conversationMap = new Map<string, {
      id: string
      title: string
      participants: Set<string>
      messages: Array<{ sender: string; text: string; timestamp: number; photos?: string[]; videos?: string[] }>
    }>()

    const totalFiles = messageFiles.length

    let processed = 0

    // Process in batches
    while (processed < totalFiles) {
      const batch = messageFiles.slice(processed, processed + 50)
      
      for (const entry of batch) {
        try {
          // @ts-ignore
          const text = await entry.getData(new TextWriter())
          
          const json = parseMessageJson(text)

          const messages: Array<{ sender: string; text: string; timestamp: number; photos?: string[]; videos?: string[] }> = []
          const participants = new Set<string>()

          if (json.messages && Array.isArray(json.messages)) {
            for (const msg of json.messages as Record<string, unknown>[]) {
              const sender = decodeInstagramText(
                (msg.sender_name as string) || (msg.sender as string) || "Unknown"
              )
              participants.add(sender)

              const rawTs = msg.timestamp_ms ?? msg.timestamp ?? msg.date ?? msg.created_at
              let timestamp: number
              if (!rawTs) {
                timestamp = Date.now()
              } else if (typeof rawTs === "number") {
                // If < 1e12, it's seconds (e.g. 1609459200); convert to ms
                timestamp = rawTs < 1e12 ? rawTs * 1000 : rawTs
              } else {
                timestamp = new Date(rawTs as string).getTime()
              }

              if (isNaN(timestamp)) continue

              const text = decodeInstagramText(
                (msg.text as string) || (msg.content as string) || ""
              )

              const photos: string[] = []
              const videos: string[] = []
              if (Array.isArray(msg.photos)) {
                for (const p of msg.photos as Record<string, unknown>[]) {
                  if (p.uri) photos.push(p.uri as string)
                }
              }
              if (Array.isArray(msg.videos)) {
                for (const v of msg.videos as Record<string, unknown>[]) {
                  if (v.uri) videos.push(v.uri as string)
                }
              }

              messages.push({
                sender,
                text,
                timestamp,
                ...(photos.length > 0 && { photos }),
                ...(videos.length > 0 && { videos }),
              })
            }
          }

          const rawTitle = (json.title as string) || (json.chat_title as string) || (json.thread_title as string) ||
            Array.from(participants).filter(p => p !== "Unknown").join(", ") ||
            "Unknown Conversation"
          const title = decodeInstagramText(rawTitle)

          // Merge with existing conversation if same title exists
          if (conversationMap.has(title)) {
            const existing = conversationMap.get(title)!
            existing.participants = new Set([...existing.participants, ...participants])
            existing.messages.push(...messages)
          } else {
            conversationMap.set(title, {
              id: entry.filename,
              title,
              participants,
              messages,
            })
          }
        } catch (parseError) {
          console.warn("Failed to parse entry:", entry.filename, parseError)
        }
      }

      processed += batch.length
      const progressVal = 20 + Math.floor((processed / totalFiles) * 50)
      ctx.postMessage({ type: "progress", progress: progressVal })
      
      await new Promise(resolve => setTimeout(resolve, 5))
    }

    await zipReader.close()
    zipReader = null

    // Convert map to final structure
    const conversations = Array.from(conversationMap.values())
      .map(conv => {
        const sortedMessages = conv.messages.sort((a, b) => a.timestamp - b.timestamp)
        return {
          id: conv.id,
          title: conv.title,
          participants: Array.from(conv.participants),
          messages: sortedMessages,
          isGroup: conv.participants.size > 2,
          startTime: sortedMessages[0]?.timestamp || 0,
          endTime: sortedMessages[sortedMessages.length - 1]?.timestamp || 0,
          messageCount: sortedMessages.length,
        }
      })

    const allMessages = conversations.flatMap((c) => c.messages)

    if (allMessages.length === 0) {
      ctx.postMessage({ type: "error", error: "No messages found in the export" })
      return
    }

    // Calculate who is the current user (the one who sends the most messages)
    const senderCounts = new Map<string, number>()
    for (const msg of allMessages) {
      senderCounts.set(msg.sender, (senderCounts.get(msg.sender) || 0) + 1)
    }
    const userName = Array.from(senderCounts.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] || "You"

    // Calculate date range efficiently
    let minTs = Infinity
    let maxTs = -Infinity
    for (const msg of allMessages) {
      if (msg.timestamp < minTs) minTs = msg.timestamp
      if (msg.timestamp > maxTs) maxTs = msg.timestamp
    }

    // Pre-compute contact stats in worker
    const contactStatsMap = new Map<string, {
      name: string
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

      if (!contactName || contactName === "Unknown") continue

      if (!contactStatsMap.has(contactName)) {
        contactStatsMap.set(contactName, {
          name: contactName,
          totalMessages: 0,
          messagesYouSent: 0,
          messagesTheySent: 0,
          hourlyDistribution: new Array(24).fill(0),
          firstMessage: Infinity,
          lastMessage: -Infinity,
        })
      }

      const stats = contactStatsMap.get(contactName)!

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

    const precomputedContactStats = Array.from(contactStatsMap.values())
      .map(stats => ({
        ...stats,
        firstMessage: stats.firstMessage === Infinity ? 0 : stats.firstMessage,
        lastMessage: stats.lastMessage === -Infinity ? 0 : stats.lastMessage,
      }))
      .sort((a, b) => b.totalMessages - a.totalMessages)

    // Helper to get contact name from a conversation
    function getContactName(conv: { participants: string[]; title: string }): string {
      const otherParticipants = conv.participants.filter((p) => p !== userName)
      return otherParticipants.join(", ") || conv.title
    }

    // Compute per-mode contact stats
    function computeStatsForCutoff(cutoff: number) {
      const map = new Map<string, {
        totalMessages: number
        messagesYouSent: number
        messagesTheySent: number
        hourlyDistribution: number[]
        firstMessage: number
        lastMessage: number
      }>()

      for (const conv of conversations) {
        const contactName = getContactName(conv)
        if (!contactName || contactName === "Unknown") continue

        for (const msg of conv.messages) {
          if (msg.timestamp < cutoff) continue

          if (!map.has(contactName)) {
            map.set(contactName, {
              totalMessages: 0,
              messagesYouSent: 0,
              messagesTheySent: 0,
              hourlyDistribution: new Array(24).fill(0),
              firstMessage: Infinity,
              lastMessage: -Infinity,
            })
          }

          const stats = map.get(contactName)!
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

      return Array.from(map.entries())
        .map(([name, stats]) => ({
          name,
          ...stats,
          firstMessage: stats.firstMessage === Infinity ? 0 : stats.firstMessage,
          lastMessage: stats.lastMessage === -Infinity ? 0 : stats.lastMessage,
        }))
        .filter(s => s.totalMessages > 0)
        .sort((a, b) => b.totalMessages - a.totalMessages)
    }

    const now = Date.now()
    const contactStatsByMode = {
      week: computeStatsForCutoff(now - 7 * 86400_000),
      month: computeStatsForCutoff(now - 30 * 86400_000),
      year: computeStatsForCutoff(now - 365 * 86400_000),
      all: precomputedContactStats,
    }

    // Precompute daily counts for trend chart (all contacts)
    const dailyCountsByContact: Record<string, Record<string, number>> = {}

    for (const conv of conversations) {
      const contactName = getContactName(conv)
      if (!contactName || contactName === "Unknown") continue
      if (!dailyCountsByContact[contactName]) dailyCountsByContact[contactName] = {}

      for (const msg of conv.messages) {
        const dateKey = new Date(msg.timestamp).toISOString().slice(0, 10)
        dailyCountsByContact[contactName][dateKey] =
          (dailyCountsByContact[contactName][dateKey] ?? 0) + 1
      }
    }

    ctx.postMessage({ type: "progress", progress: 100 })

    ctx.postMessage({
      type: "result",
      data: {
        conversations,
        totalMessages: allMessages.length,
        dateRange: { start: minTs, end: maxTs },
        userName,
        precomputedContactStats,
        contactStatsByMode,
        dailyCountsByContact,
      },
    })
  } catch (error) {
    if (zipReader) {
      try {
        await zipReader.close()
      } catch {}
    }
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    ctx.postMessage({ type: "error", error: errorMessage })
  }
}

export {}