// Demo video (60–90 sn): aynı sahnede (K2) modelin iki oyuncu için farklı karar vermesi.
// Gerçek uygulama + gerçek model; oyuncu hareketleri Cypress ile otomatik. Kayıt:
//   cp model/model.onnx cypress/fixtures/demo-model.onnx
//   cp app/node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.{wasm,mjs} cypress/fixtures/
//   CYPRESS_BASE_URL=http://localhost:3000 npx cypress run --e2e --config specPattern=cypress/demo/*.cy.ts,video=true --spec cypress/demo/demo.cy.ts
// Çıktı baştaki Cypress açılış ekranı kesilerek demo/se-primer-v2-demo.mp4 yapıldı (ffmpeg -ss 20.5).
const tid = (id: string) => `[data-testid="${id}"]`;
const cyd = (id: string) => `[data-cy="${id}"]`;

// Ekranın üstünde altyazı (yalnız video için; uygulamanın parçası değil)
function caption(text: string, ms = 3500) {
  cy.document().then((doc) => {
    let el = doc.getElementById('demo-caption');
    if (!el) {
      el = doc.createElement('div');
      el.id = 'demo-caption';
      el.setAttribute(
        'style',
        'position:fixed;left:8px;right:8px;bottom:78px;z-index:99999;padding:10px 12px;border-radius:12px;' +
          'background:rgba(242,178,102,.96);color:#0F1B2D;font:600 14px/1.35 system-ui,sans-serif;' +
          'box-shadow:0 6px 20px rgba(0,0,0,.4);text-align:center;pointer-events:none',
      );
      doc.body.appendChild(el);
    }
    el.textContent = text;
  });
  cy.wait(ms);
}

function hoverSwitch(from: 'A' | 'B', to: 'A' | 'B') {
  cy.get(tid(`choice-${to}`)).then(($to) => {
    cy.get(tid(`choice-${from}`)).trigger('pointerout', { relatedTarget: $to[0], force: true });
  });
  cy.wait(800);
}

function startSenior() {
  cy.clearLocalStorage();
  cy.visit('/');
  cy.get(tid('intake-level-senior')).click();
  cy.get(tid('intake-role-backend')).click();
  cy.get(tid('intake-goal-work')).click();
  cy.wait(600);
  cy.get(tid('intake-start')).click();
  cy.wait(1200);
  cy.get(tid('intro-start')).click();
  cy.get(tid('decision-title')).should('contain', '1');
  cy.get(cyd('p'), { timeout: 60000 }).should('not.have.text', '—'); // model HF'ten yüklendi
  // Saati model yüklendikten SONRA dondur (ONNX başlatması zamanlayıcılara ihtiyaç duyar); şimdiki zamandan devam et
  cy.window().then((w) => cy.clock(w.Date.now()));
}

// Cypress'in vekil sunucusu HF'in /api/resolve-cache yönlendirmesinde takılıyor (normal tarayıcıda sorun yok).
// Video için HF commit 03d54fe dosyalarının BİREBİR aynısı (sha256 doğrulandı) yerelden verilir.
function serveHfCommitFiles() {
  cy.readFile('model/config.json').then((cfg) => {
    cy.intercept('GET', '**/resolve/03d54fe50427aa06dea6073544c6dc725cf6f557/config.json', { body: cfg });
  });
  // onnxruntime-web 1.22.0 çalışma zamanı (CDN'deki dosyaların aynısı, app/node_modules'tan): yavaş ağda kayıt takılmasın
  cy.intercept('GET', '**/onnxruntime-web@1.22.0/dist/ort-wasm-simd-threaded.wasm', {
    fixture: 'ort-wasm-simd-threaded.wasm,null',
    headers: { 'content-type': 'application/wasm' },
  });
  cy.intercept('GET', '**/onnxruntime-web@1.22.0/dist/ort-wasm-simd-threaded.mjs', {
    fixture: 'ort-wasm-simd-threaded.mjs',
    headers: { 'content-type': 'text/javascript' },
  });
  // ikili dosya: fixture + encoding null (Buffer gövdesi JSON'a çevrilip bozuluyordu)
  cy.intercept('GET', '**/resolve/03d54fe50427aa06dea6073544c6dc725cf6f557/model.onnx', {
    fixture: 'demo-model.onnx,null',
    headers: { 'content-type': 'application/octet-stream' },
  });
}

describe('SE Primer v2 demo', () => {
  beforeEach(serveHfCommitFiles);

  it('aynı sahnede iki oyuncu, iki farklı model kararı', () => {
    cy.visit('/');
    caption('SE Primer v2 — model, oyuncunun davranışından sıradaki kararda zorlanma olasılığını (p) tahmin eder', 6500);
    caption('Uygulama kodu + HF commit 03d54fe ile birebir aynı model (sha256 doğrulandı). Oyuncu hareketleri Cypress ile otomatik.', 5500);

    // ---------- Oyuncu 1: tereddüt eden deneyimli oyuncu
    startSenior();
    caption('Oyuncu 1 · "Deneyimliyim": K1’de 60 sn sayaç var, ipucu yok (v1 kuralı)', 4500);
    cy.get(tid('choice-A')).trigger('pointerover', { force: true });
    caption('Oyuncu 1 uzun düşünüyor, A ile B arasında gidip geliyor…', 1200);
    hoverSwitch('A', 'B');
    hoverSwitch('B', 'A');
    hoverSwitch('A', 'B');
    hoverSwitch('B', 'A');
    cy.tick(40000); // 40 sn tereddüt (sayaç 60 → 20)
    cy.wait(1500);
    cy.get(tid('choice-B')).click();
    caption('…ve sonunda B’yi (riskli seçenek) seçiyor', 3500);
    cy.get(tid('next-button')).click();
    cy.clock().then((c) => c.restore());
    cy.get(tid('decision-title')).should('contain', '2');
    cy.get(cyd('p'), { timeout: 60000 }).should('not.have.text', '—');
    cy.get(tid('model-support-note')).should('be.visible');
    caption('K2 · model p ≈ 0.81 ≥ 0.50 → DESTEK AÇILDI: sayaç kalktı, ipucu kartı açık', 8500);

    // ---------- Oyuncu 2: hızlı ve emin deneyimli oyuncu
    startSenior();
    caption('Oyuncu 2 · aynı profil ("Deneyimliyim"), aynı sahne', 3500);
    cy.tick(8000); // 8 sn
    cy.get(tid('choice-A')).click();
    caption('Oyuncu 2 tereddüt etmeden 8 sn’de A’yı seçiyor', 3500);
    cy.get(tid('next-button')).click();
    cy.clock().then((c) => c.restore());
    cy.get(tid('decision-title')).should('contain', '2');
    cy.get(cyd('p'), { timeout: 60000 }).should('not.have.text', '—');
    cy.get(tid('model-support-note')).should('not.exist');
    cy.get(tid('timer')).should('exist');
    caption('K2 · model p ≈ 0.42 < 0.50 → v1 kuralları aynen: 60 sn sayaç, ipucu yok', 8500);

    caption('Aynı sahne, iki oyuncu, iki farklı karar. Model yalnızca desteği artırır; yüklenemezse oyun v1 kurallarıyla sürer.', 6000);
    caption('Diferansiyel test: tarayıcı (onnxruntime-web), Python kahini ve Render sunucusu 5 referans girdide aynı p’yi veriyor (|Δ| < 1e-4)', 6000);
  });
});
