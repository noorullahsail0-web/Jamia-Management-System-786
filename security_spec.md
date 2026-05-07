# Security Specification - Jamia Management System

## Data Invariants
- A student registration number must follow the defined patterns (DN/BN/DH + Year + ...).
- Attendance records must belong to a valid student.
- Exam results must belong to a valid student and correspond to the student's section/class.
- Phone numbers should follow a standard format.

## The "Dirty Dozen" Payloads (Attempted violations)
1. Creating a student with a random UUID instead of the pattern-based regNo.
2. Modifying another student's registration number after creation.
3. Injecting a 1MB string into the student's address field.
4. Marking attendance for a non-existent student.
5. Entering marks above 100 for a subject (Dars-e-Nizami).
6. Changing the `section` of a student to a value not in the enum.
7. Deleting a student record as an unauthenticated user.
8. Listing all students without authentication.
9. Updating a student's `isResident` status without providing `regNo`.
10. Spoofing `createdAt` to a past date.
11. Marking attendance with a status like 'holiday' (not in enum).
12. Fetching PII (phone number, address) as a guest.

## Implementation Plan
- Use `isValidId` and `isValidStudent` helpers.
- Restrict all writes to authenticated users (admins).
- Enforce immutability on `regNo` and `createdAt`.
- Enforce size limits on all strings.
