import { useState, useMemo, useCallback } from "react"
import { MessageCircle, Moon, Sun } from "lucide-react"
import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Upload } from "@/components/Upload"
import { TimeModeSelector } from "@/components/TimeModeSelector"
import { MessagingChart } from "@/components/MessagingChart"
import { ConversationList } from "@/components/ConversationList"
import { MessageViewer } from "@/components/MessageViewer"
import { SearchBar } from "@/components/SearchBar"
import { SearchResults } from "@/components/SearchResults"
import { StatsPanel } from "@/components/StatsPanel"
import type { InstagramData, Conversation, InstagramMessage, TimeMode } from "@/lib/instagram-parser"

function App() {
  const [data, setData] = useState<InstagramData | null>(null)
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [timeMode, setTimeMode] = useState<TimeMode>("year")
  const [customRange, setCustomRange] = useState<{ start: Date; end: Date } | undefined>()
  const [activeTab, setActiveTab] = useState("contacts")
  const [searchQuery, setSearchQuery] = useState<string | null>(null)
  const [targetTimestamp, setTargetTimestamp] = useState<number | undefined>()
  const { theme, setTheme } = useTheme()

  const handleDataLoaded = useCallback((loadedData: InstagramData) => {
    setData(loadedData)
  }, [])

  const handleConversationSelect = useCallback((conversation: Conversation) => {
    setSelectedConversation(conversation)
    setTargetTimestamp(undefined)
  }, [])

  const handleSelectContact = useCallback((contactName: string) => {
    if (!data) return
    const conv = data.conversations.find(c => c.title === contactName)
    if (conv) {
      setSelectedConversation(conv)
      setTargetTimestamp(undefined)
    }
  }, [data])

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
  }, [])

  const handleSearchBack = useCallback(() => {
    setSearchQuery(null)
  }, [])

  const handleSearchResultClick = useCallback((conversation: Conversation, message: InstagramMessage) => {
    setSelectedConversation(conversation)
    setTargetTimestamp(message.timestamp)
    setSearchQuery(null)
    setActiveTab("messages")
  }, [])

  const userName = data?.userName || "You"

  const filteredStats = useMemo(() => {
    if (!data) return []
    if (timeMode === "custom" && customRange) {
      const cutoffStart = customRange.start.getTime()
      const cutoffEnd = customRange.end.getTime()
      const map = new Map<string, {
        name: string; totalMessages: number; messagesYouSent: number; messagesTheySent: number
        hourlyDistribution: number[]; firstMessage: number; lastMessage: number
      }>()
      for (const conv of data.conversations) {
        const otherParticipants = conv.participants.filter((p) => p !== userName)
        const contactName = otherParticipants.join(", ") || conv.title
        if (!contactName || contactName === "Unknown") continue
        for (const msg of conv.messages) {
          if (msg.timestamp < cutoffStart || msg.timestamp > cutoffEnd) continue
          if (!map.has(contactName)) {
            map.set(contactName, {
              name: contactName, totalMessages: 0, messagesYouSent: 0, messagesTheySent: 0,
              hourlyDistribution: new Array(24).fill(0), firstMessage: Infinity, lastMessage: -Infinity,
            })
          }
          const stats = map.get(contactName)!
          stats.totalMessages++
          const hour = new Date(msg.timestamp).getHours()
          stats.hourlyDistribution[hour]++
          if (msg.sender === userName) stats.messagesYouSent++
          else stats.messagesTheySent++
          if (msg.timestamp < stats.firstMessage) stats.firstMessage = msg.timestamp
          if (msg.timestamp > stats.lastMessage) stats.lastMessage = msg.timestamp
        }
      }
      return Array.from(map.values())
        .map(s => ({ ...s, firstMessage: s.firstMessage === Infinity ? 0 : s.firstMessage, lastMessage: s.lastMessage === -Infinity ? 0 : s.lastMessage }))
        .filter(s => s.totalMessages > 0)
        .sort((a, b) => b.totalMessages - a.totalMessages)
        .slice(0, 30)
    }
    if (!data.contactStatsByMode) return []
    return (data.contactStatsByMode[timeMode] ?? data.precomputedContactStats).slice(0, 30)
  }, [data, timeMode, customRange, userName])



  if (!data) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-6 w-6" />
              <h1 className="text-xl font-bold">Instagram Data Viewer</h1>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>
          </div>
        </header>
        <main className="container py-8">
          <Upload onDataLoaded={handleDataLoaded} />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background z-10">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-6 w-6" />
            <h1 className="text-xl font-bold">Instagram Data Viewer</h1>
          </div>
          <div className="flex items-center gap-4">
            <SearchBar onSearch={handleSearch} />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-6">
        {searchQuery ? (
          <SearchResults
            query={searchQuery}
            conversations={data.conversations}
            onBack={handleSearchBack}
            onResultClick={handleSearchResultClick}
          />
        ) : (
          <>
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-semibold">Your Messaging Stats</h2>
                  <p className="text-muted-foreground">
                    {data.totalMessages.toLocaleString()} total messages across{" "}
                    {data.conversations.length} conversations
                  </p>
                </div>
                <TimeModeSelector mode={timeMode} onModeChange={setTimeMode} customRange={customRange} onCustomRangeChange={setCustomRange} />
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList>
                <TabsTrigger value="contacts">Contacts</TabsTrigger>
                <TabsTrigger value="stats">Trends</TabsTrigger>
                <TabsTrigger value="messages">Messages</TabsTrigger>
              </TabsList>

              <TabsContent value="contacts">
                <StatsPanel
                  conversations={data.conversations}
                  userName={userName}
                  precomputedStats={filteredStats}
                  onSelectContact={handleSelectContact}
                />
              </TabsContent>

              <TabsContent value="stats" className="space-y-4">
                <MessagingChart
                  dailyCountsByContact={data.dailyCountsByContact ?? {}}
                  mode={timeMode}
                  customRange={customRange}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-6 rounded-lg border bg-card">
                    <p className="text-sm text-muted-foreground">Total Conversations</p>
                    <p className="text-3xl font-bold mt-1">{data.conversations.length}</p>
                  </div>
                  <div className="p-6 rounded-lg border bg-card">
                    <p className="text-sm text-muted-foreground">Group Chats</p>
                    <p className="text-3xl font-bold mt-1">
                      {data.conversations.filter((c) => c.isGroup).length}
                    </p>
                  </div>
                  <div className="p-6 rounded-lg border bg-card">
                    <p className="text-sm text-muted-foreground">1:1 Chats</p>
                    <p className="text-3xl font-bold mt-1">
                      {data.conversations.filter((c) => !c.isGroup).length}
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="messages">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-1">
                    <ConversationList
                      conversations={data.conversations}
                      selectedId={selectedConversation?.id}
                      onSelect={handleConversationSelect}
                    />
                  </div>
                  <div className="md:col-span-2">
                    {selectedConversation ? (
                      <MessageViewer
                        conversation={selectedConversation}
                        userName={userName}
                        zipFile={data.zipFile}
                        targetTimestamp={targetTimestamp}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full min-h-[400px] border rounded-lg">
                        <p className="text-muted-foreground">
                          Select a conversation to view messages
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </div>
  )
}

export default App
