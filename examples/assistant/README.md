# Smart Assistant Example

A demo combining `chat` and `proactive` packages to create a smart assistant that can:
- Have normal conversations
- Set reminders based on natural language (e.g., "remind me in 10 seconds")
- Proactively notify the user when time is up

## Usage

```bash
npm run example:assistant
```

## How it works

```
User Input → Intent Parser → Route
                              ├── "schedule" → ProactiveAgent.schedule()
                              └── "chat"     → ChatSession.send()
                                              
Proactive Trigger ────────→ Chat Display (⏰ notification)
```

## Example Conversation

```
👤 > remind me in 5 seconds to drink water
🤖 ✅ Scheduled: drink water (in 5 seconds)

👤 > tell me a joke
🤖 Why did the scarecrow win an award? ...

⏰ [5 seconds later]
⏰ Reminder: drink water
```
