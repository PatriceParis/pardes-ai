import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
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
          "max-w-[85%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-card text-card-foreground border border-border/60",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm prose-invert max-w-none prose-p:my-2 prose-p:leading-relaxed prose-headings:my-3 prose-headings:font-serif prose-li:my-0.5 prose-em:font-serif prose-em:italic prose-strong:text-foreground">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content || (message.pending ? "…" : "")}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
