import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SourceMeta = {
  id: string;
  corpus: string;
  livre: string;
  chapitre: string | null;
  page: number | null;
  score: number;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceMeta[];
  pending?: boolean;
};

type State = {
  messages: ChatMessage[];
  isStreaming: boolean;
};

type Actions = {
  appendUser: (content: string) => string;
  startAssistant: () => string;
  appendToken: (id: string, token: string) => void;
  setSources: (id: string, sources: SourceMeta[]) => void;
  finishAssistant: (id: string) => void;
  reset: () => void;
};

export const useChatStore = create<State & Actions>()(
  persist(
    (set) => ({
      messages: [],
      isStreaming: false,

      appendUser: (content) => {
        const id = crypto.randomUUID();
        set((s) => ({
          messages: [...s.messages, { id, role: "user", content }],
        }));
        return id;
      },

      startAssistant: () => {
        const id = crypto.randomUUID();
        set((s) => ({
          messages: [
            ...s.messages,
            { id, role: "assistant", content: "", pending: true },
          ],
          isStreaming: true,
        }));
        return id;
      },

      appendToken: (id, token) =>
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === id ? { ...m, content: m.content + token } : m,
          ),
        })),

      setSources: (id, sources) =>
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === id ? { ...m, sources } : m,
          ),
        })),

      finishAssistant: (id) =>
        set((s) => ({
          isStreaming: false,
          messages: s.messages.map((m) =>
            m.id === id ? { ...m, pending: false } : m,
          ),
        })),

      reset: () => set({ messages: [], isStreaming: false }),
    }),
    {
      name: "pardes-chat",
      partialize: (s) => ({ messages: s.messages }),
    },
  ),
);
