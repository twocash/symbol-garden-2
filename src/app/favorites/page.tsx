"use client";

import { useProject } from "@/lib/project-context";
import { IconGrid } from "@/components/icons/IconGrid";
import { Separator } from "@/components/ui/separator";
import { useEffect, useState } from "react";
import { Icon } from "@/types/schema";

export default function FavoritesPage() {
    const { currentProject } = useProject();
    const [favoriteIcons, setFavoriteIcons] = useState<Icon[]>([]);

    useEffect(() => {
        if (currentProject) {
            const allIcons = JSON.parse(localStorage.getItem("ingested_icons") || "[]");
            const favorites = allIcons.filter((icon: Icon) => currentProject.favorites.includes(icon.id));
            setFavoriteIcons(favorites);
        }
    }, [currentProject]);

    if (!currentProject) {
        return <div className="p-8">Loading project...</div>;
    }

    return (
        <div className="container py-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Favorites</h1>
                <p className="text-muted-foreground">
                    Your favorite icons in <span className="font-medium text-foreground">{currentProject.name}</span>
                </p>
            </div>
            <Separator />

            {favoriteIcons.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    No favorites yet. Heart some icons to see them here!
                </div>
            ) : (
                <IconGrid icons={favoriteIcons} />
            )}
        </div>
    );
}
