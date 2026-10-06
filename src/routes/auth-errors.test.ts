import { describe, expect, it } from "vitest";
import { formatAuthError } from "./auth";

describe("formatAuthError", () => {
  it("formats invalid credentials and invalid_grant into clear, honest messages", () => {
    expect(formatAuthError("Invalid login credentials")).toBe(
      "Incorrect email or password. Please check your details and try again.",
    );
    expect(formatAuthError("invalid_grant: error verifying credentials")).toBe(
      "Incorrect email or password. Please check your details and try again.",
    );
  });

  it("informs user honestly when email is not yet confirmed", () => {
    expect(formatAuthError("Email not confirmed")).toBe(
      "Please confirm your email before signing in. Check your inbox or spam folder.",
    );
  });

  it("handles duplicate user registration honestly", () => {
    expect(formatAuthError("User already registered")).toBe(
      "An account with this email already exists. Try signing in instead.",
    );
    expect(formatAuthError("account with this email already exists")).toBe(
      "An account with this email already exists. Try signing in instead.",
    );
  });

  it("handles short password errors", () => {
    expect(formatAuthError("Password should be at least 6 characters")).toBe(
      "Password must be at least 6 characters long.",
    );
  });

  it("handles rate limiting errors honestly", () => {
    expect(formatAuthError("rate limit exceeded")).toBe(
      "Too many attempts. Please wait a moment and try again.",
    );
    expect(formatAuthError("Too many requests from this IP")).toBe(
      "Too many attempts. Please wait a moment and try again.",
    );
  });

  it("handles network connection and fetch failures honestly", () => {
    expect(formatAuthError("Failed to fetch")).toBe(
      "Network connection issue. Please check your internet connection or continue as guest.",
    );
    expect(formatAuthError("Connection refused by peer")).toBe(
      "Network connection issue. Please check your internet connection or continue as guest.",
    );
  });

  it("handles unconfigured authentication service honestly", () => {
    expect(formatAuthError("Authentication service is not configured")).toBe(
      "Authentication service is currently not configured or unavailable. Please try again later or continue as a guest.",
    );
    expect(formatAuthError("Missing Firebase credentials")).toBe(
      "Authentication service is currently not configured or unavailable. Please try again later or continue as a guest.",
    );
  });

  it("handles Firebase unauthorized domain error clearly", () => {
    expect(formatAuthError("Firebase: Error (auth/unauthorized-domain).")).toBe(
      "This domain is not authorized in Firebase Console. Please add this domain under Firebase Authentication > Settings > Authorized domains.",
    );
  });

  it("preserves unmapped backend error messages without generating phantom fake accounts", () => {
    const raw = "Database timeout error #42";
    expect(formatAuthError(raw)).toBe(raw);
  });
});
