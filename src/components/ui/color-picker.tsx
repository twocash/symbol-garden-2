"use client";

import { useState } from "react";
import { HexColorPicker } from "react-colorful";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

interface ColorPickerProps {
    value: string;
    onChange: (value: string) => void;
    className?: string;
}

export function ColorPicker({ value, onChange, className }: ColorPickerProps) {
    const [open, setOpen] = useState(false);
    const [inputValue, setInputValue] = useState(value);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setInputValue(newValue);

        // Validate hex format
        if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(newValue)) {
            onChange(newValue);
        }
    };

    const handleInputBlur = () => {
        // Reset to current valid value if input is invalid
        if (!/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(inputValue)) {
            setInputValue(value);
        }
    };

    // Sync input value when prop changes
    if (value !== inputValue && /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value)) {
        setInputValue(value);
    }

    return (
        <div className={className}>
            <div className="flex items-center gap-2">
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            className="h-8 w-8 p-0 border-border"
                            style={{ backgroundColor: value }}
                            aria-label="Pick a color"
                        >
                            <div className="sr-only">Pick a color</div>
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-3 border-2 shadow-xl bg-popover" align="start">
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-muted-foreground">Pick a color</span>
                            </div>
                            <HexColorPicker color={value} onChange={onChange} />
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
                        </div>
                    </PopoverContent>
                </Popover>
                <Input
                    value={inputValue}
                    onChange={handleInputChange}
                    onBlur={handleInputBlur}
                    className="h-8 font-mono text-xs uppercase"
                    placeholder="#000000"
                />
            </div>
        </div>
    );
}
