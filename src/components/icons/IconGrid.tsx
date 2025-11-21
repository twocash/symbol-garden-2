"use client";

import { useState, useMemo } from "react";
import { Icon } from "@/types/schema";
import { IconCard } from "@/components/icons/IconCard";
import { useSearch } from "@/lib/search-context";
import { useProject } from "@/lib/project-context";
import Fuse from "fuse.js";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Heart, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

interface IconGridProps {
    icons?: Icon[];
}

export function IconGrid({ icons: propIcons }: IconGridProps) {
    const { query, setQuery, icons: contextIcons, selectedLibrary, setSelectedIconId, selectedIconId } = useSearch();
    const { currentProject } = useProject();
    const [viewMode, setViewMode] = useState<"all" | "favorites">("all");

    // Use propIcons if available, otherwise use contextIcons
    const sourceIcons = propIcons || contextIcons;

    // Filter icons based on search query, selected library, and view mode
    const filteredIcons = useMemo(() => {
        let result = sourceIcons;

        // 1. Filter by Library (if not "all")
        if (selectedLibrary && selectedLibrary !== "all") {
            result = result.filter(icon => icon.library === selectedLibrary);
        }

        // 2. Filter by View Mode (Favorites)
        if (viewMode === "favorites" && currentProject) {
            result = result.filter(icon => currentProject.favorites.includes(icon.id));
        }

        // 3. Filter by Search Query
        if (!query) return result;

        const fuse = new Fuse(result, {
            keys: ["name", "tags", "categories", "synonyms", "aiDescription"],
            threshold: 0.3,
            ignoreLocation: true
        });

        return fuse.search(query).map((result) => result.item);
    }, [query, sourceIcons, selectedLibrary, viewMode, currentProject]);

    return (
        <div className="flex flex-col h-full gap-6">
            {/* Top Bar: Integrated into the Workspace */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="relative w-full sm:w-96">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search icons..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="pl-8 bg-muted/50 border-transparent focus:bg-background focus:border-input transition-all"
                    />
                </div>

                <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "all" | "favorites")} className="w-full sm:w-auto">
                    <TabsList className="grid w-full grid-cols-2 sm:w-auto">
                        <TabsTrigger value="all" className="gap-2">
                            <LayoutGrid className="h-4 w-4" />
                            All Icons
                        </TabsTrigger>
                        <TabsTrigger value="favorites" className="gap-2">
                            <Heart className={cn("h-4 w-4", viewMode === "favorites" && "fill-current")} />
                            Favorites
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            {/* The Grid */}
            {sourceIcons.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    Loading icons...
                </div>
            ) : filteredIcons.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
                    <Search className="h-8 w-8 opacity-20" />
                    <p>No icons found matching your criteria.</p>
                    {viewMode === "favorites" && (
                        <p className="text-sm">Try switching to "All Icons" to find more.</p>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 pb-8">
                    {filteredIcons.map((icon) => (
                        <div
                            key={icon.id}
                            onClick={() => setSelectedIconId(icon.id)}
                            className={cn(
                                "cursor-pointer rounded-xl transition-all duration-200",
                                selectedIconId === icon.id && "ring-2 ring-primary ring-offset-2 bg-accent/50"
                            )}
                        >
                            <IconCard
                                icon={icon}
                                color={currentProject?.brandColor}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
