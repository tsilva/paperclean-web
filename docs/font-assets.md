# Inter font asset

The first render uses a Latin subset of Inter for common UI text and accented
Latin filenames. It retains the original 100–900 weight range and OpenType
features. The full Inter font family remains available for other characters.

The original is the Latin Inter 4.001 WOFF2 served by PaperClean at
`2f298e194628ed91aa020b30d0b501dc280af016`. Both the original and the subset use
Inter's [SIL Open Font License](../app/fonts/OFL.txt).

- [Original Latin WOFF2](https://paperclean.tsilva.eu/_next/static/immutable/media/07c7676b89ed2778-s.p.45535valc9rzk.woff2)
- SHA-256 `c940764593d0fe5d596be327ca7558855e018039fb78509aa21921fd3644c3e4`
- Upstream revision `66647c0bb`

To regenerate the subset, run FontTools `pyftsubset` on the verified original
with the `unicode-range` from `app/layout.tsx`, `--flavor=woff2`,
`--layout-features='*'`, and `--name-IDs='*'`. Verify the character map, weight
range and glyph metrics against the original before replacing the asset.
