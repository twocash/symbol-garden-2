"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { SearchProvider } from "@/lib/search-context";
import { ProjectProvider } from "@/lib/project-context";
import { UIProvider } from "@/lib/ui-context";
import { RightDrawer } from "@/components/layout/RightDrawer";
import { Toaster } from "sonner";

interface AppShellProps {
    children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
    return (
        <ProjectProvider>
            <UIProvider>
                <SearchProvider>
                    <div className="flex h-screen bg-background text-foreground overflow-hidden">
                        <Sidebar />
                        <main className="flex-1 flex flex-col min-w-0">
                            <div className="flex-1 flex overflow-hidden">
                                <div className="flex-1 flex flex-col min-w-0 overflow-y-auto px-6">
                                    {children}
                                </div>
                                <RightDrawer />
                            </div>
                        </main>
                        <Toaster />
                    </div>
                </SearchProvider>
            </UIProvider>
        </ProjectProvider>
    );
}
