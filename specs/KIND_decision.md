# KIND: decision — Judge

**Cognitive verb:** Judge  
**Win condition:** Sum of `scoreDelta` on chosen edges, clamped to [0, maxScore]. Ending always shows principle + debrief.

## Forbidden climaxes

- Rendering `undefined` when `text` missing on ending nodes
- Infinite redirect loops with no teaching ending

## Affordances

- Path A/B choices
- Visited-node trail / minimap
- Ending principle card

## Acceptance scenarios

### scenario-path-score
Given choices with scoreDeltas  
When learner reaches an ending  
Then score = clamp(sum(deltas), 0, max)

### scenario-ending-without-text
Given an ending node with no `text`  
When rendered  
Then only principle/debrief show (no "undefined")

## Tests

- `tests/kinds/decision.win.test.ts`
