"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Project } from "@/types/schema";

interface DuplicateWorkspaceModalProps {
    project: Project | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onDuplicate: (newName: string, copyFavorites: boolean) => void;
}

export function DuplicateWorkspaceModal({
    project,
    open,
    onOpenChange,
    onDuplicate
}: DuplicateWorkspaceModalProps) {
    const [name, setName] = useState("");
    const [copyFavorites, setCopyFavorites] = useState(true);

    useEffect(() => {
        if (project) {
            setName(`${project.name} Copy`);
            setCopyFavorites(true);
        }
    }, [project]);

    const handleDuplicate = () => {
        if (!name.trim()) return;
        onDuplicate(name, copyFavorites);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
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
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
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
