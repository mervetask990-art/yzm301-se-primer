import scenario from '../../scenario/scenario.json';

const tid = (id: string) => `[data-testid="${id}"]`;
const KEY = 'se-primer-journal-v1';

// Start from a journal that already holds some evidence about the player
function visitWith(journal: Record<string, unknown>) {
  cy.visit('/', {
    onBeforeLoad(win) {
      win.localStorage.setItem(KEY, JSON.stringify({ name: 'Deneme', runs: [], researched: [], pusula: [], ...journal }));
    },
  });
}

function pickProfile(level = 'mid') {
  cy.get(tid(`intake-level-${level}`)).click();
  cy.get(tid('intake-role-backend')).click();
  cy.get(tid('intake-goal-curious')).click();
}

const readJournal = () => cy.window().then((win) => JSON.parse(win.localStorage.getItem(KEY) || '{}'));

describe('Beceri haritası ve azalan destek', () => {
  it('KÖ-8 destek her kararda o konunun ustalığına göre ayarlanır', () => {
    visitWith({ skills: { deploy: 80, security: 20 } });
    pickProfile('mid');
    cy.get(tid('intake-start')).click();
    cy.get(tid('intro-start')).click();

    // K1 · deploy 80 → strong: no hints, 60 s timer, explained
    cy.get(tid('support-note')).should('contain', 'güçlendin').and('contain', '80/100');
    cy.get(tid('timer')).should('be.visible');
    cy.get(tid('hint-toggle')).should('not.exist');
    cy.get(tid('choice-A')).click();
    cy.get(tid('next-button')).click();

    // K2 · test not measured → falls back to the chosen level (mid)
    cy.get(tid('support-note')).should('not.exist');
    cy.get(tid('hint-toggle')).should('be.visible');
    cy.get(tid('timer')).should('not.exist');
    cy.get(tid('choice-A')).click();
    cy.get(tid('next-button')).click();

    // K3 · security 20 → struggling: hint open, no timer
    cy.get(tid('support-note')).should('contain', 'zorlanıyorsun');
    cy.get(tid('hint-card')).should('contain', scenario.decisions[2].hint);
    cy.get(tid('timer')).should('not.exist');
  });

  it('çok güçlü konuda süre 45 saniyeye iner', () => {
    visitWith({ skills: { deploy: 90 } });
    pickProfile('mid');
    cy.get(tid('intake-start')).click();
    cy.get(tid('intro-start')).click();
    cy.get(tid('timer')).should('contain', '45s');
  });

  it('nöbet sonunda beceri değişimini gösterir ve radar ana ekranda güncellenir', () => {
    cy.visit('/');
    cy.get(tid('skill-radar')).should('not.exist');
    pickProfile('mid');
    cy.get(tid('intake-start')).click();
    cy.get(tid('intro-start')).click();
    ['A', 'A', 'B'].forEach((c) => {
      cy.get(tid(`choice-${c}`)).click();
      cy.get(tid('next-button')).click();
    });

    cy.get(tid('skill-delta-deploy')).should('contain', '+8').and('contain', '53/100');
    cy.get(tid('skill-delta-security')).should('contain', '-3').and('contain', '42/100');
    cy.get(tid('restart')).click();

    cy.get(tid('skill-radar')).should('be.visible');
    cy.get(tid('skill-label-deploy')).should('contain', '53');
    cy.get(tid('skill-label-observability')).should('contain', '–');
    cy.get(tid('skill-timeline')).should('contain', 'Test');
  });
});

