"use client";

export async function downloadFormPdf(options: {
  title: string;
  filename: string;
  rows: Array<[string, string]>;
}) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 54;
  let y = 62;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Camp Rise Again", margin, y);
  y += 28;
  doc.setFontSize(14);
  doc.text(options.title, margin, y);
  y += 30;
  doc.setFontSize(11);

  for (const [label, rawValue] of options.rows) {
    const value = rawValue || "None";
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, margin, y);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(value, 390);
    doc.text(lines, margin + 105, y);
    y += Math.max(20, lines.length * 15 + 5);
    if (y > 720) {
      doc.addPage();
      y = 62;
    }
  }

  y += 8;
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text("Prepared by the applicant through the Camp Rise Again website.", margin, y);
  doc.save(options.filename);
}

export function openPreparedEmail(to: string, subject: string, body: string) {
  window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
