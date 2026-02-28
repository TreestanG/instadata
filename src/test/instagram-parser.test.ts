import { describe, it, expect } from 'vitest'
import {
  getTopContacts,
  getAllContactStats,
  getContactStats,
  getGroupMemberStats,
  searchMessages,
} from '../lib/instagram-parser'
import type { Conversation } from '../lib/instagram-parser'

const createMockConversation = (
  title: string,
  participants: string[],
  messages: Array<{ sender: string; text: string; timestamp: number }>
): Conversation => ({
  id: title,
  title,
  participants,
  messages,
  isGroup: participants.length > 2,
  startTime: messages[0]?.timestamp || 0,
  endTime: messages[messages.length - 1]?.timestamp || 0,
  messageCount: messages.length,
})

describe('getTopContacts', () => {
  // Use current timestamps to avoid year 2000 filter issue
  const now = Date.now()
  
  it('should exclude "You" from contacts', () => {
    const conversations: Conversation[] = [
      createMockConversation('Chat with Alice', ['You', 'Alice'], [
        { sender: 'You', text: 'Hello', timestamp: now - 100000 },
        { sender: 'Alice', text: 'Hi', timestamp: now - 50000 },
        { sender: 'You', text: 'How are you?', timestamp: now },
      ]),
    ]

    const result = getTopContacts(conversations, 'all', 10)

    expect(result.map(r => r.name)).toEqual(['Alice'])
    expect(result[0].count).toBe(3)
  })

  it('should handle multiple contacts', () => {
    const conversations: Conversation[] = [
      createMockConversation('Chat with Alice', ['You', 'Alice'], [
        { sender: 'You', text: 'Hello', timestamp: now - 300000 },
        { sender: 'Alice', text: 'Hi', timestamp: now - 200000 },
      ]),
      createMockConversation('Chat with Bob', ['You', 'Bob'], [
        { sender: 'You', text: 'Hey', timestamp: now - 100000 },
        { sender: 'Bob', text: 'Hey!', timestamp: now - 50000 },
        { sender: 'You', text: 'Whats up', timestamp: now },
      ]),
    ]

    const result = getTopContacts(conversations, 'all', 10)

    expect(result.map(r => r.name)).toEqual(['Bob', 'Alice'])
    expect(result[0].count).toBe(3) // Bob has 3 messages (2 from you, 1 from Bob)
    expect(result[1].count).toBe(2) // Alice has 2 messages
  })

  it('should filter by time mode', () => {
    const dayAgo = now - 24 * 60 * 60 * 1000
    const monthAgo = now - 35 * 24 * 60 * 60 * 1000

    const conversations: Conversation[] = [
      createMockConversation('Chat with Alice', ['You', 'Alice'], [
        { sender: 'You', text: 'Old message', timestamp: monthAgo },
        { sender: 'You', text: 'Recent message', timestamp: now },
        { sender: 'Alice', text: 'Reply', timestamp: dayAgo },
      ]),
    ]

    const monthResult = getTopContacts(conversations, 'month', 10)
    const yearResult = getTopContacts(conversations, 'year', 10)

    expect(monthResult[0].count).toBeLessThan(yearResult[0].count)
  })

  it('should return empty array for empty conversations', () => {
    const result = getTopContacts([], 'all', 10)
    expect(result).toEqual([])
  })
})

describe('getAllContactStats', () => {
  it('should exclude "You" from contacts list', () => {
    const conversations: Conversation[] = [
      createMockConversation('Chat with Alice', ['You', 'Alice'], [
        { sender: 'You', text: 'Hello', timestamp: 1000 },
        { sender: 'Alice', text: 'Hi', timestamp: 2000 },
      ]),
    ]

    const result = getAllContactStats(conversations, 20)

    expect(result.length).toBe(1)
    expect(result[0].name).toBe('Alice')
  })

  it('should calculate correct message counts', () => {
    const conversations: Conversation[] = [
      createMockConversation('Chat with Alice', ['You', 'Alice'], [
        { sender: 'You', text: 'Hello', timestamp: 1000 },
        { sender: 'Alice', text: 'Hi', timestamp: 2000 },
        { sender: 'You', text: 'How are you?', timestamp: 3000 },
      ]),
    ]

    const result = getAllContactStats(conversations, 20)

    expect(result[0].messagesYouSent).toBe(2)
    expect(result[0].messagesTheySent).toBe(1)
    expect(result[0].totalMessages).toBe(3)
  })

  it('should calculate peak hours', () => {
    const conversations: Conversation[] = [
      createMockConversation('Chat with Alice', ['You', 'Alice'], [
        { sender: 'You', text: 'Msg1', timestamp: new Date(2024, 0, 1, 10, 0).getTime() },
        { sender: 'Alice', text: 'Msg2', timestamp: new Date(2024, 0, 1, 10, 30).getTime() },
        { sender: 'You', text: 'Msg3', timestamp: new Date(2024, 0, 1, 10, 45).getTime() },
        { sender: 'Alice', text: 'Msg4', timestamp: new Date(2024, 0, 1, 14, 0).getTime() },
      ]),
    ]

    const result = getAllContactStats(conversations, 20)

    expect(result[0].hourlyDistribution[10]).toBe(3) // 10am has 3 messages
    expect(result[0].hourlyDistribution[14]).toBe(1) // 2pm has 1 message
  })
})

