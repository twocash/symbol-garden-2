"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { RightDrawer } from "@/components/layout/RightDrawer";

interface AppShellProps {
    children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
    return (
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
        </div>
    );
}
