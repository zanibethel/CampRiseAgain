import { handleCampSubmission } from "@/lib/camp-form-submission";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleCampSubmission(request, "volunteer");
}
