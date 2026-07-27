# Bundled Font Licences

All fonts in this directory are licensed under the SIL Open Font License 1.1
(<https://scripts.sil.org/OFL>).

| Font | Source |
|---|---|
| Inter, Space Grotesk, JetBrains Mono, Poppins, Playfair Display, Outfit, Orbitron, Bebas Neue | Google Fonts |
| Noto Sans Arabic, Noto Kufi Arabic | notofonts/arabic release archives |
| Tajawal, Amiri | Google Fonts |
| Noto Color Emoji (COLRv1) | googlefonts/noto-emoji |

Static instances are vendored deliberately: @napi-rs/canvas ignores the variable
`wght` axis while browsers honour it, which would desynchronise the dashboard
preview from the bot's output.
