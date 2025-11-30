"use client";

import { useState } from "react";
import { Icon } from "@/types/schema";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useProject } from "@/lib/project-context";
import { toast } from "sonner";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface IconCardProps {
    icon: Icon;
    color?: string;
}

export function IconCard({ icon, color }: IconCardProps) {
    const { currentProject, toggleFavorite } = useProject();
    const isFavorite = currentProject?.favorites.includes(icon.id);
    const [menuOpen, setMenuOpen] = useState(false);

    // Copy SVG to clipboard
    const handleCopySvg = async () => {
        const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${icon.viewBox}" fill="${icon.renderStyle === 'fill' ? 'currentColor' : 'none'}" stroke="${icon.renderStyle === 'fill' ? 'none' : 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${icon.path}"/></svg>`;
        try {
            await navigator.clipboard.writeText(svgContent);
            toast.success("SVG copied to clipboard");
        } catch {
            toast.error("Failed to copy SVG");
        }
    };

    // Copy path data only
    const handleCopyPath = async () => {
        try {
            await navigator.clipboard.writeText(icon.path);
            toast.success("Path data copied to clipboard");
        } catch {
            toast.error("Failed to copy path");
        }
    };

    // Download as SVG file
    const handleDownload = () => {
        const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${icon.viewBox}" fill="${icon.renderStyle === 'fill' ? 'currentColor' : 'none'}" stroke="${icon.renderStyle === 'fill' ? 'none' : 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${icon.path}"/></svg>`;
        const blob = new Blob([svgContent], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${icon.name}.svg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`Downloaded ${icon.name}.svg`);
    };

    return (
        <Card className="group relative flex aspect-square flex-col items-center justify-center gap-2 overflow-hidden border-muted bg-card p-4 transition-all hover:border-primary hover:shadow-md">
            {/* Top-right actions: Favorite heart and context menu */}
            <div className={cn(
                "absolute right-2 top-2 z-10 flex items-center gap-1 transition-opacity",
                // Always show if favorited or menu open, otherwise show on hover
                isFavorite || menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}>
                {/* Favorite button */}
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleFavorite(icon.id);
                    }}
                    className={cn(
                        "rounded-full p-1.5 shadow-sm backdrop-blur-sm transition-colors",
                        isFavorite
                            ? "bg-red-100/80 text-red-500 hover:bg-red-200/80"
                            : "bg-background/80 text-muted-foreground hover:text-red-500 hover:bg-background"
                    )}
                    title={isFavorite ? "Remove from favorites" : "Add to favorites"}
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill={isFavorite ? "currentColor" : "none"}
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4"
                    >
                        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                    </svg>
                </button>

                {/* Context menu */}
                <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                    <DropdownMenuTrigger asChild>
                        <button
                            onClick={(e) => e.stopPropagation()}
                            className="rounded-full bg-background/80 p-1.5 text-muted-foreground hover:text-foreground hover:bg-background shadow-sm backdrop-blur-sm transition-colors"
                            title="More actions"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="h-4 w-4"
                            >
                                <circle cx="12" cy="12" r="1" />
                                <circle cx="12" cy="5" r="1" />
                                <circle cx="12" cy="19" r="1" />
                            </svg>
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={handleCopySvg}>
                            Copy SVG
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleCopyPath}>
                            Copy path data
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleDownload}>
                            Download SVG
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={() => toggleFavorite(icon.id)}
                            className={isFavorite ? "text-red-500" : ""}
                        >
                            {isFavorite ? "Remove from favorites" : "Add to favorites"}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Icon display */}
            <div className="relative flex h-1/2 w-1/2 items-center justify-center text-foreground transition-transform group-hover:scale-110" style={{ color: color }}>
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
            </div>

            {/* Icon name tooltip on hover */}
            <div className="absolute bottom-0 left-0 right-0 translate-y-full bg-background/90 p-2 text-center text-[10px] font-medium text-muted-foreground backdrop-blur-sm transition-transform group-hover:translate-y-0">
                {icon.name}
            </div>
        </Card>
    );
}
