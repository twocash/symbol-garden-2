"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/types/schema";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { IconCard } from "@/components/icons/IconCard";
import { useSearch } from "@/lib/search-context";
import Fuse from "fuse.js";

interface CompareModalProps {
    icon: Icon | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CompareModal({ icon, open, onOpenChange }: CompareModalProps) {
    const { icons: allIcons } = useSearch();
    const [variants, setVariants] = useState<Icon[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!icon || !open) return;

        setLoading(true);

        // Use Fuse.js for fuzzy matching
        const fuse = new Fuse(allIcons, {
            keys: [
                { name: "name", weight: 2 },
                { name: "tags", weight: 1 },
                { name: "aiDescription", weight: 0.5 },
                { name: "synonyms", weight: 1 }
            ],
            threshold: 0.4, // Adjust for sensitivity
            ignoreLocation: true
        });

        // Search using the icon name
        const results = fuse.search(icon.name);

        // Filter out the current icon and map to item
        const matches = results
            .map(result => result.item)
            .filter(i => i.id !== icon.id)
            .slice(0, 11); // Limit to a reasonable number (e.g., 11 + 1 current = 12 grid)

        setVariants(matches);
        setLoading(false);

    }, [icon, open, allIcons]);

    if (!icon) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Compare "{icon.name}"</DialogTitle>
                    <DialogDescription>
                        Reviewing variants across libraries.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 mt-4">
                    {/* Current Icon (Highlighted) */}
                    <div className="relative ring-2 ring-primary rounded-lg">
                        <div className="absolute -top-2 -left-2 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded z-10">
                            Current
                        </div>
                        <IconCard icon={icon} />
                    </div>

                    {/* Variants */}
                    {loading ? (
                        <div className="col-span-full text-center text-muted-foreground py-8">
                            Loading variants...
                        </div>
                    ) : variants.length > 0 ? (
                        variants.map((variant) => (
                            <IconCard key={variant.id} icon={variant} />
                        ))
                    ) : (
                        <div className="col-span-full text-center text-muted-foreground py-8">
                            No other variants found.
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
