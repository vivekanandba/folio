# KIND: detective — Diagnose

**Cognitive verb:** Diagnose  
**Win condition:** Learner selects the correct behaviour label while the assembled composition visual is visible. Early diagnose allowed with lower max or penalty if composition incomplete.

## Forbidden climaxes

- Detached 4-choice MCQ that does not reference / sit beside the visual state

## Affordances

- Sequential clue reveal
- Composition donut/stack updates as clues unlock
- Diagnosis chips describing portfolio behaviour

## Acceptance scenarios

### scenario-visual-diagnosis
Given composition segments revealed  
When learner picks the correct behaviour label with the visual on screen  
Then score awards a win and principle debrief shows

## Tests

- `tests/kinds/detective.win.test.ts`
