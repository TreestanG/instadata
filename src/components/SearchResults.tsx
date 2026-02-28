import { useMemo, useState } from "react"
import { ArrowLeft, CalendarIcon, Check, ChevronsUpDown, X } from "lucide-react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { cn } from "@/lib/utils"
import type { Conversation, InstagramMessage } from "@/lib/instagram-parser"
import { searchMessages } from "@/lib/instagram-parser"

interface SearchResultsProps {
  query: string
  conversations: Conversation[]
  onBack: () => void
  onResultClick: (conversation: Conversation, message: InstagramMessage) => void
}

export function SearchResults({ query, conversations, onBack, onResultClick }: SearchResultsProps) {
  const [convOpen, setConvOpen] = useState(false)
  const [conversationFilter, setConversationFilter] = useState<string>("all")
  const [dateStart, setDateStart] = useState<string>("")
  const [dateEnd, setDateEnd] = useState<string>("")

  const dateRange = useMemo(() => {
    if (!dateStart && !dateEnd) return undefined
    const start = dateStart ? new Date(dateStart + "T00:00:00") : new Date(0)
    const end = dateEnd ? new Date(dateEnd + "T23:59:59.999") : new Date()
    return { start, end }
  }, [dateStart, dateEnd])

  const hasDateFilter = Boolean(dateStart || dateEnd)

  const results = useMemo(() => {
    return searchMessages(
      conversations,
      query,
      conversationFilter === "all" ? undefined : conversationFilter,
      dateRange
    )
  }, [query, conversationFilter, conversations, dateRange])

  const selectedConv = conversations.find((c) => c.id === conversationFilter)

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

      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted-foreground">
          {results.length} result{results.length !== 1 ? "s" : ""} found
        </p>

        {/* Searchable conversation combobox */}
        <Popover open={convOpen} onOpenChange={setConvOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={convOpen}
              className="w-[220px] justify-between font-normal"
            >
              <span className="truncate">
                {selectedConv ? selectedConv.title : "All Conversations"}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search conversations..." />
              <CommandList>
                <CommandEmpty>No conversation found.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="all"
                    onSelect={() => {
                      setConversationFilter("all")
                      setConvOpen(false)
                    }}
                  >
                    <Check
                      className={cn("mr-2 h-4 w-4", conversationFilter === "all" ? "opacity-100" : "opacity-0")}
                    />
                    All Conversations
                  </CommandItem>
                  {conversations.map((conv) => (
                    <CommandItem
                      key={conv.id}
                      value={conv.title}
                      onSelect={() => {
                        setConversationFilter(conv.id)
                        setConvOpen(false)
                      }}
                    >
                      <Check
                        className={cn("mr-2 h-4 w-4", conversationFilter === conv.id ? "opacity-100" : "opacity-0")}
                      />
                      {conv.title}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Date range filter */}
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            type="date"
            value={dateStart}
            onChange={(e) => setDateStart(e.target.value)}
            max={dateEnd || undefined}
            className="w-[150px] text-sm"
            title="Start date"
          />
          <span className="text-muted-foreground text-sm">–</span>
          <Input
            type="date"
            value={dateEnd}
            onChange={(e) => setDateEnd(e.target.value)}
            min={dateStart || undefined}
            className="w-[150px] text-sm"
            title="End date"
          />
          {hasDateFilter && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => { setDateStart(""); setDateEnd("") }}
              title="Clear date filter"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
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
