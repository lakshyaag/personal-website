import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import { d1 } from "./scripts/migrate/d1";
const env = process.env;
const r2 = new S3Client({ region: "auto", endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials: { accessKeyId: env.PRIVATE_R2_ACCESS_KEY_ID ?? "", secretAccessKey: env.PRIVATE_R2_SECRET_ACCESS_KEY ?? "" } });
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const { data: assets, error } = await sb.from("photo_assets").select("id, visibility, gallery_featured, created_at");
if (error) throw error;
const rows = new Map((await d1<{ id: string; state: string; visibility: string; featured: number; updated_at: string }>("SELECT id,state,visibility,featured,updated_at FROM photos")).map((r) => [r.id, r]));
const missing: string[] = [];
for (const a of assets ?? []) {
	const id = String(a.id);
	const exists = await r2.send(new HeadObjectCommand({ Bucket: env.PRIVATE_R2_BUCKET, Key: `originals/${id}` })).then(() => true, () => false);
	const row = rows.get(id);
	if (!exists || !row || row.state !== "ready")
		missing.push(`${id} d1=${row ? `${row.state} vis=${row.visibility} featured=${row.featured} updated=${row.updated_at}` : "absent"} r2Original=${exists} supabase vis=${a.visibility} featured=${a.gallery_featured}`);
}
console.log("supabase assets", assets?.length, "d1 rows", rows.size);
console.log(missing.length ? missing.join("\n") : "every Supabase photo is ready in D1 with its original in R2");
const extra = [...rows.values()].filter((r) => !(assets ?? []).some((a) => String(a.id) === r.id));
console.log("D1-only photos (not from Supabase):", extra.map((r) => `${r.id} ${r.state}`).join(", ") || "none");
