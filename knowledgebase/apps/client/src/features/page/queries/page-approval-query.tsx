import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { submitForReview, reviewPage, getPendingApprovals } from "../services/page-approval-service";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";

export function useSubmitForReviewMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (data: { pageId: string }) => submitForReview(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["pages", variables.pageId] });
      notifications.show({
        message: t("Page submitted for review successfully"),
        color: "green",
      });
    },
    onError: (error: any) => {
      notifications.show({
        message: error.response?.data?.message || t("Failed to submit page for review"),
        color: "red",
      });
    },
  });
}

export function useReviewPageMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (data: { pageId: string; action: "APPROVE" | "REJECT"; rejectionReason?: string }) =>
      reviewPage(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["pages", variables.pageId] });
      queryClient.invalidateQueries({ queryKey: ["pending-approvals"] });
      notifications.show({
        message: variables.action === "APPROVE"
          ? t("Page approved successfully")
          : t("Page rejected successfully"),
        color: "green",
      });
    },
    onError: (error: any) => {
      notifications.show({
        message: error.response?.data?.message || t("Failed to review page"),
        color: "red",
      });
    },
  });
}

export function usePendingApprovalsQuery() {
  return useQuery({
    queryKey: ["pending-approvals"],
    queryFn: () => getPendingApprovals(),
  });
}
