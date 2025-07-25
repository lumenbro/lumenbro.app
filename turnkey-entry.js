import { TurnkeyBrowserClient } from '@turnkey/sdk-browser';
import { IframeStamper } from '@turnkey/iframe-stamper';
import { getWebAuthnAttestation } from '@turnkey/http';

window.Turnkey = {
  TurnkeyBrowserClient,
  IframeStamper,
  getWebAuthnAttestation
};
