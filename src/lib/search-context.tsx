"use client";

import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { Icon } from "@/types/schema";
import { getIngestedIcons } from "@/lib/storage";

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

                // Load dynamic icons from IndexedDB
                const dynamicIcons = await getIngestedIcons();

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
        console.warn("useSearch used outside of SearchProvider");
        return {
            query: "",
            setQuery: () => { },
            icons: [],
            setIcons: () => { },
            selectedLibrary: "all",
            setSelectedLibrary: () => { },
            libraries: [],
            selectedIconId: null,
            setSelectedIconId: () => { }
        };
    }
    return context;
}
