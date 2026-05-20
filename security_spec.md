# Jamia Management System - Hardened Security Specification

## Data Invariants & Zero-Trust Architecture
1. **Access Restrictiveness**: Direct access to student records, attendance charts, and exam outcomes is bounded strictly by identity. Only verified administrator accounts can `read`, `list`, `create`, `update`, or `delete` documents.
2. **Relational Integrity**: Attendance logs and exam outputs cannot exist without referencing a valid, active student document inside the `/students/` collection.
3. **Temporal Integrity**: Chronological entries like `createdAt` and `updatedAt` for logs must correspond exactly to `request.time`. Created timestamps on students are immutable after creation.
4. **Value Range Enforcement**: Marks, percentages, status tags, and enum categories must strictly reside in their designated ranges and lists (e.g., ExamType being quarterly, half-yearly, or annual).

## The Dirty Dozen Red-Team Attack Payloads
We simulated twelve major client-side attack configurations to ensure the system defends against resource poisoning, state shortcuts, and identity spoofing:

1. **Email Spoofing (Admin Bypass)**: Submitting requests with a simulated `'noorullahsail0@gmail.com'` email header but with `email_verified` set to `false`.
2. **Unauthorized Read**: Guests or unauthorized signed-in accounts attempting to fetch a student's private contact phone number or CNIC records.
3. **Junk ID Poisoning**: Registering a student using a 50KB character string containing custom injection sequences (blocked by standard standard alphanumeric `isValidId` check).
4. **Shadow Field Injection**: Adding custom fields like `role: 'admin'` or `isSpecial: true` during student creation or update (prevented by complete schema verification).
5. **Orphaned Attendance Write**: Creating daily attendance logs referencing a randomized dummy student ID (blocked by relational checking with `exists()`).
6. **Immutable Timestamp Reset**: Updating existing student records to change the `createdAt` date to the past.
7. **Subject Range Manipulation**: Submitting exam grades as map keys containing non-numeric strings or massive arrays.
8. **Invalid Enum Entry**: Updating student enrollment status to `'withdrawn'` instead of standard enum strings `'active'`, `'left'`, or `'graduated'`.
9. **Phone Number Overflow**: Attempting a Denial-of-Wallet resource exhaustion attack by saving phone strings larger than 50 characters.
10. **Orphaned Result Entry**: Creating Exam Results without verifying that the referenced Student ID actually exists.
11. **Client status tampering**: Bypassing UI prompts to self-promote an expired student directly to graduand status.
12. **Malicious deletion**: Guests attempting to execute bulk delete calls across collections.

## Implementation Blueprint
- **Global Safety Rule**: A default catch-all denial: `match /{document=**} { allow read, write: if false; }`.
- **Identity Hardening**: Enforcing both email equivalence and direct positive certification: `request.auth.token.email_verified == true`.
- **Type Constraints**: Validation helper wrappers for every write block ensuring type matching, size checks, and regex guards.
