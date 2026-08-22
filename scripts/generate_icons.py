import os
import struct
import zlib

def create_png(width, height, r=202, g=89, b=36):
    # Minimal raw uncompressed PNG generator
    def png_chunk(chunk_type, data):
        return struct.pack('>I', len(data)) + chunk_type + data + struct.pack('>I', zlib.crc32(chunk_type + data) & 0xffffffff)

    header = b'\x89PNG\r\n\x1a\n'
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    ihdr_chunk = png_chunk(b'IHDR', ihdr)

    # Raw scanlines with filter byte 0
    raw_scanlines = bytearray()
    for _ in range(height):
        raw_scanlines.append(0) # filter 0
        for _ in range(width):
            raw_scanlines.extend([r, g, b])

    compressed = zlib.compress(bytes(raw_scanlines))
    idat_chunk = png_chunk(b'IDAT', compressed)
    iend_chunk = png_chunk(b'IEND', b'')

    return header + ihdr_chunk + idat_chunk + iend_chunk

def create_ico(png_data, width=32, height=32):
    # Standard ICO header with embedded PNG
    ico_header = struct.pack('<HHH', 0, 1, 1) # reserved, type (1=ico), count
    # Directory entry: width, height, colors, reserved, planes, bpp, size, offset
    w_byte = width if width < 256 else 0
    h_byte = height if height < 256 else 0
    data_size = len(png_data)
    data_offset = 6 + 16 # 6 header + 16 dir entry
    ico_dir = struct.pack('<BBBBHHII', w_byte, h_byte, 0, 0, 1, 32, data_size, data_offset)
    return ico_header + ico_dir + png_data

def main():
    icons_dir = os.path.join(os.path.dirname(__file__), '..', 'apps', 'desktop', 'src-tauri', 'icons')
    os.makedirs(icons_dir, exist_ok=True)

    sizes = [
        ('32x32.png', 32, 32),
        ('128x128.png', 128, 128),
        ('128x128@2x.png', 256, 256),
        ('Square30x30Logo.png', 30, 30),
        ('Square44x44Logo.png', 44, 44),
        ('Square71x71Logo.png', 71, 71),
        ('Square89x89Logo.png', 89, 89),
        ('Square107x107Logo.png', 107, 107),
        ('Square142x142Logo.png', 142, 142),
        ('Square150x150Logo.png', 150, 150),
        ('Square284x284Logo.png', 284, 284),
        ('Square310x310Logo.png', 310, 310),
        ('StoreLogo.png', 50, 50),
        ('icon.png', 256, 256),
    ]

    for filename, w, h in sizes:
        png_bytes = create_png(w, h)
        with open(os.path.join(icons_dir, filename), 'wb') as f:
            f.write(png_bytes)

    # Create icon.ico (using 32x32 PNG)
    ico_bytes = create_ico(create_png(32, 32), 32, 32)
    with open(os.path.join(icons_dir, 'icon.ico'), 'wb') as f:
        f.write(ico_bytes)

    # Create dummy icon.icns
    with open(os.path.join(icons_dir, 'icon.icns'), 'wb') as f:
        f.write(b'icns' + struct.pack('>I', 8))

    print(f"Generated icons in {icons_dir}")

if __name__ == '__main__':
    main()
