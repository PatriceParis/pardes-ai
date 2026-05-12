"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Send, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Message } from "./message";
import { useChatStore, type SourceMeta } from "@/lib/store";

const SUGGESTIONS = [
  "Que signifie tikoun olam ?",
  "Pourquoi le Shabbat ?",
  "Différence entre orthodoxe, massorti et libéral ?",
  "Qu'est-ce que le Talmud ?",
];

export function ChatContainer() {
  const {
    conversationId,
    messages,
    isStreaming,
    appendUser,
    startAssistant,
    appendToken,
    setSources,
    finishAssistant,
    reset,
  } = useChatStore();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  async function send(text?: string) {
    const value = (text ?? input).trim();
    if (!value || isStreaming) return;
    setInput("");
    appendUser(value);
    const assistantId = startAssistant();

    const history = useChatStore
      .getState()
      .messages.filter((m) => !m.pending)
      .map(({ role, content }) => ({ role, content }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, messages: history }),
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
        const { done, value: chunk } = await reader.read();
        if (done) break;
        buffer += decoder.decode(chunk, { stream: true });

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
              appendToken(assistantId, JSON.parse(data) as string);
            } catch {
              // ignore
            }
          } else if (event === "sources") {
            try {
              setSources(assistantId, JSON.parse(data) as SourceMeta[]);
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
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="shrink-0 border-b border-border/60 px-4 py-3 sm:px-6 sm:py-4 backdrop-blur-xl bg-background/80 sticky top-0 z-10">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/" className="group flex items-baseline gap-2">
            <span className="font-serif text-xl font-semibold tracking-tight text-foreground">
              Pardes
            </span>
            <span className="font-serif text-xs italic text-muted-foreground transition-colors group-hover:text-foreground">
              פרדס
            </span>
          </Link>
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={reset}>
              <RotateCcw />
              Nouvelle étude
            </Button>
          )}
        </div>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <div
          ref={scrollRef}
          className="mx-auto h-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10"
        >
          {messages.length === 0 ? (
            <Welcome onPick={(q) => void send(q)} />
          ) : (
            <div className="space-y-5">
              {messages.map((m) => (
                <Message key={m.id} message={m} />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      <footer className="shrink-0 border-t border-border/60 backdrop-blur-xl bg-background/80">
        <div className="mx-auto max-w-3xl px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="Pose ta question…"
              rows={1}
              disabled={isStreaming}
              className="flex-1 min-h-[52px] py-3.5 text-[15px] resize-none"
            />
            <Button
              onClick={() => void send()}
              disabled={!input.trim() || isStreaming}
              size="icon"
              className="h-[52px] w-12 shrink-0"
              aria-label="Envoyer"
            >
              <Send />
            </Button>
          </div>
          <p className="mt-2.5 text-balance px-1 text-center text-[11px] leading-snug text-muted-foreground">
            Pardes est une IA, pas un rabbin — conçue par une personne non juive, fondée sur des sources juives. Pour toute décision personnelle (mariage, conversion, deuil, halakha), consulte un rabbin. Conversations enregistrées de manière anonyme. Voir la{" "}
            <Link
              href="/charte"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Charte Éthique
            </Link>
            .
          </p>
        </div>
      </footer>
    </div>
  );
}

function Welcome({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-6 text-center sm:min-h-[55vh] sm:py-0">
      <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-3 py-1 text-[11px] text-muted-foreground sm:text-xs">
        <span className="font-serif italic text-primary">פרדס</span>
        <span className="text-border">·</span>
        <span>Compagnon d'étude juive</span>
      </div>
      <h1 className="mt-5 font-serif text-4xl font-medium tracking-tight sm:mt-6 sm:text-5xl">
        Shalom.
      </h1>
      <p className="mt-3 max-w-md text-[14px] leading-relaxed text-muted-foreground sm:mt-4 sm:text-[15px]">
        Pose une question sur le judaïsme. Tanakh, Talmud, fêtes, pratiques,
        histoire — dans la langue de ton choix.
      </p>
      <div className="mt-8 flex max-w-xl flex-wrap justify-center gap-2 sm:mt-10">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="rounded-full border border-border/60 bg-card/40 px-3 py-1.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-foreground sm:px-3.5 sm:text-xs"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
