# DESIGN.md — SE Primer tasarım dili

**His:** Gece nöbeti ama panik değil. Karanlık ve sakin bir oda, elinde bir fener. Kriz anlatılır; arayüz bağırmaz. Kullanıcı düşünebilmeli.

## Renk token'ları

| Token | Hex | Kullanım |
|---|---|---|
| `--bg` | `#0F1B2D` | Uygulama zemini (gece mavisi) |
| `--surface` | `#17263C` | Kartlar, paneller |
| `--surface-2` | `#1F3150` | Seçili kart, hover |
| `--line` | `#2A3E5C` | İnce kenarlıklar, ayraçlar |
| `--primary` | `#5FB3A8` | Ana buton, ilerleme çubuğu (adaçayı-turkuaz) |
| `--primary-ink` | `#0F1B2D` | Ana buton üstündeki metin |
| `--accent` | `#F2B266` | Fener, vurgu kelimeleri, saat |
| `--calm` | `#A7A3D9` | Tutor balonu ve ipucu kartı kenarı (lavanta) |
| `--success` | `#7BC8A4` | Son A |
| `--danger` | `#E58A7B` | Son B, süre son 10 saniye (yumuşak mercan) |
| `--text` | `#E8EEF5` | Ana metin |
| `--muted` | `#9FB0C3` | İkincil metin, etiketler |

Kontrast: `--text` / `--bg` 14.8:1, `--muted` / `--bg` 7.8:1, `--primary-ink` / `--primary` 7.0:1, `--danger` / `--bg` 6.8:1 (hepsi WCAG AA üstü).

Kırmızı yoktur. Hata ve tehlike `--danger` mercanıyla, düşük doygunlukta anlatılır.

## Tipografi

- Başlık: **Plus Jakarta Sans** 700, 28 / 22 / 18 px
- Metin: **Inter** 400–500, 16 px, satır yüksekliği 1.55
- Saat ve sayaç: **JetBrains Mono** 500, `--accent`
- Türkçe karakterler (ç ğ ı İ ö ş ü) her iki fontta da desteklenir.

## Şekil ve hareket

- Köşe yarıçapı: kart 16 px, buton 14 px, çip 999 px
- Boşluk ölçeği: 4 · 8 · 12 · 16 · 24 · 32 px; ekran kenar boşluğu 20 px
- Gölge yok; derinlik `--surface` katmanları ve 1 px `--line` kenarlıkla
- Geçişler: 200 ms `ease-out`, sahne geçişinde 8 px yukarı kayma + opaklık. `prefers-reduced-motion` açıksa hareket kapanır.
- Dokunma alanı en az 48 px; birincil aksiyonlar ekranın **alt yarısında** (tek elle kullanım).

## Bileşenler

- **Seçim kartı:** `--surface`, sol tarafta büyük harf rozet (A / B), başlık + tek satır açıklama. Seçilince `--surface-2` ve `--primary` kenarlık.
- **İpucu kartı:** `--surface`, sol kenarda 3 px `--calm` çizgi, küçük fener ikonu, başlık "Düşünmen gereken".
- **Sonuç kartları (üçlü):** "Ne oldu" (nötr), "Neden oldu" (nötr), "Araştırman gereken noktalar" (`--accent` ikonlu, madde listesi çip gibi).
- **Tutor paneli:** Alttan açılan sayfa (bottom sheet), balonlar `--calm` %15 opaklık zeminli, giriş alanı en altta.
- **Sayaç:** Üst çubukta dairesel halka, `--primary`; son 10 saniyede yumuşakça `--danger`'a döner.
- **İlerleme:** Üstte 3 nokta (K1 · K2 · K3), tamamlanan `--primary`.

## Ekranlar

1. **Giriş:** Üstte başlık "SE Primer" ve `--accent` renkli alt başlık "Oynanan bir kitap". Üç soru grubu çip olarak: Seviye, Rol, Hedef. Altta tam genişlik "Nöbete başla" butonu (üçü seçilmeden pasif).
2. **Sahne:** Üst çubuk: saat (`08:00`, mono, amber), ilerleme noktaları, varsa sayaç. Orta: kısa anlatı paragrafı, varsa ipucu kartı. Alt: iki seçim kartı + sağ altta yuvarlak "Tutor'a sor" butonu.
3. **Sonuç / Son:** Sonuç ekranında üç kart + "Devam". Son ekranda büyük başlık (`--success` veya `--danger`), saat, yolun özeti (K1/K2/K3 seçimleri), tüm araştırma noktaları birleşik liste, "Yeniden oyna" butonu.

## Stitch çıktıları

Stitch ekran görüntüleri `design/` klasöründedir: `01-giris.png`, `02-sahne.png`, `03-son.png` (Son A), `03-son-b.png` (Son B). Stitch'in ürettiği HTML `design/stitch-code/`, kendi tasarım sistemi ("Nocturne Engineer") `design/stitch-DESIGN.md` içindedir.

**Stitch'ten sapmalar (uygulamada bu dosyadaki token'lar geçerlidir):**
- Stitch, Material tonlarına göre `--primary`'yi `#81D5CA`, zemini `#071425` olarak açtı/koyulaştırdı; uygulama `#5FB3A8` ve `#0F1B2D` kullanır.
- Son B'deki uyarı ikonu zemini Stitch'te koyu kırmızı (`#93000A`); uygulamada `--danger` (`#E58A7B`) %15 opaklık zemin kullanılır.
- Giriş ekranındaki fener logosu Stitch'in geçici bir görseline bağlı; uygulamada satır içi SVG fener ikonu kullanılır.
- Bazı dolgu metinleri senaryoya uymuyor ("ödeme yolları", "müşteri", "üçüncü taraf servis"); uygulama metinleri yalnızca `scenario/scenario.json`'dan gelir.
