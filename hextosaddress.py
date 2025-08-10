import base64
import binascii
import crcmod  # pip install crcmod (for checksum)

def raw_hex_to_stellar_secret(raw_hex: str) -> str:
    # Step 1: Decode hex to bytes (strip '0x' if present)
    if raw_hex.startswith('0x'):
        raw_hex = raw_hex[2:]
    seed_bytes = binascii.unhexlify(raw_hex)
    if len(seed_bytes) != 32:
        raise ValueError("Invalid raw key length; must be 32 bytes.")

    # Step 2: Prepend version byte (0x90 for secret seeds)
    versioned = b'\x90' + seed_bytes  # 33 bytes

    # Step 3: Compute CRC16-XMODEM checksum
    crc16_xmodem = crcmod.predefined.mkPredefinedCrc('crc-16-xmodem')
    checksum = crc16_xmodem(versioned).to_bytes(2, 'big')  # 2 bytes

    # Step 4: Append checksum → 35 bytes
    payload = versioned + checksum

    # Step 5: Base32 encode (RFC4648, no padding, uppercase)
    base32_encoded = base64.b32encode(payload).decode('utf-8').rstrip('=')

    return base32_encoded

# Example usage
raw_key = "0xcd0d01c473a4669a1100897f74f13f2dd2ee417e3730b2794e4489fd3b94ea1d"
stellar_secret = raw_hex_to_stellar_secret(raw_key)
print(stellar_secret)  # Outputs: SDGQ2AOEOOSGNGQRACEX65HRH4W5F3SBPY3TBMTZJZCIT7J3STVB27S7