describe('Pusula: önce tahmin et, sonra gör', () => {
  const mapPath = {
    id: 'd1-a',
    topic: 'test',
    title: 'Önce kısa test',
    logic: 'Kritik yolu doğrulamak riski erken yakalar.',
    leadsTo: 'Yayın biraz gecikir ama ana akış güvence altındadır.',
    risk: 'Test kapsamı dar kalırsa yanlış güven verir.',
    whenItFits: 'Eğer değişiklik kritik bir akışa dokunuyorsa.',
    research: ['Smoke test', 'Test piramidi'],
    selfQuestion: 'Hangi akış bozulursa en çok zarar verir?',
  };

  it('KÖ-9 güçlü konuda tahmini zorunlu tutar, karşılaştırır ve isabeti izler', () => {
    cy.intercept('POST', '/api/pusula', (req) => {
      if (req.body.mode === 'clarify') req.reply({ questions: ['Ne değişti?', 'Kim etkileniyor?'] });
      else if (req.body.mode === 'map') req.reply({ situation: 'İlk karar', paths: [mapPath, { ...mapPath, id: 'd1-b', title: 'Hemen yayın' }] });
      else if (req.body.mode === 'compare')
        req.reply({ alignment: 'close', matched: 'Gecikmeyi gördün.', missedQuestion: 'Dar kapsam neyi gizler?' });
    }).as('pusula');

    visitWith({ skills: { test: 80 } });
    pickProfile('mid');
    cy.get(tid('intake-pusula')).click();
    cy.get(tid('pusula-question')).type('Yeni özelliği bugün yayına alalım mı?');
    cy.get(tid('pusula-ask')).click();
    cy.wait('@pusula'); // clarify
    cy.get(tid('pusula-map-start')).click();
    cy.wait('@pusula'); // map

    cy.get(tid('pusula-path-topic')).first().should('contain', 'Test · güçlü');
    cy.get(tid('pusula-path-toggle')).first().click();
    cy.get(tid('pusula-predict-required')).should('be.visible');
    cy.get(tid('pusula-reveal')).should('not.exist');
    cy.get(tid('path-leads-to')).should('not.exist');

    cy.get(tid('pusula-predict-input')).type('Yayın gecikir ama kritik akış güvende olur.');
    cy.get(tid('pusula-predict-submit')).click();
    cy.wait('@pusula').its('request.body').should((body) => {
      expect(body.mode).to.eq('compare');
      expect(body.prediction).to.contain('Yayın gecikir');
      expect(body.path.title).to.eq('Önce kısa test');
    });
    cy.get(tid('pusula-compare-alignment')).should('contain', 'Yakın tahmin');
    cy.get(tid('pusula-compare')).should('contain', 'Dar kapsam neyi gizler?');
    cy.get(tid('path-leads-to')).should('be.visible');

    readJournal().then((j) => {
      expect(j.predictions).to.have.length(1);
      expect(j.predictions[0]).to.include({ topic: 'test', alignment: 'close' });
      expect(j.skills.test).to.eq(85);
    });
    cy.get(tid('pusula-home')).click();
    cy.get(tid('prediction-accuracy')).should('contain', '%100');
  });
});

describe('Defter ve aralıklı tekrar', () => {
  const concept = 'Smoke test vs regression test';

  it('KÖ-10 kavramı kendi kelimeleriyle yazdırır, vakti gelince tekrar sorar ve aralığı uzatır', () => {
    visitWith({ researched: [concept], conceptTopics: { [concept]: 'test' } });
    cy.get(tid('notebook-badge')).should('have.text', '1');
    cy.get(tid('intake-notebook')).click();

    cy.get(tid('notebook-pending-item')).should('contain', concept);
    cy.get(tid('explain-save')).should('be.disabled');
    cy.get(tid('explain-input')).type('Smoke test kritik yolları hızlıca dener, regression tüm eski davranışı.');
    cy.get(tid('explain-save')).click();
    cy.get(tid('notebook-entry')).should('contain', concept).and('contain', 'yarın');
    cy.get(tid('notebook-due')).should('not.exist');

    // Two days later the concept is due again
    readJournal().then((j) => {
      expect(j.notebook[0]).to.include({ concept, topic: 'test', stage: 0 });
      j.notebook[0].nextReview = new Date(Date.now() - 1000).toISOString();
      cy.window().then((win) => win.localStorage.setItem(KEY, JSON.stringify(j)));
    });
    cy.intercept('POST', '/api/review', { result: 'solid', followUp: 'Peki regression testi ne zaman otomatikleştirirdin?' }).as('review');
    cy.reload();
    cy.get(tid('intake-notebook')).should('contain', 'tekrar zamanı').click();

    cy.get(tid('notebook-due-item')).should('contain', concept);
    // Old explanation stays hidden until the player answers again
    cy.get(tid('notebook-due-item')).should('not.contain', 'kritik yolları hızlıca dener');
    cy.get(tid('review-input')).type('Smoke yüzeysel ve hızlı, regression geniş ve eski hataları yakalar.');
    cy.get(tid('review-submit')).click();
    cy.wait('@review').its('request.body').should((body) => {
      expect(body.concept).to.eq(concept);
      expect(body.previous).to.contain('kritik yolları');
    });
    cy.get(tid('review-result-label')).should('contain', 'Oturmuş');
    cy.get(tid('review-result')).should('contain', 'Geçen seferki açıklaman');
    cy.get(tid('review-done')).click();

    cy.get(tid('notebook-due')).should('not.exist');
    cy.get(tid('notebook-entry')).should('contain', '3 gün sonra');
    readJournal().then((j) => {
      expect(j.notebook[0].stage).to.eq(1);
      expect(j.notebook[0].reviews[0].result).to.eq('solid');
      // seed 45 (mid fallback) + 4 explain + 6 solid review
      expect(j.skills.test).to.eq(55);
    });
  });
});
