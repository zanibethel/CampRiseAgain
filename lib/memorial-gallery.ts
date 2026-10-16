export const memorialGalleryPlacements = [
  { id: "after-intro", label: "After Michael's service introduction" },
  { id: "after-personal", label: "After Beyond the Uniform" },
  { id: "after-founder", label: "After Tierra's founder story" },
  { id: "after-legacy", label: "After Michael's Legacy" },
  { id: "after-honors", label: "After military honors" },
] as const;

export type MemorialGalleryPlacement = (typeof memorialGalleryPlacements)[number]["id"];

export type MemorialGalleryPhoto = {
  id: string;
  storage_path: string;
  caption: string;
  placement: MemorialGalleryPlacement;
  sort_order: number;
  is_visible: boolean;
  created_at: string;
};

export const MEMORIAL_GALLERY_TABLE = "camp_rise_again_memorial_photos";
export const MEMORIAL_IMAGE_BUCKET = "camp-rise-again-branding";

export function orderGallery(photos: MemorialGalleryPhoto[]) {
  return [...photos].sort(
    (a, b) =>
      memorialGalleryPlacements.findIndex((p) => p.id === a.placement) -
        memorialGalleryPlacements.findIndex((p) => p.id === b.placement) ||
      a.sort_order - b.sort_order ||
      a.created_at.localeCompare(b.created_at) ||
      a.id.localeCompare(b.id)
  );
}
