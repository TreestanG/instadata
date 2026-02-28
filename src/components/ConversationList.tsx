import { format } from "date-fns"
import { MessageSquare, Users } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { Conversation } from "@/lib/instagram-parser"

interface ConversationListProps {
  conversations: Conversation[]
  selectedId?: string
  onSelect: (conversation: Conversation) => void
}

export function ConversationList({ conversations, selectedId, onSelect }: ConversationListProps) {
  const sortedConvs = [...conversations].sort(
    (a, b) => b.messageCount - a.messageCount
  )

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg">Conversations</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[calc(100vh-280px)]">
          <div className="space-y-1 p-4 pt-0">
            {sortedConvs.map((conv) => (
              <button
                key={conv.id}
                onClick={() => onSelect(conv)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  selectedId === conv.id
                    ? "bg-primary/10 border border-primary"
                    : "hover:bg-muted border border-transparent"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-1">
                    {conv.isGroup ? (
                      <Users className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-sm">
                      {conv.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {conv.isGroup
                        ? `${conv.participants.length} members`
                        : conv.participants.filter(p => p !== "Unknown").join(", ") || "Unknown"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {conv.messageCount.toLocaleString()} messages
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(conv.startTime), "MMM yyyy")} - {format(new Date(conv.endTime), "MMM yyyy")}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
