"use client";

import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { Icon } from "@/types/schema";

interface SearchContextType {
    query: string;
    setQuery: (query: string) => void;
    icons: Icon[];
    setIcons: (icons: Icon[]) => void;
    selectedLibrary: string;
    setSelectedLibrary: (library: string) => void;
    libraries: string[];
    selectedIconId: string | null;
    setSelectedIconId: (id: string | null) => void;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export function SearchProvider({ children }: { children: ReactNode }) {
    const [query, setQuery] = useState("");
    const [icons, setIcons] = useState<Icon[]>([]);
    const [selectedLibrary, setSelectedLibrary] = useState("all");
    const [libraries, setLibraries] = useState<string[]>([]);
    const [selectedIconId, setSelectedIconId] = useState<string | null>(null);

    useEffect(() => {
        async function loadIcons() {
            try {
                // Load static icons
                const res = await fetch("/data/icons.json");
                const staticIcons: Icon[] = await res.json();

                // Load dynamic icons from localStorage
                const storedIcons = localStorage.getItem("ingested_icons");
                const dynamicIcons: Icon[] = storedIcons ? JSON.parse(storedIcons) : [];

                const allIcons = [...staticIcons, ...dynamicIcons];
                setIcons(allIcons);

                // Extract unique libraries
                const uniqueLibs = Array.from(new Set(allIcons.map(icon => icon.library)));
                setLibraries(uniqueLibs);
            } catch (error) {
                console.error("Failed to load icons:", error);
            }
        }
        loadIcons();
    }, []);

    return (
        <SearchContext.Provider value={{
            query,
            setQuery,
            icons,
            setIcons,
            selectedLibrary,
            setSelectedLibrary,
            libraries,
            selectedIconId,
            setSelectedIconId
        }}>
            {children}
        </SearchContext.Provider>
    );
}

export function useSearch() {
    const context = useContext(SearchContext);
    if (context === undefined) {
        throw new Error("useSearch must be used within a SearchProvider");
    }
    return context;
}
