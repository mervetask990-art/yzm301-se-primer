// v2: zorlanma modeli — diferansiyel test (KÖ-14) ve modelin oyunu değiştirmesi (KÖ-12, KÖ-13)
import parite from '../../tests/parite.json';

const tid = (id: string) => `[data-testid="${id}"]`;
const cyd = (id: string) => `[data-cy="${id}"]`;

describe('KÖ-14 diferansiyel test: tarayıcı (onnxruntime-web) = Python kahini', () => {
  parite.vakalar.forEach((vaka) => {
    it(`KÖ-14 parite · ${vaka.ad}`, () => {
      cy.visit('/?parite=1');
      cy.get(cyd('model-status'), { timeout: 30000 }).should('contain', 'hazır');
      cy.get(cyd('parite-input')).clear().type(JSON.stringify(vaka.girdi), { parseSpecialCharSequences: false, delay: 0 });
      cy.get(cyd('parite-run')).click();
      cy.get(cyd('p'))
        .should('not.have.text', '—')
        .invoke('text')
        .then((text) => {
          const pApp = Number(text);
          const fark = Math.abs(pApp - vaka.p);
          cy.log(`uygulama ${pApp} · python ${vaka.p} · |Δ| ${fark.toExponential(1)}`);
          expect(fark, `|p_uygulama − p_python| (${vaka.ad})`).to.be.lessThan(parite.tolerans);
        });
    });
  });
});

// React'in onPointerEnter'ı pointerout/pointerover çiftinden üretilir: A'dan B'ye geçişi taklit et
function hoverSwitch(from: 'A' | 'B', to: 'A' | 'B') {
  cy.get(tid(`choice-${to}`)).then(($to) => {
    cy.get(tid(`choice-${from}`)).trigger('pointerout', { relatedTarget: $to[0], force: true });
  });
}

function seniorK1(seconds: number, switches: number, choice: 'A' | 'B') {
  cy.clock();
  cy.visit('/');
  cy.get(tid('intake-level-senior')).click();
  cy.get(tid('intake-role-backend')).click();
  cy.get(tid('intake-goal-work')).click();
  cy.get(tid('intake-start')).click();
  cy.get(tid('intro-start')).click();
  cy.get(tid('decision-title')).should('contain', '1');
  cy.get(cyd('p'), { timeout: 30000 }).should('not.have.text', '—'); // model yüklendi
  cy.get(tid('choice-A')).trigger('pointerover', { force: true });
  let at: 'A' | 'B' = 'A';
  for (let i = 0; i < switches; i++) {
    const next = at === 'A' ? 'B' : 'A';
    hoverSwitch(at, next);
    at = next;
  }
  cy.tick(seconds * 1000);
  cy.get(tid(`choice-${choice}`)).click();
  cy.get(tid('next-button')).click();
  cy.clock().then((c) => c.restore());
  cy.get(tid('decision-title')).should('contain', '2');
}

describe('Model oyunun davranışını değiştirir', () => {
  it('KÖ-12 tereddüt eden deneyimli oyuncuya K2’de destek açılır (sayaç yok, ipucu açık)', () => {
    seniorK1(40, 4, 'B');
    cy.get(cyd('p'), { timeout: 30000 })
      .should('not.have.text', '—')
      .invoke('text')
      .then((t) => expect(Number(t)).to.be.at.least(0.5));
    cy.get(tid('model-support-note')).should('be.visible').and('contain', 'Destek açıldı');
    cy.get(tid('hint-card')).should('be.visible');
    cy.get(tid('timer')).should('not.exist');
  });

  it('KÖ-13 hızlı ve emin deneyimli oyuncuda v1 kuralları aynen çalışır (60 sn sayaç, ipucu yok)', () => {
    seniorK1(8, 0, 'A');
    cy.get(cyd('p'), { timeout: 30000 })
      .should('not.have.text', '—')
      .invoke('text')
      .then((t) => expect(Number(t)).to.be.lessThan(0.5));
    cy.get(tid('model-support-note')).should('not.exist');
    cy.get(tid('hint-card')).should('not.exist');
    cy.get(tid('timer')).should('exist');
  });

  it('veri toplama satırı model olasılığını ve destek modunu kaydeder', () => {
    seniorK1(40, 4, 'B');
    cy.get(cyd('p'), { timeout: 30000 }).should('not.have.text', '—');
    cy.get(tid('choice-A')).click();
    cy.window().then((w) => {
      const rows = JSON.parse(w.localStorage.getItem('se-primer-oturumlar-v1') || '[]');
      expect(rows).to.have.length(2);
      // 4 gidip gelme A'da biter; B'ye tıklamak için imleci B'ye götürmek 5. geçiştir
      expect(rows[0]).to.include({ karar_id: 'K1', zorlandi: 1, gidip_gelme: 5, kaynak: 'gercek' });
      expect(rows[1]).to.include({ karar_id: 'K2', onceki_gidip_gelme: 5, onceki_karar_suresi_sn: 40, destek_modu: 1 });
      expect(rows[1].model_p).to.be.a('number');
      expect(Object.keys(rows[0])).not.to.include.members(['ad', 'name', 'email']);
    });
  });
});
