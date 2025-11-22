"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useProject } from "@/lib/project-context";
import { useUI } from "@/lib/ui-context";
import { toast } from "sonner";

export function DuplicateWorkspaceModal() {
    const { projects, duplicateProject } = useProject();
    const { duplicateModalOpen, duplicateProjectId, closeDuplicateWorkspace } = useUI();
    const [name, setName] = useState("");
    const [copyFavorites, setCopyFavorites] = useState(true);

    const project = projects.find((p) => p.id === duplicateProjectId);

    useEffect(() => {
        if (project) {
            setName(`${project.name} Copy`);
            setCopyFavorites(true);
        }
    }, [project, duplicateModalOpen]);

    const handleDuplicate = () => {
        if (!project || !name.trim()) return;

        try {
            duplicateProject(project.id, name.trim(), copyFavorites);
            toast.success("Workspace duplicated");
            closeDuplicateWorkspace();
        } catch (error) {
            toast.error("Failed to duplicate workspace");
        }
    };

    return (
        <Dialog open={duplicateModalOpen} onOpenChange={(open) => !open && closeDuplicateWorkspace()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Duplicate workspace</DialogTitle>
                    <DialogDescription>
                        Create a copy of {project?.name} and its settings.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="workspace-name">New workspace name</Label>
                        <Input
                            id="workspace-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Enter workspace name"
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleDuplicate();
                            }}
                        />
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="copy-favorites"
                            checked={copyFavorites}
                            onCheckedChange={(checked) => setCopyFavorites(checked as boolean)}
                        />
                        <Label
                            htmlFor="copy-favorites"
                            className="text-sm font-normal cursor-pointer"
                        >
                            Include favorited icons
                        </Label>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={closeDuplicateWorkspace}>
                        Cancel
                    </Button>
                    <Button onClick={handleDuplicate} disabled={!name.trim()}>
                        Create copy
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
