import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PriceSelect } from "../PriceSelect";

const PRICES = [
  { id: "price_1", productId: "prod_1", productName: "Pro", unitAmount: 2500, currency: "usd", interval: "month" },
];

describe("PriceSelect", () => {
  it("offers the loaded prices by product name and amount", () => {
    render(<PriceSelect value="" onChange={vi.fn()} prices={PRICES} error={null} errorStatus={null} />);
    expect(screen.getByRole("option", { name: /Pro/ })).toBeInTheDocument();
  });

  // The rule this component exists for: an empty select would say "your Stripe account has no
  // prices", which is a claim about Stripe inferred from OUR failure to read it.
  it("degrades to a text input and names the reason on a 409", () => {
    render(<PriceSelect value="" onChange={vi.fn()} prices={null} error="nope" errorStatus={409} />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText(/Stripe/i)).toBeInTheDocument();
  });

  it("points at the Setup switch on a 404, not at Stripe", () => {
    render(<PriceSelect value="" onChange={vi.fn()} prices={null} error="nope" errorStatus={404} />);
    expect(screen.getByText(/not enabled/i)).toBeInTheDocument();
  });

  it("keeps an unresolvable stored price visible rather than blank", () => {
    render(<PriceSelect value="price_gone" onChange={vi.fn()} prices={PRICES} error={null} errorStatus={null} />);
    expect(screen.getByText(/missing in Stripe/i)).toBeInTheDocument();
  });
});
