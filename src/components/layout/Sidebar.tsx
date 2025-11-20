"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { LayoutGrid, FolderOpen, Heart, Settings, Plus } from "lucide-react";
import { useProject } from "@/lib/project-context";

const sidebarItems = [
    { icon: LayoutGrid, label: "Library", href: "/" },
    { icon: FolderOpen, label: "Projects", href: "/projects" },
    { icon: Heart, label: "Favorites", href: "/favorites" },
];

export function Sidebar() {
    const pathname = usePathname();
    const { projects, currentProject, switchProject } = useProject();

    return (
        <div className="flex h-screen w-64 flex-col border-r bg-background">
            <div className="p-6">
                <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
                    <div className="h-6 w-6 rounded bg-primary" />
                    Symbol Garden
                </h1>
            </div>
            <ScrollArea className="flex-1 px-4">
                <div className="space-y-4">
                    <div className="px-2 py-2">
                        <h2 className="mb-2 px-2 text-xs font-semibold tracking-tight text-muted-foreground">
                            Discover
                        </h2>
                        <div className="space-y-1">
                            {sidebarItems.map((item) => (
                                <Button
                                    key={item.href}
                                    variant={pathname === item.href ? "secondary" : "ghost"}
                                    className={cn(
                                        "w-full justify-start",
                                        pathname === item.href && "bg-secondary"
                                    )}
                                    asChild
                                >
                                    <Link href={item.href}>
                                        <item.icon className="mr-2 h-4 w-4" />
                                        {item.label}
                                    </Link>
                                </Button>
                            ))}
                        </div>
                    </div>
                    <Separator />
                    <div className="px-2 py-2">
                        <div className="flex items-center justify-between px-2">
                            <h2 className="text-xs font-semibold tracking-tight text-muted-foreground">
                                Projects
                            </h2>
                            <Button variant="ghost" size="icon" className="h-4 w-4" asChild>
                                <Link href="/projects">
                                    <Plus className="h-3 w-3" />
                                </Link>
                            </Button>
                        </div>
                        <div className="mt-2 space-y-1">
                            {projects.map((project) => (
                                <Button
                                    key={project.id}
                                    variant={currentProject?.id === project.id ? "secondary" : "ghost"}
                                    className="w-full justify-start text-muted-foreground"
                                    onClick={() => switchProject(project.id)}
                                >
                                    <div className={cn(
                                        "mr-2 h-2 w-2 rounded-full",
                                        currentProject?.id === project.id ? "bg-primary" : "bg-muted-foreground"
                                    )} />
                                    <span className="truncate">{project.name}</span>
                                </Button>
                            ))}
                        </div>
                    </div>
                </div>
            </ScrollArea>
            <div className="p-4 border-t">
                <Button variant="ghost" className="w-full justify-start" asChild>
                    <Link href="/settings">
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                    </Link>
                </Button>
            </div>
        </div>
    );
}
