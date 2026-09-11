import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { esc, sendSubmissionEmail } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const b = await req.json();
    if (b.website) return NextResponse.json({ ok: true });
    const required = ["firstName","lastName","email","phone","address1","city","state","postalCode","dateOfBirth","shirtSize","season","consent"];
    if (required.some((k) => !String(b[k] ?? "").trim())) return NextResponse.json({ error: "Please complete all required fields." }, { status: 400 });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(b.email))) return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("camp_rise_again_camper_applications").insert({
      first_name: String(b.firstName).trim(), last_name: String(b.lastName).trim(), email: String(b.email).trim().toLowerCase(), phone: String(b.phone).trim(),
      address_1: String(b.address1).trim(), address_2: String(b.address2 ?? "").trim() || null, city: String(b.city).trim(), state: String(b.state).trim(), postal_code: String(b.postalCode).trim(),
      date_of_birth: String(b.dateOfBirth), shirt_size: String(b.shirtSize), season_preference: String(b.season), notes: String(b.notes ?? "").trim() || null,
    }).select("id").single();
    if (error) throw error;

    await sendSubmissionEmail({
      subject: `New Camp Rise Again application — ${esc(b.firstName)} ${esc(b.lastName)}`,
      html: `<h2>New camper application</h2><p><strong>Submission ID:</strong> ${esc(data.id)}</p><p><strong>Name:</strong> ${esc(b.firstName)} ${esc(b.lastName)}</p><p><strong>Email:</strong> ${esc(b.email)}</p><p><strong>Phone:</strong> ${esc(b.phone)}</p><p><strong>Address:</strong> ${esc(b.address1)} ${esc(b.address2)}<br>${esc(b.city)}, ${esc(b.state)} ${esc(b.postalCode)}</p><p><strong>Birthday:</strong> ${esc(b.dateOfBirth)}</p><p><strong>Shirt:</strong> ${esc(b.shirtSize)}</p><p><strong>Season:</strong> ${esc(b.season)}</p><p><strong>Notes:</strong> ${esc(b.notes || "None")}</p>`,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unable to submit the application right now." }, { status: 500 });
  }
}
