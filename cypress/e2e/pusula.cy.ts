const tid = (id: string) => `[data-testid="${id}"]`;

const path = (id: string, title: string) => ({
  id,
  title,
  logic: `${title} mantığı.`,
  leadsTo: `${title} sonucu.`,
  risk: `${title} riski.`,
  whenItFits: `Eğer koşul varsa ${title}.`,
  research: [`${title} kavram 1`, `${title} kavram 2`],
  selfQuestion: `${title} için neyi bilmen gerekir?`,
});

function openPusula(level = 'mid') {
  cy.visit('/');
  cy.get(tid('intake-pusula')).should('be.disabled');
  cy.get(tid('intake-name')).type('Deneme');
  cy.get(tid(`intake-level-${level}`)).click();
  cy.get(tid('intake-role-backend')).click();
  cy.get(tid('intake-goal-curious')).click();
  cy.get(tid('intake-pusula')).should('not.be.disabled').click();
  cy.get(tid('pusula')).should('be.visible');
}

describe('Pusula — kendi sorunu sor', () => {
  beforeEach(() => {
    cy.intercept('POST', '/api/pusula', (req) => {
      const { mode, depth } = req.body;
      if (mode === 'clarify') {
        req.reply({ questions: ['Kim etkileniyor?', 'En son ne değişti?'] });
      } else if (mode === 'map') {
        req.reply({
          situation: `Karar noktası ${depth} durumu`,
          paths: [path(`d${depth}-a`, `Yol ${depth}A`), path(`d${depth}-b`, `Yol ${depth}B`)],
        });
      } else {
        req.reply({ path: { ...path('custom-1', req.body.customPath), custom: true } });
      }
    }).as('pusula');
  });

  it('KÖ-7 soruyu netleştirir, yolları cevap vermeden gösterir ve derinleştirir', () => {
    openPusula();
    cy.get(tid('pusula-ask')).should('be.disabled');
    cy.get(tid('pusula-question')).type('Canlıda sorgular yavaşladı, ne yapmalıyım?');
    cy.get(tid('pusula-ask')).click();

    cy.wait('@pusula').its('request.body').should((body) => {
      expect(body.mode).to.eq('clarify');
      expect(body.profile).to.include({ level: 'mid', role: 'backend', goal: 'curious', name: 'Deneme' });
    });
    cy.get(tid('pusula-clarify-question')).should('have.length', 2);
    cy.get(tid('pusula-answer-0')).type('Tüm kullanıcılar');
    cy.get(tid('pusula-map-start')).click();

    cy.wait('@pusula').its('request.body').should((body) => {
      expect(body.mode).to.eq('map');
      expect(body.depth).to.eq(1);
      expect(body.clarifications[0]).to.deep.eq({ question: 'Kim etkileniyor?', answer: 'Tüm kullanıcılar' });
    });
    cy.get(tid('pusula-situation')).should('contain', 'Karar noktası 1');
    cy.get(tid('pusula-path')).should('have.length', 2);
    // Mid level: details stay closed until the player opens a path
    cy.get(tid('pusula-path-details')).should('not.exist');

    cy.get(tid('pusula-path-toggle')).eq(1).click();
    // Mid level: a prediction is offered first; this test skips it
    cy.get(tid('pusula-predict')).should('be.visible');
    cy.get(tid('pusula-reveal')).click();
    ['path-logic', 'path-leads-to', 'path-risk', 'path-when', 'path-self-question'].forEach((id) =>
      cy.get(tid(id)).should('be.visible').and('not.be.empty'),
    );
    cy.get(tid('pusula-path')).should('not.contain', 'Önerilen').and('not.contain', 'doğru yol');
    cy.get(tid('pusula-choose')).click();

    cy.wait('@pusula').its('request.body').should((body) => {
      expect(body.depth).to.eq(2);
      expect(body.trail).to.deep.eq([{ situation: 'Karar noktası 1 durumu', chosen: 'Yol 1B' }]);
    });
    cy.get(tid('pusula-situation')).should('contain', 'Karar noktası 2');
    cy.get(tid('pusula-trail')).should('contain', 'Yol 1B');
  });

  it('oyuncunun kendi yolunu ekler, geri dönüp başka dal dener ve günlüğe yazar', () => {
    openPusula();
    cy.get(tid('pusula-question')).type('Monolitten mikroservise geçmeli miyiz?');
    cy.get(tid('pusula-ask')).click();
    cy.wait('@pusula'); // clarify
    cy.get(tid('pusula-map-start')).click();
    cy.wait('@pusula'); // map depth 1

    cy.get(tid('pusula-custom')).type('Önce tek bir modülü ayırırım');
    cy.get(tid('pusula-custom-add')).click();
    cy.wait('@pusula').its('request.body.mode').should('eq', 'evaluate');
    cy.get(tid('pusula-path')).should('have.length', 3).last().should('contain', 'Önce tek bir modülü ayırırım');

    // Walk to depth 3 and finish
    cy.get(tid('pusula-reveal')).click();
    cy.get(tid('pusula-choose')).click();
    cy.get(tid('pusula-situation')).should('contain', 'Karar noktası 2');
    cy.get(tid('pusula-path-toggle')).first().click();
    cy.get(tid('pusula-reveal')).click();
    cy.get(tid('pusula-choose')).click();
    cy.get(tid('pusula-situation')).should('contain', 'Karar noktası 3');
    cy.get(tid('pusula-path-toggle')).first().click();
    cy.get(tid('pusula-reveal')).click();
    cy.get(tid('pusula-choose')).should('contain', 'tamamla').click();

    cy.get(tid('pusula-summary')).should('be.visible');
    cy.get(tid('pusula-summary-step')).should('have.length', 3).first().should('contain', 'Önce tek bir modülü ayırırım');

    // "What if I had taken another path?" — back to node 1, choose differently
    cy.get(tid('pusula-other-paths')).click();
    cy.get(tid('pusula-situation')).should('contain', 'Karar noktası 1');
    cy.get(tid('pusula-path-toggle')).first().click();
    cy.get(tid('pusula-reveal')).click();
    cy.get(tid('pusula-choose')).click();
    cy.get(tid('pusula-trail')).should('contain', 'Yol 1A');
    cy.get(tid('pusula-trail-2')).should('not.exist');
    cy.get(tid('pusula-finish')).click();

    cy.get(tid('pusula-summary-step')).should('have.length', 1).and('contain', 'Yol 1A');
    cy.get(tid('pusula-research-item')).first().click().should('have.attr', 'aria-pressed', 'true');
    cy.get(tid('pusula-reflection')).type('Önce sınırları netleştiririm.');
    cy.get(tid('pusula-save')).click().should('contain', 'kaydedildi');

    cy.get(tid('pusula-home')).click();
    cy.get(tid('journal-pusula-count')).should('have.text', '1');
    cy.get(tid('journal-last-question'))
      .should('contain', 'Monolitten mikroservise')
      .and('contain', 'Önce sınırları netleştiririm.');
  });

  it('yeni başlayana ilk yolu açık ve ipucuyla gösterir', () => {
    openPusula('new');
    cy.get(tid('pusula-question')).type('Code review çok yavaş.');
    cy.get(tid('pusula-ask')).click();
    cy.get(tid('pusula-map-start')).click();
    cy.get(tid('pusula-path-details')).should('have.length', 1);
    cy.get(tid('pusula')).should('contain', 'Doğru yol yok');
  });
});

describe('Pusula — gerçek sunucu (anahtarlı, anahtarsız ya da model yoğunken)', () => {
  it('her durumda bir harita göstererek çalışmaya devam eder', () => {
    // Real Gemini (and its fallbacks) can take tens of seconds
    const slow = { timeout: 120_000 };
    openPusula();
    cy.get(tid('pusula-question')).type('Dün çıkan sürümden sonra 500 hatası var.');
    cy.get(tid('pusula-ask')).click();
    cy.get(tid('pusula-clarify-question'), slow).should('have.length.at.least', 2);
    cy.get(tid('pusula-map-start')).click();
    cy.get(tid('pusula-path'), slow).should('have.length.at.least', 2);
    // Only assert the offline banner when the server truly has no key
    cy.request({
      method: 'POST',
      url: '/api/pusula',
      body: { mode: 'clarify', question: 'deneme sorusu', profile: {} },
      timeout: 120_000,
    })
      .then((res) => {
        // The banner must appear exactly when the server served the generic map (no key or all models busy)
        if (res.body.offline) cy.get(tid('pusula-offline')).should('be.visible');
      });
  });
});
