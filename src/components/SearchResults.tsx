import { useMemo, useState } from "react"
import { ArrowLeft } from "lucide-react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Conversation, InstagramMessage } from "@/lib/instagram-parser"
import { searchMessages } from "@/lib/instagram-parser"

interface SearchResultsProps {
  query: string
  conversations: Conversation[]
  onBack: () => void
  onResultClick: (conversation: Conversation, message: InstagramMessage) => void
}

export function SearchResults({ query, conversations, onBack, onResultClick }: SearchResultsProps) {
  const [conversationFilter, setConversationFilter] = useState<string>("all")

  const results = useMemo(() => {
    return searchMessages(
      conversations,
      query,
      conversationFilter === "all" ? undefined : conversationFilter
    )
  }, [query, conversationFilter, conversations])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h2 className="text-xl font-semibold">
          Search results for "{query}"
        </h2>
      </div>

      <div className="flex items-center gap-4">
        <p className="text-sm text-muted-foreground">
          {results.length} result{results.length !== 1 ? "s" : ""} found
        </p>
        <Select value={conversationFilter} onValueChange={setConversationFilter}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="All Conversations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Conversations</SelectItem>
            {conversations.map((conv) => (
              <SelectItem key={conv.id} value={conv.id}>
                {conv.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-300px)]">
            <div className="divide-y">
              {results.map((result, idx) => (
                <button
                  key={idx}
                  onClick={() => onResultClick(result.conversation, result.message)}
                  className="w-full text-left p-4 hover:bg-muted transition-colors"
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-medium text-sm">
                      {result.conversation.title}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {format(new Date(result.message.timestamp), "MMM d, yyyy h:mm a")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {result.message.sender}
                  </p>
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                    {result.message.text}
                  </p>
                </button>
              ))}
              {results.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No results found
                </p>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
