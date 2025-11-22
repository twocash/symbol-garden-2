"use client";

import { useProject } from "@/lib/project-context";
import { useSearch } from "@/lib/search-context";
import { useUI } from "@/lib/ui-context";
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
    X
} from "lucide-react";
import { useState, useEffect } from "react";
import { copySvg, copyPng, downloadPng, downloadSvg } from "@/lib/export-utils";
import { cn } from "@/lib/utils";
import { CompareModal } from "@/components/icons/CompareModal";
import { RightSidebarWorkspace } from "@/components/layout/RightSidebarWorkspace";
import { toast } from "sonner";

export function RightPanel() {
    const { currentProject, updateProject, toggleFavorite } = useProject();
    const { selectedIconId, setSelectedIconId, icons, setIcons } = useSearch();
    const { openRenameWorkspace, openDuplicateWorkspace, openDeleteWorkspace } = useUI();

    // Icon Mode State
    const [size, setSize] = useState(256);
    const [color, setColor] = useState("#ffffff");
    const [compareOpen, setCompareOpen] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [copied, setCopied] = useState(false);

    // Derived State
    const activeIcon = selectedIconId ? icons.find(i => i.id === selectedIconId) : null;
    const isFavorite = activeIcon && currentProject?.favorites.includes(activeIcon.id);

    // Effect to sync color with project brand color when switching to icon mode
    useEffect(() => {
        if (activeIcon && currentProject?.brandColor) {
            setColor(currentProject.brandColor);
        }
    }, [activeIcon, currentProject?.brandColor]);

    if (!currentProject) return null;

    // --- Project Mode Handlers ---
    const handleColorChange = (newColor: string) => {
        updateProject({
            ...currentProject,
            brandColor: newColor
        });
        toast.success("Workspace updated");
    };

    const handleExportSettingChange = (key: 'format', value: 'svg' | 'png' | 'jsx') => {
        updateProject({
            ...currentProject,
            exportSettings: {
                repoLink: currentProject.exportSettings?.repoLink,
                ...currentProject.exportSettings,
                format: value
            }
        });
        toast.success("Workspace updated");
    };

    const handleRepoUrlChange = (value: string) => {
        updateProject({
            ...currentProject,
            exportSettings: {
                format: currentProject.exportSettings?.format || 'svg',
                ...currentProject.exportSettings,
                repoLink: value
            }
        });
    };

    const handleCopyRepoUrl = () => {
        if (currentProject.exportSettings?.repoLink) {
            navigator.clipboard.writeText(currentProject.exportSettings.repoLink);
            toast.success("Repo URL copied");
        }
    };

    const handleOpenRepo = () => {
        if (currentProject.exportSettings?.repoLink) {
            window.open(currentProject.exportSettings.repoLink, '_blank');
        }
    };

    // --- Icon Mode Handlers ---
    const handleCopySvg = async () => {
        if (!activeIcon) return;
        await copySvg(activeIcon, size, color);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleCopyPng = async () => {
        if (!activeIcon) return;
        try {
            await copyPng(activeIcon, size, color);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy PNG", err);
            alert("Failed to copy PNG to clipboard");
        }
    };

    const handleDownload = () => {
        if (!activeIcon) return;
        if (currentProject.exportSettings?.format === 'png') {
            downloadPng(activeIcon, size, color);
        } else {
            downloadSvg(activeIcon, size, color);
        }
    };

    const handleGenerateDescription = async () => {
        if (!activeIcon) return;
        const apiKey = localStorage.getItem("gemini_api_key");
        if (!apiKey) {
            alert("Please enter a Gemini API Key in Settings first."); // TODO: Move API key to global settings?
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
                const updatedIcon = {
                    ...activeIcon,
                    tags: [...new Set([...activeIcon.tags, ...enriched.tags])],
                    aiDescription: enriched.description
                };

                const updatedIcons = icons.map(i => i.id === activeIcon.id ? updatedIcon : i);
                setIcons(updatedIcons);

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

    // --- Render ---

    if (!activeIcon) {
        return (
            <RightSidebarWorkspace
                workspaceId={currentProject.id}
                workspaceName={currentProject.name}
                primaryColor={currentProject.brandColor || "#000000"}
                onPrimaryColorChange={handleColorChange}
                exportFormat={currentProject.exportSettings?.format || 'svg'}
                onExportFormatChange={(val) => handleExportSettingChange('format', val)}
                repoUrl={currentProject.exportSettings?.repoLink || ""}
                onRepoUrlChange={handleRepoUrlChange}
                onOpenRepo={handleOpenRepo}
                onCopyRepoUrl={handleCopyRepoUrl}
                onRenameWorkspace={() => openRenameWorkspace(currentProject.id)}
                onDuplicateWorkspace={() => openDuplicateWorkspace(currentProject.id)}
                onDeleteWorkspace={() => openDeleteWorkspace(currentProject.id)}
            />
        );
    }

    return (
        <div className="w-[320px] border-l bg-card flex flex-col h-full">
            {/* --- Icon Mode --- */}
            <div className="p-4 border-b flex items-center justify-between">
                <div className="flex items-center gap-2 overflow-hidden">
                    <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0">
                        <img
                            src={`/data/${activeIcon.library}.svg`} // Assuming library icons exist, fallback needed?
                            alt={activeIcon.library}
                            className="h-4 w-4 opacity-50"
                            onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                    </div>
                    <div className="truncate">
                        <h2 className="font-semibold truncate">{activeIcon.name}</h2>
                        <p className="text-xs text-muted-foreground truncate">{activeIcon.library}</p>
                    </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setSelectedIconId(null)}>
                    <X className="h-4 w-4" />
                </Button>
            </div>

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
                            viewBox={activeIcon.viewBox}
                            fill={activeIcon.renderStyle === "fill" ? color : "none"}
                            stroke={activeIcon.renderStyle === "fill" ? "none" : color}
                            strokeWidth={activeIcon.renderStyle === "fill" ? "0" : "2"}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-32 w-32 transition-colors duration-200 relative z-10"
                        >
                            <path
                                d={activeIcon.path}
                                fillRule={activeIcon.fillRule as any}
                                clipRule={activeIcon.clipRule as any}
                            />
                        </svg>
                    </div>

                    {/* Quick Actions */}
                    <div className="grid grid-cols-2 gap-2">
                        <Button
                            variant={isFavorite ? "default" : "outline"}
                            className={cn("w-full", isFavorite && "bg-red-500 hover:bg-red-600 text-white")}
                            onClick={() => toggleFavorite(activeIcon.id)}
                        >
                            <Heart className={cn("mr-2 h-4 w-4", isFavorite && "fill-current")} />
                            {isFavorite ? "Saved" : "Save"}
                        </Button>
                        <Button
                            onClick={() => {
                                const format = currentProject.exportSettings?.format || 'svg';
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
                                    Copy {(currentProject.exportSettings?.format || 'svg').toUpperCase()}
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
                            <div className="flex items-center gap-2">
                                <div className="relative h-8 w-8 rounded-md border overflow-hidden shrink-0">
                                    <input
                                        type="color"
                                        value={color}
                                        onChange={(e) => setColor(e.target.value)}
                                        className="absolute -top-2 -left-2 h-12 w-12 cursor-pointer p-0 border-0"
                                    />
                                </div>
                                <Input
                                    value={color}
                                    onChange={(e) => setColor(e.target.value)}
                                    className="h-8 font-mono text-xs"
                                />
                            </div>
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
                            <h3 className="text-sm font-medium">AI Description</h3>
                            {!activeIcon.aiDescription && (
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
                        {activeIcon.aiDescription ? (
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                {activeIcon.aiDescription}
                            </p>
                        ) : (
                            <p className="text-xs text-muted-foreground italic">
                                No description generated yet.
                            </p>
                        )}

                        <div className="flex flex-wrap gap-1">
                            {activeIcon.tags.map((tag) => (
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
                </div>
            </ScrollArea>

            <CompareModal
                icon={activeIcon}
                open={compareOpen}
                onOpenChange={setCompareOpen}
            />
        </div>
    );
}
