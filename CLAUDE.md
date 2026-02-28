# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (http://localhost:5173)
npm run build        # Type-check then bundle for production (tsc -b && vite build)
npm run lint         # Run ESLint
npm run test         # Run tests once
npm run test:watch   # Run tests in watch mode
npm run preview      # Preview production build
```

Run a single test file:
```bash
npx vitest run src/test/instagram-parser.test.ts
```

## Architecture

**InstaData** is a client-side-only React/TypeScript app that parses Instagram data export ZIP files and visualizes messaging patterns. All processing happens in the browser — no data is ever sent to a server.

### Data Flow

1. User uploads a ZIP file via `Upload.tsx`
2. A Web Worker (`src/workers/zip-worker.ts`) parses the ZIP off the main thread, reading `message_*.json` files from the export, merging conversations by title, detecting the current user as the most frequent sender, and pre-computing all contact stats
3. The worker posts progress updates (0–100%) and returns an `InstagramData` object
4. `App.tsx` stores the data and renders a three-tab interface: Contacts, Trends, Messages

### Key Files

- **`src/lib/instagram-parser.ts`** — All business logic and data types (`InstagramMessage`, `Conversation`, `InstagramData`, `ContactStats`, `TimeMode`). Functions: `getTopContacts`, `getMessagingTrend`, `getAllContactStats`, `getContactStats`, `getGroupMemberStats`, `searchMessages`, `getConversationMessages`, `getAvailableMonths`
- **`src/workers/zip-worker.ts`** — ZIP parsing + pre-computation in a Web Worker; handles flexible JSON property name variants across Instagram export formats
- **`src/App.tsx`** — Global state (Instagram data, selected conversation, time mode); memoizes stats for performance
- **`src/components/ui/`** — Shadcn-style Radix UI components; treat as a library (don't modify unless changing the design system)

### Path Alias

`@/` maps to `src/` (configured in `vite.config.ts`).

### Styling

Tailwind CSS with dark mode via the `class` strategy. `ThemeProvider` (in `src/components/theme-provider.tsx`) stores preference under the localStorage key `"instagram-viewer-theme"`.
