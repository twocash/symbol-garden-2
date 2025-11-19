"use client";

import { Icon } from "@/types/schema";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface IconCardProps {
    icon: Icon;
}

export function IconCard({ icon }: IconCardProps) {
    return (
        <Card className="group relative flex aspect-square flex-col items-center justify-center gap-2 overflow-hidden border-muted bg-card p-4 transition-all hover:border-primary hover:shadow-md">
            <div className="relative flex h-1/2 w-1/2 items-center justify-center text-foreground transition-transform group-hover:scale-110">
                <svg
                    viewBox={icon.viewBox}
                    fill={icon.renderStyle === "fill" ? "currentColor" : "none"}
                    stroke={icon.renderStyle === "fill" ? "none" : "currentColor"}
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
            <div className="absolute bottom-0 left-0 right-0 translate-y-full bg-background/90 p-2 text-center text-[10px] font-medium text-muted-foreground backdrop-blur-sm transition-transform group-hover:translate-y-0">
                {icon.name}
            </div>
        </Card>
    );
}
