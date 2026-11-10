import assert from "node:assert/strict";
import test from "node:test";
import {
  validGalleryUpload, canPublishGalleryMedia, orderGalleryItems,
  MAX_GALLERY_PHOTO_BYTES, MAX_GALLERY_VIDEO_BYTES,
} from "../lib/camp-gallery-rules.ts";

test("gallery supports web photos and videos within safe upload limits",()=>{
  assert.equal(validGalleryUpload("image/jpeg",MAX_GALLERY_PHOTO_BYTES),true);
  assert.equal(validGalleryUpload("image/jpeg",MAX_GALLERY_PHOTO_BYTES+1),false);
  assert.equal(validGalleryUpload("video/mp4",MAX_GALLERY_VIDEO_BYTES),true);
  assert.equal(validGalleryUpload("video/quicktime",1024),true);
  assert.equal(validGalleryUpload("video/webm",MAX_GALLERY_VIDEO_BYTES+1),false);
  assert.equal(validGalleryUpload("application/javascript",50),false);
  assert.equal(validGalleryUpload("video/mp4",0),false);
});

test("unapproved media never becomes publicly publishable",()=>{
  const photo={media_type:"photo",upload_complete:true,
    consent_confirmed:true,alt_text:"Campers enjoying an outdoor activity"};
  assert.equal(canPublishGalleryMedia(photo),true);
  assert.equal(canPublishGalleryMedia({...photo,consent_confirmed:false}),false);
  assert.equal(canPublishGalleryMedia({...photo,upload_complete:false}),false);
  assert.equal(canPublishGalleryMedia({...photo,alt_text:""}),false);
  assert.equal(canPublishGalleryMedia({...photo,media_type:"video",alt_text:""}),true);
});

test("album media ordering is deterministic and does not mutate the original array",()=>{
  const data=[{id:"b",sort_order:20},{id:"a",sort_order:10}];
  const sorted=orderGalleryItems(data);
  assert.deepEqual(sorted.map(x=>x.id),["a","b"]);
  assert.equal(data[0].id,"b");
});
