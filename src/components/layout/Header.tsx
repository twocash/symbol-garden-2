"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useSearch } from "@/lib/search-context";

export function Header() {
    const { query, setQuery } = useSearch();

    return (
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/80 px-6 backdrop-blur-sm">
            <div className="flex flex-1 items-center gap-2">
                <div className="relative w-full max-w-md">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Search icons..."
                        className="w-full bg-background pl-9 md:w-[300px] lg:w-[400px]"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    <div className="absolute right-2.5 top-2.5 hidden items-center gap-1 text-xs text-muted-foreground md:flex">
                        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                            <span className="text-xs">⌘</span>K
                        </kbd>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2">
                {/* User nav or other actions can go here */}
            </div>
        </header>
    );
}
