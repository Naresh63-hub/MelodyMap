# Firestore Security Specification

## Data Invariants
1. Users may only read and write their own documents under `/users/{userId}` and subcollections.
2. Cross-user access is strictly disallowed: user A cannot read, query, create, update, or delete user B's likes, playlists, history, or settings.
3. Every document created under `/users/{userId}` or its subcollections must have its `userId` attribute match `request.auth.uid`.
4. Document IDs must conform to valid string regex format (`^[a-zA-Z0-9_\-]+$`) with a maximum length of 128 characters.
5. All updates must maintain ownership and schema integrity.

## The Dirty Dozen Payloads
1. **Unauthenticated Read**: Attempting to read `/users/user123` without auth. (Expected: DENIED)
2. **Cross-User Profile Read**: Auth as `userA` attempting to read `/users/userB`. (Expected: DENIED)
3. **Cross-User Profile Write**: Auth as `userA` attempting to write to `/users/userB`. (Expected: DENIED)
4. **Forged Owner Profile Create**: Auth as `userA` attempting to write `{ id: "userB" }` to `/users/userA`. (Expected: DENIED)
5. **Cross-User Likes Query**: Auth as `userA` attempting to list `/users/userB/likes`. (Expected: DENIED)
6. **Cross-User Like Creation**: Auth as `userA` writing a liked song into `/users/userB/likes/track1`. (Expected: DENIED)
7. **Mismatched Like Payload**: Auth as `userA` writing `{ userId: "userB", ... }` into `/users/userA/likes/track1`. (Expected: DENIED)
8. **Oversized Document ID**: Auth as `userA` writing to `/users/userA/likes/{string_with_2000_characters}`. (Expected: DENIED)
9. **Cross-User Playlist Modification**: Auth as `userA` attempting to edit or delete `/users/userB/playlists/pl1`. (Expected: DENIED)
10. **Playlist Injection with Excess Fields**: Writing unvalidated shadow fields into `/users/userA/playlists/pl1`. (Expected: DENIED)
11. **History Manipulation of Another User**: Auth as `userA` deleting `/users/userB/history/h1`. (Expected: DENIED)
12. **Settings Hijacking**: Auth as `userA` reading or overwriting `/users/userB/settings/preferences`. (Expected: DENIED)
