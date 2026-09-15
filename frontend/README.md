# Frontend migration boundary

The current static application remains the compatibility UI. This folder is the target boundary for the React/TypeScript migration.

Recommended order:
1. move API clients into `src/lib/apiClient.ts`
2. move domain types into `src/types/domain.ts`
3. move design primitives into `src/components`
4. move each ThinkForge stage into `src/features/<stage>`
5. migrate one stage at a time while keeping end-to-end behavior unchanged
