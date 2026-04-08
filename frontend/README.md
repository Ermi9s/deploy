# OKM Frontend

A Next.js frontend for the OKM backend APIs. The drive UI now uses the live management and ingestion services instead of mock JSON files.

## Features

- **File Management UI**: Browse, preview, and manage files and folders
- **Drag & Drop Interface**: Interactive upload area with drag-and-drop support
- **File Preview**: Support for images, PDFs, videos, and audio files
- **Search & Filter**: Advanced search with file type and sorting filters
- **Trash Recovery**: Soft delete with ability to restore deleted items from the management API
- **Responsive Design**: Fully responsive layout that works on desktop, tablet, and mobile
- **Beautiful UI**: Modern design with gradients, smooth transitions, and intuitive controls

## Getting Started

### Installation

```bash
npm install
# or
pnpm install
# or
yarn install
```

### Running the Development Server

```bash
npm run dev
# or
pnpm dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Project Structure

```
/app
  /drive          # Main drive page with file management
  /layout.tsx     # Root layout
  /page.tsx       # Home page (redirects to /drive)

/components
  /drive          # Drive-specific components
    - drive-layout.tsx     # Main layout with sidebar
    - file-grid.tsx        # File and folder grid display
    - file-preview.tsx     # File preview modal
    - upload-area.tsx      # Drag-drop upload interface
    - folder-nav.tsx       # Folder navigation
    - advanced-search.tsx  # Search and filter controls
    - trash-modal.tsx      # Trash/recycle bin
    - breadcrumb.tsx       # Navigation breadcrumbs
  /ui             # Reusable UI components (shadcn/ui)
```

The drive page is backed by the live backend APIs, so mock data is no longer required.

## Key Components

### DriveLayout
Main layout component providing header, sidebar, and responsive design.

### FileGrid
Displays files and folders in a responsive grid with context menu, preview, and rename functionality.

### FilePreview
Modal for previewing different file types with placeholder content.

### AdvancedSearch
Advanced search and filtering UI with multiple sort and filter options.

### TrashModal
Shows deleted items from the backend with restore and permanent delete options.

### UploadArea
Drag-and-drop interface for file uploads that sends files to ingestion first, then registers them in management.

## Customization

### Modify Colors
Edit `app/layout.tsx` and the component files to change the color scheme. The app uses Tailwind CSS utility classes.

### Change File Types
Update the file type filters in `/components/drive/advanced-search.tsx`.

## Notes

- Set `NEXT_PUBLIC_MANAGEMENT_API` and `NEXT_PUBLIC_INGESTION_API` before running the frontend.
- Uploads go to ingestion first, then the returned document is registered in management so it appears in the drive list.
- JWT tokens are stored in browser local storage by the API client.
- Trash, rename, create folder, move, and delete actions are backed by the management API.

## Technologies Used

- **Next.js 16** - React framework with server-side rendering
- **React 19** - UI library
- **Tailwind CSS v4** - Utility-first CSS framework
- **shadcn/ui** - High-quality React components
- **Lucide Icons** - Beautiful icon library

## License

MIT
