import { cn } from "@/lib/utils";

// Parse inline markdown: **bold** only — italics rendered as plain text
function parseInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
    // Strip single asterisks used for italics — render as plain text
    return part.replace(/\*([^*]+)\*/g, "$1");
  });
}

export const FrameworkDisplay = ({ markdown }: { markdown: string }) => {
  const lines = markdown.split("\n");

  return (
    <div className="space-y-2 text-sm leading-relaxed text-foreground/80">
      {lines.map((line, index) => {
        if (line.startsWith("# "))  return <h1  key={index} className="text-lg font-semibold tracking-tight mt-2 mb-3">{parseInline(line.slice(2))}</h1>;
        if (line.startsWith("## ")) return <h2  key={index} className="text-xs font-semibold uppercase tracking-widest text-primary mt-5 mb-1.5">{line.slice(3)}</h2>;
        if (line.startsWith("### ")) return <h3 key={index} className="text-sm font-medium text-foreground mt-3 mb-1">{parseInline(line.slice(4))}</h3>;
        if (line.startsWith("- ")) {
          return (
            <div key={index} className="flex items-start gap-2">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
              <span>{parseInline(line.slice(2))}</span>
            </div>
          );
        }
        if (line === "---") return <div key={index} className="my-3 h-px bg-border/40" />;
        if (!line.trim()) return <div key={index} className="h-1" />;
        return <p key={index}>{parseInline(line)}</p>;
      })}
    </div>
  );
};

export const FrameworkSkeleton = () => (
  <div className="space-y-3">
    {[2, 3, 2, 4, 3, 2].map((lines, i) => (
      <div key={i} className="space-y-1.5">
        <div className={cn("h-2.5 rounded bg-muted/60", i % 2 === 0 ? "w-1/3" : "w-full")} />
        {Array.from({ length: lines }).map((_, j) => (
          <div key={j} className="h-2 rounded bg-muted/40" style={{ width: `${70 + Math.random() * 25}%` }} />
        ))}
      </div>
    ))}
  </div>
);
