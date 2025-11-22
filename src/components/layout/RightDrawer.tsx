"use client";

import { useUI } from "@/lib/ui-context";
import { useProject } from "@/lib/project-context";
import { useSearch } from "@/lib/search-context";
import { IconDetailsPanel } from "@/components/icons/IconDetailsPanel";
import { RightSidebarWorkspace } from "@/components/layout/RightSidebarWorkspace";
import { toast } from "sonner";
import { useEffect } from "react";

export function RightDrawer() {
    const {
        drawerMode,
        drawerIconId,
        drawerWorkspaceId,
        closeDrawer,
        openRenameWorkspace,
        openDuplicateWorkspace,
        openDeleteWorkspace
    } = useUI();

    const { projects, currentProject, updateProject } = useProject();
    const { icons } = useSearch();

    // Global Esc key handler
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                closeDrawer();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [closeDrawer]);

    if (drawerMode === "none") return null;

    // Resolve Data
    const activeIcon = drawerMode === "icon" && drawerIconId
        ? icons.find(i => i.id === drawerIconId)
        : null;

    const activeWorkspace = drawerMode === "workspace" && drawerWorkspaceId
        ? projects.find(p => p.id === drawerWorkspaceId)
        : currentProject; // Fallback to current if ID match fails, though UIContext should handle this

    // Workspace Handlers
    const handleColorChange = (newColor: string) => {
        if (!activeWorkspace) return;
        updateProject({ ...activeWorkspace, brandColor: newColor });
        toast.success("Workspace updated");
    };

    const handleExportSettingChange = (value: 'svg' | 'png' | 'jsx') => {
        if (!activeWorkspace) return;
        updateProject({
            ...activeWorkspace,
            exportSettings: {
                repoLink: activeWorkspace.exportSettings?.repoLink,
                ...activeWorkspace.exportSettings,
                format: value
            }
        });
        toast.success("Workspace updated");
    };

    const handleRepoUrlChange = (value: string) => {
        if (!activeWorkspace) return;
        updateProject({
            ...activeWorkspace,
            exportSettings: {
                format: activeWorkspace.exportSettings?.format || 'svg',
                ...activeWorkspace.exportSettings,
                repoLink: value
            }
        });
    };

    const handleCopyRepoUrl = () => {
        if (activeWorkspace?.exportSettings?.repoLink) {
            navigator.clipboard.writeText(activeWorkspace.exportSettings.repoLink);
            toast.success("Repo URL copied");
        }
    };

    const handleOpenRepo = () => {
        if (activeWorkspace?.exportSettings?.repoLink) {
            window.open(activeWorkspace.exportSettings.repoLink, '_blank');
        }
    };

    return (
        <aside className="w-[320px] border-l border-border/60 bg-sidebar flex flex-col h-full shrink-0 pr-4">
            {/* Shared Header */}
            {/* Shared Header */}
            <header className="p-4 border-b border-border/60 flex flex-col gap-2">
                {/* Row 1: Label + Close */}
                <div className="flex items-center justify-between">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {drawerMode === "icon" ? "Icon" : "Workspace"}
                    </p>
                    <button
                        type="button"
                        onClick={closeDrawer}
                        className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted/40 shrink-0 -mr-1"
                        aria-label="Close details"
                    >
                        ×
                    </button>
                </div>

                {/* Row 2: Title + Badge */}
                <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold truncate">
                        {drawerMode === "icon" ? activeIcon?.name : activeWorkspace?.name}
                    </h2>
                    {drawerMode === "workspace" && activeWorkspace?.id === currentProject?.id && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
                            <span className="h-2 w-2 rounded-full bg-emerald-400" />
                            Active
                        </span>
                    )}
                </div>

                {/* Row 3: Description */}
                {drawerMode === "icon" && activeIcon && (
                    <p className="text-xs text-muted-foreground truncate">
                        {activeIcon.library}
                    </p>
                )}
                {drawerMode === "workspace" && (
                    <p className="text-xs text-muted-foreground">
                        Defaults and exports for this workspace.
                    </p>
                )}
            </header>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto">
                {drawerMode === "icon" && activeIcon && (
                    <IconDetailsPanel icon={activeIcon} />
                )}

                {drawerMode === "workspace" && activeWorkspace && (
                    <RightSidebarWorkspace
                        workspaceId={activeWorkspace.id}
                        workspaceName={activeWorkspace.name}
                        primaryColor={activeWorkspace.brandColor || "#000000"}
                        onPrimaryColorChange={handleColorChange}
                        exportFormat={activeWorkspace.exportSettings?.format || 'svg'}
                        onExportFormatChange={handleExportSettingChange}
                        repoUrl={activeWorkspace.exportSettings?.repoLink || ""}
                        onRepoUrlChange={handleRepoUrlChange}
                        onOpenRepo={handleOpenRepo}
                        onCopyRepoUrl={handleCopyRepoUrl}
                        onRenameWorkspace={() => openRenameWorkspace(activeWorkspace.id)}
                        onDuplicateWorkspace={() => openDuplicateWorkspace(activeWorkspace.id)}
                        onDeleteWorkspace={() => openDeleteWorkspace(activeWorkspace.id)}
                    />
                )}
            </div>
        </aside>
    );
}
