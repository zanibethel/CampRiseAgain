import { campBridge } from "@/lib/camp-supabase-bridge";

export type CampAlbum = {
  id:string; title:string; camp_date:string|null; location:string;
  description:string; sort_order:number; is_published?:boolean;
  created_at:string; updated_at?:string;
};
export type CampMedia = {
  id:string; album_id:string; media_type:"photo"|"video";
  media_url:string|null; caption:string; alt_text:string; sort_order:number;
  mime_type?:string; bytes?:number; consent_confirmed?:boolean;
  upload_complete?:boolean; is_published?:boolean; created_at?:string;
};
export type CampGallery = { albums:CampAlbum[]; media:CampMedia[] };

export async function getPublicCampGallery(): Promise<CampGallery|null> {
  try {
    return await campBridge<CampGallery>("get_public_gallery");
  } catch (error) {
    console.error("[camp-gallery] public lookup unavailable",
      error instanceof Error ? error.name : "unknown");
    return null;
  }
}
export function mediaForAlbum(gallery: CampGallery, albumId: string): CampMedia[] {
  return gallery.media.filter(x=>x.album_id===albumId && x.media_url)
    .sort((a,b)=>a.sort_order-b.sort_order);
}
