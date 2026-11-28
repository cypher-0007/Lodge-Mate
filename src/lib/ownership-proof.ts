import { supabase } from "@/integrations/supabase/client";

export const OWNERSHIP_PROOF_BUCKET = "lodge-ownership-proofs";

export async function uploadOwnershipProof(file: File, userId: string) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "bin";
  const path = `${userId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(OWNERSHIP_PROOF_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  return path;
}
