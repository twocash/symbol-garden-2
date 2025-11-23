"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
    ToggleGroup,
    ToggleGroupItem,
} from "@/components/ui/toggle-group"; // Note: shadcn/ui toggle-group might need to be installed or verified
import {
    ChevronDown,
    Library as LibraryIcon,
    Grid2x2,
    Heart,
    Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ViewFilter = "all" | "favorites";

export type LibraryOption = {
    id: string;   // "all" | "fontawesome" | "lineicons" | ...
    label: string; // "All Libraries", "Font-Awesome", etc.
};

interface LibraryHeaderProps {
    // Search
    query: string;
    onQueryChange: (value: string) => void;

    // Library filter
    libraryFilter: string;
    onLibraryChange: (value: string) => void;
    libraryOptions: LibraryOption[];

    // View filter
    viewFilter: ViewFilter;
    onViewChange: (value: ViewFilter) => void;

    // Optional: count to show on the right
    totalCount?: number;

    // AI Trigger
    onOpenAIIconGenerator: () => void;
}

export function LibraryHeader({
    query,
    onQueryChange,
    libraryFilter,
    onLibraryChange,
    libraryOptions,
    viewFilter,
    onViewChange,
    totalCount,
    onOpenAIIconGenerator,
}: LibraryHeaderProps) {
    const activeLibrary = libraryOptions.find(
        (opt) => opt.id === libraryFilter
    ) ?? libraryOptions[0];

    return (
        <div className="space-y-2 pb-4">
            {/* Page title */}
            <h1 className="text-xl font-semibold tracking-tight">Library</h1>

            {/* Filter bar */}
            <div className="flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="flex-1 min-w-[220px]">
                    <Input
                        placeholder="Search icons…"
                        value={query}
                        onChange={(e) => onQueryChange(e.target.value)}
                        className="bg-muted/40"
                    />
                </div>

                {/* Library dropdown */}
                <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild aria-label="Select icon library">
                            <Button
                                variant="outline"
                                className="inline-flex items-center gap-2"
                            >
                                <LibraryIcon className="h-4 w-4" />
                                <span className="text-sm">
                                    Library · {activeLibrary?.label || "All Libraries"}
                                </span>
                                <ChevronDown className="h-3 w-3 opacity-70" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Libraries</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {libraryOptions.map((opt) => (
                                <DropdownMenuItem
                                    key={opt.id}
                                    onClick={() => onLibraryChange(opt.id)}
                                    className={cn(
                                        "flex items-center justify-between gap-2",
                                        opt.id === libraryFilter && "font-medium"
                                    )}
                                >
                                    <span>{opt.label}</span>
                                    {opt.id === libraryFilter && (
                                        <span className="text-xs uppercase tracking-wide text-foreground/60">
                                            Active
                                        </span>
                                    )}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* View toggle: All / Favorites */}
                    <ToggleGroup
                        type="single"
                        value={viewFilter}
                        onValueChange={(val) => {
                            if (!val) return;
                            onViewChange(val as ViewFilter);
                        }}
                        className="bg-muted/40 rounded-lg p-0.5 border"
                        aria-label="View filter"
                    >
                        <ToggleGroupItem
                            value="all"
                            className="flex items-center gap-1 px-3 py-1 text-xs data-[state=on]:bg-background data-[state=on]:shadow-sm"
                            aria-label="Show all icons"
                        >
                            <Grid2x2 className="h-3 w-3" />
                            <span>All</span>
                        </ToggleGroupItem>
                        <ToggleGroupItem
                            value="favorites"
                            className="flex items-center gap-1 px-3 py-1 text-xs data-[state=on]:bg-background data-[state=on]:shadow-sm"
                            aria-label="Show favorites only"
                        >
                            <Heart className="h-3 w-3" />
                            <span>Favorites</span>
                        </ToggleGroupItem>
                    </ToggleGroup>

                    {/* AI Generator Trigger */}
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-2 text-xs border-dashed border-primary/40 hover:border-primary hover:bg-primary/5"
                        onClick={onOpenAIIconGenerator}
                    >
                        <Sparkles className="h-3 w-3 text-primary" />
                        Sprout Icon
                    </Button>
                </div>

                {/* Optional count / status */}
                {typeof totalCount === "number" && (
                    <div className="ml-auto text-xs text-muted-foreground hidden sm:block">
                        {totalCount.toLocaleString()} icons
                    </div>
                )}
            </div>
        </div>
    );
}
