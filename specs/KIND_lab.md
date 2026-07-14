# KIND: lab — Construct

**Cognitive verb:** Construct  
**Win condition:** Derived metric enters authored `passBand` before transfer check unlocks. Transfer check is optional bonus.

## Forbidden climaxes

- Judgment MCQ before pass band achieved
- Hardcoding finance formulas in the mount (use `labs/` plugins)

## Affordances

- Config-driven inputs with constraints (`sumTo`)
- Live derived displays (gauge/donut/twinBars)
- Pass-band gate → optional transfer check

## Acceptance scenarios

### scenario-pass-band
Given inputs that yield activeShare in [min, max]  
When evaluated  
Then `labInPassBand` is true and transfer may unlock

## Tests

- `tests/unit/labs.active-share.test.ts`
- `tests/kinds/lab.win.test.ts`
