# Nerdshive User Audit Report

## 1. SQL Queries Executed (via SQLAlchemy)
```sql
SELECT * FROM auth_users;
SELECT * FROM users;
SELECT * FROM admins;
SELECT * FROM superuser;
SELECT * FROM company_admins;
SELECT * FROM companies;
```

## 2. Summary Statistics
- **Total Auth Users:** 36
- **Total Customers (Users):** 15
- **Total Admins:** 4
- **Total Superusers:** 1
- **Total Company Admins:** 8
- **Total Orphaned Auth Records:** 8

## 3. Account Details
| Email | Role | Full Name | Active | Approved | Company Name | Login Working? | Profile Exists? | Created Date |
|---|---|---|---|---|---|---|---|---|
| admin@example.com | Admin | Default Admin | Yes | N/A | N/A | Yes | Yes | 2026-06-18 04:21:01 |
| testuser@example.com | None (Orphan) | N/A | Yes | N/A | N/A | Yes | No | 2026-06-18 04:56:42 |
| arulmozhi27sk@gmail.com | None (Orphan) | N/A | Yes | N/A | N/A | Yes | No | 2026-06-18 04:59:31 |
| newtest@example.com | None (Orphan) | N/A | Yes | N/A | N/A | Yes | No | 2026-06-18 05:03:27 |
| user_7636@example.com | Customer | Updated Test User | Yes | Yes | N/A | Yes | Yes | 2026-06-18 05:34:56 |
| veerasklm@gmail.com | None (Orphan) | N/A | Yes | N/A | N/A | Yes | No | 2026-06-18 05:53:47 |
| shaarul2k7@gmail.com | None (Orphan) | N/A | Yes | N/A | N/A | Yes | No | 2026-06-18 06:02:33 |
| admin10@gmail.com | CompanyAdmin | admin10 | Yes | N/A | company10 | Yes | Yes | 2026-06-20 11:54:45 |
| admine51e2251@example.com | CompanyAdmin | Admin Tester | No | N/A | Test Corp e51e2251 | No | Yes | 2026-06-22 05:41:04 |
| arulmozhi39sk@gmail.com | None (Orphan) | N/A | Yes | N/A | N/A | Yes | No | 2026-06-18 04:50:02 |
| onetwo@gmail.com | Customer | arul | Yes | Yes | N/A | Yes | Yes | 2026-06-18 09:53:57 |
| arul0309@gmail.com | CompanyAdmin | arulmozhi S | Yes | N/A | company20 | Yes | Yes | 2026-06-22 05:45:16 |
| enroll_test_a_1226@example.com | Customer | Alice Smith | Yes | Yes | N/A | Yes | Yes | 2026-06-18 11:46:18 |
| enroll_test_b_1226@example.com | Customer | Charlie Brown | Yes | Yes | N/A | Yes | Yes | 2026-06-18 11:46:18 |
| admin@nerdshive.local | Admin | arul | Yes | N/A | N/A | Yes | Yes | 2026-06-18 10:01:54 |
| enroll_test_a_5017@example.com | Customer | Alice Smith | Yes | Yes | N/A | Yes | Yes | 2026-06-18 12:15:44 |
| enroll_test_b_5017@example.com | Customer | Charlie Brown | Yes | Yes | N/A | Yes | Yes | 2026-06-18 12:15:44 |
| querytest_82105@example.com | None (Orphan) | N/A | Yes | N/A | N/A | Yes | No | 2026-06-18 12:54:38 |
| querytest_13295@example.com | None (Orphan) | N/A | Yes | N/A | N/A | Yes | No | 2026-06-19 01:58:30 |
| alice.smith@example.com | Customer | Alice Smith | Yes | Yes | N/A | Yes | Yes | 2026-06-19 02:01:39 |
| charlie.brown@example.com | Customer | Charlie Brown | Yes | Yes | N/A | Yes | Yes | 2026-06-19 02:01:39 |
| jane.doe@example.com | Customer | Jane Doe | Yes | Yes | N/A | Yes | Yes | 2026-06-19 02:01:39 |
| john.doe@example.com | Customer | John Doe | Yes | Yes | N/A | Yes | Yes | 2026-06-19 02:01:40 |
| emily.watson@example.com | Customer | Emily Watson | Yes | Yes | N/A | Yes | Yes | 2026-06-19 02:01:40 |
| two@gmail.com | Customer | two | Yes | Yes | N/A | Yes | Yes | 2026-06-19 06:17:05 |
| one@gmail.com | Customer | hi | Yes | Yes | N/A | Yes | Yes | 2026-06-18 12:47:43 |
| superuser@example.com | Superuser | Default Superuser | Yes | N/A | N/A | Yes | Yes | 2026-06-18 04:21:01 |
| superuser@emple.com | Admin | N/A | Yes | N/A | N/A | Yes | Yes | 2026-06-20 07:20:03 |
| superuser@example.c | Admin | N/A | Yes | N/A | N/A | Yes | Yes | 2026-06-20 07:31:21 |
| a@gmail.com | CompanyAdmin | a | Yes | N/A | a | Yes | Yes | 2026-06-20 11:05:00 |
| arulmozhi@gmail.com | CompanyAdmin | arulmozhi | Yes | N/A | company | Yes | Yes | 2026-06-20 11:12:34 |
| arul@gmail.com | CompanyAdmin | arul | Yes | N/A | jj motor | Yes | Yes | 2026-06-20 10:45:20 |
| admin.alpha@example.com | CompanyAdmin | Admin Alpha | No | N/A | Test Company Alpha | No | Yes | 2026-06-22 06:44:35 |
| admin2@example.com | CompanyAdmin | Test Admin | No | N/A | Test Company 2 | No | Yes | 2026-06-22 10:35:24 |
| bob.johnson@example.com | Customer | Bob Johnson | Yes | Yes | company20 | Yes | Yes | 2026-06-22 13:17:26 |
| charlie.davis@example.com | Customer | Charlie Davis | Yes | Yes | company20 | Yes | Yes | 2026-06-22 13:17:26 |

## 4. Inconsistencies & Recommendations
- Found 8 orphaned auth_users records that have no corresponding profile in any role table.
-   - Orphan: testuser@example.com
-   - Orphan: arulmozhi27sk@gmail.com
-   - Orphan: newtest@example.com
-   - Orphan: veerasklm@gmail.com
-   - Orphan: shaarul2k7@gmail.com
-   - Orphan: arulmozhi39sk@gmail.com
-   - Orphan: querytest_82105@example.com
-   - Orphan: querytest_13295@example.com

### Recommended Fixes:
- Delete the orphaned `auth_users` records or assign them appropriate profiles.
- Ensure transaction integrity when creating accounts to prevent `auth_users` records being created without a corresponding profile.