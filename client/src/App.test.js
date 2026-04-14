import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders status dashboard heading", () => {
  render(<App />);
  const heading = screen.getByRole("heading", {
    name: /prasad status/i,
  });
  expect(heading).toBeInTheDocument();
});
