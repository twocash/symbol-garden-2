import { Sidebar } from "@/components/layout/Sidebar";
import { SearchProvider } from "@/lib/search-context";
import { ProjectProvider } from "@/lib/project-context";
import { RightPanel } from "@/components/layout/RightPanel";

interface AppShellProps {
    children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
    return (
        <ProjectProvider>
            <SearchProvider>
                <div className="flex h-screen overflow-hidden bg-background">
                    <Sidebar />
                    <main className="flex-1 overflow-y-auto p-6">
                        {children}
                    </main>
                    <RightPanel />
                </div>
            </SearchProvider>
        </ProjectProvider>
    );
}
