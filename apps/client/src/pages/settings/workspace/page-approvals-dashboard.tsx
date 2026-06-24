import React, { useState } from "react";
import {
  Table,
  Button,
  Group,
  Text,
  Modal,
  Textarea,
  Stack,
  Loader,
  Center,
} from "@mantine/core";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { getAppName } from "@/lib/config";
import SettingsTitle from "@/components/settings/settings-title";
import { usePendingApprovalsQuery, useReviewPageMutation } from "@/features/page/queries/page-approval-query";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import { formattedDate } from "@/lib/time";
import { Link } from "react-router-dom";

export default function PageApprovalsDashboard() {
  const { t } = useTranslation();
  const { data: pendingPages, isLoading } = usePendingApprovalsQuery();
  const reviewMutation = useReviewPageMutation();

  const [rejectingPageId, setRejectingPageId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const handleApprove = (pageId: string) => {
    reviewMutation.mutate({ pageId, action: "APPROVE" });
  };

  const handleOpenReject = (pageId: string) => {
    setRejectingPageId(pageId);
    setRejectionReason("");
  };

  const handleConfirmReject = () => {
    if (rejectingPageId) {
      reviewMutation.mutate(
        {
          pageId: rejectingPageId,
          action: "REJECT",
          rejectionReason: rejectionReason.trim() || undefined,
        },
        {
          onSuccess: () => {
            setRejectingPageId(null);
          },
        }
      );
    }
  };

  return (
    <>
      <Helmet>
        <title>
          {t("Page approvals")} - {getAppName()}
        </title>
      </Helmet>

      <SettingsTitle title={t("Page approvals")} />

      {isLoading ? (
        <Center py="xl">
          <Loader size="md" />
        </Center>
      ) : pendingPages && pendingPages.length > 0 ? (
        <Table highlightOnHover verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t("Page")}</Table.Th>
              <Table.Th>{t("Requested by")}</Table.Th>
              <Table.Th>{t("Requested date")}</Table.Th>
              <Table.Th style={{ width: 220 }}>{t("Actions")}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {pendingPages.map((item: any) => (
              <Table.Tr key={item.id}>
                <Table.Td>
                  <Text
                    component={Link}
                    to={`/p/${item.slugId}`}
                    fw={500}
                    size="sm"
                    style={{ color: "var(--mantine-color-blue-filled)", textDecoration: "none" }}
                  >
                    {item.title || t("Untitled")}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs" wrap="nowrap">
                    <CustomAvatar
                      avatarUrl={item.creatorAvatarUrl}
                      name={item.creatorName}
                      size={24}
                    />
                    <Text size="sm">{item.creatorName}</Text>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">
                    {formattedDate(new Date(item.createdAt))}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs" wrap="nowrap">
                    <Button
                      size="xs"
                      color="green"
                      onClick={() => handleApprove(item.id)}
                      loading={reviewMutation.isPending && reviewMutation.variables?.pageId === item.id && reviewMutation.variables?.action === "APPROVE"}
                    >
                      {t("Approve")}
                    </Button>
                    <Button
                      size="xs"
                      variant="outline"
                      color="red"
                      onClick={() => handleOpenReject(item.id)}
                      disabled={reviewMutation.isPending}
                    >
                      {t("Reject")}
                    </Button>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Text size="sm" c="dimmed" ta="center" py="xl">
          {t("No pages pending approval.")}
        </Text>
      )}

      <Modal
        opened={!!rejectingPageId}
        onClose={() => setRejectingPageId(null)}
        title={t("Reject page approval")}
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            {t("Are you sure you want to reject this page? Provide a reason below to notify the author:")}
          </Text>
          <Textarea
            placeholder={t("Enter rejection reason (optional)...")}
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            rows={3}
            autoFocus
          />
          <Group gap="sm" justify="flex-end">
            <Button variant="default" onClick={() => setRejectingPageId(null)}>
              {t("Cancel")}
            </Button>
            <Button
              color="red"
              onClick={handleConfirmReject}
              loading={reviewMutation.isPending && reviewMutation.variables?.action === "REJECT"}
            >
              {t("Confirm Rejection")}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
