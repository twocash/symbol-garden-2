import { Sidebar } from "@/components/layout/Sidebar";
import { SearchProvider } from "@/lib/search-context";
import { ProjectProvider } from "@/lib/project-context";
import { UIProvider } from "@/lib/ui-context";
import { RightPanel } from "@/components/layout/RightPanel";
import { Toaster } from "sonner";
import { RenameWorkspaceModal } from "@/components/dialogs/RenameWorkspaceModal";
import { DuplicateWorkspaceModal } from "@/components/dialogs/DuplicateWorkspaceModal";
import { DeleteWorkspaceModal } from "@/components/dialogs/DeleteWorkspaceModal";

interface AppShellProps {
    children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
    return (
        <ProjectProvider>
            <SearchProvider>
                <UIProvider>
                    <div className="flex h-screen overflow-hidden bg-background">
                        <Sidebar />
                        <main className="flex-1 overflow-y-auto p-6">
                            {children}
                        </main>
                        <RightPanel />
                        <Toaster />
                        <RenameWorkspaceModal />
                        <DuplicateWorkspaceModal />
                        <DeleteWorkspaceModal />
                    </div>
                </UIProvider>
            </SearchProvider>
        </ProjectProvider>
    );
}
