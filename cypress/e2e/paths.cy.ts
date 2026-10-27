import scenario from '../../scenario/scenario.json';

type Choice = 'A' | 'B';
type Level = 'new' | 'mid' | 'senior';

const tid = (id: string) => `[data-testid="${id}"]`;

function startGame(level: Level = 'mid', role = 'backend', goal = 'curious') {
  cy.visit('/');
  cy.get(tid('intake-start')).should('be.disabled');
  cy.get(tid(`intake-level-${level}`)).click();
  cy.get(tid(`intake-role-${role}`)).click();
  cy.get(tid(`intake-goal-${goal}`)).click();
  cy.get(tid('intake-start')).should('not.be.disabled').click();
  cy.get(tid('intro-text')).should('contain', scenario.intro.roleLine[role as keyof typeof scenario.intro.roleLine]);
  cy.get(tid('intro-start')).click();
}

// KÖ-5: every outcome screen shows what / why / at least 2 research points
function expectOutcomeCards() {
  cy.get(tid('outcome-what')).should('be.visible').and('not.be.empty');
  cy.get(tid('outcome-why')).should('be.visible').and('not.be.empty');
  cy.get(tid('outcome-research')).find('li, [role="listitem"], span').should('have.length.at.least', 2);
}

function decide(index: number, choice: Choice) {
  // title text may be upper-cased by CSS, so match the decision number only
  cy.get(tid('decision-title')).should('be.visible').and('contain', String(index + 1));
  cy.get(tid(`choice-${choice}`)).click();
  expectOutcomeCards();
  cy.get(tid('next-button')).click();
}

const paths: [Choice, Choice, Choice][] = [];
for (const k1 of ['A', 'B'] as Choice[])
  for (const k2 of ['A', 'B'] as Choice[])
    for (const k3 of ['A', 'B'] as Choice[]) paths.push([k1, k2, k3]);

describe('SE Primer — 8 yol', () => {
  paths.forEach(([k1, k2, k3]) => {
    const ending = k3 === 'A' ? 'A' : 'B';
    const clock = scenario.clockTable[`${k1},${k2}` as keyof typeof scenario.clockTable];

    it(`K1=${k1} K2=${k2} K3=${k3} → Son ${ending} (${clock})`, () => {
      startGame('mid');
      decide(0, k1);
      if (k1 === 'B' && k2 === 'B') {
        cy.get(tid('choice-B')).click();
        cy.get(tid('outcome-what')).should('contain', '08:50');
        cy.get(tid('next-button')).click();
      } else {
        decide(1, k2);
      }
      decide(2, k3);

      cy.get(tid(`ending-${ending}`)).should('be.visible');
      cy.get(tid(`ending-${ending}`)).should('contain', scenario.endings[ending].title);
      cy.get(tid('ending-clock')).should('contain', clock);
      cy.get(tid('ending-research')).should('not.be.empty');

      cy.get(tid('restart')).click();
      cy.get(tid('intake-start')).should('exist');
    });
  });
});

describe('Kişiselleştirme', () => {
  it('KÖ-1 yeni oyuncu ipucu kartını görür, sayaç yoktur', () => {
    startGame('new');
    cy.get(tid('hint-card')).should('be.visible').and('contain', scenario.decisions[0].hint);
    cy.get(tid('timer')).should('not.exist');
  });

  it('orta seviye ipucunu butonla açar', () => {
    startGame('mid');
    cy.get(tid('hint-card')).should('not.exist');
    cy.get(tid('hint-toggle')).click();
    cy.get(tid('hint-card')).should('be.visible');
  });

  it('KÖ-2 deneyimli oyuncuda süre dolunca B uygulanır', () => {
    cy.clock();
    startGame('senior');
    cy.get(tid('hint-card')).should('not.exist');
    cy.get(tid('hint-toggle')).should('not.exist');
    cy.get(tid('timer')).should('be.visible');

    cy.tick(61_000);
    cy.get(tid('timeout-notice')).should('be.visible').and('contain', scenario.timeout.what);
    cy.get(tid('outcome-what')).should('contain', scenario.decisions[0].choices.B.what);
  });
});

