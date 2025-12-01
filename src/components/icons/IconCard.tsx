"use client";

import { Icon } from "@/types/schema";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useProject } from "@/lib/project-context";

interface IconCardProps {
    icon: Icon;
    color?: string;
}

export function IconCard({ icon, color }: IconCardProps) {
    const { currentProject, toggleFavorite } = useProject();
    const isFavorite = currentProject?.favorites.includes(icon.id);

    return (
        <Card className="group relative flex aspect-square flex-col items-center justify-center gap-2 overflow-hidden border-muted bg-card p-4 transition-all hover:border-primary hover:shadow-md">
            <div className="absolute right-2 top-2 z-10 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleFavorite(icon.id);
                    }}
                    className="rounded-full bg-background/80 p-1.5 text-muted-foreground hover:text-red-500 hover:bg-background shadow-sm backdrop-blur-sm transition-colors"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill={isFavorite ? "currentColor" : "none"}
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={cn("h-4 w-4", isFavorite && "text-red-500 fill-red-500")}
                    >
                        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                    </svg>
                </button>
            </div>
            <div className="relative flex h-1/2 w-1/2 items-center justify-center text-foreground transition-transform group-hover:scale-110" style={{ color: color }}>
                {icon.svgContent ? (
                    // Complex icons with transforms - render inner SVG content directly
                    <svg
                        viewBox={icon.viewBox}
                        fill={icon.renderStyle === "fill" ? (color || "currentColor") : "none"}
                        stroke={icon.renderStyle === "fill" ? "none" : (color || "currentColor")}
                        strokeWidth={icon.renderStyle === "fill" ? "0" : "2"}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-full w-full"
                        dangerouslySetInnerHTML={{ __html: icon.svgContent }}
                    />
                ) : (
                    // Simple icons - use path directly
                    <svg
                        viewBox={icon.viewBox}
                        fill={icon.renderStyle === "fill" ? (color || "currentColor") : "none"}
                        stroke={icon.renderStyle === "fill" ? "none" : (color || "currentColor")}
                        strokeWidth={icon.renderStyle === "fill" ? "0" : "2"}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-full w-full"
                    >
                        <path
                            d={icon.path}
                            fillRule={icon.fillRule as any}
                            clipRule={icon.clipRule as any}
                        />
                    </svg>
                )}
            </div>
            <div className="absolute bottom-0 left-0 right-0 translate-y-full bg-background/90 p-2 text-center text-[10px] font-medium text-muted-foreground backdrop-blur-sm transition-transform group-hover:translate-y-0">
                {icon.name}
            </div>
        </Card>
    );
}
