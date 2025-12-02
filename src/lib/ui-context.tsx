"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { RenameWorkspaceModal } from "@/components/dialogs/RenameWorkspaceModal";
import { DuplicateWorkspaceModal } from "@/components/dialogs/DuplicateWorkspaceModal";
import { DeleteWorkspaceModal } from "@/components/dialogs/DeleteWorkspaceModal";
import { SproutModal } from "@/components/dialogs/SproutModal";

type RightDrawerMode = "none" | "icon" | "workspace";

interface UIContextType {
    // Drawer state
    drawerMode: RightDrawerMode;
    drawerIconId: string | null;
    drawerWorkspaceId: string | null;

    // Drawer Actions
    openIconDetails: (iconId: string) => void;
    openWorkspaceSettings: (workspaceId: string) => void;
    closeDrawer: () => void;

    // Modal Actions
    openRenameWorkspace: (projectId: string) => void;
    openDuplicateWorkspace: (projectId: string) => void;
    openDeleteWorkspace: (projectId: string) => void;
    openAIIconGenerator: () => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export function UIProvider({ children }: { children: ReactNode }) {
    // Drawer State
    const [drawerMode, setDrawerMode] = useState<RightDrawerMode>("none");
    const [drawerIconId, setDrawerIconId] = useState<string | null>(null);
    const [drawerWorkspaceId, setDrawerWorkspaceId] = useState<string | null>(null);

    // Modal State
    const [renameId, setRenameId] = useState<string | null>(null);
    const [duplicateId, setDuplicateId] = useState<string | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isAIGeneratorOpen, setIsAIGeneratorOpen] = useState(false);

    // Drawer Actions
    const openIconDetails = (iconId: string) => {
        setDrawerMode("icon");
        setDrawerIconId(iconId);
        // We don't clear workspaceId, but it's ignored in "icon" mode
    };

    const openWorkspaceSettings = (workspaceId: string) => {
        setDrawerMode("workspace");
        setDrawerWorkspaceId(workspaceId);
        setDrawerIconId(null); // Clear icon selection when switching to workspace mode
    };

    const closeDrawer = () => {
        setDrawerMode("none");
        setDrawerIconId(null);
        // We keep workspaceId so it's ready if we switch back
    };

    // Modal Actions
    const openRenameWorkspace = (id: string) => setRenameId(id);
    const openDuplicateWorkspace = (id: string) => setDuplicateId(id);
    const openDeleteWorkspace = (id: string) => setDeleteId(id);
    const openAIIconGenerator = () => setIsAIGeneratorOpen(true);

    const closeModals = () => {
        setRenameId(null);
        setDuplicateId(null);
        setDeleteId(null);
        setIsAIGeneratorOpen(false);
    };

    return (
        <UIContext.Provider
            value={{
                drawerMode,
                drawerIconId,
                drawerWorkspaceId,
                openIconDetails,
                openWorkspaceSettings,
                closeDrawer,
                openRenameWorkspace,
                openDuplicateWorkspace,
                openDeleteWorkspace,
                openAIIconGenerator,
            }}
        >
            {children}
            {renameId && (
                <RenameWorkspaceModal
                    projectId={renameId}
                    isOpen={!!renameId}
                    onClose={closeModals}
                />
            )}
            {duplicateId && (
                <DuplicateWorkspaceModal
                    projectId={duplicateId}
                    isOpen={!!duplicateId}
                    onClose={closeModals}
                />
            )}
            {deleteId && (
                <DeleteWorkspaceModal
                    projectId={deleteId}
                    isOpen={!!deleteId}
                    onClose={closeModals}
                />
            )}
            {/* Sprint 10-B: SproutModal replaces AIIconGeneratorModal */}
            <SproutModal
                isOpen={isAIGeneratorOpen}
                onClose={() => setIsAIGeneratorOpen(false)}
            />
        </UIContext.Provider>
    );
}

export function useUI() {
    const context = useContext(UIContext);
    if (context === undefined) {
        throw new Error("useUI must be used within a UIProvider");
    }
    return context;
}
