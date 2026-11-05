"""data/oturumlar.csv'yi üretir: gerçek oturumlar + sentetik oturumlar.

    python data/veri_hazirla.py

1) data/gercek/*.csv  → oyunun "CSV indir" çıktıları (kaynak=gercek), olduğu gibi alınır.
2) Sentetik üretici   → kaynak=sentetik, sabit tohum (TOHUM=42), kural aşağıda.

SENTETİK ÜRETİCİ KURALI v2.1 (README.md'de de yazılı; neden değişti: spec.md §8.5)
----------------------------------------------------------------------------------
Her sentetik oyuncunun gizli bir "kararsızlık" eğilimi vardır: z ~ N(0, 1). Oyuncu 1–6 nöbet oynar.
Oyun kuralları uygulamadakiyle aynıdır (konu puanı, kademe, 60/45 sn sayaç, ipucu, puan güncellemesi).

Her kararda:
  karar süresi   t   ~ LogNormal(log(9) + 0.45·z + 0.6·(1 − puan/100) + 0.25·[karar 3], 0.45)  saniye
  gidip gelme    g   ~ Poisson(0.6 + 0.3·|z| + 0.3·[ipucu açık])        (etiketle yönlü bağı yok — §8.5/4)
  tutor sorusu       ~ Poisson(0.15 + 0.25·max(z, 0))
  ipucu (gelişen)    ~ Bernoulli(0.25 + 0.2·[z > 0])
  keşif              = 0.35·(nöbet sırası, 0'dan) + 1.5·(puan − 50)/100      (§8.5/2: tekrar oynayan diğer sonu merak eder)
  zorlanma logiti    = −0.5 + 0.8·z + keşif − 1.1·[önceki karar B]           (§8.5/1: toparlanma)
                       + 0.08·(önceki karar süresi − 9) − 0.4·[ipucu açık] + ε,  ε ~ N(0, 0.8)   (§8.5/3)
  zorlandi           = Bernoulli(σ(logit));  sayaç varsa ve t > süre ise süre doldu → zorlandi = 1
Model z'yi görmez; z yalnızca önceki kararın süresi, gidip gelme, tutor kullanımı ve geçmiş
riskli oran üzerinden dolaylı olarak izlenebilir. Bu bilinçli bir varsayımdır (bkz. model kartı → sınırlar).
"""
from __future__ import annotations

import sys as _sys

# Windows konsolu (cp1254) ✓/✗ karakterlerini yazamaz
if hasattr(_sys.stdout, "reconfigure"):
    _sys.stdout.reconfigure(encoding="utf-8")

import glob
import math
from pathlib import Path

import numpy as np
import pandas as pd

TOHUM = 42
SENTETIK_OYUNCU = 180
BURASI = Path(__file__).resolve().parent
CIKTI = BURASI / "oturumlar.csv"

FEATURES = [
    "karar_no", "konu_puani", "sure_baskisi", "onceki_karar_suresi_sn", "onceki_gidip_gelme",
    "onceki_riskli_sayisi", "ipucu_sayisi", "tutor_mesaj_sayisi", "gecmis_riskli_oran",
]
SUTUNLAR = (
    ["oturum_id", "oyuncu_id", "kaynak", "tarih", "karar_id", "seviye"]
    + FEATURES
    + ["secim", "sure_doldu", "karar_suresi_sn", "gidip_gelme", "model_p", "destek_modu", "zorlandi"]
)

KARARLAR = [("K1", "deploy"), ("K2", "test"), ("K3", "security")]
SEVIYE_PUANI = {"new": 15, "mid": 45, "senior": 70}


def kademe(puan: float) -> str:  # app/src/skills.ts → tierFor
    return "new" if puan < 35 else "mid" if puan < 70 else "senior"


def sayac(puan: float) -> int | None:  # app/src/skills.ts → timerSecondsFor
    if puan < 70:
        return None
    return 45 if puan >= 85 else 60


def sigmoid(x: float) -> float:
    return 1 / (1 + math.exp(-x))


