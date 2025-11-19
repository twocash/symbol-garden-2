"use client";

import { IconGrid } from "@/components/icons/IconGrid";
import { useSearch } from "@/lib/search-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Home() {
  const { libraries, selectedLibrary, setSelectedLibrary } = useSearch();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Library</h2>
        <div className="w-[200px]">
          <Select value={selectedLibrary} onValueChange={setSelectedLibrary}>
            <SelectTrigger>
              <SelectValue placeholder="Select library" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Icons</SelectItem>
              {libraries.map((lib) => (
                <SelectItem key={lib} value={lib}>
                  {lib}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <IconGrid />
    </div>
  );
}
