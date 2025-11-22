"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useProject } from "@/lib/project-context";
import { toast } from "sonner";

interface DuplicateWorkspaceModalProps {
    projectId: string;
    isOpen: boolean;
    onClose: () => void;
}

export function DuplicateWorkspaceModal({ projectId, isOpen, onClose }: DuplicateWorkspaceModalProps) {
    const { projects, duplicateProject } = useProject();
    const [name, setName] = useState("");
    const [copyFavorites, setCopyFavorites] = useState(true);

    const project = projects.find((p) => p.id === projectId);

    useEffect(() => {
        if (project) {
            setName(`${project.name} (Copy)`);
            setCopyFavorites(true);
        }
    }, [project, isOpen]);

    const handleDuplicate = () => {
        if (!project || !name.trim()) return;

        try {
            duplicateProject(project.id, name.trim(), copyFavorites);
            toast.success("Workspace duplicated");
            onClose();
        } catch (error) {
            toast.error("Failed to duplicate workspace");
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Duplicate Workspace</DialogTitle>
                    <DialogDescription>
                        Create a copy of this workspace. You can choose to include favorited icons.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="dup-name">Name</Label>
                        <Input
                            id="dup-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleDuplicate()}
                            autoFocus
                        />
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="copy-favorites"
                            checked={copyFavorites}
                            onCheckedChange={(checked) => setCopyFavorites(checked as boolean)}
                        />
                        <Label htmlFor="copy-favorites" className="text-sm font-normal">
                            Copy favorited icons
                        </Label>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={handleDuplicate}>Duplicate</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
