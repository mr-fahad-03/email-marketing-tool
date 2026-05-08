"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { TemplateImageManagerPanel } from "@/components/templates/template-image-manager-panel";
import { Button } from "@/components/ui/button";

export default function TemplateImageManagerPage() {
  const router = useRouter();

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-semibold text-zinc-100">
            Image Manager
          </h2>
          <p className="text-sm text-zinc-400">
            Upload, organize, and reuse images for your email templates.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="border-zinc-700 text-zinc-200 hover:bg-zinc-800"
          onClick={() => router.push("/dashboard/templates")}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Templates
        </Button>
      </div>

      <TemplateImageManagerPanel />
    </section>
  );
}
