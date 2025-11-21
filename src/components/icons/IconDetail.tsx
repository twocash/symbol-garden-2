"use client";

import { Icon } from "@/types/schema";
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Copy, Download, Check, GitCompare, Heart, ArrowLeftRight, Sparkles, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { CompareModal } from "@/components/icons/CompareModal";
import { copySvg, copyPng, downloadPng, downloadSvg } from "@/lib/export-utils";
import { useProject } from "@/lib/project-context";
import { useSearch } from "@/lib/search-context";
import { cn } from "@/lib/utils";

interface IconDetailProps {
    icon: Icon | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function IconDetail({ icon, open, onOpenChange }: IconDetailProps) {
    const { currentProject, toggleFavorite } = useProject();
    const { icons, setIcons } = useSearch();
    const [copied, setCopied] = useState(false);
    const [compareOpen, setCompareOpen] = useState(false);
    const [size, setSize] = useState(256);
    const [color, setColor] = useState("#ffffff"); // Default to white for dark mode contrast
    const [generating, setGenerating] = useState(false);

    // Use the live icon from context if available to ensure updates are reflected immediately
    const activeIcon = icons.find(i => i.id === icon?.id) || icon;

    // Reset defaults when icon changes
    // useEffect(() => {
    //     if (open) {
    //         setSize(256);
    //         setColor("#000000");
    //     }
    // }, [open, icon]);

    if (!activeIcon) return null;

    const isFavorite = currentProject?.favorites.includes(activeIcon.id);

    const handleCopySvg = async () => {
        await copySvg(activeIcon, size, color);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleCopyPng = async () => {
        try {
            await copyPng(activeIcon, size, color);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy PNG", err);
            alert("Failed to copy PNG to clipboard");
        }
    };

    const handleDownloadPng = () => {
        downloadPng(activeIcon, size, color);
    };

    const handleDownloadSvg = () => {
        downloadSvg(activeIcon, size, color);
    };

    const handleGenerateDescription = async () => {
        const apiKey = localStorage.getItem("gemini_api_key");
        if (!apiKey) {
            alert("Please enter a Gemini API Key in Settings first.");
            return;
        }

        setGenerating(true);
        try {
            const res = await fetch("/api/enrich", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ icons: [activeIcon], apiKey })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "API Failed");
            }

            const { data } = await res.json();
            if (data && data[0]) {
                const enriched = data[0];

                // Update local state
                const updatedIcon = {
                    ...activeIcon,
                    tags: [...new Set([...activeIcon.tags, ...enriched.tags])],
                    aiDescription: enriched.description
                };

                // Update context
                const updatedIcons = icons.map(i => i.id === activeIcon.id ? updatedIcon : i);
                setIcons(updatedIcons);

                // Update localStorage if it exists there
                const storedIcons = JSON.parse(localStorage.getItem("ingested_icons") || "[]");
                const storedIndex = storedIcons.findIndex((i: any) => i.id === activeIcon.id);
                if (storedIndex !== -1) {
                    storedIcons[storedIndex] = updatedIcon;
                    localStorage.setItem("ingested_icons", JSON.stringify(storedIcons));
                }
            }
        } catch (error) {
            console.error(error);
            alert(`Failed to generate description: ${error instanceof Error ? error.message : "Unknown error"}`);
        } finally {
            setGenerating(false);
        }
    };

    return (
        <>
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto p-6">
                    <SheetHeader>
                        <SheetTitle>{activeIcon.name}</SheetTitle>
                        <SheetDescription>
                            {activeIcon.library} / {activeIcon.style || "regular"}
                        </SheetDescription>
                    </SheetHeader>

                    <div className="mt-8 flex flex-col gap-6">
                        {/* Preview Area */}
                        <div className="flex aspect-square w-full items-center justify-center rounded-lg border bg-muted/30 p-8 relative overflow-hidden">
                            {/* Checkerboard background for transparency */}
                            <div className="absolute inset-0 opacity-20 pointer-events-none"
                                style={{
                                    backgroundImage: `linear-gradient(45deg, #808080 25%, transparent 25%), linear-gradient(-45deg, #808080 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #808080 75%), linear-gradient(-45deg, transparent 75%, #808080 75%)`,
                                    backgroundSize: '20px 20px',
                                    backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
                                }}
                            />

                            <svg
                                viewBox={activeIcon.viewBox}
                                fill={activeIcon.renderStyle === "fill" ? color : "none"}
                                stroke={activeIcon.renderStyle === "fill" ? "none" : color}
                                strokeWidth={activeIcon.renderStyle === "fill" ? "0" : "2"}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="h-64 w-64 transition-colors duration-200 relative z-10"
                            >
                                <path
                                    d={activeIcon.path}
                                    fillRule={activeIcon.fillRule as any}
                                    clipRule={activeIcon.clipRule as any}
                                />
                            </svg>
                        </div>

                        <Separator />

                        {/* Customization Controls */}
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium">Size: {size}px</label>
                                </div>
                                <Slider
                                    value={[size]}
                                    onValueChange={(vals) => setSize(vals[0])}
                                    min={16}
                                    max={1024}
                                    step={16}
                                    className="w-full"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Color</label>
                                <div className="flex items-center gap-2">
                                    <div className="relative h-10 w-full rounded-md border overflow-hidden">
                                        <input
                                            type="color"
                                            value={color}
                                            onChange={(e) => setColor(e.target.value)}
                                            className="absolute -top-2 -left-2 h-16 w-[120%] cursor-pointer p-0 border-0"
                                        />
                                    </div>
                                    <Input
                                        value={color}
                                        onChange={(e) => setColor(e.target.value)}
                                        className="w-32 font-mono"
                                    />
                                </div>
                            </div>
                        </div>

                        <Separator />

                        {/* Actions */}
                        <div className="grid grid-cols-2 gap-4">
                            <Button
                                variant="outline"
                                className={cn("w-full", isFavorite && "text-red-500 hover:text-red-600")}
                                onClick={() => toggleFavorite(activeIcon.id)}
                            >
                                <Heart className={cn("mr-2 h-4 w-4", isFavorite && "fill-current")} />
                                {isFavorite ? "Favorited" : "Favorite"}
                            </Button>

                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => setCompareOpen(true)}
                            >
                                <ArrowLeftRight className="mr-2 h-4 w-4" />
                                Compare
                            </Button>

                            <Button onClick={handleCopySvg} variant="outline" className="w-full">
                                <Copy className="mr-2 h-4 w-4" />
                                Copy SVG
                            </Button>
                            <Button onClick={handleCopyPng} variant="outline" className="w-full">
                                <Copy className="mr-2 h-4 w-4" />
                                Copy PNG
                            </Button>
                            <Button onClick={handleDownloadSvg} variant="secondary" className="w-full">
                                <Download className="mr-2 h-4 w-4" />
                                SVG
                            </Button>
                            <Button onClick={handleDownloadPng} className="w-full">
                                <Download className="mr-2 h-4 w-4" />
                                PNG
                            </Button>
                        </div>

                        {/* Metadata */}
                        <div className="space-y-4 pt-4 border-t">
                            {activeIcon.aiDescription ? (
                                <div>
                                    <h3 className="mb-2 text-sm font-medium text-muted-foreground">AI Description</h3>
                                    <p className="text-sm text-foreground leading-relaxed">
                                        {activeIcon.aiDescription}
                                    </p>
                                </div>
                            ) : (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-sm font-medium text-muted-foreground">AI Description</h3>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full h-auto py-4 border-dashed"
                                        onClick={handleGenerateDescription}
                                        disabled={generating}
                                    >
                                        {generating ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Generating...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="mr-2 h-4 w-4" />
                                                Generate Description
                                            </>
                                        )}
                                    </Button>
                                </div>
                            )}
                            <div>
                                <h3 className="mb-2 text-sm font-medium text-muted-foreground">Tags</h3>
                                <div className="flex flex-wrap gap-2">
                                    {activeIcon.tags.map((tag) => (
                                        <Badge key={tag} variant="secondary">
                                            {tag}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>

            <CompareModal
                icon={activeIcon}
                open={compareOpen}
                onOpenChange={setCompareOpen}
            />
        </>
    );
}
