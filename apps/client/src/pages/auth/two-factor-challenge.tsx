import React, { useState } from "react";
import {
  Container,
  Title,
  Text,
  PinInput,
  Button,
  Stack,
  Paper,
  Center,
  ThemeIcon,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { zod4Resolver } from "mantine-form-zod-resolver";
import { IconDeviceMobile, IconLock } from "@tabler/icons-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { notifications } from "@mantine/notifications";
import { z } from "zod/v4";
import { useTranslation } from "react-i18next";

import { verify2FaLogin } from "@/features/auth/services/auth-service";
import APP_ROUTE, { getPostLoginRedirect } from "@/lib/app-route";
import { AuthLayout } from "@/features/auth/components/auth-layout";
import classes from "@/ee/mfa/components/mfa-challenge.module.css";

const formSchema = z.object({
  code: z
    .string()
    .length(6, { message: "Enter a 6-digit verification code" })
    .regex(/^\d{6}$/, { message: "Code must be numeric" }),
});

type FormValues = z.infer<typeof formSchema>;

export default function TwoFactorChallengePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);

  const userId = searchParams.get("userId");

  const form = useForm<FormValues>({
    validate: zod4Resolver(formSchema),
    initialValues: {
      code: "",
    },
  });

  const handleSubmit = async (values: FormValues) => {
    if (!userId) {
      notifications.show({
        message: t("Invalid session, please try logging in again"),
        color: "red",
      });
      navigate(APP_ROUTE.AUTH.LOGIN);
      return;
    }

    setIsLoading(true);
    try {
      await verify2FaLogin({ userId, token: values.code });
      navigate(getPostLoginRedirect());
    } catch (error: any) {
      setIsLoading(false);
      notifications.show({
        message: error.response?.data?.message || t("Invalid verification code"),
        color: "red",
      });
      form.setFieldValue("code", "");
    }
  };

  return (
    <AuthLayout>
      <Container size={420} className={classes.container}>
        <Paper radius="lg" p={40} className={classes.paper}>
          <Stack align="center" gap="xl">
            <Center>
              <ThemeIcon size={80} radius="xl" variant="light" color="blue">
                <IconDeviceMobile size={40} stroke={1.5} />
              </ThemeIcon>
            </Center>

            <Stack align="center" gap="xs">
              <Title order={2} ta="center" fw={600}>
                {t("Two-factor verification")}
              </Title>
              <Text size="sm" c="dimmed" ta="center">
                {t("Enter the 6-digit code from your authenticator app")}
              </Text>
            </Stack>

            <form onSubmit={form.onSubmit(handleSubmit)} style={{ width: "100%" }}>
              <Stack gap="lg">
                <Center>
                  <PinInput
                    length={6}
                    type="number"
                    autoFocus
                    data-autofocus
                    oneTimeCode
                    {...form.getInputProps("code")}
                    error={!!form.errors.code}
                    styles={{
                      input: {
                        fontSize: "1.2rem",
                        textAlign: "center",
                      },
                    }}
                  />
                </Center>

                {form.errors.code && (
                  <Text c="red" size="sm" ta="center">
                    {form.errors.code}
                  </Text>
                )}

                <Button
                  type="submit"
                  fullWidth
                  size="md"
                  loading={isLoading}
                  leftSection={<IconLock size={18} />}
                >
                  {t("Verify")}
                </Button>
              </Stack>
            </form>
          </Stack>
        </Paper>
      </Container>
    </AuthLayout>
  );
}
