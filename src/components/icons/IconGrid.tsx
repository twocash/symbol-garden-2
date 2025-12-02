"use client";

import { useState, useMemo } from "react";
import { Icon } from "@/types/schema";
import { IconCard } from "@/components/icons/IconCard";
import { useSearch } from "@/lib/search-context";
import { useProject } from "@/lib/project-context";
import { useUI } from "@/lib/ui-context";
import Fuse from "fuse.js";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { LibraryHeader, LibraryOption } from "@/components/icons/LibraryHeader";

interface IconGridProps {
    icons?: Icon[];
}

// Library label mapping configuration
const LIBRARY_LABELS: Record<string, string> = {
    "all": "All Libraries",
    // Standard library names
    "lucide-icons": "Lucide Icons",
    "fontawesome": "Font Awesome",
    "bootstrap-icons": "Bootstrap Icons",
    "heroicons": "Heroicons",
    "radix-icons": "Radix Icons",
    "feather-icons": "Feather Icons",
    "material-icons": "Material Icons",
    "ionicons": "Ionicons",
    "simple-icons": "Simple Icons",
    // Iconify prefixes (used by ingested icons)
    "lucide": "Lucide",
    "tabler": "Tabler",
    "feather": "Feather",
    "fe": "Feather",
    "phosphor": "Phosphor",
    "humbleicons": "Humble Icons",
    "majesticons": "Majesticons",
    "iconoir": "Iconoir",
    "carbon": "Carbon",
    "solar": "Solar",
    "mdi": "Material Design",
    "fa": "Font Awesome",
    "fa6": "Font Awesome 6",
    "bi": "Bootstrap",
    "ri": "Remix",
    "ion": "Ionicons",
    // AI-generated icons
    "ai-sprout": "Custom Sprouts",
    "custom": "Custom Sprouts", // Legacy fallback
};

// Helper to prettify library names if not in config
const prettifyLibraryName = (id: string): string => {
    if (LIBRARY_LABELS[id]) return LIBRARY_LABELS[id];
    return id
        .split("-")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
};

export function IconGrid({ icons: propIcons }: IconGridProps) {
    const { query, setQuery, icons: contextIcons, selectedLibrary, setSelectedLibrary, libraries } = useSearch();
    const { openIconDetails, drawerIconId } = useUI();
    const { currentProject } = useProject();
    const [viewMode, setViewMode] = useState<"all" | "favorites">("all");

    // Use propIcons if available, otherwise use contextIcons + customIcons
    const sourceIcons = useMemo(() => {
        if (propIcons) return propIcons;
        const custom = currentProject?.customIcons || [];
        return [...contextIcons, ...custom];
    }, [propIcons, contextIcons, currentProject?.customIcons]);

    // Prepare library options for the header
    const libraryOptions: LibraryOption[] = useMemo(() => {
        const hasCustomIcons = (currentProject?.customIcons?.length || 0) > 0;
        const options = [
            { id: "all", label: "All Libraries" },
            ...libraries.map(lib => ({
                id: lib,
                label: prettifyLibraryName(lib)
            }))
        ];

        // Add "ai-sprout" library option if there are custom icons
        if (hasCustomIcons) {
            options.push({ id: "ai-sprout", label: "Custom Sprouts" });
        }

        return options;
    }, [libraries, currentProject?.customIcons?.length]);

    // Filter icons based on library, view mode, and search query
    const filteredIcons = useMemo(() => {
        let result = sourceIcons;

        // 1. Filter by Library (if not "all")
        if (selectedLibrary && selectedLibrary !== "all") {
            // "ai-sprout" should also match legacy "custom" library icons
            if (selectedLibrary === "ai-sprout") {
                result = result.filter(icon => icon.library === "ai-sprout" || icon.library === "custom");
            } else {
                result = result.filter(icon => icon.library === selectedLibrary);
            }
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
            {/* Unified Library Header */}
            <LibraryHeader
                query={query}
                onQueryChange={setQuery}
                libraryFilter={selectedLibrary}
                onLibraryChange={setSelectedLibrary}
                libraryOptions={libraryOptions}
                viewFilter={viewMode}
                onViewChange={setViewMode}
                totalCount={filteredIcons.length}
                onOpenAIIconGenerator={useUI().openAIIconGenerator}
            />

            {/* The Grid */}
            {sourceIcons.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    Loading icons...
                </div>
            ) : filteredIcons.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2 py-12">
                    <Search className="h-8 w-8 opacity-20" />
                    <p>No icons found matching your criteria.</p>
                    {viewMode === "favorites" ? (
                        <p className="text-sm">Try switching to "All" to find more.</p>
                    ) : selectedLibrary !== "all" ? (
                        <p className="text-sm">Try switching to "All Libraries".</p>
                    ) : null}
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 pb-8">
                    {filteredIcons.map((icon) => (
                        <div
                            key={icon.id}
                            onClick={() => openIconDetails(icon.id)}
                            className={cn(
                                "cursor-pointer rounded-xl transition-all duration-200",
                                drawerIconId === icon.id && "ring-2 ring-primary ring-offset-2 bg-accent/50"
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
