"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProject } from "@/lib/project-context";
import { useSearch } from "@/lib/search-context";
import { getIconSources } from "@/lib/storage";
import { toast } from "sonner";
import { Loader2, Sparkles, Check, Download, Settings2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface AIIconGeneratorModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function AIIconGeneratorModal({ isOpen, onClose }: AIIconGeneratorModalProps) {
    const { currentProject, addIconToProject } = useProject();
    const { icons: globalIcons, libraries } = useSearch();
    const [prompt, setPrompt] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedSvgs, setGeneratedSvgs] = useState<string[]>([]);
    const [selectedSvgIndex, setSelectedSvgIndex] = useState<number | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Generation options
    const [libraryOverride, setLibraryOverride] = useState<string | null>(null);
    const [variantCount, setVariantCount] = useState<number>(3);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [fewShotCount, setFewShotCount] = useState<number>(4);
    const [temperature, setTemperature] = useState<number>(0.2);

    // Metadata from generation
    const [metadata, setMetadata] = useState<{
        fewShotExamples?: string[];
        decompositionSource?: string;
        attempts?: number;
    } | null>(null);

    // Icon sources (for accessing styleManifest)
    const [iconSources, setIconSources] = useState<Array<{
        id: string;
        name: string;
        styleManifest?: string;
    }>>([]);

    // Determine available libraries from ingested icons
    const availableLibraries = libraries.filter(lib => lib !== "custom");

    // Derive favorites and detect dominant library
    const favorites = currentProject?.favorites
        .map(id => globalIcons.find(i => i.id === id))
        .filter((icon): icon is NonNullable<typeof icon> => !!icon && !!icon.path) || [];

    // Detect dominant library from favorites (like the original flow)
    const detectedLibrary = (() => {
        if (favorites.length >= 3) {
            const libraryCount: Record<string, number> = {};
            favorites.forEach(icon => {
                if (icon.library) {
                    libraryCount[icon.library] = (libraryCount[icon.library] || 0) + 1;
                }
            });
            const sorted = Object.entries(libraryCount).sort((a, b) => b[1] - a[1]);
            if (sorted.length > 0) {
                return { library: sorted[0][0], count: sorted[0][1], total: favorites.length };
            }
        }
        // Fallback: use the library with most icons
        if (availableLibraries.length > 0) {
            const libCounts = availableLibraries.map(lib => ({
                lib,
                count: globalIcons.filter(i => i.library === lib).length
            }));
            libCounts.sort((a, b) => b.count - a.count);
            return { library: libCounts[0].lib, count: libCounts[0].count, total: globalIcons.length, fromAll: true };
        }
        return null;
    })();

    // The effective library to use
    const effectiveLibrary = libraryOverride || detectedLibrary?.library || availableLibraries[0];

    // Reset state when opening and load icon sources
    useEffect(() => {
        if (isOpen) {
            setPrompt("");
            setGeneratedSvgs([]);
            setSelectedSvgIndex(null);
            setMetadata(null);
            setLibraryOverride(null); // Reset override on open

            // Load icon sources to access styleManifest
            getIconSources().then(sources => {
                setIconSources(sources);
            });
        }
    }, [isOpen]);

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            toast.error("Please enter an icon concept");
            return;
        }

        if (!effectiveLibrary) {
            toast.error("No icon library available. Please ingest a library first.");
            return;
        }

        // Get icons for the effective library
        const libraryIcons = globalIcons.filter(icon =>
            icon.library === effectiveLibrary && icon.path
        );

        if (libraryIcons.length < 10) {
            toast.error(`Not enough icons in "${effectiveLibrary}" library. Need at least 10 icons.`);
            return;
        }

        setIsGenerating(true);
        setGeneratedSvgs([]);
        setSelectedSvgIndex(null);
        setMetadata(null);

        try {
            // Find the styleManifest for this library from icon sources
            const librarySource = iconSources.find(s => s.name === effectiveLibrary);
            const styleManifest = librarySource?.styleManifest;

            console.log(`[Modal] Generating "${prompt}" in style of ${effectiveLibrary} (${libraryIcons.length} icons)${styleManifest ? ' with Style DNA' : ''}`);

            const response = await fetch("/api/generate-svg", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    concept: prompt.trim(),
                    libraryId: effectiveLibrary,
                    icons: libraryIcons.slice(0, 100), // Send up to 100 icons for reference
                    styleManifest, // Pass Style DNA if available
                    options: {
                        variants: variantCount,
                        fewShotCount,
                        temperature,
                        decompositionMode: "auto",
                        includePatternLibrary: true,
                    },
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();

                if (response.status === 429) {
                    throw new Error("API Quota Exceeded. Please wait a moment and try again.");
                }

                throw new Error(errorData.details || errorData.error || "Generation failed");
            }

            const data = await response.json();

            // Handle single or multiple SVGs
            const svgs = data.svgs || (data.svg ? [data.svg] : []);
            setGeneratedSvgs(svgs);
            setMetadata(data.metadata);

            if (svgs.length > 0) {
                toast.success(`Generated ${svgs.length} icon variant${svgs.length > 1 ? 's' : ''}!`);
            } else {
                toast.error("No icons were generated");
            }
        } catch (error) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : "Failed to generate icons");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSave = async () => {
        if (selectedSvgIndex === null || !currentProject) return;

        setIsSaving(true);
        try {
            const svg = generatedSvgs[selectedSvgIndex];

            // Extract viewBox from the SVG
            const viewBoxMatch = svg.match(/viewBox="([^"]+)"/);
            const fillRuleMatch = svg.match(/fill-rule="([^"]+)"/);

            // Extract ALL path elements and combine their d attributes
            // Generated SVGs often have multiple <path> elements for complex icons
            const pathMatches = [...svg.matchAll(/<path[^>]*d="([^"]+)"[^>]*\/?>/g)];

            if (pathMatches.length === 0) {
                throw new Error("Could not extract vector path from generated SVG");
            }

            // Combine all path d attributes into a single path string
            // Each path becomes a separate move command in the combined path
            const combinedPath = pathMatches.map(match => match[1]).join(' ');

            console.log(`[Modal] Saving icon with ${pathMatches.length} path(s), combined length: ${combinedPath.length}`);

            const newIcon = {
                id: crypto.randomUUID(),
                name: prompt || "Generated Icon",
                library: "custom",
                viewBox: viewBoxMatch ? viewBoxMatch[1] : "0 0 24 24",
                path: combinedPath,
                tags: ["ai-generated", "sprout"],
                categories: ["Generated"],
                renderStyle: "stroke" as const,
                fillRule: fillRuleMatch ? fillRuleMatch[1] : undefined,
            };

            addIconToProject(newIcon, true); // Auto-favorite
            toast.success(`"${prompt}" saved to workspace!`);
            onClose();
        } catch (error) {
            console.error('Save error:', error);
            toast.error(error instanceof Error ? error.message : "Failed to save icon");
        } finally {
            setIsSaving(false);
        }
    };

    // Helper to render SVG preview
    const renderSvgPreview = (svg: string) => {
        // Add stroke styling for preview
        const styledSvg = svg
            .replace(/<svg/, '<svg class="w-full h-full"')
            .replace(/stroke="[^"]*"/, 'stroke="currentColor"')
            .replace(/fill="[^"]*"/, 'fill="none"');
        return styledSvg;
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[800px] h-[600px] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-primary" />
                        Sprout Custom Icon
                    </DialogTitle>
                    <DialogDescription>
                        Generate native SVG icons that match your library&apos;s style.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 flex gap-6 min-h-0 py-4">
                    {/* Left Column: Controls */}
                    <div className="w-1/3 flex flex-col gap-4">
                        <div className="space-y-2">
                            <Label>Icon Concept</Label>
                            <Input
                                placeholder="e.g. rocket, brain, magic-wand"
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && !isGenerating && handleGenerate()}
                                disabled={isGenerating}
                            />
                            <p className="text-xs text-muted-foreground">
                                Describe the icon you want to create
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label>Style Library</Label>
                            {libraryOverride ? (
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 px-3 py-2 rounded-md border bg-muted/50 text-sm">
                                        {libraryOverride.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setLibraryOverride(null)}
                                        className="text-xs"
                                    >
                                        Reset
                                    </Button>
                                </div>
                            ) : detectedLibrary ? (
                                <div className="px-3 py-2 rounded-md border bg-muted/50">
                                    <div className="text-sm font-medium">
                                        {detectedLibrary.library.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {detectedLibrary.fromAll
                                            ? `Largest library (${detectedLibrary.count} icons)`
                                            : `Detected from ${detectedLibrary.count}/${detectedLibrary.total} favorites`}
                                    </div>
                                </div>
                            ) : (
                                <div className="px-3 py-2 rounded-md border bg-muted/50 text-sm text-muted-foreground">
                                    No library available
                                </div>
                            )}
                            {availableLibraries.length > 1 && !libraryOverride && (
                                <Select value="" onValueChange={(v) => v && setLibraryOverride(v)}>
                                    <SelectTrigger className="h-8 text-xs">
                                        <SelectValue placeholder="Override library..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableLibraries.map(lib => (
                                            <SelectItem key={lib} value={lib}>
                                                {lib.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label>Variants</Label>
                            <Select value={variantCount.toString()} onValueChange={(v) => setVariantCount(parseInt(v))}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">1 variant</SelectItem>
                                    <SelectItem value="2">2 variants</SelectItem>
                                    <SelectItem value="3">3 variants</SelectItem>
                                    <SelectItem value="4">4 variants</SelectItem>
                                    <SelectItem value="5">5 variants</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Advanced Options Toggle */}
                        <div>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="w-full justify-start text-xs text-muted-foreground"
                                onClick={() => setShowAdvanced(!showAdvanced)}
                            >
                                <Settings2 className="w-3 h-3 mr-2" />
                                {showAdvanced ? "Hide" : "Show"} Advanced Options
                            </Button>
                            {showAdvanced && (
                                <div className="space-y-3 pt-2 px-1">
                                    <div className="space-y-1">
                                        <Label className="text-xs flex justify-between">
                                            <span>Few-shot Examples</span>
                                            <span className="text-muted-foreground">{fewShotCount}</span>
                                        </Label>
                                        <input
                                            type="range"
                                            min="1"
                                            max="8"
                                            step="1"
                                            value={fewShotCount}
                                            onChange={(e) => setFewShotCount(Number(e.target.value))}
                                            className="w-full h-2"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs flex justify-between">
                                            <span>Temperature</span>
                                            <span className="text-muted-foreground">{temperature.toFixed(1)}</span>
                                        </Label>
                                        <input
                                            type="range"
                                            min="0"
                                            max="1"
                                            step="0.1"
                                            value={temperature}
                                            onChange={(e) => setTemperature(Number(e.target.value))}
                                            className="w-full h-2"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="mt-auto">
                            <Button
                                className="w-full"
                                onClick={handleGenerate}
                                disabled={!prompt.trim() || isGenerating || globalIcons.length < 10}
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4 mr-2" />
                                        Generate Icon
                                    </>
                                )}
                            </Button>
                            {globalIcons.length < 10 && (
                                <p className="text-xs text-destructive mt-2 text-center">
                                    Ingest an icon library first to enable generation
                                </p>
                            )}
                        </div>
                    </div>

                    <Separator orientation="vertical" />

                    {/* Right Column: Results */}
                    <div className="flex-1 flex flex-col min-h-0">
                        <div className="flex items-center justify-between mb-2">
                            <Label>Generated Icons</Label>
                            {metadata && (
                                <span className="text-xs text-muted-foreground">
                                    {metadata.fewShotExamples?.length || 0} examples used
                                    {metadata.decompositionSource && ` · ${metadata.decompositionSource} decomposition`}
                                </span>
                            )}
                        </div>
                        <ScrollArea className="flex-1 bg-muted/30 rounded-lg border p-4">
                            {generatedSvgs.length > 0 ? (
                                <div className="grid grid-cols-3 gap-4">
                                    {generatedSvgs.map((svg, index) => (
                                        <button
                                            key={index}
                                            className={cn(
                                                "relative aspect-square rounded-lg border-2 overflow-hidden bg-background transition-all hover:border-primary/50 focus:outline-none p-4",
                                                selectedSvgIndex === index ? "border-primary ring-2 ring-primary/20" : "border-muted"
                                            )}
                                            onClick={() => setSelectedSvgIndex(index)}
                                        >
                                            <div
                                                className="w-full h-full text-foreground"
                                                dangerouslySetInnerHTML={{ __html: renderSvgPreview(svg) }}
                                            />
                                            {selectedSvgIndex === index && (
                                                <div className="absolute top-2 right-2 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-sm">
                                                    <Check className="w-3 h-3" />
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-center p-8">
                                    <Sparkles className="w-12 h-12 mb-4 opacity-20" />
                                    <p className="text-sm font-medium">Ready to generate</p>
                                    <p className="text-xs mt-1">Enter a concept and click generate to create icons.</p>
                                </div>
                            )}
                        </ScrollArea>

                        <div className="mt-4 flex justify-end gap-2">
                            <Button variant="outline" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSave}
                                disabled={selectedSvgIndex === null || isSaving}
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Download className="w-4 h-4 mr-2" />
                                        Save to Workspace
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
