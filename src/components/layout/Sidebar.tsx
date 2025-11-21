"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { LayoutGrid, Plus, FolderOpen } from "lucide-react";
import { useProject } from "@/lib/project-context";
import { useSearch } from "@/lib/search-context";

export function Sidebar() {
    const { projects, currentProject, switchProject, createProject } = useProject();
    const { setSelectedLibrary } = useSearch();

    const handleSwitchToAll = () => {
        // "All Library" is effectively a null project context or a specific "all" state
        // For now, we might need a way to represent "No Project Selected" in ProjectContext,
        // or we treat "All" as a special mode.
        // Based on the plan: "All Library" -> Neutral Mode.
        // We might need to update ProjectContext to allow currentProject to be null?
        // Or we just switch to a "default" project?
        // Let's assume for now we switch to the default project or handle it via a specific ID if needed.
        // But wait, the requirement says "The Project is the Global Context".
        // If "All Library" is selected, maybe we just clear the current project?
        // Let's try switching to the 'default' project if it exists, or handle null.
        // Actually, let's look at ProjectContext again. It has a 'default' project.
        switchProject("default");
        setSelectedLibrary("all");
    };

    const handleCreateProject = () => {
        const name = prompt("Enter project name:");
        if (name) {
            createProject(name);
        }
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
                                <Button
                                    key={project.id}
                                    variant={currentProject?.id === project.id ? "secondary" : "ghost"}
                                    className="w-full justify-start font-normal"
                                    onClick={() => switchProject(project.id)}
                                >
                                    <div
                                        className="mr-2 h-2 w-2 rounded-full shrink-0"
                                        style={{ backgroundColor: project.brandColor || "hsl(var(--primary))" }}
                                    />
                                    <span className="truncate">{project.name}</span>
                                </Button>
                            ))}
                            {projects.length === 1 && ( // Only default project exists
                                <div className="px-2 py-4 text-xs text-muted-foreground text-center border-dashed border rounded-md">
                                    No projects yet.
                                    <br />
                                    Click + to create one.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </ScrollArea>

            {/* User / Meta (Optional footer) */}
            <div className="p-4 border-t text-xs text-muted-foreground text-center">
                v0.2.3
            </div>
        </div>
    );
}
