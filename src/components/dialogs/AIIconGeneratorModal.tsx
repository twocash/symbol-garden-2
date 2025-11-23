"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProject } from "@/lib/project-context";
import { useSearch } from "@/lib/search-context";
import { toast } from "sonner";
import { Loader2, Sparkles, Check, Download } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface AIIconGeneratorModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function AIIconGeneratorModal({ isOpen, onClose }: AIIconGeneratorModalProps) {
    const { currentProject, addIconToProject, toggleFavorite } = useProject();
    const { icons: globalIcons } = useSearch();
    const [prompt, setPrompt] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedImages, setGeneratedImages] = useState<string[]>([]);
    const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Derive favorites from currentProject and globalIcons
    const favorites = currentProject?.favorites
        .map(id => globalIcons.find(i => i.id === id))
        .filter((icon): icon is NonNullable<typeof icon> => !!icon) || [];

    // Reset state when opening
    useEffect(() => {
        if (isOpen) {
            setPrompt("");
            setGeneratedImages([]);
            setSelectedImageIndex(null);
        }
    }, [isOpen]);

    // Helper to construct SVG string
    const getSvgString = (icon: typeof favorites[0]) => `
<svg viewBox="${icon.viewBox}" xmlns="http://www.w3.org/2000/svg">
    <path d="${icon.path}" fill="currentColor" />
</svg>`;

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        if (favorites.length < 8) {
            toast.error("You need at least 8 favorites to generate icons.");
            return;
        }

        setIsGenerating(true);
        setGeneratedImages([]);
        setSelectedImageIndex(null);

        try {
            // Prepare form data
            const formData = new FormData();
            formData.append("prompt", prompt);

            favorites.slice(0, 12).forEach((icon, index) => {
                const svgString = getSvgString(icon);
                const blob = new Blob([svgString], { type: "image/svg+xml" });
                formData.append("styleReferences", blob, `seed-${index}.svg`);
            });

            const response = await fetch("/api/generate", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Generation failed");
            }

            const data = await response.json();
            setGeneratedImages(data.images);
            toast.success("Icons generated successfully!");
        } catch (error) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : "Failed to generate icons");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSave = async () => {
        if (selectedImageIndex === null || !currentProject) return;

        setIsSaving(true);
        try {
            const imageBase64 = generatedImages[selectedImageIndex];

            // Convert base64 to blob
            const res = await fetch(imageBase64);
            const blob = await res.blob();

            // Send to vectorize API
            const formData = new FormData();
            formData.append("image", blob, "generated-icon.png");

            const vectorizeRes = await fetch("/api/vectorize", {
                method: "POST",
                body: formData,
            });

            if (!vectorizeRes.ok) {
                const errorData = await vectorizeRes.json();
                throw new Error(errorData.error || "Vectorization failed");
            }

            const { svg } = await vectorizeRes.json();

            // Add to project
            const newIconId = crypto.randomUUID();

            // Extract path and viewBox
            const viewBoxMatch = svg.match(/viewBox="([^"]+)"/);
            const pathMatch = svg.match(/d="([^"]+)"/);

            // If we have a path, use path-based icon
            const newIcon: any = {
                id: newIconId,
                name: prompt || "Generated Icon",
                library: "custom",
                viewBox: viewBoxMatch ? viewBoxMatch[1] : "0 0 512 512",
                tags: ["ai-generated", "sprout"],
                categories: ["Generated"],
                renderStyle: "fill",
            };

            if (pathMatch) {
                newIcon.path = pathMatch[1];
                addIconToProject(newIcon, true); // Auto-favorite
                toast.success(`"${prompt}" saved!`);
                onClose();
            } else {
                throw new Error("Could not extract vector path from generated SVG");
            }

        } catch (error) {
            console.error('Save error:', error);
            toast.error(error instanceof Error ? error.message : "Failed to save icon");
        } finally {
            setIsSaving(false);
        }
    };

    const seedsCount = favorites.length;
    const canGenerate = seedsCount >= 8;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[800px] h-[600px] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-primary" />
                        Sprout Custom Icon
                    </DialogTitle>
                    <DialogDescription>
                        Generate brand-consistent icons using your favorites as seeds.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 flex gap-6 min-h-0 py-4">
                    {/* Left Column: Controls */}
                    <div className="w-1/3 flex flex-col gap-6">
                        <div className="space-y-2">
                            <Label>Icon Concept</Label>
                            <Input
                                placeholder="e.g. Battery charging with lightning bolt"
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
                                disabled={isGenerating}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="flex justify-between">
                                <span>Style Seeds</span>
                                <span className={cn("text-xs", canGenerate ? "text-muted-foreground" : "text-destructive")}>
                                    {seedsCount}/8 required
                                </span>
                            </Label>
                            <div className="grid grid-cols-4 gap-2 p-2 bg-muted/50 rounded-lg border">
                                {favorites.slice(0, 12).map((icon) => (
                                    <div key={icon.id} className="aspect-square bg-background rounded p-1 flex items-center justify-center border">
                                        <div
                                            className="w-full h-full text-foreground"
                                            dangerouslySetInnerHTML={{ __html: getSvgString(icon) }}
                                        />
                                    </div>
                                ))}
                                {Array.from({ length: Math.max(0, 8 - seedsCount) }).map((_, i) => (
                                    <div key={`empty-${i}`} className="aspect-square bg-muted/20 rounded border border-dashed flex items-center justify-center text-muted-foreground/20">
                                        <div className="w-2 h-2 rounded-full bg-current" />
                                    </div>
                                ))}
                            </div>
                            {!canGenerate && (
                                <p className="text-xs text-destructive">
                                    Favorite at least {8 - seedsCount} more icons in {currentProject?.name || "this workspace"} to use this feature.
                                </p>
                            )}
                        </div>

                        <div className="mt-auto">
                            <Button
                                className="w-full"
                                onClick={handleGenerate}
                                disabled={!canGenerate || !prompt.trim() || isGenerating}
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Sprouting...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4 mr-2" />
                                        Sprout Icon
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>

                    <Separator orientation="vertical" />

                    {/* Right Column: Results */}
                    <div className="flex-1 flex flex-col min-h-0">
                        <Label className="mb-2">Nursery (Results)</Label>
                        <ScrollArea className="flex-1 bg-muted/30 rounded-lg border p-4">
                            {generatedImages.length > 0 ? (
                                <div className="grid grid-cols-3 gap-4">
                                    {generatedImages.map((src, index) => (
                                        <button
                                            key={index}
                                            className={cn(
                                                "relative aspect-square rounded-lg border-2 overflow-hidden bg-background transition-all hover:border-primary/50 focus:outline-none",
                                                selectedImageIndex === index ? "border-primary ring-2 ring-primary/20" : "border-transparent"
                                            )}
                                            onClick={() => setSelectedImageIndex(index)}
                                        >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={src} alt={`Generated variant ${index + 1}`} className="w-full h-full object-contain p-4" />
                                            {selectedImageIndex === index && (
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
                                    <p className="text-sm font-medium">Ready to sprout</p>
                                    <p className="text-xs mt-1">Enter a prompt and click generate to see results here.</p>
                                </div>
                            )}
                        </ScrollArea>

                        <div className="mt-4 flex justify-end gap-2">
                            <Button variant="outline" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSave}
                                disabled={selectedImageIndex === null || isSaving}
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
