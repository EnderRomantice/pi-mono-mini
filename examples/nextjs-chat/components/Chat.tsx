'use client';

import { useEffect, useRef, useState } from 'react';
import { 
  requestNotificationPermission, 
  showNotification,
  isNotificationSupported,
  getNotificationPermission 
} from '@/lib/notifications';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

interface Task {
  id: string;
  name: string;
  action: { prompt: string };
  nextRun?: number;
  enabled: boolean;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [delaySeconds, setDelaySeconds] = useState(10);
  const [reminderText, setReminderText] = useState('');
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Initialize
  useEffect(() => {
    init();
    
    // Check notification permission
    setNotifPermission(getNotificationPermission());
    
    // Cleanup
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function init() {
    try {
      setError(null);
      
      // Create or get session
      const res = await fetch('/api/chat', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', title: 'Chat' }) 
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
      
      const data = await res.json();
      setSessionId(data.sessionId);
      
      // Load messages
      const msgRes = await fetch(`/api/chat?sessionId=${data.sessionId}`);
      if (!msgRes.ok) throw new Error('Failed to load messages');
      
      const msgData = await msgRes.json();
      setMessages(msgData.messages || []);
      
      // Load tasks
      await loadTasks();
      
      // Connect to SSE
      connectEventSource();
    } catch (e: any) {
      console.error('Failed to init:', e);
      setError(e.message || 'Failed to initialize');
    } finally {
      setInitializing(false);
    }
  }

  function connectEventSource() {
    const es = new EventSource('/api/events');
    eventSourceRef.current = es;
    
    es.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'message') {
        setMessages(prev => {
          // Avoid duplicates
          if (prev.find(m => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
        setLoading(false);
      } else if (data.type === 'proactive') {
        // Show browser notification for proactive tasks
        showNotification(
          '⏰ Reminder',
          data.task.prompt,
          { tag: data.task.name }
        );
        
        // Also add as system message
        const systemMsg: Message = {
          id: `proactive-${Date.now()}`,
          role: 'system',
          content: `🔔 Reminder: ${data.task.prompt}`,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, systemMsg]);
        
        // Refresh tasks
        loadTasks();
      }
    };
    
    es.onerror = () => {
      console.log('SSE error, reconnecting...');
      es.close();
      setTimeout(connectEventSource, 3000);
    };
  }

  async function loadTasks() {
    try {
      const res = await fetch('/api/proactive');
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch (e) {
      console.error('Failed to load tasks:', e);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !sessionId || loading) return;
    
    const content = input.trim();
    setInput('');
    setLoading(true);
    
    // Optimistically add user message
    const userMsg: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    
    try {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', sessionId, content }),
      });
      // Response will come via SSE
    } catch (e) {
      console.error('Failed to send:', e);
      setLoading(false);
    }
  }

  async function scheduleReminder(e: React.FormEvent) {
    e.preventDefault();
    if (!reminderText.trim()) return;
    
    try {
      const res = await fetch('/api/proactive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delaySeconds,
          prompt: reminderText,
          name: `reminder-${Date.now()}`,
        }),
      });
      
      if (res.ok) {
        setReminderText('');
        loadTasks();
      }
    } catch (e) {
      console.error('Failed to schedule:', e);
    }
  }

  async function enableNotifications() {
    const granted = await requestNotificationPermission();
    setNotifPermission(granted ? 'granted' : 'denied');
  }

