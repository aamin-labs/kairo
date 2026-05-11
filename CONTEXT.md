# Kairo Review

Kairo Review is an Anki-style review app where a learner answers cards, receives model coaching, and owns the final memory rating.

## Language

**Feedback**:
Model critique of the learner's submitted answer.
_Avoid_: Grading, score

**Follow-up prompt**:
An optional model question after **Feedback** that deepens recall or precision.
_Avoid_: Feedback question, quiz

**Follow-up reply**:
The learner's response to a **Follow-up prompt**.
_Avoid_: Second answer, correction

**Coaching thread**:
A short chat-like exchange after **Feedback** and before rating.
_Avoid_: Chat history, conversation

**Coaching response**:
Model response to a **Follow-up reply** that may correct the learner and ask one next useful question.
_Avoid_: Grade, rating

**Rating**:
The learner's own memory-confidence choice used to schedule the card.
_Avoid_: Model rating, grade

**Review memory**:
A card's saved prior review signal used to make later feedback more specific to the learner's recurring fragile points.
_Avoid_: Cache, history, transcript

**Fragile point**:
The specific concept, distinction, or mechanism the learner previously missed or expressed weakly on a card.
_Avoid_: Mistake, weakness, gap

**Learning edge**:
The current most useful fragile point for the learner to strengthen on a card.
_Avoid_: Mistake log, weakness list

**Evidence**:
The brief reason a learning edge was selected from the learner's latest answer or coaching thread.
_Avoid_: Audit log, transcript

**Append import**:
Adding imported cards to the current deck without changing existing cards or review progress.
_Avoid_: Re-import, reset, replace import

**Duplicate card**:
An imported card with the same question and answer as a card already in the deck.
_Avoid_: Repeat, copy

## Relationships

- **Feedback** may include one **Follow-up prompt**
- **Feedback** separates critique text from any **Follow-up prompt** in the domain model
- A **Coaching thread** continues from the learner's submitted answer instead of replacing it
- The learner's submitted answer appears as the first learner message in the **Coaching thread**
- The learner's submitted answer appears read-only once **Feedback** exists
- Initial **Feedback** appears to the learner as the first coach message in the **Coaching thread**
- Initial **Feedback** appears as normal tutor speech without a visible feedback label
- When initial **Feedback** includes a **Follow-up prompt**, they appear together as one coach message with the prompt last
- The expected answer appears as a separate inline card outside the **Coaching thread** because it is source truth, not tutor speech
- The expected-answer card keeps a clear heading so source truth is not confused with tutor speech
- The reply box belongs visually to the **Coaching thread** because it continues the conversation
- A **Follow-up prompt** may receive one or more **Follow-up replies**
- Follow-up replies continue through coaching behavior, not feedback behavior
- A **Coaching response** may correct the learner and ask one next useful question
- When a **Coaching response** includes a next **Follow-up prompt**, they appear together as one coach message with the prompt last
- A **Coaching thread** belongs to one review attempt
- A **Coaching thread** is capped at four learner replies in the MVP
- A full **Coaching thread** is saved with the review attempt but does not affect scheduling
- After **Feedback** appears, the review flow remains single-column: question, learner answer, tutor feedback, expected-answer card, optional reply, then rating
- **Rating** appears after the optional reply box while remaining available once **Feedback** exists
- The review flow avoids generic rating prompts when rating buttons are already visible
- A **Rating** remains outside the **Coaching thread** because it is the learner's judgment, not conversation
- A **Rating** remains available even when a **Coaching thread** is active
- **Review memory** may inform later **Feedback** for the same card
- **Review memory** centers on the current **Learning edge**, not a full transcript
- **Feedback** uses **Review memory** to compare the current answer against prior **Fragile points**
- A **Follow-up prompt** may revisit, deepen, or reframe a prior **Fragile point**
- A **Coaching response** prioritizes the current **Coaching thread** before **Review memory**
- **Review memory** tracks the card's current **Learning edge**, not every prior **Fragile point**
- When the learner improves on a **Learning edge**, **Review memory** may be replaced or cleared
- The model identifies the next **Learning edge**; the app stores the resulting **Review memory**
- **Review memory** is hidden from the learner in the MVP
- **Review memory** is committed when the learner gives a **Rating**, not when **Feedback** first appears
- **Coaching response** may update proposed **Review memory** before the learner gives a **Rating**
- When multiple proposed **Review memory** updates exist in one attempt, the latest proposal wins
- Persisted **Review memory** contains the current **Learning edge**, its **Evidence**, and when it was updated
- An **Append import** preserves existing cards, ratings, scheduling, attempts, and **Review memory**
- An **Append import** adds new cards and skips **Duplicate cards** without updating existing card fields
- First-time deck import and **Append import** are separate learner actions
- Cards added through **Append import** enter the deck as new cards eligible for immediate review

## Example dialogue

> **Dev:** "Should the follow-up question block the learner from rating the card?"
> **Domain expert:** "No. The **Follow-up prompt** is optional coaching. The learner can reply, skip it, or rate immediately."

## Flagged ambiguities

- "follow up" could mean part of **Feedback** or a separate **Follow-up prompt**; resolved: it is a separate optional coaching turn after feedback.
- **Feedback** used to be one prose blob; resolved: critique text and **Follow-up prompt** are separate fields, but may be presented together as one coach message.
- "chat" could imply open-ended conversation; resolved: a **Coaching thread** is capped at four learner replies in the MVP.
- "cache" could imply reusing technical outputs to avoid model calls; resolved: the domain concept is **Review memory**, which exists to improve learner-aware feedback.
- "history" could imply storing every prior turn; resolved: the MVP memory unit is a compact **Fragile point** signal.
- "saving token costs" could imply skipping model calls; resolved: the MVP uses **Review memory** to improve coaching quality before adding model-call avoidance.
- "previous mistakes" could imply a growing mistake log; resolved: **Review memory** tracks the current **Learning edge** only.
- **Review memory** should not be inferred from feedback prose by app logic; resolved: the model returns structured memory metadata and the app stores it.
- "import" could mean replacing the deck or adding to it; resolved: **Append import** adds new cards without changing existing review progress.
- "same card" is identified by normalized question and answer in the MVP; resolved: **Duplicate cards** are skipped during **Append import**. Normalization trims, collapses whitespace, and ignores case.
- "duplicate" could imply updating changed context or explanation; resolved: **Duplicate cards** are skipped entirely during **Append import** in the MVP.
