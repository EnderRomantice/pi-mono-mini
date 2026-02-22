# NestJS + React Example

This example demonstrates using **pi-mono-mini** with a **NestJS** backend and **React** frontend.

## Architecture

```
┌─────────────────┐      WebSocket/HTTP      ┌─────────────────┐
│                 │ ◄──────────────────────► │                 │
│  React Frontend │                          │  NestJS Backend │
│   (Vite)        │                          │  (pi-mono-mini) │
│   Port: 5173    │                          │   Port: 3000    │
└─────────────────┘                          └─────────────────┘
```
## Features

- ✅ Real-time chat via WebSocket
- ✅ Session management
- ✅ Proactive agent notifications
- ✅ Streaming responses
- ✅ Multiple chat sessions

## Quick Start

### 1. Install Backend Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment Variables

Create `backend/.env`:

```env
# Choose one of the following:
DEEPSEEK_API_KEY=sk-your-key-here
# KIMI_API_KEY=sk-your-key-here
# OPENAI_API_KEY=sk-your-key-here
```

### 3. Start Backend

```bash
cd backend
npm run dev
```

Backend will start on http://localhost:3000

### 4. Install Frontend Dependencies

```bash
cd frontend
npm install
```

### 5. Start Frontend

```bash
cd frontend
npm run dev
```

Frontend will start on http://localhost:5173

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/chat/health` | Check service status |
| GET | `/api/chat/sessions` | List all sessions |
| POST | `/api/chat/sessions` | Create new session |
| GET | `/api/chat/sessions/:id/messages` | Get session messages |
| POST | `/api/chat/sessions/:id/messages` | Send message |
| WS | `/` | WebSocket for real-time updates |

## WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `connected` | Server → Client | Connection established |
| `message` | Server → Client | New message received |
| `stream:start` | Server → Client | Streaming started |
| `stream:chunk` | Server → Client | Streaming chunk |
| `stream:end` | Server → Client | Streaming ended |
| `proactive` | Server → Client | Proactive task triggered |

## Development

### Backend (NestJS)

```bash
cd backend
npm run dev        # Development with hot reload
npm run build      # Build for production
npm start          # Start production build
```

### Frontend (React + Vite)

```bash
cd frontend
npm run dev        # Development server
npm run build      # Build for production
npm run preview    # Preview production build
```

## Project Structure

```
nestjs-react/
├── backend/
│   ├── src/
│   │   ├── chat/
│   │   │   ├── chat.controller.ts    # HTTP API
│   │   │   ├── chat.gateway.ts       # WebSocket
│   │   │   ├── chat.module.ts        # Module definition
│   │   │   └── chat.service.ts       # Business logic
│   │   ├── app.module.ts             # Root module
│   │   └── main.ts                   # Entry point
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx                   # Main component
│   │   ├── main.tsx                  # Entry point
│   │   └── index.css                 # Styles
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
└── README.md
```
