"use client";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { Project } from "@/types/schema";

interface DeleteWorkspaceModalProps {
    project: Project | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onDelete: (projectId: string) => void;
}

export function DeleteWorkspaceModal({
    project,
    open,
    onOpenChange,
    onDelete
}: DeleteWorkspaceModalProps) {
    if (!project) return null;

    const handleDelete = () => {
        onDelete(project.id);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
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
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
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
