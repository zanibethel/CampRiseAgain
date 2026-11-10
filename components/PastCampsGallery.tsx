"use client";

import { useEffect, useMemo, useState } from "react";
import type { CampGallery, CampMedia } from "@/lib/camp-gallery";

function dateLabel(input: string|null): string {
  if (!input) return "";
  const date = new Date(input + "T12:00:00");
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-US",{
    year:"numeric",month:"long",day:"numeric",
  });
}

export default function PastCampsGallery({gallery}:{gallery:CampGallery}) {
  const [selectedAlbum,setSelectedAlbum]=useState<string|null>(gallery.albums[0]?.id || null);
  const [selectedMedia,setSelectedMedia]=useState<string|null>(null);
  const album=gallery.albums.find(x=>x.id===selectedAlbum) || null;
  const media=useMemo(()=>gallery.media.filter(x=>x.album_id===selectedAlbum && x.media_url)
    .sort((a,b)=>a.sort_order-b.sort_order),[gallery,selectedAlbum]);
  const selectedIndex=media.findIndex(x=>x.id===selectedMedia);
  const active=selectedIndex>=0 ? media[selectedIndex] : null;

  useEffect(()=>{
    if (!active) return;
    function key(event:KeyboardEvent) {
      if (event.key==="Escape") setSelectedMedia(null);
      if (event.key==="ArrowRight") setSelectedMedia(current=>{
        const i=media.findIndex(m=>m.id===current);
        return media.length?media[(i+1)%media.length].id:null;
      });
      if (event.key==="ArrowLeft") setSelectedMedia(current=>{
        const i=media.findIndex(m=>m.id===current);
        return media.length?media[(i+media.length-1)%media.length].id:null;
      });
    }
    document.addEventListener("keydown",key);
    return ()=>document.removeEventListener("keydown",key);
  },[active,media]);

  if (!gallery.albums.length) {
    return <section className="card" style={{maxWidth:720}}>
      <h2>Memories are on the way</h2>
      <p>We're preparing photos and videos from previous Camp Rise Again gatherings.
        Check back as our team shares approved memories.</p>
    </section>;
  }

  return <div className="past-camps">
    <div className="camp-album-picker" role="group" aria-label="Choose a previous camp">
      {gallery.albums.map(item=>{
        const albumMedia=gallery.media.filter(x=>x.album_id===item.id && x.media_url);
        const cover=albumMedia.find(x=>x.media_type==="photo");
        return <button type="button" key={item.id}
          className={"camp-album-card"+(selectedAlbum===item.id?" is-selected":"")}
          onClick={()=>{setSelectedAlbum(item.id);setSelectedMedia(null);}}
          aria-pressed={selectedAlbum===item.id}>
          <div className="camp-album-cover">
            {cover?.media_url?<img src={cover.media_url} alt="" loading="lazy"/>:
              <span aria-hidden="true">Camp Rise Again</span>}
          </div>
          <div className="camp-album-card-copy">
            <strong>{item.title}</strong>
            <small>{[dateLabel(item.camp_date),item.location].filter(Boolean).join(" · ")}</small>
            <small>{albumMedia.length} {albumMedia.length===1?"memory":"memories"}</small>
          </div>
        </button>;
      })}
    </div>
    {album && <section className="camp-album-detail" aria-live="polite">
      <div className="eyebrow">Camp memories</div>
      <h2>{album.title}</h2>
      {(album.camp_date || album.location) && <p className="camp-album-meta">
        {[dateLabel(album.camp_date),album.location].filter(Boolean).join(" · ")}</p>}
      {album.description && <p className="section-copy">{album.description}</p>}
      {!media.length ? <p className="section-copy">Photos and videos for this album are being prepared.</p> :
        <div className="camp-media-grid">
          {media.map(item=><button key={item.id} type="button"
            className="camp-media-card"
            onClick={()=>setSelectedMedia(item.id)}
            aria-label={"View "+(item.media_type==="video"?"video":"photo")+
              (item.caption ? ": "+item.caption : "")}>
            {item.media_type==="photo" && item.media_url ?
              <img src={item.media_url} alt={item.alt_text || item.caption || "A Camp Rise Again memory"} loading="lazy"/> :
              <div className="camp-video-placeholder">
                <span aria-hidden="true" className="camp-video-play">▶</span>
                <span>Play video</span>
              </div>}
            {item.caption && <span className="camp-media-caption">{item.caption}</span>}
          </button>)}
        </div>}
    </section>}
    {active && active.media_url && <div className="camp-lightbox"
      role="dialog" aria-modal="true" aria-label="Camp photo and video viewer">
      <div className="camp-lightbox-toolbar">
        <span>{selectedIndex+1} of {media.length}</span>
        <button type="button" className="btn btn-secondary"
          autoFocus onClick={()=>setSelectedMedia(null)}>Close ×</button>
      </div>
      <div className="camp-lightbox-content">
        {active.media_type==="photo"?
          <img src={active.media_url} alt={active.alt_text || active.caption || "Camp memory"} />:
          <video key={active.id} src={active.media_url} controls autoPlay playsInline preload="metadata">
            Your browser may not support this video format.
          </video>}
        {active.caption && <p>{active.caption}</p>}
      </div>
      {media.length>1 && <div className="camp-lightbox-navigation">
        <button type="button" className="btn btn-secondary" onClick={()=>
          setSelectedMedia(media[(selectedIndex+media.length-1)%media.length].id)}>← Previous</button>
        <button type="button" className="btn btn-secondary" onClick={()=>
          setSelectedMedia(media[(selectedIndex+1)%media.length].id)}>Next →</button>
      </div>}
    </div>}
  </div>;
}