describe('Tutor arayüzü (/api/tutor mock)', () => {
  it('KÖ-4 tutor paneli soru ile yanıt verir ve öğrenme günlüğünü gönderir', () => {
    cy.intercept('POST', '/api/tutor', {
      statusCode: 200,
      body: { reply: 'Seçimi sen yapacaksın. Yeni sürüm veritabanında neyi değiştirdi, bunu nereden kontrol edersin?' },
    }).as('gemini');

    startGame('mid');
    cy.get(tid('tutor-open')).click();
    cy.get(tid('tutor-sheet')).should('be.visible');
    cy.get(tid('tutor-message')).first().should('contain', scenario.decisions[0].tutorQuestion);

    cy.get(tid('tutor-input')).type('Hangisi doğru, A mı B mi?');
    cy.get(tid('tutor-send')).click();
    cy.wait('@gemini').its('request.body').should((body) => {
      expect(body.context.tutorQuestion).to.eq(scenario.decisions[0].tutorQuestion);
      expect(body.learner).to.have.property('runCount', 0);
    });
    cy.get(tid('tutor-message')).last().invoke('text').should('match', /\?\s*$/);
  });

  it('API hatasında oyun oynanabilir kalır', () => {
    cy.intercept('POST', '/api/tutor', { statusCode: 500 }).as('gemini');
    startGame('mid');
    cy.get(tid('tutor-open')).click();
    cy.get(tid('tutor-input')).type('İpucu ver');
    cy.get(tid('tutor-send')).click();
    cy.wait('@gemini');
    cy.get(tid('tutor-sheet')).should('contain', 'Tutor şu an düşünemiyor');
    cy.get(tid('tutor-close')).click();
    cy.get(tid('choice-A')).should('be.visible');
  });
});

describe('Öğrenme günlüğü (birlikte öğrenen Primer)', () => {
  it('KÖ-6 ikinci nöbette geçmişi hatırlar ve kişiselleştirir', () => {
    cy.visit('/');
    cy.get(tid('journal-card')).should('not.exist');
    cy.get(tid('intake-name')).type('Deneme');
    cy.get(tid('intake-level-mid')).click();
    cy.get(tid('intake-role-qa')).click();
    cy.get(tid('intake-goal-work')).click();
    cy.get(tid('intake-start')).click();
    cy.get(tid('intro-greeting')).should('contain', 'Deneme');
    cy.get(tid('intro-start')).click();
    decide(0, 'A');
    decide(1, 'B');
    decide(2, 'B');

    cy.get(tid('ending-run-number')).should('contain', '1.');
    cy.get(tid('research-item')).first().click().should('have.attr', 'aria-pressed', 'true');
    cy.get(tid('research-progress')).should('contain', '1/');
    cy.get(tid('reflection-input')).type('Logu maskelemeden paylaşmam.');
    cy.get(tid('reflection-save')).click().should('contain', 'kaydedildi');
    cy.get(tid('restart')).click();

    // Second visit: profile preselected, journal remembers the run
    cy.reload();
    cy.get(tid('intake-start')).should('not.be.disabled');
    cy.get(tid('journal-card'))
      .should('contain', 'Öğrenme yolculuğun')
      .and('contain', 'Logu maskelemeden paylaşmam.');
    cy.get(tid('journal-weak-topic')).should('contain', 'Test');
    cy.get(tid('journal-next-research')).should('be.visible');

    cy.intercept('POST', '/api/tutor', { body: { reply: 'Bunu nasıl kontrol ederdin?' } }).as('tutor');
    cy.get(tid('intake-start')).click();
    cy.get(tid('intro-memory')).should('contain', 'Test');
    cy.get(tid('intro-start')).click();
    cy.get(tid('tutor-open')).click();
    cy.get(tid('tutor-input')).type('İpucu?');
    cy.get(tid('tutor-send')).click();
    cy.wait('@tutor').its('request.body.learner').should((learner) => {
      expect(learner.name).to.eq('Deneme');
      expect(learner.runCount).to.eq(1);
      expect(learner.researched).to.have.length(1);
      expect(learner.lastReflection).to.eq('Logu maskelemeden paylaşmam.');
    });
  });
});
