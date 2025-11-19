"use client";

import { useState } from "react";
import { Icon } from "@/types/schema";
import { IconCard } from "@/components/icons/IconCard";
import { IconDetail } from "@/components/icons/IconDetail";
import { useSearch } from "@/lib/search-context";
import Fuse from "fuse.js";
import { useMemo } from "react";

export function IconGrid() {
    const [selectedIcon, setSelectedIcon] = useState<Icon | null>(null);
    const { query, icons, selectedLibrary } = useSearch();

    // Filter icons based on search query and selected library
    const filteredIcons = useMemo(() => {
        let result = icons;

        // Filter by library first
        if (selectedLibrary && selectedLibrary !== "all") {
            result = result.filter(icon => icon.library === selectedLibrary);
        }

        if (!query) return result;

        const fuse = new Fuse(result, {
            keys: ["name", "tags", "categories", "synonyms"],
            threshold: 0.3,
        });

        return fuse.search(query).map((result) => result.item);
    }, [query, icons, selectedLibrary]);

    if (icons.length === 0) {
        return <div className="p-8 text-center text-muted-foreground">Loading icons...</div>;
    }

    if (filteredIcons.length === 0) {
        return <div className="p-8 text-center text-muted-foreground">No icons found.</div>;
    }

    return (
        <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {filteredIcons.map((icon) => (
                    <div key={icon.id} onClick={() => setSelectedIcon(icon)} className="cursor-pointer">
                        <IconCard icon={icon} />
                    </div>
                ))}
            </div>
            <IconDetail
                icon={selectedIcon}
                open={!!selectedIcon}
                onOpenChange={(open) => !open && setSelectedIcon(null)}
            />
        </>
    );
}
