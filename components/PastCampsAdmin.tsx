"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { CampAlbum, CampMedia } from "@/lib/camp-gallery";

type AdminAlbum=CampAlbum & { is_published:boolean; updated_at:string };
type AdminMedia=CampMedia & {
  mime_type:string; bytes:number; consent_confirmed:boolean;
  upload_complete:boolean; is_published:boolean;
};
type AlbumDraft = { title:string; camp_date:string; location:string; description:string; is_published:boolean };
type MediaDraft = {caption:string;alt_text:string;consent_confirmed:boolean;is_published:boolean};

function albumDraft(item:AdminAlbum):AlbumDraft {
  return {title:item.title,camp_date:item.camp_date||"",location:item.location,
    description:item.description,is_published:item.is_published};
}
function mediaDraft(item:AdminMedia):MediaDraft {
  return {caption:item.caption,alt_text:item.alt_text,
    consent_confirmed:item.consent_confirmed,is_published:item.is_published};
}
function fileMime(file:File):string {
  const type=file.type.toLowerCase();
  if(["video/mp4","video/webm","video/quicktime"].includes(type))return type;
  if(/\.mov$/i.test(file.name))return "video/quicktime";
  if(/\.mp4$/i.test(file.name))return "video/mp4";
  if(/\.webm$/i.test(file.name))return "video/webm";
  if(type.startsWith("image/") || /\.(heic|heif|jpg|jpeg|png|webp)$/i.test(file.name))
    return "image/jpeg";
  throw new Error("Use a supported image or MP4, WebM, or MOV video.");
}

