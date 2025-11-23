"use client";

import { SearchProvider } from "@/lib/search-context";
import { ProjectProvider } from "@/lib/project-context";
import { UIProvider } from "@/lib/ui-context";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ProjectProvider>
            <SearchProvider>
                <UIProvider>
                    {children}
                    <Toaster />
                </UIProvider>
            </SearchProvider>
        </ProjectProvider>
    );
}
