# Pack UI

## Order

1. Header + source attribution  
2. Continue (next incomplete curriculum session, else first)  
3. Tabs (Phase 3+): Sheet | Concepts | Sessions — Phase 1 shows Sessions then Concepts sections  
4. Sessions: kind, concepts practiced, best score  
5. Concepts: frontmatter title + “practiced by” session chips  
6. Phase 4: Revisit weak concepts

## Acceptance

### scenario-concept-titles
Given concept MD with frontmatter title  
When Pack renders  
Then title from frontmatter is shown (not slug pretty-id alone)

### scenario-continue
Given some sessions incomplete  
When Hub/Pack Continue is shown  
Then it links to the first incomplete curriculum session

## Tests

- `tests/unit/pack.curriculum.test.ts`
