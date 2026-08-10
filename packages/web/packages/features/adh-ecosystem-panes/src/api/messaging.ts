"use client";

// Per-ecosystem messaging (the promoted admin Messaging tool). Each product/ecosystem
// sends via ITS OWN connected Postmark/Twilio integration through the backend's
// /messaging/ecosystems/:id/{status,log,send} routes. Templates are shared + static.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { enc } from "@agentic-toolkit/data";
import type { RequestBody, SuccessBody } from "@agentic-toolkit/adh-api-types";
import { authedJson } from "@agentic-toolkit/auth/client";

export type MessagingStatus = SuccessBody<"/messaging/ecosystems/{id}/status", "get">;
export type MessageLogPage = SuccessBody<"/messaging/ecosystems/{id}/log", "get">;
export type MessageLogEntry = MessageLogPage["items"][number];
export type SendMessageRequest = RequestBody<"/messaging/ecosystems/{id}/send", "post">;
export type SendMessageResult = SuccessBody<"/messaging/ecosystems/{id}/send", "post">;
export type MessagingTemplateList = SuccessBody<"/messaging/templates", "get">;

const base = (ecoId: string) => `/api/messaging/ecosystems/${enc(ecoId)}`;

export function useMessagingStatus(ecosystemId?: string) {
  return useQuery({
    queryKey: ["messaging", ecosystemId, "status"],
    queryFn: () => authedJson<MessagingStatus>(`${base(ecosystemId as string)}/status`),
    enabled: ecosystemId != null,
  });
}

export function useMessagingTemplates() {
  return useQuery({
    queryKey: ["messaging", "templates"],
    queryFn: () => authedJson<MessagingTemplateList>("/api/messaging/templates"),
  });
}

export function useMessageLog(ecosystemId: string | undefined, page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ["messaging", ecosystemId, "log", page, pageSize],
    queryFn: () =>
      authedJson<MessageLogPage>(
        `${base(ecosystemId as string)}/log?page=${page}&pageSize=${pageSize}`,
      ),
    enabled: ecosystemId != null,
  });
}

export function useSendMessage(ecosystemId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SendMessageRequest) =>
      authedJson<SendMessageResult>(`${base(ecosystemId as string)}/send`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["messaging", ecosystemId] }),
  });
}
