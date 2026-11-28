import { supabase } from "@/integrations/supabase/client";

export async function uploadPublicListingMedia(files: File[], userId: string, folder: "lodges" | "rooms") {
  const urls: string[] = [];
  for (const file of files) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      throw new Error("Use JPG, PNG, or WebP images up to 5 MB each.");
    }
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${userId}/${folder}/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from("listings").upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (error) throw error;
    const { data } = supabase.storage.from("listings").getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return urls;
}

export async function uploadRoomVideo(file: File, userId: string) {
  if (!["video/mp4", "video/webm", "video/quicktime"].includes(file.type) || file.size > 50 * 1024 * 1024) {
    throw new Error("Use an MP4, WebM, or MOV video up to 50 MB.");
  }
  const extension = file.name.split(".").pop()?.toLowerCase() || "mp4";
  const path = `${userId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from("lodge-room-videos").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("lodge-room-videos").getPublicUrl(path);
  return data.publicUrl;
}
