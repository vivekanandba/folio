# KIND: classify — Discriminate

**Cognitive verb:** Discriminate  
**Win condition:** Placement accuracy = count of cards in correct bucket / total cards (optionally averaged across rounds).

## Forbidden climaxes

- Ending with a detached MCQ that ignores bucket placement
- Auto-completing without a check step

## Affordances

- Drag cards into buckets (tap-to-place fallback on mobile)
- Check placement → review rows
- Optional round 2 with harder cards

## Acceptance scenarios

### scenario-perfect-placement
Given all cards assigned to correct buckets  
When the learner checks placement  
Then score = maxScore and debrief is shown

### scenario-partial-placement
Given some cards in wrong buckets  
When checked  
Then score = correct count and miss rows show the expected bucket

## Tests

- `tests/kinds/classify.win.test.ts`
