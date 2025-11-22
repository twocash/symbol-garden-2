"use client";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { useProject } from "@/lib/project-context";
import { useUI } from "@/lib/ui-context";
import { toast } from "sonner";

export function DeleteWorkspaceModal() {
    const { projects, deleteProject } = useProject();
    const { deleteModalOpen, deleteProjectId, closeDeleteWorkspace } = useUI();

    const project = projects.find((p) => p.id === deleteProjectId);

    if (!project) return null;

    const handleDelete = () => {
        try {
            deleteProject(project.id);
            toast.success("Workspace deleted");
            closeDeleteWorkspace();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to delete workspace");
        }
    };

    return (
        <Dialog open={deleteModalOpen} onOpenChange={(open) => !open && closeDeleteWorkspace()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        Delete "{project.name}"?
                    </DialogTitle>
                    <DialogDescription>
                        This removes the workspace and its settings. Files in your repo won't be deleted.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={closeDeleteWorkspace}>
                        Cancel
                    </Button>
                    <Button variant="destructive" onClick={handleDelete}>
                        Delete
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
