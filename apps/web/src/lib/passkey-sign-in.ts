import {
  type PublicKeyCredentialRequestOptionsJSON,
  WebAuthnError,
  startAuthentication,
} from "@simplewebauthn/browser";

import { getErrorMessage } from "./error-message";

async function parseJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function signInWithPasskey() {
  const optionsResponse = await fetch(
    "/api/auth/passkey/generate-authenticate-options",
    {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    }
  );
  const optionsPayload = await parseJson(optionsResponse);

  if (!optionsResponse.ok) {
    return {
      data: null,
      error: {
        message: getErrorMessage(
          optionsPayload,
          "Unable to start passkey sign-in"
        ),
      },
    };
  }

  try {
    const credentialResponse = await startAuthentication({
      optionsJSON: optionsPayload as PublicKeyCredentialRequestOptionsJSON,
    });

    const verifyResponse = await fetch("/api/auth/passkey/verify-authentication", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      credentials: "include",
      cache: "no-store",
      body: JSON.stringify({
        response: credentialResponse,
      }),
    });
    const verifyPayload = await parseJson(verifyResponse);

    if (!verifyResponse.ok) {
      return {
        data: null,
        error: {
          message: getErrorMessage(
            verifyPayload,
            "Unable to sign in with passkey"
          ),
        },
      };
    }

    return {
      data: verifyPayload,
      error: null,
    };
  } catch (error) {
    if (
      error instanceof WebAuthnError ||
      (error instanceof DOMException && error.name === "NotAllowedError")
    ) {
      return {
        data: null,
        error: {
          message: "Passkey request was cancelled or not allowed.",
        },
      };
    }

    return {
      data: null,
      error: {
        message: getErrorMessage(error, "Unable to sign in with passkey"),
      },
    };
  }
}
