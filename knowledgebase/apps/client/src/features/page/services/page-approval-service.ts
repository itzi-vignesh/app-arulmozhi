import api from "@/lib/api-client";

export async function submitForReview(data: { pageId: string }): Promise<{ message: string }> {
  const req = await api.post<{ message: string }>("/page-approval/submit", data);
  return req.data;
}

export async function reviewPage(data: {
  pageId: string;
  action: "APPROVE" | "REJECT";
  rejectionReason?: string;
}): Promise<{ message: string }> {
  const req = await api.post<{ message: string }>("/page-approval/review", data);
  return req.data;
}

export async function getPendingApprovals(): Promise<any[]> {
  const req = await api.get<any[]>("/page-approval/pending");
  return req.data;
}
