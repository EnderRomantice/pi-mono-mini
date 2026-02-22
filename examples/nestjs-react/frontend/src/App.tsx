import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface Session {
  id: string;
  title: string;
  status: string;
  createdAt: number;
  updatedAt: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

interface ProactiveTask {
  taskName: string;
  prompt: string;
  timestamp: number;
}

// Session list item with inline editing and delete
function SessionItem({ 
  session, 
  isActive, 
  onClick, 
  onRename,
  onDelete,
}: { 
  session: Session; 
  isActive: boolean; 
  onClick: () => void;
  onRename: (title: string) => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(session.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSubmit = () => {
    onRename(editValue);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      setEditValue(session.title);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <li className="session-item editing">
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSubmit}
          onKeyDown={handleKeyDown}
        />
      </li>
    );
  }

  return (
    <li
      className={`session-item ${isActive ? 'active' : ''}`}
      onClick={onClick}
      onDoubleClick={() => setIsEditing(true)}
      title="Double-click to rename, click × to delete"
    >
      <span className="session-title">{session.title}</span>
      <span className="session-delete" onClick={onDelete}>×</span>
    </li>
  );
}

function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [health, setHealth] = useState<'ready' | 'not_configured'>('not_configured');
  const [proactiveTasks, setProactiveTasks] = useState<ProactiveTask[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const notificationEnabledRef = useRef(false);
  const activeSessionRef = useRef<string | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    notificationEnabledRef.current = notificationEnabled;
    console.log('[Notification] Status changed:', notificationEnabled);
  }, [notificationEnabled]);

  useEffect(() => {
    activeSessionRef.current = activeSession;
    console.log('[ActiveSession] Changed:', activeSession);
  }, [activeSession]);

  // Request browser notification permission
  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.log('[Notification] Browser does not support notifications');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setNotificationEnabled(true);
        console.log('[Notification] Permission granted');
      } else {
        setNotificationEnabled(false);
        console.log('[Notification] Permission denied');
      }
    } catch (err) {
      console.error('[Notification] Error requesting permission:', err);
    }
  }, []);

  // Show browser notification - defined as ref to avoid dependency issues
  const showNotificationRef = useRef((title: string, body: string) => {
    const enabled = notificationEnabledRef.current;
    console.log(`[Notification] Called with title="${title}", body="${body}", enabled=${enabled}`);
    
    if (!enabled) {
      console.log('[Notification] Skipped: permission not granted');
      return;
    }

    if (!title || !body) {
      console.log('[Notification] Skipped: empty title or body');
      return;
    }

    try {
      console.log('[Notification] Creating Notification...');
      const notification = new Notification(title, {
        body,
        icon: '/vite.svg',
        badge: '/vite.svg',
        tag: 'proactive-task',
        requireInteraction: true,
      });

      console.log('[Notification] Notification created successfully');

      notification.onclick = () => {
        console.log('[Notification] Clicked');
        window.focus();
        notification.close();
      };

      notification.onshow = () => {
        console.log('[Notification] Shown successfully');
      };

      notification.onerror = (err) => {
        console.error('[Notification] Error event:', err);
      };

      setTimeout(() => {
        console.log('[Notification] Auto-closing after 10s');
        notification.close();
      }, 10000);
    } catch (err) {
      console.error('[Notification] Error creating notification:', err);
    }
  });

  // Update the ref when enabled status changes
  useEffect(() => {
    // Ref is already initialized, just log the change
    console.log('[Notification] Effect updated, current enabled:', notificationEnabledRef.current);
  }, [notificationEnabled]);

  // Check health on mount
  useEffect(() => {
    fetch('/api/chat/health')
      .then(res => res.json())
      .then(data => setHealth(data.status))
      .catch(() => setHealth('not_configured'));
  }, []);

  // Check notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationEnabled(Notification.permission === 'granted');
    }
  }, []);

  // Load sessions on mount
  useEffect(() => {
    if (health === 'ready') {
      fetch('/api/chat/sessions')
        .then(res => res.json())
        .then(data => {
          setSessions(data);
          if (data.length > 0 && !activeSession) {
            setActiveSession(data[0].id);
          }
        });
    }
  }, [health]);

  // Load messages when active session changes
  useEffect(() => {
    if (activeSession && health === 'ready') {
      fetch(`/api/chat/sessions/${activeSession}/messages`)
        .then(res => res.json())
        .then(data => setMessages(data));
    }
  }, [activeSession, health]);

  // Setup WebSocket
  useEffect(() => {
    const socket = io('http://localhost:3000');
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket] Connected');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('[Socket] Disconnected');
      setIsConnected(false);
    });

    // Receive assistant message (complete)
    socket.on('message:sent', (data) => {
      console.log('[Socket] message:sent', data.sessionId, 'current:', activeSessionRef.current);
      if (data.sessionId === activeSessionRef.current) {
        setMessages(prev => [...prev, data.message]);
      }
      setIsLoading(false);
      // Refresh sessions to get updated titles
      fetch('/api/chat/sessions')
        .then(res => res.json())
        .then(data => setSessions(data));
    });

    // Stream chunk (for streaming responses)
    socket.on('stream:chunk', (data) => {
      console.log('[Socket] stream:chunk', data.sessionId, 'current:', activeSessionRef.current);
      if (data.sessionId === activeSessionRef.current) {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant') {
            return [
              ...prev.slice(0, -1),
              { ...last, content: last.content + data.chunk }
            ];
          }
          return [...prev, { id: Date.now().toString(), role: 'assistant', content: data.chunk, timestamp: Date.now() }];
        });
      }
    });

    // Stream end
    socket.on('stream:end', () => {
      console.log('[Socket] Stream ended');
      setIsLoading(false);
      // Refresh sessions to get updated titles
      fetch('/api/chat/sessions')
        .then(res => res.json())
        .then(data => setSessions(data));
    });

    socket.on('proactive', (data: any) => {
      console.log('[Socket] Received raw data:', data);
      
      // Handle both direct object and nested task
      const task: ProactiveTask = {
        taskName: data.taskName || data.task?.taskName || 'Unknown',
        prompt: data.prompt || data.task?.prompt || data.task?.description || 'No details',
        timestamp: data.timestamp || Date.now(),
      };
      
      console.log('[Socket] Parsed task:', task);
      setProactiveTasks(prev => [...prev, task]);
      
      // Show browser notification
      showNotificationRef.current(
        '⏰ 提醒通知',
        task.prompt
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [activeSession]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const createSession = useCallback(async () => {
    const res = await fetch('/api/chat/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const session = await res.json();
    setSessions(prev => [...prev, session]);
    setActiveSession(session.id);
    setMessages([]);
  }, []);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || !activeSession || isLoading) return;

    const content = input.trim();
    setInput('');
    setIsLoading(true);

    // Optimistically add user message
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: Date.now(),
    }]);

    try {
      await fetch(`/api/chat/sessions/${activeSession}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      // Note: isLoading will be set to false when stream:end is received
      // If no streaming response within 30s, reset loading state
      setTimeout(() => {
        setIsLoading(prev => {
          if (prev) console.log('[Send] Timeout reset loading state');
          return false;
        });
      }, 30000);
    } catch (err) {
      console.error('Failed to send message:', err);
      setIsLoading(false);
    }
  }, [input, activeSession, isLoading]);

  const dismissProactive = useCallback((index: number) => {
    setProactiveTasks(prev => prev.filter((_, i) => i !== index));
  }, []);

  const renameSession = useCallback(async (sessionId: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    
    // Update local state
    setSessions(prev => prev.map(s => 
      s.id === sessionId ? { ...s, title: newTitle.trim() } : s
    ));
    
    // TODO: Persist to backend if needed
    // await fetch(`/api/chat/sessions/${sessionId}`, { method: 'PATCH', ... });
  }, []);

  const deleteSession = useCallback(async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation(); // Prevent triggering onClick
    
    if (!confirm('Delete this session?')) return;
    
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}`, {
        method: 'DELETE',
      });
      
      if (res.ok) {
        // Remove from local state
        setSessions(prev => prev.filter(s => s.id !== sessionId));
        
        // If deleted session was active, clear it
        if (activeSession === sessionId) {
          setActiveSession(null);
          setMessages([]);
        }
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  }, [activeSession]);

  if (health === 'not_configured') {
    return (
      <div className="container">
        <div className="header">
          <h1>PI MONO</h1>
          <span className="status">○</span>
        </div>
        <div className="empty-state">
          <h2>Configure API Key</h2>
          <p>Set one of the following in backend .env</p>
          <ul>
            <li>DEEPSEEK_API_KEY=sk-...</li>
            <li>KIMI_API_KEY=sk-...</li>
            <li>OPENAI_API_KEY=sk-...</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">
        <h1>PI MONO</h1>
        <div className="header-actions">
          <button
            className={`notify-btn ${notificationEnabled ? 'enabled' : ''}`}
            onClick={requestNotificationPermission}
            title={notificationEnabled ? 'Notifications enabled' : 'Click to enable notifications'}
          >
            {notificationEnabled ? 'ON' : 'OFF'}
          </button>
          <span className={`status ${isConnected ? 'ready' : ''}`}>
            {isConnected ? '●' : '○'}
          </span>
        </div>
      </div>

      {!notificationEnabled && (
        <div className="notification-warning">
          <span>Click bell button to enable notifications</span>
        </div>
      )}

      {proactiveTasks.map((task, index) => (
        <div key={task.timestamp} className="proactive-banner">
          <div>
            <strong>REMINDER</strong> — {task.prompt}
          </div>
          <span className="close" onClick={() => dismissProactive(index)}>×</span>
        </div>
      ))}

      <div className="chat-container">
        <div className="sidebar">
          <h2>Sessions</h2>
          <ul className="session-list">
            {sessions.map(session => (
              <SessionItem
                key={session.id}
                session={session}
                isActive={session.id === activeSession}
                onClick={() => setActiveSession(session.id)}
                onRename={(title) => renameSession(session.id, title)}
                onDelete={(e) => deleteSession(e, session.id)}
              />
            ))}
          </ul>
          <button className="new-session-btn" onClick={createSession}>
            + New
          </button>
        </div>

        <div className="chat-area">
          {activeSession ? (
            <>
              <div className="messages">
                {messages.map(msg => (
                  <div key={msg.id} className={`message ${msg.role}`}>
                    <div className="message-bubble">{msg.content}</div>
                    <div className="message-time">
                      {new Date(msg.timestamp).toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        hour12: false 
                      })}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="message assistant">
                    <div className="message-bubble">
                      <span className="loading-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                      </span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
              <div className="input-area">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  placeholder="Type a message..."
                  disabled={isLoading}
                />
                <button onClick={sendMessage} disabled={isLoading || !input.trim()}>
                  →
                </button>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <h2>Select or create a session to start chatting</h2>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
