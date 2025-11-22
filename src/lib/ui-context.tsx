"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

interface UIContextType {
    // Rename Modal
    renameModalOpen: boolean;
    renameProjectId: string | null;
    openRenameWorkspace: (projectId: string) => void;
    closeRenameWorkspace: () => void;

    // Duplicate Modal
    duplicateModalOpen: boolean;
    duplicateProjectId: string | null;
    openDuplicateWorkspace: (projectId: string) => void;
    closeDuplicateWorkspace: () => void;

    // Delete Modal
    deleteModalOpen: boolean;
    deleteProjectId: string | null;
    openDeleteWorkspace: (projectId: string) => void;
    closeDeleteWorkspace: () => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export function UIProvider({ children }: { children: ReactNode }) {
    // Rename State
    const [renameModalOpen, setRenameModalOpen] = useState(false);
    const [renameProjectId, setRenameProjectId] = useState<string | null>(null);

    // Duplicate State
    const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
    const [duplicateProjectId, setDuplicateProjectId] = useState<string | null>(null);

    // Delete State
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);

    // Handlers
    const openRenameWorkspace = (projectId: string) => {
        setRenameProjectId(projectId);
        setRenameModalOpen(true);
    };
    const closeRenameWorkspace = () => {
        setRenameModalOpen(false);
        setRenameProjectId(null);
    };

    const openDuplicateWorkspace = (projectId: string) => {
        setDuplicateProjectId(projectId);
        setDuplicateModalOpen(true);
    };
    const closeDuplicateWorkspace = () => {
        setDuplicateModalOpen(false);
        setDuplicateProjectId(null);
    };

    const openDeleteWorkspace = (projectId: string) => {
        setDeleteProjectId(projectId);
        setDeleteModalOpen(true);
    };
    const closeDeleteWorkspace = () => {
        setDeleteModalOpen(false);
        setDeleteProjectId(null);
    };

    return (
        <UIContext.Provider
            value={{
                renameModalOpen,
                renameProjectId,
                openRenameWorkspace,
                closeRenameWorkspace,
                duplicateModalOpen,
                duplicateProjectId,
                openDuplicateWorkspace,
                closeDuplicateWorkspace,
                deleteModalOpen,
                deleteProjectId,
                openDeleteWorkspace,
                closeDeleteWorkspace,
            }}
        >
            {children}
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
