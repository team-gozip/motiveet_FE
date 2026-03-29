'use client';

import { createContext, useContext, useState } from 'react';

export interface Folder {
    folderId: number;
    name: string;
    description: string | null;
}

interface FolderContextType {
    currentFolder: Folder | null;
    setCurrentFolder: (folder: Folder | null) => void;
}

const FolderContext = createContext<FolderContextType>({
    currentFolder: null,
    setCurrentFolder: () => {},
});

export function FolderProvider({ children }: { children: React.ReactNode }) {
    const [currentFolder, setCurrentFolder] = useState<Folder | null>(null);
    return (
        <FolderContext.Provider value={{ currentFolder, setCurrentFolder }}>
            {children}
        </FolderContext.Provider>
    );
}

export const useFolder = () => useContext(FolderContext);
