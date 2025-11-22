"use client";

import { useState } from "react";
import { HexColorPicker } from "react-colorful";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Plus, X, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const MAX_SECONDARY_COLORS = 8;

interface SecondaryColorPaletteProps {
    colors: string[];
    onAdd: (color: string) => void;
    onUpdate: (index: number, color: string) => void;
    onRemove: (index: number) => void;
    maxColors?: number;
}

export function SecondaryColorPalette({
    colors = [],
    onAdd,
    onUpdate,
    onRemove,
    maxColors = MAX_SECONDARY_COLORS
}: SecondaryColorPaletteProps) {
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [addingNew, setAddingNew] = useState(false);
    const [tempColor, setTempColor] = useState("#CD1409");
    const [inputValue, setInputValue] = useState("#CD1409");

    const isMaxReached = colors.length >= maxColors;

    const handleAddClick = () => {
        setTempColor("#CD1409");
        setInputValue("#CD1409");
        setAddingNew(true);
    };

    const handleAddConfirm = () => {
        try {
            onAdd(tempColor);
            setAddingNew(false);
            toast.success("Color added");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to add color");
        }
    };

    const handleEditClick = (index: number) => {
        setEditingIndex(index);
        setTempColor(colors[index]);
        setInputValue(colors[index]);
    };

    const handleEditConfirm = () => {
        if (editingIndex === null) return;
        try {
            onUpdate(editingIndex, tempColor);
            setEditingIndex(null);
            toast.success("Color updated");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to update color");
        }
    };

    const handleRemove = (index: number, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            onRemove(index);
            toast.success("Color removed");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to remove color");
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setInputValue(newValue);

        // Validate hex format
        if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(newValue)) {
            setTempColor(newValue);
        }
    };

    const handleInputBlur = () => {
        // Reset to current valid value if input is invalid
        if (!/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(inputValue)) {
            setInputValue(tempColor);
        }
    };

    return (
        <div className="flex flex-wrap items-center gap-1.5">
            {/* Existing color swatches */}
            {colors.map((color, index) => (
                <div key={index} className="relative group">
                    <Popover
                        open={editingIndex === index}
                        onOpenChange={(open) => {
                            if (!open) setEditingIndex(null);
                        }}
                    >
                        <PopoverTrigger asChild>
                            <button
                                onClick={() => handleEditClick(index)}
                                className={cn(
                                    "h-7 w-7 rounded-full border-2 border-border transition-all",
                                    "hover:scale-110 hover:border-primary/50",
                                    "relative"
                                )}
                                style={{ backgroundColor: color }}
                                aria-label={`Edit color ${color}`}
                            />
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-3 border-2 shadow-xl bg-popover" align="start">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-muted-foreground">Edit color</span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-xs text-destructive hover:text-destructive"
                                        onClick={() => {
                                            handleRemove(index, { stopPropagation: () => { } } as any);
                                            setEditingIndex(null);
                                        }}
                                    >
                                        <X className="h-3 w-3 mr-1" />
                                        Remove
                                    </Button>
                                </div>
                                <HexColorPicker color={tempColor} onChange={setTempColor} />
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground w-6">Hex</span>
                                    <Input
                                        value={inputValue}
                                        onChange={handleInputChange}
                                        onBlur={handleInputBlur}
                                        className="h-8 font-mono text-xs uppercase"
                                        placeholder="#000000"
                                    />
                                </div>
                                <Button
                                    size="sm"
                                    className="w-full h-8"
                                    onClick={handleEditConfirm}
                                >
                                    Update
                                </Button>
                            </div>
                        </PopoverContent>
                    </Popover>

                    {/* Delete button on hover */}
                    <button
                        onClick={(e) => handleRemove(index, e)}
                        className={cn(
                            "absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground",
                            "flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity",
                            "hover:bg-destructive/90"
                        )}
                        aria-label="Remove color"
                    >
                        <X className="h-2.5 w-2.5" />
                    </button>
                </div>
            ))}

            {/* Add new color button */}
            <Popover open={addingNew} onOpenChange={setAddingNew}>
                <PopoverTrigger asChild>
                    <button
                        onClick={handleAddClick}
                        disabled={isMaxReached}
                        className={cn(
                            "h-7 w-7 rounded-full border-2 border-dashed transition-all",
                            "flex items-center justify-center",
                            isMaxReached
                                ? "border-border/40 text-muted-foreground/40 cursor-not-allowed"
                                : "border-primary/40 text-primary hover:border-primary hover:bg-primary/10 hover:scale-110"
                        )}
                        aria-label="Add secondary color"
                        title={isMaxReached ? `Maximum of ${maxColors} colors reached` : "Add color"}
                    >
                        <Plus className="h-3.5 w-3.5" />
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-3 border-2 shadow-xl bg-popover" align="start">
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">Pick a color</span>
                        </div>
                        <HexColorPicker color={tempColor} onChange={setTempColor} />
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-6">Hex</span>
                            <Input
                                value={inputValue}
                                onChange={handleInputChange}
                                onBlur={handleInputBlur}
                                className="h-8 font-mono text-xs uppercase"
                                placeholder="#000000"
                            />
                        </div>
                        <Button
                            size="sm"
                            className="w-full h-8"
                            onClick={handleAddConfirm}
                        >
                            Add Color
                        </Button>
                    </div>
                </PopoverContent>
            </Popover>

            {/* Empty state message */}
            {colors.length === 0 && (
                <p className="text-[11px] text-muted-foreground italic ml-1">
                    No secondary colors yet
                </p>
            )}
        </div>
    );
}
