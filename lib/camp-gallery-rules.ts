export type GalleryMediaType = "photo" | "video";

export const MAX_GALLERY_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_GALLERY_VIDEO_BYTES = 45 * 1024 * 1024;
export const GALLERY_MIMES = new Set([
  "image/jpeg","image/png","image/webp",
  "video/mp4","video/webm","video/quicktime",
]);
export function validGalleryUpload(mime: string, bytes: number): boolean {
  const max = mime.startsWith("image/") ? MAX_GALLERY_PHOTO_BYTES : MAX_GALLERY_VIDEO_BYTES;
  return GALLERY_MIMES.has(mime) && Number.isInteger(bytes) && bytes>0 && bytes<=max;
}
export function canPublishGalleryMedia(media:{
  media_type:GalleryMediaType; upload_complete:boolean;
  consent_confirmed:boolean;alt_text:string;
}):boolean {
  return media.upload_complete && media.consent_confirmed &&
    (media.media_type!=="photo" || media.alt_text.trim().length>=5);
}
export function orderGalleryItems<T extends {sort_order:number;id:string}>(items:T[]):T[] {
  return [...items].sort((a,b)=>a.sort_order-b.sort_order || a.id.localeCompare(b.id));
}
