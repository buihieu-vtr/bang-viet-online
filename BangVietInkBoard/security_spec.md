# Security Specification & Payload-First TDD

## 1. Data Invariants
1. **Strict User Isolation**: Every notebook (`users/{userId}/notebooks/{notebookId}`), page (`users/{userId}/notebooks/{notebookId}/pages/{pageId}`), and private profile (`users/{userId}/private/info`) is strictly readable and writable ONLY by the verified user whose `request.auth.uid == userId` and `request.auth.token.email_verified == true`.
2. **PII Split Collection**: `email` is isolated in `users/{userId}/private/info`, never placed in `users/{userId}/public/profile`.
3. **Immutable Ownership & Creation Timestamps**: `ownerId` / `uid`, `notebookId`, `id`, and `createdAt` cannot be modified after creation. `createdAt` on create and `updatedAt` on create/update must equal `request.time`.
4. **Master Gate**: Page creation/updates verify parent notebook existence (`exists(...)` / `existsAfter(...)`) and ownership (`ownerId == request.auth.uid`).
5. **Bounded Payloads**: Every string has `.size()` bounds, IDs match `^[a-zA-Z0-9_\-]+$`, and arrays (`customColors`, `elements`) have bounded `.size()` limits.

## 2. The "Dirty Dozen" Attack Payloads
1. Unauthenticated read/write to `/users/u1/notebooks/nb1` -> `PERMISSION_DENIED`
2. Authenticated user `u2` reading or listing `/users/u1/notebooks` -> `PERMISSION_DENIED`
3. Unverified email user (`email_verified == false`) writing `/users/u1/notebooks/nb1` -> `PERMISSION_DENIED`
4. Identity spoofing: `u1` creating `/users/u1/notebooks/nb1` with `ownerId: "u2"` -> `PERMISSION_DENIED`
5. Shadow field / Ghost field injection: creating notebook with extra `isAdmin: true` -> `PERMISSION_DENIED`
6. Path variable poisoning: creating doc with ID `../../admin` or 500-char ID -> `PERMISSION_DENIED`
7. Client timestamp spoofing: creating/updating with `createdAt: "2020-01-01"` instead of `request.time` -> `PERMISSION_DENIED`
8. Immutable field tampering: updating `ownerId` or `createdAt` on an existing notebook -> `PERMISSION_DENIED`
9. PII leak: `u2` attempting `get` on `/users/u1/private/info` -> `PERMISSION_DENIED`
10. Unbounded array poisoning: `customColors` with 100 entries or `elements` > 2500 -> `PERMISSION_DENIED`
11. Invalid enum value: page with `template: "hacked"` or `pageSize: "huge"` -> `PERMISSION_DENIED`
12. Orphaned page write: creating page under a non-existent parent notebook ID -> `PERMISSION_DENIED`
