"use client";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { LayoutGrid, Plus, Settings, MoreVertical, Edit, Copy, Trash2 } from "lucide-react";
import { useProject } from "@/lib/project-context";
import { useSearch } from "@/lib/search-context";
import { useUI } from "@/lib/ui-context";
import { SettingsModal } from "@/components/layout/SettingsModal";
import { useState } from "react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Project } from "@/types/schema";

export function Sidebar() {
    const { projects, currentProject, switchProject, createProject, renameProject } = useProject();
    const { setSelectedLibrary } = useSearch();
    const { drawerMode, openDuplicateWorkspace, openDeleteWorkspace, openWorkspaceSettings } = useUI();
    const [settingsOpen, setSettingsOpen] = useState(false);

    // Workspace management state
    const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState("");

    const handleSwitchToAll = () => {
        switchProject("default");
        setSelectedLibrary("all");
    };

    const handleCreateProject = () => {
        const name = prompt("Enter project name:");
        if (name) {
            try {
                createProject(name);
                toast.success("Workspace created");
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Failed to create workspace");
            }
        }
    };

    const handleSwitchProject = (projectId: string) => {
        switchProject(projectId);

        // If workspace settings drawer is open, auto-update to show the new workspace
        if (drawerMode === "workspace") {
            openWorkspaceSettings(projectId);
        }
    };

    const startRenaming = (project: Project) => {
        setEditingProjectId(project.id);
        setEditingName(project.name);
    };

    const handleRenameSubmit = () => {
        if (!editingProjectId) return;

        try {
            if (editingName.trim() !== "") {
                renameProject(editingProjectId, editingName);
                toast.success("Workspace renamed");
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to rename workspace");
            // Don't close edit mode on error so user can fix it
            return;
        }
        setEditingProjectId(null);
    };

    return (
        <div className="flex h-screen w-60 flex-col border-r bg-background">
            <div className="p-6">
                <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
                    <div className="h-6 w-6 rounded bg-primary" />
                    Symbol Garden
                </h1>
            </div>

            <ScrollArea className="flex-1 px-4">
                <div className="space-y-4">
                    {/* Global Context */}
                    <div className="py-2">
                        <Button
                            variant={currentProject?.id === "default" ? "secondary" : "ghost"}
                            className="w-full justify-start"
                            onClick={handleSwitchToAll}
                        >
                            <LayoutGrid className="mr-2 h-4 w-4" />
                            All Library
                        </Button>
                    </div>

                    <Separator />

                    {/* Project Contexts */}
                    <div className="py-2">
                        <div className="flex items-center justify-between px-2 mb-2">
                            <h2 className="text-xs font-semibold tracking-tight text-muted-foreground">
                                Workspaces
                            </h2>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-4 w-4 hover:bg-transparent"
                                onClick={handleCreateProject}
                            >
                                <Plus className="h-3 w-3" />
                            </Button>
                        </div>
                        <div className="space-y-1">
                            {projects.filter(p => p.id !== "default").map((project) => (
                                <div key={project.id}>
                                    <div className="group flex items-center relative">
                                        {editingProjectId === project.id ? (
                                            <div className="w-full px-2 py-1">
                                                <Input
                                                    value={editingName}
                                                    onChange={(e) => setEditingName(e.target.value)}
                                                    onBlur={handleRenameSubmit}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") handleRenameSubmit();
                                                        if (e.key === "Escape") setEditingProjectId(null);
                                                    }}
                                                    autoFocus
                                                    className="h-8 text-sm"
                                                    onFocus={(e) => e.target.select()}
                                                />
                                                <div className="text-[10px] text-muted-foreground mt-1 px-1">
                                                    Enter to save · Esc to cancel
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <Button
                                                    variant={currentProject?.id === project.id ? "secondary" : "ghost"}
                                                    className="w-full justify-start font-normal pr-8"
                                                    onClick={() => handleSwitchProject(project.id)}
                                                    onDoubleClick={() => startRenaming(project)}
                                                >
                                                    <div
                                                        className="mr-2 h-2 w-2 rounded-full shrink-0"
                                                        style={{ backgroundColor: project.brandColor || "hsl(var(--primary))" }}
                                                    />
                                                    <span className="truncate">{project.name}</span>
                                                </Button>

                                                <div className="absolute right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-6 w-6">
                                                                <MoreVertical className="h-3 w-3" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-48">
                                                            <DropdownMenuItem onClick={() => openWorkspaceSettings(project.id)}>
                                                                <Settings className="mr-2 h-4 w-4" />
                                                                Workspace settings...
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => startRenaming(project)}>
                                                                <Edit className="mr-2 h-4 w-4" />
                                                                Rename workspace...
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => openDuplicateWorkspace(project.id)}>
                                                                <Copy className="mr-2 h-4 w-4" />
                                                                Duplicate workspace...
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                onClick={() => openDeleteWorkspace(project.id)}
                                                                className="text-destructive focus:text-destructive"
                                                            >
                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                Delete workspace...
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    {/* Workspace Settings Trigger for Active Workspace */}
                                </div>
                            ))}
                            {projects.filter(p => p.id !== "default").length === 0 && (
                                <div className="px-2 py-4 text-xs text-muted-foreground text-center border-dashed border rounded-md">
                                    No workspaces yet.
                                    <br />
                                    Click + to create one.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </ScrollArea >

            {/* Footer: Version + Settings */}
            < div className="p-4 border-t flex items-center justify-between" >
                <span className="text-xs text-muted-foreground">v0.5.0</span>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setSettingsOpen(true)}
                >
                    <Settings className="h-4 w-4" />
                </Button>
            </div >

            <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
        </div >
    );
}
