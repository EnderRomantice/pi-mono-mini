# Next.js Chat with Proactive Notifications

A full-stack chat application demonstrating:
- **Backend**: `chat` and `proactive` packages for session management and scheduled tasks
- **Frontend**: React + Server-Sent Events for real-time updates
- **Notifications**: Browser Notification API for proactive reminders

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (Next.js App Router)                                   │
│  ├── Chat UI → HTTP POST /api/chat                              │
│  ├── SSE Client → GET /api/events (real-time updates)           │
│  └── Notification API → Browser notifications                   │
├─────────────────────────────────────────────────────────────────┤
│  Backend (Next.js API Routes)                                    │
│  ├── SessionManager → Chat sessions & persistence               │
│  ├── ProactiveAgent → Scheduled task execution                  │
│  └── SSE Broadcast → Push to connected clients                  │
└─────────────────────────────────────────────────────────────────┘
```

## Features

- 💬 **Real-time Chat**: AI responses via Server-Sent Events
- ⏰ **Scheduled Reminders**: "Remind me in 10 seconds to drink water"
- 🔔 **Browser Notifications**: Get alerted even when tab is inactive
- 💾 **Persistent Sessions**: Conversations survive page reloads

## Quick Start

### 1. Set Environment Variables

```bash
export DEEPSEEK_API_KEY=sk-...
# or
export OPENAI_API_KEY=sk-...
```

### 2. Install & Run

```bash
cd examples/nextjs-chat
npm install
npm run dev
```

### 3. Open Browser

Navigate to `http://localhost:3000`

**First time**: Click "Enable Notifications" to allow browser notifications.

## Usage

### Chat
1. Type a message and press Enter
2. AI responds in real-time

### Schedule Reminder
1. Enter reminder text (e.g., "drink water")
2. Set delay (seconds)
3. Click "Schedule"
4. Switch to another tab
5. When time is up, you'll get a browser notification!

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat` | GET | List sessions or get messages |
| `/api/chat` | POST | Create session or send message |
| `/api/proactive` | GET | List scheduled tasks |
| `/api/proactive` | POST | Create a scheduled task |
| `/api/events` | GET | Server-Sent Events stream |

## How It Works

### Proactive → Notification Flow

```
1. User schedules reminder
   POST /api/proactive { delaySeconds: 10, prompt: "drink water" }
   ↓
2. ProactiveAgent schedules task
   Scheduler → pending/task-xxx.json
   ↓
3. Watcher detects file change
   ↓
4. Broadcast via SSE
   All connected clients receive: { type: "proactive", task: {...} }
   ↓
5. Frontend shows notification
   new Notification("⏰ Reminder", { body: "drink water" })
```

## Customization

### Change LLM Provider

Edit `lib/chat.ts` or set environment:
```bash
export KIMI_API_KEY=sk-...
export OPENAI_API_KEY=sk-...
```

### Persistent Storage

Sessions and tasks are stored in:
- `.pi/nextjs-chat/` - Session data
- `.pi/nextjs-chat/proactive/` - Scheduled tasks

### Notification Behavior

Edit `lib/notifications.ts` to customize:
- Notification icons
- Vibration patterns
- Click actions

## Production Considerations

1. **Authentication**: Add user sessions before deploying
2. **Database**: Replace file storage with PostgreSQL/MongoDB
3. **Scaling**: Use Redis for SSE broadcasting across instances
4. **Security**: Validate all inputs, rate limit APIs

## File Structure

```
app/
├── api/
│   ├── chat/route.ts       # Chat API
│   ├── proactive/route.ts  # Proactive tasks API
│   └── events/route.ts     # SSE endpoint
├── page.tsx                # Main page
├── layout.tsx              # Root layout
components/
└── Chat.tsx                # Chat UI component
lib/
├── chat.ts                 # Backend chat manager
└── notifications.ts        # Browser notification helpers
```
