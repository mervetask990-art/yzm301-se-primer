# Veri sözlüğü — `data/oturumlar.csv`

**Bir satır = bir karar.** Bir oturum (nöbet) 3 karardan oluşur (K1 Mimari, K2 Test, K3 KVKK), yani tam bir oturum 3 satırdır.

Gerçek satırlar oyunun **veri toplama modu**ndan gelir (`app/src/telemetry.ts`): her karar tarayıcıda kaydedilir, giriş ekranındaki **"CSV indir"** ile dışa aktarılır. Sentetik satırlar `data/sentetik.py` ile üretilir (kural ve tohum: `README.md`).

## Gizlilik (KVKK)

- Ad, e-posta, telefon, cihaz kimliği, konum, IP, tarayıcı bilgisi **toplanmaz**. Oyuncunun girişte yazdığı ad CSV'ye **girmez**.
- `oturum_id` ve `oyuncu_id` rastgele üretilir (`crypto.randomUUID`); bir kişiyle eşleştirilemez. "Günlüğü sıfırla" yeni bir `oyuncu_id` verir.
- Zaman bilgisi yalnızca gün düzeyindedir (`tarih`), saat tutulmaz.
- Veri, oyuncu "CSV indir"e basmadıkça cihazdan çıkmaz.

## Sütunlar

### Kimlik ve bağlam (model girdisi değil)

| Sütun | Tür | Birim / değerler | Anlamı |
|---|---|---|---|
| `oturum_id` | metin | `s-` + 10 karakter | Bir nöbetin rastgele kimliği. Eğitimde train/test bölmesi buna göre yapılır (aynı oturum iki tarafa düşmez). |
| `oyuncu_id` | metin | `o-` + 10 karakter | Aynı cihazdaki oyuncunun rastgele kimliği; kaç farklı kişiden veri geldiğini saymak için. |
| `kaynak` | kategori | `gercek` \| `sentetik` | Satır gerçek bir oyuncudan mı, üreticiden mi geldi. **Zorunlu.** |
| `tarih` | tarih | `YYYY-AA-GG` | Kararın verildiği gün (saat yok). |
| `karar_id` | kategori | `K1` \| `K2` \| `K3` | Senaryodaki karar. |
| `seviye` | kategori | `new` \| `mid` \| `senior` | Oyuncunun girişte seçtiği seviye. |

### Model girdileri (sıra `model/config.json → features` ile aynı)

Hepsi **kararın başında** ölçülür; o kararda sonradan olan hiçbir şey girdiye karışmaz.

| Sütun | Tür | Birim / aralık | Anlamı |
|---|---|---|---|
| `karar_no` | tam sayı | 1–3 | Nöbetteki kaçıncı karar. |
| `konu_puani` | tam sayı | 0–100 puan | Kararın konusundaki beceri puanı (K1 deploy, K2 test, K3 güvenlik). Ölçülmemişse seviyeden başlar: yeni 15, orta 45, deneyimli 70. |
| `sure_baskisi` | ikili | 0/1 | v1 kurallarına göre bu kararda geri sayım açık mı (konu puanı ≥ 70). |
| `onceki_karar_suresi_sn` | ondalık | saniye (0.1) | Bu nöbette bir önceki kararın ekranda kaldığı süre. K1'de 0. |
| `onceki_gidip_gelme` | tam sayı | adet | Bir önceki kararda imlecin/parmağın A ve B seçenekleri arasında kaç kez yer değiştirdiği (tereddüt ölçüsü). K1'de 0. |
| `onceki_riskli_sayisi` | tam sayı | 0–2 adet | Bu nöbette şimdiye kadar B seçilen veya süresi dolan karar sayısı. |
| `ipucu_sayisi` | tam sayı | 0–2 adet | Bu nöbette şimdiye kadar açılan ipucu sayısı (yeni seviyede her karar ipucu açık sayılır). |
| `tutor_mesaj_sayisi` | tam sayı | adet | Bu nöbette şimdiye kadar tutor'a gönderilen soru sayısı. |
| `gecmis_riskli_oran` | ondalık | 0–1 oran | Bu cihazdaki önceki nöbetlerin tüm kararlarında riskli (B / süre aşımı) olanların oranı. İlk nöbette 0. |

### Sonuç ve etiket (model girdisi değil)

| Sütun | Tür | Birim / değerler | Anlamı |
|---|---|---|---|
| `secim` | kategori | `A` \| `B` | Oyuncunun seçimi (süre dolarsa `B`). |
| `sure_doldu` | ikili | 0/1 | Süre dolduğu için B mi uygulandı. |
| `karar_suresi_sn` | ondalık | saniye (0.1) | Bu kararın ekranda kaldığı süre. **Girdi olamaz** (kararın sonunda bilinir, sızıntı olur); bir sonraki satırın `onceki_karar_suresi_sn`'i olur. |
| `gidip_gelme` | tam sayı | adet | Bu karardaki A↔B geçişi. **Girdi olamaz**; bir sonraki satırın `onceki_gidip_gelme`'si olur. |
| `model_p` | ondalık | 0–1, boş olabilir | Kararın başında modelin verdiği zorlanma olasılığı. Model devreye girmeden önce toplanan satırlarda boş. |
| `destek_modu` | ikili | 0/1 | Model eşiği geçti ve desteği (ipucu açık, sayaç yok) açtı mı. |
| **`zorlandi`** | ikili | 0/1 | **Etiket.** `secim = B` **veya** `sure_doldu = 1` ise 1. |

## Bilinen sınırlar

- `onceki_gidip_gelme` dokunmatik ekranda yalnızca parmağın seçeneğe değdiği anları sayar; fare ile dokunma arasında ölçek farkı olabilir.
- `destek_modu = 1` olan satırlarda etiket, modelin kendi müdahalesinden etkilenmiştir (ipucu görmek B seçme olasılığını düşürür). Sonraki sürümleri eğitirken bu satırlar ayrı değerlendirilmelidir.
- Gerçek oturumlar aynı sınıftan arkadaşlardan gelir; genel öğrenci kitlesini temsil etmez.