async function prepareUpload(file:File):Promise<{file:Blob;mime:string}> {
  const mime=fileMime(file);
  if(mime.startsWith("video/")) {
    if(file.size>45*1024*1024)throw new Error("Videos must be smaller than 45 MB.");
    return {file,mime};
  }
  if(file.size>25*1024*1024)throw new Error("Photos must be smaller than 25 MB before processing.");
  // Re-encoding on canvas strips camera GPS and EXIF from public photo files.
  const url=URL.createObjectURL(file);
  try {
    const img=new Image();
    await new Promise<void>((resolve,reject)=>{
      img.onload=()=>resolve();
      img.onerror=()=>reject(new Error("Photo can't be opened. Export the image as JPG and try again."));
      img.src=url;
    });
    if(!img.naturalWidth || !img.naturalHeight)throw new Error("Invalid photo.");
    const scale=Math.min(1,1920/Math.max(img.naturalWidth,img.naturalHeight));
    const canvas=document.createElement("canvas");
    canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
    canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
    const ctx=canvas.getContext("2d");
    if(!ctx)throw new Error("This browser can't prepare the photo.");
    ctx.fillStyle="#ffffff";ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/jpeg",.83));
    if(!blob || blob.size>10*1024*1024)throw new Error("The photo could not be compressed. Try a smaller image.");
    return {file:blob,mime:"image/jpeg"};
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function PastCampsAdmin() {
  const supabase=useMemo(()=>getSupabaseBrowserClient(),[]);
  const [albums,setAlbums]=useState<AdminAlbum[]>([]);
  const [media,setMedia]=useState<AdminMedia[]>([]);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [albumEdits,setAlbumEdits]=useState<Record<string,AlbumDraft>>({});
  const [mediaEdits,setMediaEdits]=useState<Record<string,MediaDraft>>({});
  const [createOpen,setCreateOpen]=useState(false);
  const [newAlbum,setNewAlbum]=useState({title:"",camp_date:"",location:"",description:""});
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [progress,setProgress]=useState("");
  const [status,setStatus]=useState("");

  const api=useCallback(async(action?:string,params:Record<string,unknown>={})=>{
    if(!supabase)throw new Error("Please sign in again.");
    const {data,error}=await supabase.auth.getSession();
    if(error || !data.session?.access_token)throw new Error("Please sign in again.");
    const response=await fetch("/api/admin/past-camps",{
      method:action?"POST":"GET",
      headers:{Authorization:"Bearer "+data.session.access_token,
        ...(action?{"Content-Type":"application/json"}:{})},
      ...(action?{body:JSON.stringify({action,...params})}:{}),
      cache:"no-store",
    });
    const result=await response.json();
    if(!response.ok)throw new Error(result.error || "Gallery request failed.");
    return result;
  },[supabase]);

  const refresh=useCallback(async()=>{
    try {
      const result=await api();
      const nextAlbums=(result.albums||[]) as AdminAlbum[];
      const nextMedia=(result.media||[]) as AdminMedia[];
      setAlbums(nextAlbums);setMedia(nextMedia);
      setAlbumEdits(Object.fromEntries(nextAlbums.map(a=>[a.id,albumDraft(a)])));
      setMediaEdits(Object.fromEntries(nextMedia.map(m=>[m.id,mediaDraft(m)])));
      setSelectedId(prev=>prev && nextAlbums.some(x=>x.id===prev)?prev:nextAlbums[0]?.id||null);
    }catch(error){
      setStatus(error instanceof Error?error.message:"Unable to load gallery.");
    }finally{setLoading(false);}
  },[api]);

  useEffect(()=>{void refresh();},[refresh]);

  async function command(action:string,values:Record<string,unknown>,message:string) {
    if(busy)return;
    setBusy(true);setStatus("");
    try {
      await api(action,values);
      await refresh();
      setStatus(message);
    }catch(error){
      setStatus(error instanceof Error?error.message:"Could not save changes.");
    }finally{setBusy(false);}
  }

  async function createAlbum(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(!newAlbum.title.trim())return;
    setBusy(true);
    try {
      const response=await api("admin_gallery_create_album",newAlbum);
      setCreateOpen(false);
      setNewAlbum({title:"",camp_date:"",location:"",description:""});
      await refresh();
      setSelectedId(response.album.id);
      setStatus("Album created as a private draft. Upload and approve its media before publishing.");
    }catch(error){setStatus(error instanceof Error?error.message:"Unable to create album.");}
    finally{setBusy(false);}
  }

  const selected=albums.find(x=>x.id===selectedId)||null;
  const albumFiles=media.filter(x=>x.album_id===selectedId)
    .sort((a,b)=>a.sort_order-b.sort_order);

  async function upload(event:ChangeEvent<HTMLInputElement>) {
    const files=Array.from(event.target.files||[]);
    event.target.value="";
    if(!selected || !supabase || !files.length || busy)return;
    if(files.length>10){setStatus("Choose up to 10 photos or videos per upload.");return;}
    setBusy(true);setStatus("");
    let completed=0;
    try {
      for(const [index,file] of files.entries()){
        setProgress("Uploading "+(index+1)+" of "+files.length+": "+file.name);
        const prepared=await prepareUpload(file);
        const ticket=await api("admin_gallery_prepare_upload",{
          album_id:selected.id,mime_type:prepared.mime,bytes:prepared.file.size,
        });
        const {error:uploadError}=await supabase.storage.from(ticket.bucket)
          .uploadToSignedUrl(ticket.path,ticket.uploadToken,prepared.file,{
            contentType:prepared.mime,upsert:false,
          });
        if(uploadError)throw uploadError;
        await api("admin_gallery_finalize_upload",{id:ticket.mediaId});
        completed++;
      }
      setStatus(completed+" file(s) uploaded privately. Add captions and confirm sharing permissions before publishing.");
    }catch(error){
      setStatus(completed+" uploaded. "+(error instanceof Error?error.message:"Upload failed.")+
        " Refresh the album before retrying.");
    }finally{
      setBusy(false);setProgress("");
      await refresh();
    }
  }

  return <section className="form-card" aria-label="Past Camps album administration">
    <h2>Past Camps — Photos & Videos</h2>
    <p className="section-copy">
      Organize previous camps into albums. New albums and uploads stay private
      until you explicitly publish them. Only approved content is shown publicly.
    </p>
    <div className="notice">
      <strong>Privacy before publishing:</strong> Confirm that every identifiable person
      has consented to publication on a public website. Do not share sensitive conversations
      or private camper details. Photos are resized to remove EXIF location data;
      videos may contain embedded metadata and should be reviewed or exported without location data.
    </div>

    <div className="actions" style={{marginBottom:16}}>
      <button type="button" className="btn btn-primary" onClick={()=>setCreateOpen(v=>!v)} disabled={busy}>
        {createOpen?"Cancel New Album":"+ Add Camp Album"}
      </button>
      <a className="btn btn-secondary" href="/past-camps" target="_blank" rel="noopener noreferrer">View Public Gallery</a>
      <button type="button" className="btn btn-secondary" disabled={busy} onClick={()=>void refresh()}>Refresh</button>
    </div>

    {createOpen && <form onSubmit={event=>void createAlbum(event)} className="card" style={{marginBottom:20}}>
      <h3>Create Camp Album</h3>
      <div className="field"><label htmlFor="camp-new-title">Album title</label>
        <input id="camp-new-title" required minLength={3} maxLength={150} value={newAlbum.title}
          onChange={event=>setNewAlbum(x=>({...x,title:event.target.value}))} placeholder="Spring Camp 2027"/></div>
      <div className="field-grid">
        <div className="field"><label htmlFor="camp-new-date">Camp date (optional)</label>
          <input id="camp-new-date" type="date" value={newAlbum.camp_date}
            onChange={event=>setNewAlbum(x=>({...x,camp_date:event.target.value}))}/></div>
        <div className="field"><label htmlFor="camp-new-location">City (optional)</label>
          <input id="camp-new-location" maxLength={160} value={newAlbum.location}
            onChange={event=>setNewAlbum(x=>({...x,location:event.target.value}))}/></div>
      </div>
      <div className="field"><label htmlFor="camp-new-description">Description (optional)</label>
        <textarea id="camp-new-description" maxLength={1200} rows={3} value={newAlbum.description}
          onChange={event=>setNewAlbum(x=>({...x,description:event.target.value}))}/></div>
      <button type="submit" className="btn btn-primary" disabled={busy}>Create Private Album</button>
    </form>}

    {loading ? <p>Loading camp albums…</p> :
    <div className="camp-admin-album-tabs">
      {albums.map(album=><button key={album.id} type="button" className="camp-admin-album-tab"
        style={{borderColor: selectedId===album.id?"var(--forest)":"var(--line)"}}
        aria-pressed={selectedId===album.id}
        onClick={()=>setSelectedId(album.id)}>
        <strong>{album.title}</strong>
        <small>{album.is_published?"Public":"Private draft"} · {media.filter(x=>x.album_id===album.id).length} files</small>
      </button>)}
    </div>}

    {selected && <div style={{borderTop:"1px solid var(--line)",paddingTop:22,marginTop:16}}>
      <h3>Edit {selected.title}</h3>
      <div className="field"><label htmlFor="camp-album-title">Album title</label>
        <input id="camp-album-title" maxLength={150}
          value={albumEdits[selected.id]?.title??selected.title}
          onChange={event=>setAlbumEdits(x=>({...x,[selected.id]:{...x[selected.id],title:event.target.value}}))}/></div>
      <div className="field-grid">
        <div className="field"><label htmlFor="camp-album-date">Date</label>
          <input id="camp-album-date" type="date"
            value={albumEdits[selected.id]?.camp_date??selected.camp_date??""}
            onChange={event=>setAlbumEdits(x=>({...x,[selected.id]:{...x[selected.id],camp_date:event.target.value}}))}/></div>
        <div className="field"><label htmlFor="camp-album-city">Location</label>
          <input id="camp-album-city" maxLength={160}
            value={albumEdits[selected.id]?.location??selected.location}
            onChange={event=>setAlbumEdits(x=>({...x,[selected.id]:{...x[selected.id],location:event.target.value}}))}/></div>
      </div>
      <div className="field"><label htmlFor="camp-album-description">Description</label>
        <textarea id="camp-album-description" maxLength={1200} rows={3}
          value={albumEdits[selected.id]?.description??selected.description}
          onChange={event=>setAlbumEdits(x=>({...x,[selected.id]:{...x[selected.id],description:event.target.value}}))}/></div>
      <label style={{display:"flex",gap:10,alignItems:"center",margin:"16px 0"}}>
        <input type="checkbox" checked={albumEdits[selected.id]?.is_published??selected.is_published}
          onChange={event=>setAlbumEdits(x=>({...x,[selected.id]:{...x[selected.id],is_published:event.target.checked}}))}/>
        <strong>Show this album publicly (approved media only)</strong>
      </label>
      <div className="actions" style={{marginBottom:30}}>
        <button type="button" className="btn btn-primary" disabled={busy}
          onClick={()=>void command("admin_gallery_update_album",{id:selected.id,...albumEdits[selected.id]},"Album settings saved.")}>
          Save Album
        </button>
        <button type="button" className="btn btn-secondary" disabled={busy||albums.indexOf(selected)===0}
          onClick={()=>void command("admin_gallery_move",{id:selected.id,kind:"album",direction:-1},"Album moved up.")}>↑ Move Up</button>
        <button type="button" className="btn btn-secondary" disabled={busy||albums.indexOf(selected)===albums.length-1}
          onClick={()=>void command("admin_gallery_move",{id:selected.id,kind:"album",direction:1},"Album moved down.")}>↓ Move Down</button>
        <button type="button" className="btn" disabled={busy}
          style={{background:"#fce8e8",color:"#812424"}}
          onClick={()=>{if(window.confirm("Delete this album? Remove its media first."))void command("admin_gallery_delete_album",{id:selected.id},"Album deleted.");}}>Delete Album</button>
      </div>

      <h3>Photos & Videos</h3>
      <p className="section-copy">Choose up to 10 files at a time. Photos are optimized automatically;
        videos must be 45 MB or smaller. MP4 and WebM play most reliably across devices.
        MOV playback varies by browser.</p>
      <div className="field">
        <label htmlFor="camp-media-upload">Upload to {selected.title}</label>
        <input id="camp-media-upload" type="file" multiple disabled={busy}
          accept="image/*,.heic,.heif,video/mp4,video/webm,video/quicktime,.mov"
          onChange={event=>void upload(event)}/>
      </div>
      {progress && <p role="status" className="status">{progress}</p>}
      {!albumFiles.length && <p className="section-copy">No media uploaded yet.</p>}
      <div className="camp-admin-media-list">
        {albumFiles.map((item,index)=>{
          const edit=mediaEdits[item.id]||mediaDraft(item);
          const update=(value:Partial<MediaDraft>)=>
            setMediaEdits(x=>({...x,[item.id]:{...edit,...value}}));
          return <article className="card" key={item.id} style={{padding:16}}>
            {item.media_url ?
              (item.media_type==="photo"?
                <img className="camp-admin-media-preview" src={item.media_url}
                  alt={item.alt_text||"Uploaded private camp photo"}/>:
                <video className="camp-admin-media-preview" controls preload="none" playsInline
                  src={item.media_url}/>) :
              <p className="notice">{item.upload_complete?"Preview expired. Refresh to renew.":"Upload is incomplete. Delete this draft and retry if the upload failed."}</p>}
            <p className="section-copy" style={{fontSize:13,margin:"10px 0"}}>
              {item.media_type==="photo"?"Photo":"Video"} · {Math.round(item.bytes/1048576*10)/10} MB ·
              {item.is_published?" Public when album is public":" Hidden"}
            </p>
            <div className="field"><label htmlFor={"camp-media-caption-"+item.id}>Caption</label>
              <textarea id={"camp-media-caption-"+item.id} rows={2} maxLength={700}
                value={edit.caption} onChange={event=>update({caption:event.target.value})}/></div>
            <div className="field"><label htmlFor={"camp-media-alt-"+item.id}>
              {item.media_type==="photo"?"Photo description (required to publish)":"Video description (optional)"}
            </label>
              <input id={"camp-media-alt-"+item.id} maxLength={200} value={edit.alt_text}
                placeholder={item.media_type==="photo"?"Describe what this photo shows":"What does this video show?"}
                onChange={event=>update({alt_text:event.target.value})}/></div>
            <label className="camp-media-check">
              <input type="checkbox" checked={edit.consent_confirmed}
                onChange={event=>update({consent_confirmed:event.target.checked})}/>
              <span>I confirm that everyone identifiable has agreed to have this media publicly shared,
                including guardian permission where relevant.</span>
            </label>
            <label className="camp-media-check">
              <input type="checkbox" checked={edit.is_published}
                onChange={event=>update({is_published:event.target.checked})}/>
              <strong>Publish this {item.media_type==="photo"?"photo":"video"}</strong>
            </label>
            <div className="actions" style={{gap:8}}>
              <button className="btn btn-primary" type="button" disabled={busy||!item.upload_complete}
                onClick={()=>void command("admin_gallery_update_media",{
                  id:item.id,media_type:item.media_type,...edit,
                },"Media details saved.")}>Save Media</button>
              <button type="button" className="btn btn-secondary" disabled={busy||index===0}
                onClick={()=>void command("admin_gallery_move",{
                  id:item.id,kind:"media",direction:-1,
                },"Media order updated.")}>↑</button>
              <button type="button" className="btn btn-secondary" disabled={busy||index===albumFiles.length-1}
                onClick={()=>void command("admin_gallery_move",{
                  id:item.id,kind:"media",direction:1,
                },"Media order updated.")}>↓</button>
              <button className="btn" type="button" disabled={busy}
                style={{background:"#fce8e8",color:"#812424"}}
                onClick={()=>{
                  if(window.confirm("Delete this photo or video? The stored file will be removed."))
                    void command("admin_gallery_delete_media",{id:item.id},"Media removed.");
                }}>Delete</button>
            </div>
          </article>;
        })}
      </div>
    </div>}
    {status && <p className="status" role="status" aria-live="polite">{status}</p>}
  </section>;
}
