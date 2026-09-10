"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function saveBrandFrame(name: string, content: string): Promise<void> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Nicht angemeldet.");
  }

  const { error } = await supabase
    .from("brand_frames")
    .upsert({ owner_id: user.id, name, content }, { onConflict: "owner_id,name" });

  if (error) {
    throw new Error(`Konnte frame.md nicht speichern: ${error.message}`);
  }

  revalidatePath("/brand");
}
