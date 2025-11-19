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
import { Copy, Download, Check, GitCompare } from "lucide-react";
import { useState } from "react";
import { CompareModal } from "@/components/icons/CompareModal";
import { copySvg, copyPng, downloadPng, downloadSvg } from "@/lib/export-utils";

interface IconDetailProps {
    icon: Icon | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function IconDetail({ icon, open, onOpenChange }: IconDetailProps) {
    const [copied, setCopied] = useState(false);
    const [compareOpen, setCompareOpen] = useState(false);
    const [size, setSize] = useState(256);
    const [color, setColor] = useState("#ffffff"); // Default to white for dark mode contrast

    // Reset defaults when icon changes
    // useEffect(() => {
    //     if (open) {
    //         setSize(256);
    //         setColor("#000000");
    //     }
    // }, [open, icon]);

    if (!icon) return null;

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
            alert("Failed to copy PNG to clipboard");
        }
    };

    const handleDownloadPng = () => {
        downloadPng(icon, size, color);
    };

    const handleDownloadSvg = () => {
        downloadSvg(icon, size, color);
    };

    return (
        <>
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto p-6">
                    <SheetHeader>
                        <SheetTitle>{icon.name}</SheetTitle>
                        <SheetDescription>
                            {icon.library} / {icon.style || "regular"}
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
                                viewBox={icon.viewBox}
                                fill={icon.renderStyle === "fill" ? color : "none"}
                                stroke={icon.renderStyle === "fill" ? "none" : color}
                                strokeWidth={icon.renderStyle === "fill" ? "0" : "2"}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="h-64 w-64 transition-colors duration-200 relative z-10"
                            >
                                <path
                                    d={icon.path}
                                    fillRule={icon.fillRule as any}
                                    clipRule={icon.clipRule as any}
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

                            <Button
                                variant="ghost"
                                className="col-span-2"
                                onClick={() => setCompareOpen(true)}
                            >
                                <GitCompare className="mr-2 h-4 w-4" />
                                Compare Variants
                            </Button>
                        </div>

                        {/* Metadata */}
                        <div className="space-y-4 pt-4 border-t">
                            <div>
                                <h3 className="mb-2 text-sm font-medium text-muted-foreground">Tags</h3>
                                <div className="flex flex-wrap gap-2">
                                    {icon.tags.map((tag) => (
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
                icon={icon}
                open={compareOpen}
                onOpenChange={setCompareOpen}
            />
        </>
    );
}
