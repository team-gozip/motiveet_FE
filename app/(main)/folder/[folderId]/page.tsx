import { use } from 'react';
import FolderPage from '@/components/folder/FolderPage';

interface PageProps {
    params: Promise<{ folderId: string }>;
}

export default function Page({ params }: PageProps) {
    const { folderId } = use(params);
    return <FolderPage folderId={Number(folderId)} />;
}
