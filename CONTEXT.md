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

## Relationships

- **Feedback** may include one **Follow-up prompt**
- **Feedback** separates critique text from any **Follow-up prompt**
- A **Coaching thread** continues from the learner's submitted answer instead of replacing it
- The learner's submitted answer appears as the first learner message in the **Coaching thread**
- A **Follow-up prompt** may receive one or more **Follow-up replies**
- Follow-up replies continue through coaching behavior, not feedback behavior
- A **Coaching response** may correct the learner and ask one next useful question
- A **Coaching thread** belongs to one review attempt
- A **Coaching thread** is capped at four learner replies in the MVP
- A full **Coaching thread** is saved with the review attempt but does not affect scheduling
- A **Rating** remains available even when a **Coaching thread** is active

## Example dialogue

> **Dev:** "Should the follow-up question block the learner from rating the card?"
> **Domain expert:** "No. The **Follow-up prompt** is optional coaching. The learner can reply, skip it, or rate immediately."

## Flagged ambiguities

- "follow up" could mean part of **Feedback** or a separate **Follow-up prompt**; resolved: it is a separate optional coaching turn after feedback.
- **Feedback** used to be one prose blob; resolved: critique text and **Follow-up prompt** are separate fields.
- "chat" could imply open-ended conversation; resolved: a **Coaching thread** is capped at four learner replies in the MVP.
