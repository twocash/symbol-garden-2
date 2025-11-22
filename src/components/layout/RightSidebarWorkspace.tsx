"use client";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ColorPicker } from "@/components/ui/color-picker";
import { cn } from "@/lib/utils";

interface RightSidebarWorkspaceProps {
    workspaceId: string;
    workspaceName: string;
    primaryColor: string;
    onPrimaryColorChange: (value: string) => void;
    exportFormat: "svg" | "png" | "jsx";
    onExportFormatChange: (value: "svg" | "png" | "jsx") => void;
    repoUrl: string;
    onRepoUrlChange: (value: string) => void;
    onOpenRepo: () => void;
    onCopyRepoUrl: () => void;
    onRenameWorkspace: () => void;
    onDuplicateWorkspace: () => void;
    onDeleteWorkspace: () => void;
}

export function RightSidebarWorkspace(props: RightSidebarWorkspaceProps) {
    const {
        workspaceName,
        primaryColor,
        onPrimaryColorChange,
        exportFormat,
        onExportFormatChange,
        repoUrl,
        onRepoUrlChange,
        onOpenRepo,
        onCopyRepoUrl,
        onRenameWorkspace,
        onDuplicateWorkspace,
        onDeleteWorkspace,
    } = props;

    return (
        <aside className="w-[320px] border-l border-border/60 bg-sidebar flex flex-col h-full">
            {/* Header */}
            <header className="p-4 border-b border-border/60 space-y-1">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Workspace
                </p>
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold truncate">{workspaceName}</h2>
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <span className="h-2 w-2 rounded-full bg-emerald-400" />
                        Active
                    </span>
                </div>
                <p className="text-xs text-muted-foreground">
                    Defaults and exports for this workspace.
                </p>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Brand Defaults */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-xs font-semibold tracking-tight">
                            Brand defaults
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Set the default look for icons in this workspace. Individual icons can still override these settings.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="space-y-1">
                            <p className="text-xs font-medium">Primary color</p>
                            <p className="text-[11px] text-muted-foreground">
                                Used as the default icon color in this workspace.
                            </p>
                            <ColorPicker
                                value={primaryColor}
                                onChange={onPrimaryColorChange}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Export Rules */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-xs font-semibold tracking-tight">
                            Export rules
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Choose how icons export by default. You can still change format per download.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="space-y-1">
                            <p className="text-xs font-medium">Default format</p>
                            <p className="text-[11px] text-muted-foreground">
                                Applies when you use Copy or Download in this workspace.
                            </p>
                            <div className="inline-flex rounded-md bg-muted/40 p-0.5">
                                {(["svg", "png", "jsx"] as const).map((fmt) => (
                                    <Button
                                        key={fmt}
                                        size="sm"
                                        variant={exportFormat === fmt ? "default" : "ghost"}
                                        className={cn(
                                            "px-2 text-[11px] h-6",
                                            exportFormat === fmt && "shadow-sm"
                                        )}
                                        onClick={() => onExportFormatChange(fmt)}
                                    >
                                        {fmt.toUpperCase()}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Repository & Integrations */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-xs font-semibold tracking-tight">
                            Repository & integrations
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Connect this workspace to your source of truth for icons.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="space-y-1">
                            <p className="text-xs font-medium">Repository link</p>
                            <p className="text-[11px] text-muted-foreground">
                                Used for syncing icon assets with your codebase.
                            </p>
                            <div className="flex items-center gap-2">
                                <Input
                                    value={repoUrl}
                                    onChange={(e) => onRepoUrlChange(e.target.value)}
                                    className="h-8 text-xs font-mono"
                                    placeholder="github.com/org/repo"
                                />
                                <Button size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={onCopyRepoUrl}>
                                    Copy URL
                                </Button>
                                <Button size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={onOpenRepo}>
                                    Open repo
                                </Button>
                            </div>
                            {/* Optional status line */}
                            <p className="text-[11px] text-muted-foreground">
                                Status: {repoUrl ? "Connected" : "Not configured"}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Manage Workspace */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-xs font-semibold tracking-tight">
                            Manage workspace
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Rename, duplicate, or delete this workspace.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full justify-start h-8 text-xs"
                            onClick={onRenameWorkspace}
                        >
                            Rename workspace…
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full justify-start h-8 text-xs"
                            onClick={onDuplicateWorkspace}
                        >
                            Duplicate workspace…
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            className="w-full justify-start h-8 text-xs"
                            onClick={onDeleteWorkspace}
                        >
                            Delete workspace…
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </aside>
    );
}
