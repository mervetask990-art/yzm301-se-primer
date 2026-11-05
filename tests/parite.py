"""Test kahini (oracle): aynı model.onnx'i Python onnxruntime ile çalıştırır.

    python tests/parite.py --yaz     # tests/parite.json'u (5 referans girdi + Python olasılığı) üretir
    python tests/parite.py           # parite.json'daki beklenen olasılıkları yeniden hesaplayıp doğrular
    python tests/parite.py --hub     # modeli HF'teki commit'e sabit URL'den indirip doğrular
    python tests/parite.py --sunucu https://<servis>.onrender.com   # üçüncü tüketici: POST /api/predict

Diğer tüketiciler (tarayıcı: cypress/e2e/model.cy.ts, sunucu: /api/predict) aynı girdilere
|p − p_python| < TOLERANS vermek zorundadır (diferansiyel test, spec KÖ-14).
"""
from __future__ import annotations

import sys as _sys

# Windows konsolu (cp1254) ✓/✗ karakterlerini yazamaz
if hasattr(_sys.stdout, "reconfigure"):
    _sys.stdout.reconfigure(encoding="utf-8")

import argparse
import json
import sys
import urllib.request
from pathlib import Path

import numpy as np
import onnxruntime as ort

KOK = Path(__file__).resolve().parent.parent
MODEL = KOK / "model" / "model.onnx"
CONFIG = KOK / "model" / "config.json"
PARITE = KOK / "tests" / "parite.json"
KAYNAK = KOK / "app" / "src" / "model-source.json"
TOLERANS = 1e-4

# 5 referans girdi: tipik, uç ve spec'teki kabul örnekleri (KÖ-12 / KÖ-13)
REFERANS = [
    ("K1 · yeni oyuncu, geçmiş yok", dict(karar_no=1, konu_puani=15, sure_baskisi=0, onceki_karar_suresi_sn=0,
     onceki_gidip_gelme=0, onceki_riskli_sayisi=0, ipucu_sayisi=0, tutor_mesaj_sayisi=0, gecmis_riskli_oran=0)),
    ("KÖ-12 · deneyimli, K1'de 40 sn tereddüt, 4 gidip gelme, B", dict(karar_no=2, konu_puani=70, sure_baskisi=1,
     onceki_karar_suresi_sn=40, onceki_gidip_gelme=4, onceki_riskli_sayisi=1, ipucu_sayisi=0, tutor_mesaj_sayisi=0,
     gecmis_riskli_oran=0)),
    ("KÖ-13 · deneyimli, K1'de 8 sn, gidip gelme yok, A", dict(karar_no=2, konu_puani=70, sure_baskisi=1,
     onceki_karar_suresi_sn=8, onceki_gidip_gelme=0, onceki_riskli_sayisi=0, ipucu_sayisi=0, tutor_mesaj_sayisi=0,
     gecmis_riskli_oran=0)),
    ("K3 · orta, iki riskli karar, tutor kullanmış, riskli geçmiş", dict(karar_no=3, konu_puani=38, sure_baskisi=0,
     onceki_karar_suresi_sn=22.5, onceki_gidip_gelme=2, onceki_riskli_sayisi=2, ipucu_sayisi=1, tutor_mesaj_sayisi=2,
     gecmis_riskli_oran=0.667)),
    ("K3 · usta, hızlı, temiz geçmiş (uç değer)", dict(karar_no=3, konu_puani=96, sure_baskisi=1,
     onceki_karar_suresi_sn=3.1, onceki_gidip_gelme=0, onceki_riskli_sayisi=0, ipucu_sayisi=0, tutor_mesaj_sayisi=0,
     gecmis_riskli_oran=0.0)),
]


def oturum(hub: bool):
    if not hub:
        return ort.InferenceSession(str(MODEL)), json.loads(CONFIG.read_text(encoding="utf-8")), str(MODEL)
    k = json.loads(KAYNAK.read_text(encoding="utf-8"))
    if not (k.get("repo") and k.get("commit")):
        sys.exit("✗ app/src/model-source.json içinde repo/commit yok (henüz yayınlanmadı)")
    taban = f"https://huggingface.co/{k['repo']}/resolve/{k['commit']}/"
    model = urllib.request.urlopen(taban + "model.onnx").read()
    config = json.loads(urllib.request.urlopen(taban + "config.json").read())
    return ort.InferenceSession(model), config, taban


def tahmin(sess, config, girdi: dict) -> float:
    adlar = [f["name"] for f in config["features"]]
    x = np.array([[girdi[a] for a in adlar]], dtype=np.float32)
    out = sess.run([config["output"]["name"]], {config["input"]["name"]: x})[0]
    return float(out[0, config["output"]["index"]])


def sunucu_parite(taban: str):
    """Bonus: aynı referans girdileri sunucuya gönderir, Python kahininin olasılığıyla kıyaslar."""
    beklenen = json.loads(PARITE.read_text(encoding="utf-8"))
    bilgi = json.loads(urllib.request.urlopen(taban + "/api/model", timeout=120).read())
    print(f"sunucu: {taban} · model v{bilgi['version']} · {bilgi['source']}")
    hata = 0
    for v in beklenen["vakalar"]:
        istek = urllib.request.Request(taban + "/api/predict", data=json.dumps({"inputs": v["girdi"]}).encode(),
                                       headers={"Content-Type": "application/json"})
        p = float(json.loads(urllib.request.urlopen(istek, timeout=120).read())["p"])
        fark = abs(p - v["p"])
        ok = fark < TOLERANS
        hata += not ok
        print(f"  {'✓' if ok else '✗'} |Δ|={fark:.1e}  p={p:.6f}  {v['ad']}")
    if hata:
        sys.exit(f"✗ {hata} vaka tolerans dışında")
    print(f"✓ sunucu 5/5 vaka tolerans ({TOLERANS}) içinde")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--yaz", action="store_true")
    ap.add_argument("--hub", action="store_true")
    ap.add_argument("--sunucu", metavar="URL", help="kendi sunucumuz (onnxruntime-node) ile parite")
    args = ap.parse_args()
    if args.sunucu:
        return sunucu_parite(args.sunucu.rstrip("/"))
    sess, config, kaynak = oturum(args.hub)
    print(f"kahin: onnxruntime {ort.__version__} · model v{config['version']} · {kaynak}")

    if args.yaz:
        vakalar = [{"ad": ad, "girdi": g, "p": round(tahmin(sess, config, g), 8)} for ad, g in REFERANS]
        PARITE.write_text(json.dumps({
            "model_version": config["version"],
            "tolerans": TOLERANS,
            "kahin": f"Python onnxruntime {ort.__version__}",
            "esik": config["decision_threshold"],
            "vakalar": vakalar,
        }, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        for v in vakalar:
            print(f"  p={v['p']:.6f}  {'DESTEK' if v['p'] >= config['decision_threshold'] else 'kural '}  {v['ad']}")
        print(f"✓ {PARITE.relative_to(KOK)} yazıldı")
        return

    beklenen = json.loads(PARITE.read_text(encoding="utf-8"))
    hata = 0
    for v in beklenen["vakalar"]:
        p = tahmin(sess, config, v["girdi"])
        fark = abs(p - v["p"])
        ok = fark < TOLERANS
        hata += not ok
        print(f"  {'✓' if ok else '✗'} |Δ|={fark:.1e}  p={p:.6f}  {v['ad']}")
    if hata:
        sys.exit(f"✗ {hata} vaka tolerans dışında")
    print(f"✓ 5/5 vaka tolerans ({TOLERANS}) içinde")


if __name__ == "__main__":
    main()
