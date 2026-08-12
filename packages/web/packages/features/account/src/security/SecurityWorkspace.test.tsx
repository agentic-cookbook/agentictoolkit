import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@agentic-toolkit/auth", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  useAuth: () => ({ user: { email: "mike@example.com" }, isAuthenticated: true }),
}));

// SecurityWorkspace queries MFA status via useQuery, which throws "No QueryClient set" without a
// real QueryClientProvider ancestor — the brief's literal test (no provider) fails with exactly
// that error before ever reaching the heading assertion. Stub the transport boundary
// `getMfaStatus` calls through (`authedJson`, imported straight from `@agentic-toolkit/auth/client`)
// and wrap in a real `QueryClientProvider`, the same seam `ArchivedPanel.test.tsx` in this
// package already established for the identical reason.
const { authedJson } = vi.hoisted(() => ({ authedJson: vi.fn() }));
vi.mock("@agentic-toolkit/auth/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@agentic-toolkit/auth/client")>()),
  authedJson,
}));

import { SecurityWorkspace } from "./SecurityWorkspace";

function renderWorkspace() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SecurityWorkspace />
    </QueryClientProvider>,
  );
}

describe("SecurityWorkspace", () => {
  it("renders its own section heading rather than relying on a wrapper title", () => {
    authedJson.mockResolvedValue({
      sms: false,
      totp: false,
      webauthn: false,
      totpPending: false,
      recoveryRemaining: 0,
      preferredMethod: null,
    });
    renderWorkspace();
    expect(screen.getByRole("heading", { name: /security/i })).toBeInTheDocument();
  });
});
