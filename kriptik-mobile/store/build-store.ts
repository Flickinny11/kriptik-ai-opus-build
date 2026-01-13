import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';
import { API_BASE_URL } from '../lib/config';

export type MessageRole = 'user' | 'assistant' | 'system';
export type MessageType = 'text' | 'plan' | 'verification' | 'code' | 'error' | 'tool_call';
export type PlanStatus = 'pending' | 'approved' | 'rejected' | 'modified';

export interface PlanStep {
  id: string;
  description: string;
  estimatedTime?: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

export interface Plan {
  id: string;
  steps: PlanStep[];
  status: PlanStatus;
  totalEstimatedTime?: number;
  approvedAt?: string;
}

export interface VerificationCheck {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  duration?: number;
  error?: string;
}

export interface CodeBlock {
  language: string;
  filename?: string;
  code: string;
  action: 'create' | 'modify' | 'delete';
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  type: MessageType;
  content: string;
  timestamp: string;
  isStreaming?: boolean;
  plan?: Plan;
  codeBlocks?: CodeBlock[];
  tokens?: number;
}

export interface BuildSession {
  id: string;
  projectId: string;
  messages: ChatMessage[];
  status: 'idle' | 'waiting' | 'streaming' | 'planning' | 'building' | 'verifying' | 'completed' | 'error';
  currentPlan?: Plan;
  startedAt: string;
  completedAt?: string;
  totalTokens: number;
  error?: string;
}

interface BuildState {
  currentSession: BuildSession | null;
  sessions: Record<string, BuildSession>;
  isStreaming: boolean;
  inputText: string;
  isVoiceActive: boolean;
  voiceTranscript: string;
  showPlanApproval: boolean;
}

interface BuildActions {
  startNewSession: (projectId: string) => Promise<string>;
  loadSession: (sessionId: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  cancelStream: () => void;
  approvePlan: (planId: string) => Promise<void>;
  rejectPlan: (planId: string, reason: string) => Promise<void>;
  setInputText: (text: string) => void;
  startVoiceInput: () => void;
  stopVoiceInput: () => void;
  clearSession: () => void;
}

type BuildStore = BuildState & BuildActions;

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

let abortController: AbortController | null = null;

export const useBuildStore = create<BuildStore>((set, get) => ({
  currentSession: null,
  sessions: {},
  isStreaming: false,
  inputText: '',
  isVoiceActive: false,
  voiceTranscript: '',
  showPlanApproval: false,

  startNewSession: async (projectId: string) => {
    const sessionId = generateId();
    const session: BuildSession = {
      id: sessionId,
      projectId,
      messages: [],
      status: 'idle',
      startedAt: new Date().toISOString(),
      totalTokens: 0,
    };
    set({
      currentSession: session,
      sessions: { ...get().sessions, [sessionId]: session },
    });
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    return sessionId;
  },

  loadSession: async (sessionId: string) => {
    const { sessions } = get();
    const session = sessions[sessionId];
    if (session) {
      set({ currentSession: session });
      return;
    }
    
    // Load from API
    const token = await SecureStore.getItemAsync('kriptik_access_token');
    if (!token) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/builds/${sessionId}`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        const loadedSession: BuildSession = {
          id: sessionId,
          projectId: data.build.projectId,
          messages: [],
          status: data.build.status === 'completed' ? 'completed' : 'idle',
          startedAt: data.build.startedAt,
          completedAt: data.build.completedAt,
          totalTokens: 0,
        };
        set({ 
          currentSession: loadedSession,
          sessions: { ...get().sessions, [sessionId]: loadedSession },
        });
      }
    } catch (error) {
      console.error('Failed to load session:', error);
    }
  },

  sendMessage: async (content: string) => {
    const { currentSession } = get();
    if (!currentSession) return;

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      type: 'text',
      content,
      timestamp: new Date().toISOString(),
    };

    set({
      currentSession: {
        ...currentSession,
        messages: [...currentSession.messages, userMessage],
        status: 'waiting',
      },
      inputText: '',
    });

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Start streaming response
    const token = await SecureStore.getItemAsync('kriptik_access_token');
    if (!token) return;

    abortController = new AbortController();
    const assistantMessageId = generateId();

    set({
      isStreaming: true,
      currentSession: {
        ...get().currentSession!,
        messages: [
          ...get().currentSession!.messages,
          {
            id: assistantMessageId,
            role: 'assistant',
            type: 'text',
            content: '',
            timestamp: new Date().toISOString(),
            isStreaming: true,
          },
        ],
        status: 'streaming',
      },
    });

    try {
      const response = await fetch(`${API_BASE_URL}/api/execute`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          sessionId: currentSession.id,
          projectId: currentSession.projectId,
          prompt: content,
          stream: true,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const event = JSON.parse(data);

              if (event.type === 'token' || event.type === 'content') {
                fullContent += event.content || event.text || '';
                const session = get().currentSession;
                if (session) {
                  const messages = session.messages.map(m =>
                    m.id === assistantMessageId
                      ? { ...m, content: fullContent }
                      : m
                  );
                  set({ currentSession: { ...session, messages } });
                }
              } else if (event.type === 'plan') {
                const session = get().currentSession;
                if (session) {
                  set({
                    currentSession: {
                      ...session,
                      currentPlan: event.plan,
                      status: 'planning',
                    },
                    showPlanApproval: true,
                  });
                }
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } else if (event.type === 'complete' || event.type === 'done') {
                const session = get().currentSession;
                if (session) {
                  const messages = session.messages.map(m =>
                    m.id === assistantMessageId
                      ? { ...m, isStreaming: false }
                      : m
                  );
                  set({
                    currentSession: {
                      ...session,
                      messages,
                      status: 'completed',
                      completedAt: new Date().toISOString(),
                    },
                  });
                }
              }
            } catch {
              // Skip malformed events
            }
          }
        }
      }

      const session = get().currentSession;
      if (session) {
        const messages = session.messages.map(m =>
          m.id === assistantMessageId ? { ...m, isStreaming: false } : m
        );
        set({
          currentSession: { ...session, messages },
          isStreaming: false,
        });
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        const session = get().currentSession;
        if (session) {
          const messages = session.messages.map(m =>
            m.id === assistantMessageId
              ? { ...m, isStreaming: false, content: m.content + '\n\n*[Cancelled]*' }
              : m
          );
          set({
            currentSession: { ...session, messages, status: 'idle' },
            isStreaming: false,
          });
        }
      } else {
        const session = get().currentSession;
        if (session) {
          const messages = session.messages.map(m =>
            m.id === assistantMessageId
              ? { ...m, isStreaming: false, type: 'error' as const, content: `Error: ${(error as Error).message}` }
              : m
          );
          set({
            currentSession: { ...session, messages, status: 'error', error: (error as Error).message },
            isStreaming: false,
          });
        }
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      abortController = null;
    }
  },

  cancelStream: () => {
    if (abortController) {
      abortController.abort();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  },

  approvePlan: async (planId: string) => {
    const { currentSession } = get();
    if (!currentSession?.currentPlan) return;

    set({
      currentSession: {
        ...currentSession,
        currentPlan: { ...currentSession.currentPlan, status: 'approved', approvedAt: new Date().toISOString() },
        status: 'building',
      },
      showPlanApproval: false,
    });

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Notify backend
    const token = await SecureStore.getItemAsync('kriptik_access_token');
    if (token) {
      await fetch(`${API_BASE_URL}/api/plans/${planId}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId: currentSession.id }),
        credentials: 'include',
      });
    }
  },

  rejectPlan: async (planId: string, reason: string) => {
    const { currentSession } = get();
    if (!currentSession?.currentPlan) return;

    const systemMessage: ChatMessage = {
      id: generateId(),
      role: 'system',
      type: 'text',
      content: `Plan rejected: ${reason}`,
      timestamp: new Date().toISOString(),
    };

    set({
      currentSession: {
        ...currentSession,
        messages: [...currentSession.messages, systemMessage],
        currentPlan: { ...currentSession.currentPlan, status: 'rejected' },
        status: 'idle',
      },
      showPlanApproval: false,
    });

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  },

  setInputText: (text: string) => {
    set({ inputText: text });
  },

  startVoiceInput: () => {
    set({ isVoiceActive: true, voiceTranscript: '' });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  },

  stopVoiceInput: () => {
    const { voiceTranscript } = get();
    set({
      isVoiceActive: false,
      inputText: voiceTranscript.trim() || get().inputText,
      voiceTranscript: '',
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },

  clearSession: () => {
    set({
      currentSession: null,
      isStreaming: false,
      inputText: '',
      isVoiceActive: false,
      voiceTranscript: '',
      showPlanApproval: false,
    });
  },
}));