def sentetik(rng: np.random.Generator) -> pd.DataFrame:
    satirlar = []
    for o in range(SENTETIK_OYUNCU):
        oyuncu_id = f"o-sen{o:04d}"
        seviye = rng.choice(["new", "mid", "senior"], p=[0.35, 0.40, 0.25])
        z = rng.normal()
        puan = {t: SEVIYE_PUANI[seviye] for _, t in KARARLAR}
        gecmis_riskli = gecmis_toplam = 0

        for n in range(int(rng.integers(1, 7))):
            oturum_id = f"s-sen{o:04d}-{n}"
            onceki = None
            onceki_secim = None
            riskli = ipucu = tutor = 0
            for i, (kid, konu) in enumerate(KARARLAR):
                p_konu = float(np.clip(round(puan[konu]), 0, 100))
                sure_limit = sayac(p_konu)
                k = kademe(p_konu)
                ozellik = {
                    "karar_no": i + 1,
                    "konu_puani": p_konu,
                    "sure_baskisi": int(sure_limit is not None),
                    "onceki_karar_suresi_sn": onceki[0] if onceki else 0.0,
                    "onceki_gidip_gelme": onceki[1] if onceki else 0,
                    "onceki_riskli_sayisi": riskli,
                    "ipucu_sayisi": ipucu,
                    "tutor_mesaj_sayisi": tutor,
                    "gecmis_riskli_oran": round(gecmis_riskli / gecmis_toplam, 3) if gecmis_toplam else 0.0,
                }
                # karar anındaki davranış
                ipucu_acik = k == "new" or (k == "mid" and rng.random() < 0.25 + 0.2 * (z > 0))
                t = float(rng.lognormal(math.log(9) + 0.45 * z + 0.6 * (1 - p_konu / 100) + 0.25 * (i == 2), 0.45))
                g = int(rng.poisson(0.6 + 0.3 * abs(z) + 0.3 * ipucu_acik))
                tutor += int(rng.poisson(0.15 + 0.25 * max(z, 0)))
                kesif = 0.35 * n + 1.5 * (p_konu - 50) / 100
                onceki_b = 1 if onceki_secim == "B" else 0
                onceki_sure = onceki[0] if onceki else 9.0
                logit = (-0.5 + 0.8 * z + kesif - 1.1 * onceki_b + 0.08 * (onceki_sure - 9)
                         - 0.4 * ipucu_acik + rng.normal(0, 0.8))
                sure_doldu = sure_limit is not None and t > sure_limit
                if sure_doldu:
                    t = float(sure_limit)
                secim = "B" if sure_doldu or rng.random() < sigmoid(logit) else "A"
                zorlandi = int(secim == "B")

                satirlar.append({
                    "oturum_id": oturum_id, "oyuncu_id": oyuncu_id, "kaynak": "sentetik",
                    "tarih": "2026-11-04", "karar_id": kid, "seviye": seviye, **ozellik,
                    "secim": secim, "sure_doldu": int(sure_doldu), "karar_suresi_sn": round(t, 1),
                    "gidip_gelme": g, "model_p": "", "destek_modu": 0, "zorlandi": zorlandi,
                })

                # oyun kuralları (app/src/App.tsx → runEvents)
                ipucu += int(ipucu_acik)
                riskli += zorlandi
                if sure_doldu:
                    puan[konu] -= 5
                elif secim == "A":
                    puan[konu] += 5 if ipucu_acik else 8
                else:
                    puan[konu] -= 3
                puan[konu] = float(np.clip(puan[konu], 0, 100))
                onceki = (round(t, 1), g)
                onceki_secim = secim
            gecmis_riskli += riskli
            gecmis_toplam += len(KARARLAR)
    return pd.DataFrame(satirlar, columns=SUTUNLAR)


def gercek() -> pd.DataFrame:
    dosyalar = sorted(glob.glob(str(BURASI / "gercek" / "*.csv")))
    if not dosyalar:
        return pd.DataFrame(columns=SUTUNLAR)
    df = pd.concat([pd.read_csv(f) for f in dosyalar], ignore_index=True)
    df = df.drop_duplicates(subset=["oturum_id", "karar_id"])  # aynı CSV iki kez indirildiyse
    df["kaynak"] = "gercek"
    return df[SUTUNLAR]


def main():
    g = gercek()
    s = sentetik(np.random.default_rng(TOHUM))
    df = pd.concat([g, s], ignore_index=True)
    df.to_csv(CIKTI, index=False)
    ozet = df.groupby("kaynak").agg(satir=("oturum_id", "size"), oturum=("oturum_id", "nunique"),
                                    oyuncu=("oyuncu_id", "nunique"), zorlanma_orani=("zorlandi", "mean"))
    print(f"✓ {CIKTI.relative_to(BURASI.parent)} yazıldı ({len(df)} satır)")
    print(ozet.round(3).to_string())
    if len(g) and g["oturum_id"].nunique() < 15:
        print(f"! gerçek oturum sayısı {g['oturum_id'].nunique()} < 15 (ödev en az 15 istiyor)")


if __name__ == "__main__":
    main()
