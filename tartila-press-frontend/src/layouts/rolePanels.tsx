import EditorNavLinks from './EditorNavLinks';
import type { NavPanel } from './FocusedDashboardNav';
import {
    EDITOR_CATEGORIES,
    WRITER_CATEGORIES,
    isEditorPage,
    isWriterPage,
} from './navSections';
import WriterNavLinks from './WriterNavLinks';

/** Panel Editor untuk menu samping. */
export const editorPanel: NavPanel = {
    label: 'Panel Editor',
    content: <EditorNavLinks />,
    isPage: isEditorPage,
    isCategory: (category) => EDITOR_CATEGORIES.includes(category),
};

/** Panel Penulis untuk menu samping. */
export const writerPanel: NavPanel = {
    label: 'Panel Penulis',
    content: <WriterNavLinks />,
    isPage: isWriterPage,
    isCategory: (category) => WRITER_CATEGORIES.includes(category),
};

/**
 * Detail naskah dibuka editor (naskah ditugaskan) dan admin, bukan hanya
 * penulis: bagi mereka tidak membuka Panel Penulis/Menu Lainnya.
 */
export const isManuscriptDetail = (pathname: string) =>
    pathname.startsWith('/dashboard/naskah/');
