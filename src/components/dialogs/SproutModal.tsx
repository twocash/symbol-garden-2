"use client";

/**
 * SproutModal - Icon Style Transfer UI
 * Sprint 10-B: Clean 3-panel design for the Sprout workflow
 *
 * Layout:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  SEARCH PANEL (Left)  │  WORKBENCH (Center)  │  RESULTS (Right)        │
 * │                       │                       │                         │
 * │  [Search input]       │  Large preview of     │  Sprouted result        │
 * │                       │  selected icon        │  preview                │
 * │  Grid of Iconify      │                       │                         │
 * │  search results       │  [Adopt Original]     │  [Save to Workspace]    │
 * │                       │  [Sprout Library Ver] │                         │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useProject } from "@/lib/project-context";
import { useSearch } from "@/lib/search-context";
import { getIconSources } from "@/lib/storage";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Sprout,
  Search,
  Download,
  Import,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  X,
} from "lucide-react";

// Types
interface IconifyMatch {
  iconId: string;
  svg: string;
  collection: string;
}

// Map Iconify prefixes to display names
const COLLECTION_DISPLAY_NAMES: Record<string, string> = {
  lucide: "Lucide",
  tabler: "Tabler",
  feather: "Feather",
  fe: "Feather",  // Some APIs return "fe" for Feather
  phosphor: "Phosphor",
  heroicons: "Heroicons",
  humbleicons: "Humble Icons",
  majesticons: "Majesticons",
  iconoir: "Iconoir",
  carbon: "Carbon",
  solar: "Solar",
  mdi: "Material Design",
  fa: "Font Awesome",
  fa6: "Font Awesome 6",
  bi: "Bootstrap",
  ri: "Remix",
  ion: "Ionicons",
};

// Helper to get display name for a collection prefix
function getCollectionDisplayName(prefix: string): string {
  return COLLECTION_DISPLAY_NAMES[prefix] ||
    prefix.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface SproutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SproutModal({ isOpen, onClose }: SproutModalProps) {
  const { currentProject, addIconToProject } = useProject();
  const { icons: globalIcons, libraries } = useSearch();

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<IconifyMatch[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Selection state
  const [selectedIcon, setSelectedIcon] = useState<IconifyMatch | null>(null);

  // Sprout state
  const [isSprouting, setIsSprouting] = useState(false);
  const [sproutedSvg, setSproutedSvg] = useState<string | null>(null);
  const [sproutMetadata, setSproutMetadata] = useState<{
    tokensSaved: number;
    processingTimeMs: number;
    complianceScore: number | null;
  } | null>(null);

  // Library state
  const [iconSources, setIconSources] = useState<
    Array<{ id: string; name: string; styleManifest?: string }>
  >([]);

  // Determine the target library (largest available)
  const availableLibraries = libraries.filter((lib) => lib !== "custom");
  const targetLibrary = (() => {
    if (availableLibraries.length === 0) return null;
    const libCounts = availableLibraries.map((lib) => ({
      lib,
      count: globalIcons.filter((i) => i.library === lib).length,
    }));
    libCounts.sort((a, b) => b.count - a.count);
    return libCounts[0]?.lib || null;
  })();

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      setSearchResults([]);
      setSelectedIcon(null);
      setSproutedSvg(null);
      setSproutMetadata(null);

      // Load icon sources for styleManifest
      getIconSources().then(setIconSources);
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(
          `/api/iconify/search?query=${encodeURIComponent(searchQuery.trim())}&limit=20`
        );
        if (response.ok) {
          const data = await response.json();
          setSearchResults(data.results || []);
        }
      } catch (error) {
        console.error("[SproutModal] Search failed:", error);
        toast.error("Search failed");
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Clear sprouted result when selection changes
  useEffect(() => {
    setSproutedSvg(null);
    setSproutMetadata(null);
  }, [selectedIcon]);

  // Handle Adopt Original - Import raw SVG without AI
  const handleAdoptOriginal = useCallback(async () => {
    if (!selectedIcon || !currentProject) return;

    try {
      // Extract icon name from iconId
      const iconName = selectedIcon.iconId.split(":")[1] || searchQuery || "imported-icon";

      // Extract viewBox from SVG
      const viewBoxMatch = selectedIcon.svg.match(/viewBox="([^"]+)"/);
      const viewBox = viewBoxMatch ? viewBoxMatch[1] : "0 0 24 24";

      // Extract inner SVG content
      const innerMatch = selectedIcon.svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
      const svgContent = innerMatch ? innerMatch[1].trim() : undefined;

      // Extract paths as fallback
      const pathMatches = [
        ...selectedIcon.svg.matchAll(/<path[^>]*d="([^"]+)"[^>]*\/?>/g),
      ];
      const combinedPath = pathMatches.map((match) => match[1]).join(" ");

      if (!svgContent && pathMatches.length === 0) {
        toast.error("Could not extract SVG content");
        return;
      }

      const newIcon = {
        id: crypto.randomUUID(),
        name: iconName,
        library: "ai-sprout",
        viewBox,
        path: combinedPath || "M0 0",
        svgContent,
        tags: ["imported", selectedIcon.collection],
        categories: ["Imported"],
        renderStyle: "stroke" as const,
      };

      addIconToProject(newIcon, true);
      toast.success(`"${iconName}" imported from ${getCollectionDisplayName(selectedIcon.collection)}!`);
      onClose();
    } catch (error) {
      console.error("[SproutModal] Adopt failed:", error);
      toast.error("Failed to import icon");
    }
  }, [selectedIcon, currentProject, searchQuery, addIconToProject, onClose]);

  // Handle Sprout - AI transpilation to target library style
  const handleSprout = useCallback(async () => {
    if (!selectedIcon || !targetLibrary) return;

    // Get API key
    const apiKey = localStorage.getItem("gemini_api_key");
    if (!apiKey) {
      toast.error("Please set your Google API key in System Settings");
      return;
    }

    // Get styleManifest for target library
    const librarySource = iconSources.find((s) => s.name === targetLibrary);
    const styleManifest = librarySource?.styleManifest || "";

    setIsSprouting(true);
    setSproutedSvg(null);
    setSproutMetadata(null);

    try {
      const response = await fetch("/api/sprout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceSvg: selectedIcon.svg,
          styleManifest,
          concept: searchQuery || selectedIcon.iconId.split(":")[1],
          apiKey,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Sprout failed");
      }

      setSproutedSvg(data.svg);
      setSproutMetadata(data.metadata);
      toast.success("Icon sprouted successfully!");
    } catch (error) {
      console.error("[SproutModal] Sprout failed:", error);
      toast.error(error instanceof Error ? error.message : "Sprout failed");
    } finally {
      setIsSprouting(false);
    }
  }, [selectedIcon, targetLibrary, iconSources, searchQuery]);

  // Handle Save - Save sprouted result to workspace
  const handleSave = useCallback(async () => {
    if (!sproutedSvg || !currentProject) return;

    try {
      const iconName =
        selectedIcon?.iconId.split(":")[1] || searchQuery || "sprouted-icon";

      // Extract viewBox from SVG
      const viewBoxMatch = sproutedSvg.match(/viewBox="([^"]+)"/);
      const viewBox = viewBoxMatch ? viewBoxMatch[1] : "0 0 24 24";

      // Extract inner SVG content
      const innerMatch = sproutedSvg.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
      const svgContent = innerMatch ? innerMatch[1].trim() : undefined;

      // Extract paths as fallback
      const pathMatches = [
        ...sproutedSvg.matchAll(/<path[^>]*d="([^"]+)"[^>]*\/?>/g),
      ];
      const combinedPath = pathMatches.map((match) => match[1]).join(" ");

      if (!svgContent && pathMatches.length === 0) {
        toast.error("Could not extract SVG content");
        return;
      }

      const newIcon = {
        id: crypto.randomUUID(),
        name: iconName,
        library: "ai-sprout",
        viewBox,
        path: combinedPath || "M0 0",
        svgContent,
        tags: ["ai-generated", "sprout", targetLibrary || "styled"],
        categories: ["Generated"],
        renderStyle: "stroke" as const,
      };

      addIconToProject(newIcon, true);
      toast.success(`"${iconName}" saved to workspace!`);
      onClose();
    } catch (error) {
      console.error("[SproutModal] Save failed:", error);
      toast.error("Failed to save icon");
    }
  }, [
    sproutedSvg,
    currentProject,
    selectedIcon,
    searchQuery,
    targetLibrary,
    addIconToProject,
    onClose,
  ]);

  // Helper to render SVG preview
  const renderSvgPreview = (svg: string, className?: string) => {
    return (
      <div
        className={cn("text-foreground", className)}
        dangerouslySetInnerHTML={{
          __html: svg
            .replace(/<svg/, '<svg class="w-full h-full"')
            .replace(/stroke="(?!none)[^"]*"/g, 'stroke="currentColor"'),
        }}
      />
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[1000px] w-[90vw] h-[600px] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Sprout className="w-5 h-5 text-green-600" />
            Sprout Icon
          </DialogTitle>
          <DialogDescription>
            Search Iconify, then adopt the original or sprout a{" "}
            {targetLibrary
              ? getCollectionDisplayName(targetLibrary)
              : "styled"}{" "}
            version.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex min-h-0">
          {/* LEFT: Search Panel */}
          <div className="w-[280px] border-r flex flex-col">
            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search icons..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  autoFocus
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                )}
              </div>
            </div>

            <ScrollArea className="flex-1">
              {searchResults.length > 0 ? (
                <div className="grid grid-cols-4 gap-2 p-4">
                  {searchResults.map((icon) => (
                    <button
                      key={icon.iconId}
                      onClick={() => setSelectedIcon(icon)}
                      className={cn(
                        "relative aspect-square rounded-lg border-2 p-2 transition-all hover:border-primary/50 group",
                        selectedIcon?.iconId === icon.iconId
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                          : "border-muted bg-background"
                      )}
                      title={`${getCollectionDisplayName(icon.collection)}: ${icon.iconId.split(":")[1]}`}
                    >
                      {renderSvgPreview(
                        icon.svg,
                        "w-full h-full text-muted-foreground group-hover:text-foreground transition-colors"
                      )}
                      {selectedIcon?.iconId === icon.iconId && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground rounded-full flex items-center justify-center">
                          <CheckCircle2 className="w-3 h-3" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              ) : searchQuery.length >= 2 && !isSearching ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                  <Search className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-sm">No icons found</p>
                  <p className="text-xs">Try a different search term</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                  <Sparkles className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-sm">Search Iconify</p>
                  <p className="text-xs">275K+ icons from 100+ libraries</p>
                </div>
              )}
            </ScrollArea>

            {searchResults.length > 0 && (
              <div className="px-4 py-2 border-t">
                <p className="text-[10px] text-muted-foreground text-center">
                  From:{" "}
                  {[...new Set(searchResults.map((r) => r.collection))]
                    .slice(0, 5)
                    .map(getCollectionDisplayName)
                    .join(", ")}
                </p>
              </div>
            )}
          </div>

          {/* CENTER: Workbench Panel */}
          <div className="flex-1 flex flex-col border-r">
            <div className="flex-1 flex items-center justify-center p-8">
              {selectedIcon ? (
                <div className="flex flex-col items-center">
                  <div className="w-32 h-32 p-4 rounded-xl border-2 border-muted bg-background shadow-sm">
                    {renderSvgPreview(selectedIcon.svg, "w-full h-full")}
                  </div>
                  <div className="mt-4 text-center">
                    <p className="text-sm font-medium">
                      {selectedIcon.iconId.split(":")[1]}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {getCollectionDisplayName(selectedIcon.collection)}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground">
                  <div className="w-24 h-24 mx-auto mb-4 rounded-xl border-2 border-dashed border-muted flex items-center justify-center">
                    <ArrowRight className="w-8 h-8 opacity-30" />
                  </div>
                  <p className="text-sm">Select an icon from the left</p>
                </div>
              )}
            </div>

            {selectedIcon && (
              <div className="p-4 border-t space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={handleAdoptOriginal}
                >
                  <Import className="w-4 h-4 mr-2" />
                  Adopt Original
                  <span className="ml-auto text-xs text-muted-foreground">
                    Free
                  </span>
                </Button>
                <Button
                  className="w-full justify-start bg-green-600 hover:bg-green-700"
                  onClick={handleSprout}
                  disabled={!targetLibrary || isSprouting}
                >
                  {isSprouting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sprouting...
                    </>
                  ) : (
                    <>
                      <Sprout className="w-4 h-4 mr-2" />
                      Sprout{" "}
                      {targetLibrary
                        ? getCollectionDisplayName(targetLibrary)
                        : "Styled"}{" "}
                      Version
                      <span className="ml-auto text-xs opacity-70">AI</span>
                    </>
                  )}
                </Button>
                {!targetLibrary && (
                  <p className="text-[10px] text-muted-foreground text-center">
                    Ingest a library to enable sprouting
                  </p>
                )}
              </div>
            )}
          </div>

          {/* RIGHT: Results Panel */}
          <div className="w-[250px] flex flex-col">
            <div className="flex-1 flex items-center justify-center p-6">
              {sproutedSvg ? (
                <div className="flex flex-col items-center">
                  <div className="w-28 h-28 p-4 rounded-xl border-2 border-green-500 bg-green-50 dark:bg-green-950/30 shadow-sm">
                    {renderSvgPreview(sproutedSvg, "w-full h-full")}
                  </div>
                  <div className="mt-4 text-center">
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">
                      Sprouted!
                    </p>
                    {sproutMetadata && (
                      <div className="mt-2 space-y-1">
                        <p className="text-[10px] text-muted-foreground">
                          {sproutMetadata.processingTimeMs}ms processing
                        </p>
                        {sproutMetadata.complianceScore !== null && (
                          <p className="text-[10px] text-muted-foreground">
                            Compliance: {sproutMetadata.complianceScore}/100
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : isSprouting ? (
                <div className="text-center text-muted-foreground">
                  <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-green-600" />
                  <p className="text-sm">Transpiling style...</p>
                  <p className="text-xs">This may take a few seconds</p>
                </div>
              ) : (
                <div className="text-center text-muted-foreground">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-xl border-2 border-dashed border-muted flex items-center justify-center">
                    <Sprout className="w-8 h-8 opacity-30" />
                  </div>
                  <p className="text-sm">Result preview</p>
                  <p className="text-xs">Sprouted icon appears here</p>
                </div>
              )}
            </div>

            {sproutedSvg && (
              <div className="p-4 border-t">
                <Button
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={handleSave}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Save to Workspace
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t flex items-center justify-between bg-muted/30">
          <p className="text-[10px] text-muted-foreground">
            Powered by Iconify API + Gemini 2.5 Flash
          </p>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4 mr-1" />
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
