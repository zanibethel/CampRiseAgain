export type CampFormKind = "camper" | "volunteer" | "contact";
export type CampMailbox = "info" | "volunteer" | "forms";

export const FORM_MAILBOX: Record<CampFormKind, {
  inbox: CampMailbox;
  address: string;
  label: string;
}> = {
  camper: { inbox: "forms", address: "forms@campriseagain.org", label: "Camper application" },
  volunteer: { inbox: "volunteer", address: "volunteer@campriseagain.org", label: "Volunteer application" },
  contact: { inbox: "info", address: "info@campriseagain.org", label: "Contact question" },
};

/**
 * Never include application answers, dates of birth, address, health context,
 * freeform notes, or the message body in an emailed staff notification.
 * Those belong in the admin portal only.
 */
export function staffFormNotice(kind: CampFormKind, id: string, name: string): string {
  const route = FORM_MAILBOX[kind];
  return [
    "A new " + route.label.toLowerCase() + " was submitted on campriseagain.org.",
    "Reference: " + id,
    "Submitted by: " + name,
    "Full information is available only in the protected admin portal.",
    "Review: https://campriseagain.org/admin (Form Submissions tab)",
    "",
    "Reply to this notification in Gmail to answer from " + route.address + ".",
    "Please do not send private camper application details by email.",
  ].join("\n");
}
export function applicantReceipt(kind: CampFormKind, id: string, name: string): string {
  const sentence = kind === "camper"
    ? "We received your camper application. Submitting an application does not confirm a place at camp."
    : kind === "volunteer"
      ? "We received your volunteer interest form. A team member may contact you about opportunities."
      : "We received your message. Our team will review it.";
  return [
    "Thank you for contacting Camp Rise Again" + (name ? ", " + name : "") + ".",
    "",
    sentence,
    "Your reference number: " + id,
    "",
    "For immediate danger, call 911. In the U.S., call or text 988 for mental-health crisis support.",
    "Camp Rise Again is a peer-support camp, not clinical treatment or a crisis service.",
    "",
    "Camp Rise Again",
  ].join("\n");
}
