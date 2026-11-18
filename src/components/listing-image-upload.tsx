import { Camera, Image as ImageIcon, Trash2, UploadCloud, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export type ImageFileItem = {
  id: string;
  file?: File;
  previewUrl: string;
  isExisting?: boolean;
};

/**
 * Safely uploads the primary listing photo to Supabase storage bucket 'listings'.
 * If the bucket is not yet provisioned remotely, handles the failure honestly without breaking.
 */
export async function uploadListingPhotos(
  items: ImageFileItem[],
  userId: string,
): Promise<{ primaryUrl: string | null; error?: string }> {
  // If there are existing uploaded images and no new files
  const newFiles = items.filter((item) => item.file);
  const existingItems = items.filter((item) => item.isExisting);

  if (newFiles.length === 0) {
    return { primaryUrl: existingItems[0]?.previewUrl || null };
  }

  const primaryItem = newFiles[0];
  if (!primaryItem || !primaryItem.file) {
    return { primaryUrl: existingItems[0]?.previewUrl || null };
  }

  try {
    const file = primaryItem.file;
    const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const filePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("listings")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      console.warn("Storage upload notice:", uploadError.message);
      return {
        primaryUrl: null,
        error: uploadError.message,
      };
    }

    const { data: publicUrlData } = supabase.storage
      .from("listings")
      .getPublicUrl(filePath);

    return { primaryUrl: publicUrlData.publicUrl };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upload failed";
    console.warn("Storage upload exception:", msg);
    return { primaryUrl: null, error: msg };
  }
}

interface ListingImageUploadProps {
  images: ImageFileItem[];
  onChange: (items: ImageFileItem[]) => void;
  maxFiles?: number;
  maxSizeBytes?: number; // default 5MB
}

export function ListingImageUpload({
  images,
  onChange,
  maxFiles = 5,
  maxSizeBytes = 5 * 1024 * 1024,
}: ListingImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];

  const handleFiles = (fileList: FileList | File[]) => {
    const validNewItems: ImageFileItem[] = [];

    Array.from(fileList).forEach((file) => {
      // Validate type
      if (!allowedTypes.includes(file.type)) {
        toast.error(`Invalid format: ${file.name}`, {
          description: "Please upload JPG, PNG, or WebP images.",
        });
        return;
      }

      // Validate size
      if (file.size > maxSizeBytes) {
        toast.error(`File too large: ${file.name}`, {
          description: `Maximum size per photograph is ${Math.round(maxSizeBytes / (1024 * 1024))}MB.`,
        });
        return;
      }

      // Check max count
      if (images.length + validNewItems.length >= maxFiles) {
        toast.info(`Maximum ${maxFiles} photos allowed per listing.`);
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      validNewItems.push({
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        file,
        previewUrl,
        isExisting: false,
      });
    });

    if (validNewItems.length > 0) {
      onChange([...images, ...validNewItems]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleRemove = (id: string) => {
    const itemToRemove = images.find((img) => img.id === id);
    if (itemToRemove && !itemToRemove.isExisting) {
      URL.revokeObjectURL(itemToRemove.previewUrl);
    }
    onChange(images.filter((img) => img.id !== id));
  };

  return (
    <div className="space-y-3">
      {/* Hidden native input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/jpg"
        className="hidden"
        onChange={handleInputChange}
      />

      {/* Upload Dropzone */}
      {images.length < maxFiles && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-5 text-center cursor-pointer transition-all ${
            isDragging
              ? "border-primary bg-primary/10"
              : "border-border/80 bg-muted/30 hover:border-primary/50 hover:bg-muted/50"
          }`}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary mb-2">
            <UploadCloud className="h-5 w-5" />
          </div>
          <p className="text-xs font-semibold text-foreground">
            Click to upload or drag &amp; drop photos
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            JPG, PNG, or WebP (max 5MB each, up to {maxFiles} photos)
          </p>
        </div>
      )}

      {/* Previews Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 min-[420px]:grid-cols-3 sm:grid-cols-4 gap-2.5">
          {images.map((img, idx) => (
            <div
              key={img.id}
              className="group relative aspect-[4/3] rounded-xl overflow-hidden border border-border/70 bg-muted shadow-xs"
            >
              <img
                src={img.previewUrl}
                alt={`Lodge photo ${idx + 1}`}
                className="h-full w-full object-cover"
              />

              {/* Cover Photo Badge on first item */}
              {idx === 0 && (
                <span className="absolute left-1.5 top-1.5 rounded-md bg-black/75 px-1.5 py-0.5 text-[9px] font-semibold text-white backdrop-blur-xs">
                  Cover Photo
                </span>
              )}

              {/* Remove button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(img.id);
                }}
                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white opacity-90 transition-opacity hover:bg-destructive hover:opacity-100"
                title="Remove photo"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