  if (initializing) {
    return (
      <div className="chat-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <h2>🚀 Loading...</h2>
          <p>Initializing chat session</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="chat-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center', color: '#e74c3c' }}>
          <h2>❌ Error</h2>
          <p>{error}</p>
          <button 
            onClick={() => { setInitializing(true); init(); }}
            style={{ 
              marginTop: '20px', 
              padding: '10px 20px',
              background: '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-container">
      {/* Header */}
      <header className="header">
        <h1>🚀 Next.js Chat with Proactive</h1>
        
        {isNotificationSupported() && notifPermission !== 'granted' && (
          <button onClick={enableNotifications} className="notif-btn">
            🔔 Enable Notifications
          </button>
        )}
      </header>

      <div className="main-content">
        {/* Chat Area */}
        <div className="chat-area">
          <div className="messages">
            {messages.length === 0 && (
              <div className="empty">Start a conversation...</div>
            )}
            
            {messages.map((msg) => (
              <div key={msg.id} className={`message ${msg.role}`}>
                <div className="role">
                  {msg.role === 'user' ? '👤' : msg.role === 'assistant' ? '🤖' : '🔔'}
                </div>
                <div className="content">{msg.content}</div>
              </div>
            ))}
            
            {loading && (
              <div className="message assistant loading">
                <div className="role">🤖</div>
                <div className="content">Thinking...</div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
          
          <form onSubmit={handleSend} className="input-form">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              disabled={loading}
            />
            <button type="submit" disabled={loading || !input.trim()}>
              Send
            </button>
          </form>
        </div>

        {/* Sidebar */}
        <aside className="sidebar">
          {/* Schedule Reminder */}
          <div className="section">
            <h3>⏰ Schedule Reminder</h3>
            <form onSubmit={scheduleReminder}>
              <input
                type="text"
                value={reminderText}
                onChange={(e) => setReminderText(e.target.value)}
                placeholder="What to remind?"
              />
              <div className="delay-row">
                <label>in</label>
                <input
                  type="number"
                  min={1}
                  max={3600}
                  value={delaySeconds}
                  onChange={(e) => setDelaySeconds(Number(e.target.value))}
                />
                <span>seconds</span>
              </div>
              <button type="submit" disabled={!reminderText.trim()}>
                Schedule
              </button>
            </form>
          </div>

          {/* Active Tasks */}
          <div className="section">
            <h3>📅 Scheduled Tasks ({tasks.length})</h3>
            <ul className="task-list">
              {tasks.map((task) => (
                <li key={task.id} className={task.enabled ? '' : 'disabled'}>
                  <div className="task-name">{task.action.prompt}</div>
                  <div className="task-time">
                    {task.nextRun 
                      ? new Date(task.nextRun).toLocaleTimeString()
                      : 'Completed'}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Instructions */}
          <div className="section instructions">
            <h3>💡 Tips</h3>
            <ul>
              <li>Type messages to chat with AI</li>
              <li>Schedule reminders for later</li>
              <li>Enable notifications to get alerted</li>
              <li>Switch to another tab to test notifications</li>
            </ul>
          </div>
        </aside>
      </div>

      <style jsx>{`
        .chat-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
          height: 100vh;
          display: flex;
          flex-direction: column;
        }
        
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 20px;
          border-bottom: 1px solid #eee;
        }
        
        .header h1 {
          margin: 0;
          font-size: 1.5rem;
        }
        
        .notif-btn {
          padding: 8px 16px;
          background: #0070f3;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .main-content {
          display: flex;
          flex: 1;
          gap: 20px;
          margin-top: 20px;
          overflow: hidden;
        }
        
        .chat-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          border: 1px solid #eee;
          border-radius: 8px;
          overflow: hidden;
        }
        
        .messages {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .empty {
          text-align: center;
          color: #999;
          margin-top: 50px;
        }
        
        .message {
          display: flex;
          gap: 12px;
          padding: 12px;
          border-radius: 8px;
        }
        
        .message.user {
          background: #f0f0f0;
        }
        
        .message.assistant {
          background: #e3f2fd;
        }
        
        .message.system {
          background: #fff3e0;
          font-style: italic;
        }
        
        .role {
          font-size: 1.2rem;
        }
        
        .content {
          flex: 1;
          line-height: 1.5;
          white-space: pre-wrap;
        }
        
        .input-form {
          display: flex;
          gap: 8px;
          padding: 16px;
          border-top: 1px solid #eee;
          background: #fafafa;
        }
        
        .input-form input {
          flex: 1;
          padding: 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 1rem;
        }
        
        .input-form button {
          padding: 12px 24px;
          background: #0070f3;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .input-form button:disabled {
          background: #ccc;
          cursor: not-allowed;
        }
        
        .sidebar {
          width: 300px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          overflow-y: auto;
        }
        
        .section {
          border: 1px solid #eee;
          border-radius: 8px;
          padding: 16px;
        }
        
        .section h3 {
          margin: 0 0 12px 0;
          font-size: 1rem;
        }
        
        .section input {
          width: 100%;
          padding: 8px;
          margin-bottom: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }
        
        .delay-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }
        
        .delay-row input {
          width: 60px;
          margin: 0;
          text-align: center;
        }
        
        .section button {
          width: 100%;
          padding: 10px;
          background: #28a745;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .section button:disabled {
          background: #ccc;
        }
        
        .task-list {
          list-style: none;
          padding: 0;
          margin: 0;
          max-height: 200px;
          overflow-y: auto;
        }
        
        .task-list li {
          padding: 8px;
          border-bottom: 1px solid #eee;
          font-size: 0.9rem;
        }
        
        .task-list li.disabled {
          opacity: 0.5;
        }
        
        .task-name {
          font-weight: 500;
          margin-bottom: 4px;
        }
        
        .task-time {
          font-size: 0.8rem;
          color: #666;
        }
        
        .instructions ul {
          margin: 0;
          padding-left: 16px;
          font-size: 0.9rem;
          color: #666;
        }
        
        .instructions li {
          margin-bottom: 4px;
        }
      `}</style>
    </div>
  );
}
