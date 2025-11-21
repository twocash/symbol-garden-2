"use client";

import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SettingsModal } from "@/components/layout/SettingsModal";
import { useState } from "react";

export function Header() {
    const [settingsOpen, setSettingsOpen] = useState(false);

    return (
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/80 px-6 backdrop-blur-sm">
            <div className="flex items-center gap-2">
                {/* Breadcrumbs or context info could go here */}
            </div>
            <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)}>
                    <Settings className="h-4 w-4" />
                </Button>
            </div>

            <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
        </header>
    );
}
