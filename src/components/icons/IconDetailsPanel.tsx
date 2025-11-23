"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Heart,
    Copy,
    ArrowLeftRight,
    Sparkles,
    Loader2,
    Trash2,
    RefreshCw
} from "lucide-react";
import { ColorPicker } from "@/components/ui/color-picker";
import { copySvg, copyPng, downloadPng, downloadSvg } from "@/lib/export-utils";
import { cn } from "@/lib/utils";
import { CompareModal } from "@/components/icons/CompareModal";
import { toast } from "sonner";
import { Icon } from "@/types/schema";
import { useProject } from "@/lib/project-context";
import { useSearch } from "@/lib/search-context";
import { useUI } from "@/lib/ui-context";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface IconDetailsPanelProps {
    icon: Icon;
}

export function IconDetailsPanel({ icon }: IconDetailsPanelProps) {
    const { currentProject, toggleFavorite, deleteIconFromProject } = useProject();
    const { setIcons, icons } = useSearch(); // Needed for AI enrichment update
    const { closeDrawer } = useUI();

    // Local State
    const [size, setSize] = useState(256);
    const [color, setColor] = useState("#ffffff");
    const [compareOpen, setCompareOpen] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [copied, setCopied] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    const isFavorite = currentProject?.favorites.includes(icon.id);
    const isCustomIcon = currentProject?.customIcons?.some(i => i.id === icon.id);

    // Sync color with project brand color on mount or when project changes
    useEffect(() => {
        if (currentProject?.brandColor) {
            setColor(currentProject.brandColor);
        }
    }, [currentProject?.brandColor]);

    const handleCopySvg = async () => {
        await copySvg(icon, size, color);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleCopyPng = async () => {
        try {
            await copyPng(icon, size, color);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy PNG", err);
            toast.error("Failed to copy PNG to clipboard");
        }
    };

    const handleDownload = () => {
        if (currentProject?.exportSettings?.format === 'png') {
            downloadPng(icon, size, color);
        } else {
            downloadSvg(icon, size, color);
        }
    };

    const handleGenerateDescription = async () => {
        const apiKey = localStorage.getItem("gemini_api_key");
        if (!apiKey) {
            toast.error("Please enter a Gemini API Key in Settings first.");
            return;
        }

        setGenerating(true);
        try {
            const res = await fetch("/api/enrich", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ icons: [icon], apiKey })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "API Failed");
            }

            const { data } = await res.json();
            if (data && data[0]) {
                const enriched = data[0];
                const updatedIcon = {
                    ...icon,
                    tags: [...new Set([...icon.tags, ...enriched.tags])],
                    aiDescription: enriched.description
                };

                // Update in SearchContext (live view)
                const updatedIcons = icons.map(i => i.id === icon.id ? updatedIcon : i);
                setIcons(updatedIcons);

                // Update in localStorage (persistence)
                const storedIcons = JSON.parse(localStorage.getItem("ingested_icons") || "[]");
                const storedIndex = storedIcons.findIndex((i: any) => i.id === icon.id);
                if (storedIndex !== -1) {
                    storedIcons[storedIndex] = updatedIcon;
                    localStorage.setItem("ingested_icons", JSON.stringify(storedIcons));
                }
                toast.success("Description generated");
            }
        } catch (error) {
            console.error(error);
            toast.error(`Failed to generate description: ${error instanceof Error ? error.message : "Unknown error"}`);
        } finally {
            setGenerating(false);
        }
    };

    const handleDelete = () => {
        deleteIconFromProject(icon.id);
        setDeleteDialogOpen(false);
        closeDrawer();
        toast.success("Icon deleted");
    };

    return (
        <div className="flex flex-col h-full">
            <ScrollArea className="flex-1">
                <div className="p-4 space-y-6">
                    {/* Preview */}
                    <div className="aspect-square w-full rounded-lg border bg-muted/30 p-8 relative overflow-hidden flex items-center justify-center">
                        <div className="absolute inset-0 opacity-20 pointer-events-none"
                            style={{
                                backgroundImage: `linear-gradient(45deg, #808080 25%, transparent 25%), linear-gradient(-45deg, #808080 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #808080 75%), linear-gradient(-45deg, transparent 75%, #808080 75%)`,
                                backgroundSize: '20px 20px',
                                backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
                            }}
                        />
                        <svg
                            viewBox={icon.viewBox}
                            fill={icon.renderStyle === "fill" ? color : "none"}
                            stroke={icon.renderStyle === "fill" ? "none" : color}
                            strokeWidth={icon.renderStyle === "fill" ? "0" : "2"}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-32 w-32 transition-colors duration-200 relative z-10"
                        >
                            <path
                                d={icon.path}
                                fillRule={icon.fillRule as any}
                                clipRule={icon.clipRule as any}
                            />
                        </svg>
                    </div>

                    {/* Quick Actions */}
                    <div className="grid grid-cols-2 gap-2">
                        <Button
                            variant={isFavorite ? "default" : "outline"}
                            className={cn("w-full", isFavorite && "bg-red-500 hover:bg-red-600 text-white")}
                            onClick={() => toggleFavorite(icon.id)}
                        >
                            <Heart className={cn("mr-2 h-4 w-4", isFavorite && "fill-current")} />
                            {isFavorite ? "Saved" : "Save"}
                        </Button>
                        <Button
                            onClick={() => {
                                const format = currentProject?.exportSettings?.format || 'svg';
                                if (format === 'png') {
                                    handleCopyPng();
                                } else {
                                    handleCopySvg();
                                }
                            }}
                            className="w-full"
                            disabled={copied}
                        >
                            {copied ? (
                                <>
                                    <Copy className="mr-2 h-4 w-4" />
                                    Copied!
                                </>
                            ) : (
                                <>
                                    <Copy className="mr-2 h-4 w-4" />
                                    Copy {(currentProject?.exportSettings?.format || 'svg').toUpperCase()}
                                </>
                            )}
                        </Button>
                    </div>

                    <Separator />

                    {/* Overrides */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-medium">Overrides</h3>
                        <div className="space-y-2">
                            <label className="text-xs text-muted-foreground">Color</label>
                            <ColorPicker value={color} onChange={setColor} />

                            {/* Workspace colors quick-select */}
                            {currentProject && (currentProject.brandColor || (currentProject.secondaryColors && currentProject.secondaryColors.length > 0)) && (
                                <div className="space-y-1 pt-1">
                                    <label className="text-xs text-muted-foreground">Workspace colors</label>
                                    <div className="flex flex-wrap gap-1.5">
                                        {/* Primary color swatch */}
                                        {currentProject.brandColor && (
                                            <button
                                                onClick={() => setColor(currentProject.brandColor!)}
                                                className={cn(
                                                    "h-6 w-6 rounded-full border-2 transition-all",
                                                    color === currentProject.brandColor
                                                        ? "border-primary scale-110"
                                                        : "border-border hover:scale-110 hover:border-primary/50"
                                                )}
                                                style={{ backgroundColor: currentProject.brandColor }}
                                                title={`Primary: ${currentProject.brandColor}`}
                                                aria-label={`Use primary color ${currentProject.brandColor}`}
                                            />
                                        )}
                                        {/* Secondary color swatches */}
                                        {currentProject.secondaryColors?.map((secColor, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => setColor(secColor)}
                                                className={cn(
                                                    "h-6 w-6 rounded-full border-2 transition-all",
                                                    color === secColor
                                                        ? "border-primary scale-110"
                                                        : "border-border hover:scale-110 hover:border-primary/50"
                                                )}
                                                style={{ backgroundColor: secColor }}
                                                title={secColor}
                                                aria-label={`Use secondary color ${secColor}`}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs text-muted-foreground">Size</label>
                                <span className="text-xs">{size}px</span>
                            </div>
                            <Slider
                                value={[size]}
                                onValueChange={(vals) => setSize(vals[0])}
                                min={16}
                                max={1024}
                                step={16}
                            />
                        </div>
                    </div>

                    <Separator />

                    {/* Metadata & AI */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Sprout Description</h3>
                            {!icon.aiDescription && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-xs"
                                    onClick={handleGenerateDescription}
                                    disabled={generating}
                                >
                                    {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 text-primary" />}
                                </Button>
                            )}
                        </div>
                        {icon.aiDescription ? (
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                {icon.aiDescription}
                            </p>
                        ) : (
                            <p className="text-xs text-muted-foreground italic">
                                No description generated yet.
                            </p>
                        )}

                        <div className="flex flex-wrap gap-1">
                            {icon.tags.map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-[10px] px-1 py-0">
                                    {tag}
                                </Badge>
                            ))}
                        </div>
                    </div>

                    <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setCompareOpen(true)}
                    >
                        <ArrowLeftRight className="mr-2 h-4 w-4" />
                        Compare Variants
                    </Button>

                    {/* Custom Icon Actions */}
                    {isCustomIcon && (
                        <div className="pt-4 border-t space-y-3">
                            <h3 className="text-sm font-medium">Sprout Actions</h3>
                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    disabled
                                    title="Coming soon"
                                >
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Remix
                                </Button>
                                <Button
                                    variant="destructive"
                                    className="w-full"
                                    onClick={() => setDeleteDialogOpen(true)}
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </ScrollArea>

            <CompareModal
                icon={icon}
                open={compareOpen}
                onOpenChange={setCompareOpen}
            />

            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Icon</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete "{icon.name}"? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDelete}>
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