describe('getContactStats', () => {
  it('should return null for non-existent contact', () => {
    const conversations: Conversation[] = [
      createMockConversation('Chat with Alice', ['You', 'Alice'], [
        { sender: 'You', text: 'Hello', timestamp: 1000 },
      ]),
    ]

    const result = getContactStats(conversations, 'Bob')
    expect(result).toBeNull()
  })

  it('should return stats for existing contact', () => {
    const conversations: Conversation[] = [
      createMockConversation('Chat with Alice', ['You', 'Alice'], [
        { sender: 'You', text: 'Hello', timestamp: 1000 },
        { sender: 'Alice', text: 'Hi', timestamp: 2000 },
      ]),
    ]

    const result = getContactStats(conversations, 'Alice')

    expect(result).not.toBeNull()
    expect(result?.name).toBe('Alice')
    expect(result?.totalMessages).toBe(2)
    expect(result?.messagesYouSent).toBe(1)
    expect(result?.messagesTheySent).toBe(1)
  })
})

describe('getGroupMemberStats', () => {
  it('should return empty array for non-group chats', () => {
    const conversation = createMockConversation('Chat', ['You', 'Alice'], [
      { sender: 'You', text: 'Hello', timestamp: 1000 },
    ])

    const result = getGroupMemberStats(conversation)
    expect(result).toEqual([])
  })

  it('should return member stats for group chats', () => {
    const conversation = createMockConversation('Group Chat', ['Alice', 'Bob', 'Charlie'], [
      { sender: 'Alice', text: 'Hi', timestamp: 1000 },
      { sender: 'Bob', text: 'Hello', timestamp: 2000 },
      { sender: 'Alice', text: 'Howdy', timestamp: 3000 },
      { sender: 'Charlie', text: 'Hey', timestamp: 4000 },
    ])

    const result = getGroupMemberStats(conversation)

    expect(result.length).toBe(3)
    expect(result[0].member).toBe('Alice') // 2 messages
    expect(result[0].count).toBe(2)
  })
})

describe('searchMessages', () => {
  it('should find messages matching query', () => {
    const conversations: Conversation[] = [
      createMockConversation('Chat with Alice', ['You', 'Alice'], [
        { sender: 'You', text: 'Hello world', timestamp: 1000 },
        { sender: 'Alice', text: 'Hi there', timestamp: 2000 },
        { sender: 'You', text: 'world is big', timestamp: 3000 },
      ]),
    ]

    const results = searchMessages(conversations, 'world')

    expect(results.length).toBe(2)
  })

  it('should be case insensitive', () => {
    const conversations: Conversation[] = [
      createMockConversation('Chat', ['You', 'Alice'], [
        { sender: 'You', text: 'HELLO', timestamp: 1000 },
      ]),
    ]

    const results = searchMessages(conversations, 'hello')
    expect(results.length).toBe(1)
  })

  it('should filter by conversation when provided', () => {
    const conversations: Conversation[] = [
      createMockConversation('Chat1', ['You', 'Alice'], [
        { sender: 'You', text: 'Hello', timestamp: 1000 },
      ]),
      createMockConversation('Chat2', ['You', 'Bob'], [
        { sender: 'You', text: 'Hello', timestamp: 2000 },
      ]),
    ]

    const results = searchMessages(conversations, 'hello', 'Chat1')
    expect(results.length).toBe(1)
    expect(results[0].conversation.id).toBe('Chat1')
  })
})