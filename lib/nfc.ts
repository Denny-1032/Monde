import { Platform } from 'react-native';
import NfcManager, { NfcTech, Ndef, NfcEvents, TagEvent } from 'react-native-nfc-manager';

// Monde NFC payment protocol
// NDEF message format: monde://pay?phone={phone}&name={name}&amount={amount}

export interface NfcPayload {
  phone: string;
  name: string;
  amount?: number;
}

const MONDE_URI_PREFIX = 'monde://pay?';

/** Check if device has NFC hardware */
export async function isNfcSupported(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return await NfcManager.isSupported();
  } catch {
    return false;
  }
}

/** Check if NFC is enabled in system settings */
export async function isNfcEnabled(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return await NfcManager.isEnabled();
  } catch {
    return false;
  }
}

/** Initialize NFC manager — call once on mount */
export async function initNfc(): Promise<boolean> {
  try {
    await NfcManager.start();
    return true;
  } catch {
    return false;
  }
}

/** Clean up NFC — call on unmount */
export function cleanupNfc() {
  try {
    NfcManager.setEventListener(NfcEvents.DiscoverTag, null);
    NfcManager.setEventListener(NfcEvents.SessionClosed, null);
    NfcManager.cancelTechnologyRequest().catch(() => {});
    NfcManager.unregisterTagEvent().catch(() => {});
  } catch {}
}

/** Encode a Monde payment payload into an NDEF message */
export function encodePayload(payload: NfcPayload): number[] {
  const params = new URLSearchParams();
  params.set('phone', payload.phone);
  params.set('name', payload.name);
  if (payload.amount !== undefined) {
    params.set('amount', payload.amount.toString());
  }
  const uri = `${MONDE_URI_PREFIX}${params.toString()}`;
  return Ndef.encodeMessage([Ndef.textRecord(uri)]);
}

/** Decode an NDEF tag into a Monde payment payload */
export function decodePayload(tag: TagEvent): NfcPayload | null {
  try {
    if (!tag.ndefMessage || tag.ndefMessage.length === 0) return null;

    for (const record of tag.ndefMessage) {
      const text = Ndef.text.decodePayload(new Uint8Array(record.payload));
      if (text && text.includes(MONDE_URI_PREFIX)) {
        const queryString = text.split(MONDE_URI_PREFIX)[1];
        const params = new URLSearchParams(queryString);
        const phone = params.get('phone');
        const name = params.get('name');
        if (!phone || !name) return null;
        const amountStr = params.get('amount');
        return {
          phone,
          name,
          amount: amountStr ? parseFloat(amountStr) : undefined,
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Write a Monde payment payload to an NFC tag via NDEF technology request */
export async function writeNfcTag(payload: NfcPayload): Promise<{ success: boolean; error?: string }> {
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef);
    const bytes = encodePayload(payload);
    await NfcManager.ndefHandler.writeNdefMessage(bytes);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to write NFC tag' };
  } finally {
    NfcManager.cancelTechnologyRequest().catch(() => {});
  }
}

/** 
 * Start listening for NFC tags (receiver mode).
 * Uses setEventListener + registerTagEvent pattern.
 * Cancel by calling cleanupNfc().
 */
export function listenForNfcTag(
  onDiscovered: (payload: NfcPayload) => void,
  onError?: (error: string) => void,
) {
  NfcManager.setEventListener(NfcEvents.DiscoverTag, (tag: TagEvent) => {
    const payload = decodePayload(tag);
    if (payload) {
      onDiscovered(payload);
    } else {
      onError?.('Not a valid Monde payment tag');
    }
    NfcManager.unregisterTagEvent().catch(() => {});
  });

  NfcManager.setEventListener(NfcEvents.SessionClosed, () => {
    // Session ended (user cancelled or tag processed)
  });

  NfcManager.registerTagEvent({
    invalidateAfterFirstRead: true,
    alertMessage: 'Hold your phone near the other device',
  }).catch((e: any) => {
    onError?.(e?.message || 'Failed to start NFC listener');
  });
}

/**
 * Read an NFC tag using technology request (more reliable for NDEF).
 * Returns the decoded payload or null.
 */
export async function readNfcTag(): Promise<{ payload: NfcPayload | null; error?: string }> {
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef, {
      alertMessage: 'Hold your phone near the sender\'s device',
    });
    const tag = await NfcManager.getTag();
    if (!tag) return { payload: null, error: 'No tag found' };
    const payload = decodePayload(tag);
    return { payload };
  } catch (e: any) {
    return { payload: null, error: e?.message || 'NFC read failed' };
  } finally {
    NfcManager.cancelTechnologyRequest().catch(() => {});
  }
}

/**
 * Monde NFC Flow:
 * 1. SENDER sets amount, enters "sending" mode → writes NDEF with their phone+name+amount
 * 2. RECEIVER enters "receiving" mode → listens for NDEF tags
 * 3. When receiver detects sender's tag → reads payload → processes payment via Supabase RPC
 * 4. Both devices show success/failure
 *
 * Fallback: If NFC is not available, the app falls back to QR code payment flow.
 */

/** Open NFC settings (Android only) */
export async function openNfcSettings(): Promise<void> {
  if (Platform.OS === 'android') {
    try {
      await NfcManager.goToNfcSetting();
    } catch {}
  }
}

export { NfcManager, NfcTech, Ndef, NfcEvents };
export type { TagEvent };
