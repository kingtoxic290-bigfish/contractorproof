import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it("renders the match label with an accessible status name", () => {
    render(<StatusBadge status="MATCH" />);

    expect(screen.getByText("Match")).toBeInTheDocument();
    expect(screen.getByLabelText("Match")).toBeInTheDocument();
  });
});