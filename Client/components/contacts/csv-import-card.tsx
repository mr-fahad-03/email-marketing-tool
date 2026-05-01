'use client';

import { Download, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface CsvImportCardProps {
  isImporting?: boolean;
  onImport: (file: File) => Promise<void>;
}

export function CsvImportCard({ isImporting = false, onImport }: CsvImportCardProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleImport = async () => {
    if (!selectedFile) {
      return;
    }

    await onImport(selectedFile);
    setSelectedFile(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <Card className="border-zinc-800 bg-zinc-900/60 text-zinc-100">
      <CardHeader>
        <CardTitle className="text-base">CSV Import</CardTitle>
        <CardDescription className="text-zinc-400">
          Upload contacts in bulk using your CSV structure: company, contact name, country, email,
          telephone, mobile, additional number, designation, department, category, city, and source.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="block w-full text-sm text-zinc-400 file:mr-4 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-100 hover:file:bg-zinc-700"
          onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
        />
        <Button type="button" variant="outline" className="sm:w-auto" asChild>
          <a href="/contacts-import-template.csv" download>
            <Download className="mr-2 h-4 w-4" />
            Download Template
          </a>
        </Button>
        <Button
          type="button"
          className="sm:w-auto"
          disabled={!selectedFile || isImporting}
          onClick={() => void handleImport()}
        >
          <Upload className="mr-2 h-4 w-4" />
          {isImporting ? 'Importing...' : 'Import CSV'}
        </Button>
      </CardContent>
      {selectedFile && (
        <p className="px-6 pb-4 text-xs text-zinc-500">
          Selected file: <span className="text-zinc-300">{selectedFile.name}</span>
        </p>
      )}
    </Card>
  );
}

