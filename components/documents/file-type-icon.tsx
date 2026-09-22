import { File, FileText, FileType, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { isPdfMime, isWordMime } from "@/lib/documents/mime";

export function FileTypeIcon({
  mimeType,
  className,
  size = "md",
}: {
  mimeType: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const word = isWordMime(mimeType);
  const pdf = isPdfMime(mimeType);
  const image = mimeType.startsWith("image/");
  const Icon = word ? FileType : pdf ? FileText : image ? ImageIcon : File;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-2xl",
        size === "sm" && "h-9 w-9 rounded-xl",
        size === "md" && "h-12 w-12",
        size === "lg" && "h-14 w-14",
        word && "bg-accent text-primary",
        pdf && "bg-[#f3e4d8] text-[#8b3a2a]",
        image && "bg-amber-100 text-amber-900",
        !word && !pdf && !image && "bg-secondary text-secondary-foreground",
        className,
      )}
      aria-hidden
    >
      <Icon className={size === "sm" ? "h-4 w-4" : "h-5 w-5"} />
    </span>
  );
}
