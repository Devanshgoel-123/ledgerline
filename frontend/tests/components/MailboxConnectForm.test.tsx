import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MailboxConnectForm } from "@/components/MailboxConnectForm";
import type { MailStatus } from "@/lib/api/types";

const connectMailbox = vi.fn();
vi.mock("@/lib/useApi", () => ({ useApi: () => ({ connectMailbox }) }));

const connected: MailStatus = {
  connected: true,
  needsPassword: false,
  email: "me@gmail.com",
  provider: "gmail",
  host: "imap.gmail.com",
  port: 993,
  poolingEnabled: false,
};

describe("MailboxConnectForm", () => {
  beforeEach(() => {
    connectMailbox.mockReset();
  });

  it("walks through getting a Gmail app password and promises the password stays local", () => {
    render(<MailboxConnectForm current={null} onConnected={() => {}} />);
    expect(screen.getByRole("link", { name: "myaccount.google.com/apppasswords" })).toHaveAttribute(
      "href",
      "https://myaccount.google.com/apppasswords",
    );
    expect(screen.getByText(/stored only on this computer/)).toBeInTheDocument();
    expect(screen.getByText(/never changes your/)).toBeInTheDocument();
  });

  it("warns that Outlook may not work", () => {
    render(<MailboxConnectForm current={null} onConnected={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Outlook" }));
    expect(screen.getByRole("note")).toHaveTextContent(/May not work: Microsoft is ending app passwords/);
  });

  it("asks a custom mailbox for its server and sends it with the password", async () => {
    connectMailbox.mockResolvedValue({ ...connected, provider: "custom", email: "me@example.com" });
    const onConnected = vi.fn();
    render(<MailboxConnectForm current={null} onConnected={onConnected} />);
    fireEvent.click(screen.getByRole("button", { name: "Other" }));
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: " me@example.com " } });
    fireEvent.change(screen.getByLabelText("IMAP server"), { target: { value: "imap.example.com" } });
    fireEvent.change(screen.getByLabelText("App password"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Check and connect" }));
    await waitFor(() => expect(onConnected).toHaveBeenCalled());
    expect(connectMailbox).toHaveBeenCalledWith({
      email: "me@example.com",
      provider: "custom",
      password: "secret",
      host: "imap.example.com",
      port: 993,
    });
  });

  it("shows the mail server's answer when the password is refused", async () => {
    connectMailbox.mockRejectedValue(new Error("The email address or app password was not accepted."));
    render(<MailboxConnectForm current={null} onConnected={() => {}} />);
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "me@gmail.com" } });
    fireEvent.change(screen.getByLabelText("App password"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Check and connect" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/not accepted/);
  });

  it("asks a mailbox carried over from Google sign-in for an app password", () => {
    render(
      <MailboxConnectForm
        current={{ ...connected, connected: false, needsPassword: true }}
        onConnected={() => {}}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(/no longer signs in with Google/);
    expect(screen.getByLabelText("Email address")).toHaveValue("me@gmail.com");
  });
});
