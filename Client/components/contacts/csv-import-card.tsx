'use client';

import { Download, Eye, Loader2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { parseCsvForPreview, extractEmailsFromCsv } from '@/lib/utils/csv-preview-parser';
import type { CsvPreviewResult } from '@/lib/utils/csv-preview-parser';
import { checkContactsDuplicates } from '@/lib/api/contacts';

interface CsvImportCardProps {
  /** Called once the CSV is parsed. Parent handles navigation to the preview page. */
  onPreview: (file: File, result: CsvPreviewResult) => void;
}

export function CsvImportCard({ onPreview }: CsvImportCardProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  const handlePreviewClick = async () => {
    if (!selectedFile) return;

    setIsParsing(true);
    try {
      // 1. Extract emails and check duplicates on server
      const emailsInFile = await extractEmailsFromCsv(selectedFile);
      const serverDuplicates = await checkContactsDuplicates(emailsInFile);

      // 2. Parse the CSV with the knowledge of which ones already exist
      const result = await parseCsvForPreview(selectedFile, serverDuplicates);
      onPreview(selectedFile, result);

      // Reset UI — the parent will navigate away
      setSelectedFile(null);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    } finally {
      setIsParsing(false);
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
          className="sm:w-auto gap-2 bg-blue-600 hover:bg-blue-500 text-white"
          disabled={!selectedFile || isParsing}
          onClick={() => void handlePreviewClick()}
        >
          {isParsing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analysing…
            </>
          ) : (
            <>
              <Eye className="h-4 w-4" />
              Preview Import
            </>
          )}
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
