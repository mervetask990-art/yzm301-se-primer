# Google Stitch prompt'ları

**Nasıl kullanılır:** stitch.withgoogle.com → yeni proje → **Mobile** seç. Önce "Ortak stil" bloğunu, ardından her ekranın prompt'unu ayrı ayrı yapıştır. Üç ekranı da aynı projede üret ki stil tutarlı kalsın. Beğenmediğin yerleri "Ortak stil"e uygun kısa düzeltmelerle iste (örnek düzeltmeler en altta).

Çıktıları PNG olarak `design/01-giris.png`, `design/02-sahne.png`, `design/03-son.png` adlarıyla kaydet.

---

## Ortak stil (her prompt'un başına ekle)

```
Mobile app, 390x844, Turkish language UI. Calm, focused, night-shift mood — not alarming.
Colors: background #0F1B2D, cards #17263C, selected card #1F3150, thin borders #2A3E5C,
primary button #5FB3A8 with dark text #0F1B2D, accent #F2B266 for highlights and the clock,
lavender #A7A3D9 for tutor and hint elements, success #7BC8A4, danger #E58A7B (soft coral, no bright red).
Text #E8EEF5, secondary text #9FB0C3.
Fonts: Plus Jakarta Sans bold for headings, Inter for body, JetBrains Mono for the clock.
16px card radius, 14px button radius, no drop shadows, generous spacing, 20px side padding.
Primary actions in the bottom half of the screen, touch targets at least 48px.
Minimal line icons. A small lantern motif is the brand symbol.
```

## Ekran 1 — Giriş

```
Onboarding screen for "SE Primer". Top: small lantern icon, title "SE Primer",
subtitle in accent color "Oynanan bir yazılım mühendisliği kitabı".
Short line: "Seni tanıyalım, hikâye sana göre yazılsın."
Three question groups with pill-shaped selectable chips:
1) "Seviyen?" — Yeni başladım · Biraz deneyimliyim · Deneyimliyim
2) "Rolün?" — Backend · Frontend · DevOps · QA
3) "Hedefin?" — Mülakata hazırlık · İşte daha iyi olmak · Merak
Show one chip selected in each group (primary color outline + filled surface).
Bottom: full-width primary button "Nöbete başla".
```

## Ekran 2 — Karar sahnesi

```
Decision scene screen. Top bar: clock "08:00" in monospace accent color on the left,
three progress dots in the middle (first one active, labeled K1 · K2 · K3),
a circular 60-second countdown ring on the right in primary color.
Section label "KARAR 1 · MİMARİ".
Narrative paragraph: "Dün gece yeni sürüm çıktı. 08:00'de randevu ekranı 500 hatası veriyor. 300 hasta bekliyor. Nöbetçi sensin."
A hint card with a 3px lavender left border and a lantern icon, title "Düşünmen gereken",
text: "Geri dönmek her zaman güvenli değildir: yeni sürüm veritabanında neyi değiştirdi?"
Bottom: two large choice cards stacked, each with a round letter badge:
A — "Eski sürüme geri dön" / "Rollback"
B — "Canlıda yama yap" / "Hotfix"
Bottom-right floating round button with a chat icon and label "Tutor'a sor" in lavender.
```

## Ekran 3 — Son

```
Ending screen. Large success-colored title "Sistem ayakta, veri güvende",
under it clock "08:25" in monospace accent color.
A compact path summary card: "K1 Rollback → K2 Smoke test → K3 Maskele" with small check icons.
A card titled "Araştırman gereken noktalar" with accent lantern icon and a wrap of pill chips:
"Expand–contract migration", "Smoke test vs regression", "KVKK madde 12", "Log maskeleme", "Canary deployment".
Small muted line: "Cevaplar burada değil. Bu kavramları araştır, sonra tekrar oyna."
Bottom: full-width primary button "Yeniden oyna" and a secondary text button "Diğer sonu gör".
```

Son B için aynı ekranı şu değişiklikle bir varyant olarak üret:
```
Same layout, title in danger color #E58A7B "Sistem ayakta ama KVKK ihlali", clock "08:25",
path summary ends with "K3 Olduğu gibi gönder" with a soft coral warning icon.
```

---

## Sık kullanılan düzeltmeler

- "Make it calmer: reduce saturation, remove gradients and glow."
- "Increase spacing between cards to 16px and make body text 16px."
- "Move the primary button to the bottom of the screen, full width."
- "Replace any bright red with #E58A7B."
- "Keep all text in Turkish, do not translate."
