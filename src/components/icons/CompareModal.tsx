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

interface CompareModalProps {
    icon: Icon | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CompareModal({ icon, open, onOpenChange }: CompareModalProps) {
    const [variants, setVariants] = useState<Icon[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!icon || !open) return;

        async function fetchVariants() {
            setLoading(true);
            try {
                // In a real app, this would be a specific API call or filtered from a global store.
                // For MVP, we'll fetch all and filter client-side (inefficient but works for seed data).
                const res = await fetch("/data/icons.json");
                const allIcons: Icon[] = await res.json();

                // Find icons with matching name or synonyms
                const matches = allIcons.filter(
                    (i) =>
                        i.id !== icon?.id && // Don't show the current icon
                        (i.name === icon?.name ||
                            i.synonyms?.some(s => icon?.synonyms?.includes(s)))
                );
                setVariants(matches);
            } catch (error) {
                console.error("Failed to fetch variants:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchVariants();
    }, [icon, open]);

    if (!icon) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Compare "{icon.name}"</DialogTitle>
                    <DialogDescription>
                        Reviewing variants across libraries.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 mt-4">
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
