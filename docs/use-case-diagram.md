# Zero Incident — Use Case Diagram

> How to view this file:
> - **On GitHub**: push it to your repo — GitHub renders Mermaid diagrams natively in `.md` files (open it on the repo's *Code* page).
> - **Anywhere**: paste the code block below into <https://mermaid.live> and export as PNG/SVG.

```mermaid
usecaseDiagram
    actor "Employee (Learner)" as Employee
    actor "Administrator" as Admin

    rectangle "Zero Incident" {
        usecase "Log in" as UC_Login
        usecase "Log out" as UC_Logout
        usecase "Set initial password" as UC_FirstPw
        usecase "Change password" as UC_ChgPw

        usecase "View training dashboard (progress summary)" as UC_Dash
        usecase "View module" as UC_ViewMod
        usecase "Start module attempt" as UC_Start
        usecase "Complete module activity (checkpoints / hazard walk)" as UC_Activity
        usecase "Take timed quiz (30 marks, 20s per question)" as UC_Quiz
        usecase "View results & history" as UC_Results
        usecase "Retake module" as UC_Retake

        usecase "Verify 70+ in all 3 modules" as UC_Verify
        usecase "Generate certificate" as UC_GenCert
        usecase "Download certificate PDF" as UC_Pdf

        usecase "View overview dashboard" as UC_Overview
        usecase "Search employees" as UC_SearchEmp
        usecase "Manage employees (create / edit / status / delete)" as UC_MgrEmp
        usecase "View employee progress" as UC_ViewProg
        usecase "Manage trainers (create / edit / image / status)" as UC_MgrTrainer
        usecase "Search certificate records" as UC_SearchCert
        usecase "Issue certificate" as UC_IssueCert

        Employee --> UC_Login
        Employee --> UC_Logout
        Employee --> UC_FirstPw
        Employee --> UC_ChgPw
        Employee --> UC_Dash
        Employee --> UC_ViewMod
        Employee --> UC_Start
        Employee --> UC_Activity
        Employee --> UC_Quiz
        Employee --> UC_Results
        Employee --> UC_Retake
        Employee --> UC_GenCert
        Employee --> UC_Pdf

        Admin --> UC_Login
        Admin --> UC_Logout
        Admin --> UC_Overview
        Admin --> UC_SearchEmp
        Admin --> UC_MgrEmp
        Admin --> UC_ViewProg
        Admin --> UC_MgrTrainer
        Admin --> UC_SearchCert
        Admin --> UC_IssueCert
        Admin --> UC_Pdf

        UC_FirstPw ..> UC_Login : <<extend>>
        UC_Retake ..> UC_Start : <<include>>
        UC_Activity ..> UC_Start : <<include>>
        UC_Quiz ..> UC_Start : <<include>>
        UC_GenCert ..> UC_Verify : <<include>>
        UC_IssueCert ..> UC_Verify : <<include>>
        UC_Pdf ..> UC_GenCert : <<include>>
    }
```

**Notes**
- *Set initial password* extends *Log in* only when `mustChangePassword` is true (first-login onboarding).
- *Verify 70+ in all 3 modules* is the certificate gate: genuine assessed best scores of ≥70/100 in every module; demo/sample scores and averages cannot bypass it.
- Employee numbers are minted atomically as `ZI-<year>-<seq>` via a `Counter` document.
