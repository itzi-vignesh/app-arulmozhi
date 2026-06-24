import api from "@/lib/api-client";
import {
  IChangePassword,
  ICollabToken,
  IForgotPassword,
  ILogin,
  ILoginResponse,
  IPasswordReset,
  ISetupWorkspace,
  IVerifyUserToken,
} from "@/features/auth/types/auth.types";
import { IWorkspace } from "@/features/workspace/types/workspace.types.ts";

export async function login(data: ILogin): Promise<ILoginResponse> {
  const response = await api.post<ILoginResponse>("/auth/login", data);
  return response.data;
}

export async function logout(): Promise<void> {
  await api.post<void>("/auth/logout");
}

export async function changePassword(
  data: IChangePassword,
): Promise<IChangePassword> {
  const req = await api.post<IChangePassword>("/auth/change-password", data);
  return req.data;
}

export async function setupWorkspace(
  data: ISetupWorkspace,
): Promise<IWorkspace> {
  const req = await api.post<IWorkspace>("/auth/setup", data);
  return req.data;
}

export async function forgotPassword(data: IForgotPassword): Promise<void> {
  await api.post<void>("/auth/forgot-password", data);
}

export async function passwordReset(data: IPasswordReset): Promise<{ requiresLogin?: boolean; }> {
  const req = await api.post("/auth/password-reset", data);
  return req.data;
}

export async function verifyUserToken(data: IVerifyUserToken): Promise<any> {
  return api.post<any>("/auth/verify-token", data);
}

export async function getCollabToken(): Promise<ICollabToken> {
  const req = await api.post<ICollabToken>("/auth/collab-token");
  return req.data;
}

export async function generate2FaSecret(): Promise<{ secret: string; otpauthUrl: string }> {
  const req = await api.post<{ secret: string; otpauthUrl: string }>("/auth/2fa/generate");
  return req.data;
}

export async function enable2FA(data: { token: string }): Promise<{ success: boolean }> {
  const req = await api.post<{ success: boolean }>("/auth/2fa/enable", data);
  return req.data;
}

export async function verify2FaLogin(data: { userId: string; token: string }): Promise<{ success: boolean }> {
  const req = await api.post<{ success: boolean }>("/auth/2fa/verify", data);
  return req.data;
}


