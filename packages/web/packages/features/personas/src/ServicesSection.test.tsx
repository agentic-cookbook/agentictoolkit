// @vitest-environment jsdom
//
// Component test for the Save gate in ServicesSection's service editor (task 4 of the
// editable-detail Save wiring): Save must start DISABLED for an already-loaded service and only
// enable once the draft actually differs from what was loaded (dirty && valid), not merely because
// the required fields happen to be filled (the pre-existing bug this task fixes). Only the
// `@agentic-toolkit/data/personas` module boundary is mocked, so the real ServiceEditor/useDirtyDraft
// wiring is exercised, not the transport.
//
// HierarchicalTopicDetail (which ServicesSection renders through) measures its container's
// clientWidth via ResizeObserver to choose wide vs. narrow layout; jsdom's default clientWidth is 0,
// which reads as narrow and would hide the selected leaf's detail pane behind a push-nav this test
// never drives. Force wide mode the same way packages/ui/src/__tests__/hierarchicalTopicDetail.test.tsx
// does — override clientWidth before the first (useLayoutEffect) measurement.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@agentic-toolkit/data/personas", () => ({
  api: {
    templates: vi.fn(),
    services: {
      list: vi.fn(),
      create: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      connect: vi.fn(),
      refreshModels: vi.fn(),
    },
  },
}));

import { ServicesSection } from "./ServicesSection";
import { api, type UserService } from "@agentic-toolkit/data/personas";

const list = vi.mocked(api.services.list);
const patchService = vi.mocked(api.services.patch);

const SERVICE: UserService = {
  id: "svc_1",
  templateId: null,
  providerKind: "openai",
  name: "My OpenAI",
  baseUrl: "https://api.openai.com/v1",
  hasApiKey: true,
  connectStatus: "connected",
  connectError: null,
  lastConnectedAt: null,
  documentationUrl: null,
  statusUrl: null,
  models: [],
  modelsFetchedAt: null,
};

Object.defineProperty(HTMLElement.prototype, "clientWidth", {
  configurable: true,
  get: () => 1200,
});

beforeEach(() => {
  vi.clearAllMocks();
  list.mockResolvedValue([SERVICE]);
});

afterEach(cleanup);

describe("ServicesSection save gate (service editor)", () => {
  it("starts disabled for an unmodified service and enables after one field edit", async () => {
    render(<ServicesSection urlSelection={{ serviceId: SERVICE.id, onSelectService: vi.fn() }} />);

    const save = await screen.findByRole("button", { name: "Save" });
    expect(save).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/name/i), "!");
    expect(save).toBeEnabled();
  });

  it("re-disables Save after a successful save (baseline moves to the saved row)", async () => {
    const saved: UserService = { ...SERVICE, name: "Renamed" };
    patchService.mockResolvedValue(saved);

    render(<ServicesSection urlSelection={{ serviceId: SERVICE.id, onSelectService: vi.fn() }} />);

    const save = await screen.findByRole("button", { name: "Save" });
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: "Renamed" } });
    expect(save).toBeEnabled();

    fireEvent.click(save);
    await waitFor(() =>
      expect(patchService).toHaveBeenCalledWith("svc_1", {
        name: "Renamed",
        baseUrl: SERVICE.baseUrl,
      }),
    );
    await waitFor(() => expect(save).toBeDisabled());
  });
});
