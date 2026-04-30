# Security Specification for CollabGrid

## Data Invariants
1. A user can only be created with their own UID.
2. A project must have at least one member (the owner).
3. A task must belong to a project and have a valid priority and status.
4. Only project owners (Admins) can add/remove members.
5. Members can only see projects they belong to.
6. Members can only update tasks assigned to them (or creator/owner can update any task in project).

## The Dirty Dozen Payloads (Targeting Projects & Tasks)

### 1. Identity Spoofing (Create User)
**Payload:** `{ "id": "ATTACKER_UID", "name": "Fake Me", "email": "victim@example.com", "role": "Admin" }`
**Target:** `/users/VICTIM_UID`
**Result:** PERMISSION_DENIED (UID mismatch)

### 2. Privilege Escalation (User Update)
**Payload:** `{ "role": "Admin" }`
**Target:** `/users/MEMBER_UID` (by Member)
**Result:** PERMISSION_DENIED (cannot change own role)

### 3. Unauthorized Project Read
**Target:** `/projects/SECRET_PROJECT` (where user is not in `memberIds`)
**Result:** PERMISSION_DENIED

### 4. Shadow Project Creation
**Payload:** `{ "name": "Evil", "ownerId": "VICTIM_UID", "memberIds": ["VICTIM_UID"] }`
**Target:** `/projects/NEW_ID`
**Result:** PERMISSION_DENIED (ownerId must match requester)

### 5. Member Theft (Add self to project)
**Payload:** `{ "memberIds": ["ORIGINAL_MEMBER", "ATTACKER_UID"] }`
**Target:** `/projects/PROJECT_ID` (by non-owner)
**Result:** PERMISSION_DENIED

### 6. Task Injection (Create task in project I don't own)
**Payload:** `{ "title": "Hack", "projectId": "REMOTE_PROJECT", "assigneeId": "ATTACKER_UID", ... }`
**Target:** `/projects/REMOTE_PROJECT/tasks/NEW_TASK`
**Result:** PERMISSION_DENIED

### 7. Unauthorized Task Update
**Payload:** `{ "status": "Done" }`
**Target:** `/projects/PROJECT_ID/tasks/TASK_ID` (by user not assigned and not owner)
**Result:** PERMISSION_DENIED

### 8. Immutable Field Mutation (Change Task projectId)
**Payload:** `{ "projectId": "NEW_PROJECT_ID" }`
**Target:** `/projects/PROJECT_ID/tasks/TASK_ID`
**Result:** PERMISSION_DENIED

### 9. Resource Poisoning (Giant Task Title)
**Payload:** `{ "title": "A".repeat(2000), ... }`
**Target:** `/projects/PROJECT_ID/tasks/TASK_ID`
**Result:** PERMISSION_DENIED (title size limit)

### 10. Orphaned Task (Create task with dummy projectId)
**Payload:** `{ "projectId": "NON_EXISTENT", ... }`
**Target:** `/projects/NON_EXISTENT/tasks/TASK_ID`
**Result:** PERMISSION_DENIED (project must exist)

### 11. Relational Sync Bypass (Delete project but keep tasks)
**Attempt:** Delete project directly.
**Result:** PERMISSION_DENIED (unless tasks are gone or restricted - actually Firestore rules can't enforce cascade delete, but we can restrict delete if subcollections exist? No, but we can ensure only owner can delete).

### 12. PII Leak (Read all users)
**Attempt:** `list /users`
**Result:** PERMISSION_DENIED (only allowed if searching for members, or limited read).
