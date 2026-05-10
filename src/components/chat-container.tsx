"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Send, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Message } from "./message";
import { useChatStore, type SourceMeta } from "@/lib/store";

export function ChatContainer() {
  const { messages, isStreaming, appendUser, startAssistant, appendToken, setSources, finishAssistant, reset } =
    useChatStore();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    appendUser(text);
    const assistantId = startAssistant();

    const history = useChatStore
      .getState()
      .messages.filter((m) => !m.pending)
      .map(({ role, content }) => ({ role, content }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      if (!res.ok || !res.body) {
        appendToken(assistantId, "_Erreur — réessaie._");
        finishAssistant(assistantId);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const evt of events) {
          const lines = evt.split("\n");
          let event = "message";
          let data = "";
          for (const line of lines) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            else if (line.startsWith("data:")) data += line.slice(5).trim();
          }
          if (!data) continue;

          if (event === "token") {
            try {
              const tok = JSON.parse(data) as string;
              appendToken(assistantId, tok);
            } catch {
              // ignore parse errors
            }
          } else if (event === "sources") {
            try {
              const srcs = JSON.parse(data) as SourceMeta[];
              setSources(assistantId, srcs);
            } catch {
              // ignore
            }
          } else if (event === "done") {
            finishAssistant(assistantId);
          }
        }
      }
      finishAssistant(assistantId);
    } catch (e) {
      appendToken(assistantId, `_Erreur réseau : ${String(e)}_`);
      finishAssistant(assistantId);
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="border-b border-border bg-card/40 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div>
            <h1 className="font-serif text-xl tracking-tight">Pardes</h1>
            <p className="text-xs text-muted-foreground">
              <span className="font-serif italic">פרדס</span> — Pshat · Remez · Drash · Sod
            </p>
          </div>
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={reset}>
              <RotateCcw />
              Nouvelle étude
            </Button>
          )}
        </div>
      </header>

      <ScrollArea className="flex-1">
        <div ref={scrollRef} className="mx-auto h-full max-w-3xl px-6 py-8">
          {messages.length === 0 ? (
            <Welcome />
          ) : (
            <div className="space-y-6">
              {messages.map((m) => (
                <Message key={m.id} message={m} />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      <footer className="border-t border-border bg-card/40 backdrop-blur">
        <div className="mx-auto max-w-3xl px-6 py-4">
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="Pose ta question — Tanakh, Talmud, halakha, tradition, vie…"
              rows={2}
              disabled={isStreaming}
              className="flex-1"
            />
            <Button
              onClick={send}
              disabled={!input.trim() || isStreaming}
              size="icon"
              className="h-[60px] w-12"
            >
              <Send />
            </Button>
          </div>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            Pardes n'est pas un rabbin — IA conçue par une personne non juive, fondée sur des sources juives. Pour toute décision personnelle (mariage, conversion, deuil, halakha), consulte un rabbin. Voir la{" "}
            <Link href="/charte" className="underline underline-offset-2 hover:text-foreground">
              Charte Éthique
            </Link>
            .
          </p>
        </div>
      </footer>
    </div>
  );
}

function Welcome() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <h2 className="font-serif text-3xl">Shalom.</h2>
      <p className="mt-4 max-w-md text-sm text-muted-foreground">
        Compagnon d'étude — Tanakh, Talmud, Halakha, Mahshava, Kabbale.
        <br />
        Pose ta question, simple ou complexe, dans la langue de ton choix.
      </p>
    </div>
  );
}
