import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { SourceBadges } from "./source-badge";
import type { ChatMessage } from "@/lib/store";

export function Message({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div
      className={cn(
        "flex w-full",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-card text-card-foreground border border-border",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <>
            <div className="prose prose-sm prose-invert max-w-none prose-p:my-2 prose-headings:my-3 prose-li:my-0.5 prose-em:font-serif">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content || (message.pending ? "…" : "")}
              </ReactMarkdown>
            </div>
            {message.sources && <SourceBadges sources={message.sources} />}
          </>
        )}
      </div>
    </div>
  );
}
