import React, { useState } from "react";
import {
  Button,
  Group,
  Text,
  Stack,
  TextInput,
  PinInput,
  Center,
  CopyButton,
  ActionIcon,
  Tooltip,
  Box,
  Alert,
} from "@mantine/core";
import { IconCheck, IconCopy, IconLock, IconShieldCheck } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { notifications } from "@mantine/notifications";
import { QRCodeSVG } from "qrcode.react";

import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import { generate2FaSecret, enable2FA } from "@/features/auth/services/auth-service";
import {
  ResponsiveSettingsRow,
  ResponsiveSettingsContent,
  ResponsiveSettingsControl,
} from "@/components/ui/responsive-settings-row";

export function TwoFactorAuthSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [currentUser] = useAtom(currentUserAtom);
  
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [secret, setSecret] = useState("");
  const [otpauthUrl, setOtpauthUrl] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const user = currentUser?.user;
  const is2faEnabled = user?.is2faEnabled === true;

  const handleStartSetup = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await generate2FaSecret();
      setSecret(data.secret);
      setOtpauthUrl(data.otpauthUrl);
      setIsSettingUp(true);
    } catch (err: any) {
      notifications.show({
        message: err.response?.data?.message || t("Failed to initiate 2FA setup"),
        color: "red",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnable2FA = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError(t("Please enter a valid 6-digit code"));
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await enable2FA({ token: verificationCode });
      notifications.show({
        title: t("Success"),
        message: t("Two-factor authentication has been enabled"),
        color: "green",
      });
      // Invalidate query to refetch user data and update UI
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      setIsSettingUp(false);
      setVerificationCode("");
    } catch (err: any) {
      setError(err.response?.data?.message || t("Invalid verification code. Please try again."));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelSetup = () => {
    setIsSettingUp(false);
    setSecret("");
    setOtpauthUrl("");
    setVerificationCode("");
    setError(null);
  };

  return (
    <>
      <ResponsiveSettingsRow>
        <ResponsiveSettingsContent>
          <Text size="md" fw={500}>{t("Two-factor authentication (2FA)")}</Text>
          <Text size="sm" c="dimmed">
            {is2faEnabled
              ? t("Two-factor authentication is active on your account.")
              : t("Add an extra layer of security to your account using a TOTP authenticator app.")}
          </Text>
        </ResponsiveSettingsContent>

        <ResponsiveSettingsControl>
          {!is2faEnabled && !isSettingUp && (
            <Button
              variant="default"
              onClick={handleStartSetup}
              loading={isLoading}
              style={{ whiteSpace: "nowrap" }}
            >
              {t("Set up 2FA")}
            </Button>
          )}
          {is2faEnabled && (
            <Group gap="xs" wrap="nowrap">
              <IconShieldCheck size={20} color="var(--mantine-color-green-filled)" />
              <Text size="sm" c="green" fw={500}>
                {t("Enabled")}
              </Text>
            </Group>
          )}
        </ResponsiveSettingsControl>
      </ResponsiveSettingsRow>

      {isSettingUp && (
        <Box mt="md" p="md" style={{ border: "1px solid var(--mantine-color-default-border)", borderRadius: "var(--mantine-radius-md)", backgroundColor: "var(--mantine-color-default-hover)" }}>
          <Stack gap="md">
            <Text size="sm" fw={500}>
              {t("1. Scan the QR code below using your mobile authenticator app:")}
            </Text>
            
            {otpauthUrl && (
              <Center p="sm" style={{ background: "#fff", borderRadius: "8px", width: "fit-content", alignSelf: "center" }}>
                <QRCodeSVG value={otpauthUrl} size={180} />
              </Center>
            )}

            <Text size="sm" fw={500}>
              {t("Or enter the key manually into your app:")}
            </Text>
            
            <Group gap="xs" wrap="nowrap" justify="center">
              <Box p="xs" style={{ background: "var(--mantine-color-body)", borderRadius: "var(--mantine-radius-sm)", border: "1px dashed var(--mantine-color-default-border)", fontFamily: "monospace", fontSize: "0.95rem", letterSpacing: "1px" }}>
                {secret}
              </Box>
              <CopyButton value={secret} timeout={2000}>
                {({ copied, copy }) => (
                  <Tooltip label={copied ? t("Copied") : t("Copy")} withArrow position="right">
                    <ActionIcon color={copied ? "teal" : "gray"} variant="subtle" onClick={copy}>
                      {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                    </ActionIcon>
                  </Tooltip>
                )}
              </CopyButton>
            </Group>

            <Text size="sm" fw={500}>
              {t("2. Enter the 6-digit verification code from your authenticator app:")}
            </Text>

            <Center>
              <PinInput
                length={6}
                type="number"
                value={verificationCode}
                onChange={setVerificationCode}
                error={!!error}
                autoFocus
                oneTimeCode
              />
            </Center>

            {error && (
              <Text c="red" size="xs" ta="center">
                {error}
              </Text>
            )}

            <Group gap="sm" justify="flex-end" mt="sm">
              <Button variant="default" size="sm" onClick={handleCancelSetup} disabled={isLoading}>
                {t("Cancel")}
              </Button>
              <Button size="sm" leftSection={<IconLock size={16} />} onClick={handleEnable2FA} loading={isLoading}>
                {t("Enable 2FA")}
              </Button>
            </Group>
          </Stack>
        </Box>
      )}
    </>
  );
}
