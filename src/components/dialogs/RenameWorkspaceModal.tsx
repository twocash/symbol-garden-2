"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProject } from "@/lib/project-context";
import { useUI } from "@/lib/ui-context";
import { toast } from "sonner";

export function RenameWorkspaceModal() {
    const { projects, renameProject } = useProject();
    const { renameModalOpen, renameProjectId, closeRenameWorkspace } = useUI();
    const [name, setName] = useState("");

    const project = projects.find((p) => p.id === renameProjectId);

    useEffect(() => {
        if (project) {
            setName(project.name);
        }
    }, [project, renameModalOpen]);

    const handleRename = () => {
        if (!project || !name.trim()) return;

        try {
            renameProject(project.id, name.trim());
            toast.success("Workspace renamed");
            closeRenameWorkspace();
        } catch (error) {
            toast.error("Failed to rename workspace");
        }
    };

    return (
        <Dialog open={renameModalOpen} onOpenChange={(open) => !open && closeRenameWorkspace()}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Rename Workspace</DialogTitle>
                    <DialogDescription>
                        Enter a new name for your workspace.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name">Name</Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleRename()}
                            autoFocus
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={closeRenameWorkspace}>
                        Cancel
                    </Button>
                    <Button onClick={handleRename}>Save Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
