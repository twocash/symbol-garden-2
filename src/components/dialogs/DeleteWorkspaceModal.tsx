"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useProject } from "@/lib/project-context";
import { toast } from "sonner";

interface DeleteWorkspaceModalProps {
    projectId: string;
    isOpen: boolean;
    onClose: () => void;
}

export function DeleteWorkspaceModal({ projectId, isOpen, onClose }: DeleteWorkspaceModalProps) {
    const { projects, deleteProject } = useProject();
    const project = projects.find((p) => p.id === projectId);

    const handleDelete = () => {
        if (!project) return;

        try {
            deleteProject(project.id);
            toast.success("Workspace deleted");
            onClose();
        } catch (error) {
            toast.error("Failed to delete workspace");
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Delete Workspace</DialogTitle>
                    <DialogDescription>
                        Are you sure you want to delete <span className="font-semibold">{project?.name}</span>? This action cannot be undone.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="destructive" onClick={handleDelete}>
                        Delete Workspace
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
