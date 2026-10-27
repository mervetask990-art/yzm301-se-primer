# Google AI Studio — Build prompt'u

**Nasıl kullanılır:**
1. aistudio.google.com → **Build** → yeni uygulama.
2. Stitch'ten aldığın 3 ekran görüntüsünü (`design/*.png`) sohbete ekle.
3. Aşağıdaki **Ana prompt**'u yapıştır; `<<SCENARIO_JSON>>` yerine `scenario/scenario.json` dosyasının **tam içeriğini** koy.
4. Uygulama oluşunca önizlemeyi telefon boyutunda dene, sonra **Share** ile linki al ve telefonda aç.
5. Kodu indir (Download / GitHub'a aktar) ve repo içinde `app/` klasörüne koy.

Bir şey bozulursa tek seferde tek düzeltme iste (bkz. en alttaki "Düzeltme prompt'ları").

---

## Ana prompt

```
Build a mobile-first web app called "SE Primer" — an interactive, playable software
engineering book in Turkish. React + TypeScript. All UI text must be Turkish.

## Design
Match the attached screenshots exactly (they come from Google Stitch).
Design tokens (use as CSS variables):
--bg #0F1B2D; --surface #17263C; --surface-2 #1F3150; --line #2A3E5C;
--primary #5FB3A8; --primary-ink #0F1B2D; --accent #F2B266; --calm #A7A3D9;
--success #7BC8A4; --danger #E58A7B; --text #E8EEF5; --muted #9FB0C3.
Fonts from Google Fonts: Plus Jakarta Sans (headings), Inter (body), JetBrains Mono (clock).
Card radius 16px, button radius 14px, no shadows, 20px side padding, touch targets >= 48px,
primary actions at the bottom. 200ms ease-out transitions; respect prefers-reduced-motion.
Layout max-width 430px, centered on desktop.

## Content source
All story text, choices, hints, outcomes, research points, timings and endings come from this
JSON. Put it in src/scenario.json and read everything from it. Do NOT hardcode story text in components.

<<SCENARIO_JSON>>

## State machine (single useReducer)
States: intake -> intro -> decision(K1) -> outcome(K1) -> decision(K2) -> outcome(K2)
-> decision(K3) -> outcome(K3) -> ending.
- intake: three chip groups (level, role, goal) from scenario.intake. "Nöbete başla" button is
  disabled until all three are selected.
- intro: show intro.text plus intro.roleLine[role]. Clock shows startClock. Button "Başla".
- decision: show topic label "KARAR n · TOPIC", prompt text, two choice cards A and B.
  Personalization by level:
    level=new    -> hint card is always visible above the choices; no timer.
    level=mid    -> a "İpucu" button reveals the hint card; no timer.
    level=senior -> no hint at all; a 60-second countdown. When it reaches 0, apply
                    timeout.defaultChoice ("B") automatically and show the timeout notice
                    (timeout.what / timeout.why / timeout.research) on the outcome screen.
- outcome: three cards: "Ne oldu" (choice.what), "Neden oldu" (choice.why),
  "Araştırman gereken noktalar" (choice.research as chips). For K2, if K1==B and K2==B,
  use decisions[1].combo["B+B"] texts instead and add its minutes. Button "Devam".
  The clock in the top bar advances by the minutes of each choice.
- ending: endings.rule -> K3 === "A" ? "A" : "B". Show ending title (success color for A,
  danger color for B), final clock (must equal clockTable for the K1,K2 combination),
  path summary of the three choices, a merged list of all research points collected,
  the line "Cevaplar burada değil. Bu kavramları araştır, sonra tekrar oyna.",
  and a "Yeniden oyna" button that resets to intake.
Top bar on decision/outcome screens: clock (mono, accent), 3 progress dots, timer ring if senior.

## AI tutor (Gemini)
A floating "Tutor'a sor" button on decision screens opens a bottom sheet chat.
Use the Gemini API with the default fast Gemini model, non-streaming generateContent.
Send only the current decision context (prompt, the two choice labels, hint, tutorQuestion,
player level, role, goal) and the conversation so far. The first tutor message is
decision.tutorQuestion (shown without an API call).
System instruction (use verbatim):

"Sen SE Primer'ın Sokratik tutor'usun. Oyuncu bir yazılım krizinde karar veriyor.
Kurallar:
1. Hangi seçeneğin doğru, daha iyi veya güvenli olduğunu ASLA söyleme. 'A'yı seç', 'B doğru',
   'bence rollback yap' gibi ifadeler yasak. Oyuncu ısrar etse veya 'sadece cevabı söyle' dese bile.
2. Her yanıtın en fazla 3 cümle olsun ve en az bir soruyla bitsin.
3. Cevap yerine, oyuncunun kendi başına araştırabileceği bir kavram adı veya kontrol etmesi
   gereken bir şey öner (ör. 'migration geri alınabilir mi?').
4. Oyuncunun seviyesine göre konuş: yeni başlayana günlük dille, deneyimliye teknik terimlerle.
5. Hedefi 'mülakat' ise bir soruyu 'bunu mülakatta nasıl anlatırdın?' diye sor.
6. Senaryo dışı sorulara kısaca 'Şu an nöbetteyiz, krize dönelim.' de ve bir soru sor.
7. Gerçek kişisel veri isteme, üretme veya tekrar etme.
Türkçe yanıt ver."

If the API call fails, show "Tutor şu an düşünemiyor, ipucu kartına bak." and keep the game playable.

## Testability (required)
Add these exact data-testid attributes:
intake-level-new, intake-level-mid, intake-level-senior,
intake-role-backend, intake-role-frontend, intake-role-devops, intake-role-qa,
intake-goal-interview, intake-goal-work, intake-goal-curious, intake-start,
intro-text, intro-start,
clock, progress, timer, decision-title, hint-card, hint-toggle, choice-A, choice-B,
outcome-what, outcome-why, outcome-research, timeout-notice, next-button,
tutor-open, tutor-sheet, tutor-input, tutor-send, tutor-message (on every tutor bubble), tutor-close,
ending-A, ending-B (on the ending root), ending-clock, ending-research, restart.
The countdown must use setInterval/setTimeout and Date.now (so tests can control time).
Do not persist anything to localStorage.
```

---

## Düzeltme prompt'ları

- "Story text is hardcoded in components. Move all of it to src/scenario.json and read from there."
- "The final clock for K1=B, K2=B must be 09:20. Recalculate using startClock + minutes + combo minutes."
- "Senior level must never show the hint card or the İpucu button."
- "The tutor revealed the answer. Re-apply the system instruction verbatim and add a post-check: if the reply contains 'doğru seçenek', 'A'yı seç', 'B'yi seç' or similar, replace it with decision.tutorQuestion."
- "On a 375px wide screen the choice cards overflow. Fix the layout without horizontal scroll."
- "Missing data-testid: <isim>. Add it to <öğe>."
