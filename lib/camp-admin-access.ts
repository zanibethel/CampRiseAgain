/**
 * Check Camp Rise Again's current, private administrator directory.
 * This is only a UI gate; Supabase RLS and every protected endpoint enforce
 * the same live membership independently on the server.
 */
export async function campAdminAllowed(accessToken:string):Promise<boolean>{
  if(!accessToken)return false;
  try{
    const response=await fetch("/api/admin/admins?me=1",{
      headers:{Authorization:"Bearer "+accessToken},
      cache:"no-store",
    });
    return response.ok;
  }catch{return false;}
}
