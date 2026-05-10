import { cn } from "@/lib/utils";
import type { SourceMeta } from "@/lib/store";

export function SourceBadges({ sources }: { sources: SourceMeta[] }) {
  if (!sources?.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {sources.map((s, i) => {
        const ref = [s.livre, s.chapitre, s.page ? `p.${s.page}` : null]
          .filter(Boolean)
          .join(" ");
        return (
          <span
            key={s.id}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground",
            )}
            title={`${s.corpus} • score ${s.score.toFixed(3)}`}
          >
            <span className="font-mono text-[10px] text-primary">[{i + 1}]</span>
            {ref || s.corpus}
          </span>
        );
      })}
    </div>
  );
}
