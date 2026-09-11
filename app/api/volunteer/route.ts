import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { esc, sendSubmissionEmail } from "@/lib/email";

const validRoles = ["food_beverage","camp_mentor_support","activity_coordinator","transportation","setup","take_down"];

export async function POST(req: Request) {
  try {
    const b = await req.json();
    if (b.website) return NextResponse.json({ ok: true });
    const roles = Array.isArray(b.roles) ? b.roles.filter((r: string) => validRoles.includes(r)) : [];
    if (!["firstName","lastName","email","phone","season","consent"].every((k) => String(b[k] ?? "").trim()) || roles.length === 0) return NextResponse.json({ error: "Please complete the required fields and choose at least one volunteer area." }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("camp_rise_again_volunteer_applications").insert({
      first_name: String(b.firstName).trim(), last_name: String(b.lastName).trim(), email: String(b.email).trim().toLowerCase(), phone: String(b.phone).trim(),
      season_preference: String(b.season), volunteer_roles: roles, notes: String(b.notes ?? "").trim() || null,
    }).select("id").single();
    if (error) throw error;

    await sendSubmissionEmail({ subject: `New Camp Rise Again volunteer — ${esc(b.firstName)} ${esc(b.lastName)}`, html: `<h2>New volunteer submission</h2><p><strong>Submission ID:</strong> ${esc(data.id)}</p><p><strong>Name:</strong> ${esc(b.firstName)} ${esc(b.lastName)}</p><p><strong>Email:</strong> ${esc(b.email)}</p><p><strong>Phone:</strong> ${esc(b.phone)}</p><p><strong>Season:</strong> ${esc(b.season)}</p><p><strong>Volunteer areas:</strong> ${roles.map(esc).join(", ")}</p><p><strong>Notes:</strong> ${esc(b.notes || "None")}</p>` });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unable to submit the volunteer form right now." }, { status: 500 });
  }
}
