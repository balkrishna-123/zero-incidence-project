# Zero Incident — Class Diagram

> How to view this file:
> - **On GitHub**: push it to your repo — GitHub renders Mermaid diagrams natively in `.md` files (open it on the repo's *Code* page).
> - **Anywhere**: paste the code block below into <https://mermaid.live> and export as PNG/SVG.

```mermaid
classDiagram
    direction LR

    class User {
        +String firstName
        +String lastName
        +Number age
        +String employeeNumber
        +String username
        +String passwordHash
        +enum role "admin | employee"
        +enum status "active | inactive"
        +Boolean mustChangePassword
        +Number sessionVersion
        +Date lastLoginAt
        +Date passwordChangedAt
        +Boolean isDemo
        +create()
        +findOne()
        +findById()
        +updateOne()
    }

    class Trainer {
        +String firstName
        +String lastName
        +String nickname
        +String nicknameKey
        +Number age
        +String imageUrl
        +String introduction
        +enum status "active | inactive"
        +create()
        +find()
        +exists()
    }

    class Module {
        +String key
        +String title
        +String description
        +String[] objectives
        +String[] rules
        +ObjectId trainerId
        +find()
        +updateMany()
    }

    class Progress {
        +ObjectId employeeId
        +String moduleKey
        +Number score
        +Number attempts
        +Date assessedAt
        +ObjectId bestAttemptId
        +Number activityScore
        +Number quizScore
        +Number lastScore
        +enum source "demo | assessment"
        +create()
        +updateOne()
        +progressSummary()$
    }

    class TrainingAttempt {
        +ObjectId employeeId
        +String moduleKey
        +String version
        +enum phase
        +Boolean open
        +ActivityAnswer[] activityAnswers
        +AreaClassification[] classifications
        +String[] quizOrder
        +QuizAnswer[] quizAnswers
        +Number activityScore
        +Number quizScore
        +Number score
        +Date completedAt
        +create()
        +findOne()
        +updateOne()
    }

    class Certificate {
        +ObjectId employeeId
        +String programVersion
        +String programTitle
        +String certificateId
        +String employeeName
        +Boolean demoLearner
        +ModuleSnapshot[] modules
        +Number overallScore
        +Date issuedAt
        +ObjectId issuedBy
        +String snapshotDigest
        +create()
        +findOne()
    }

    class Counter {
        +String _id
        +Number value
        +nextEmployeeNumber()$
    }

    class Audit {
        +ObjectId actorId
        +String actorName
        +String action
        +String subject
        +Date createdAt
        +create()
        +find()
    }

    class ActivityAnswer {
        +String taskId
        +String optionId
        +Boolean correct
        +Boolean identificationCorrect
        +Date answeredAt
    }

    class QuizAnswer {
        +String questionId
        +String optionId
        +Boolean correct
        +Boolean timedOut
        +Date answeredAt
    }

    class AreaClassification {
        +String objectId
        +Boolean flagged
        +Boolean correct
        +Date classifiedAt
    }

    class ModuleSnapshot {
        +String key
        +String title
        +String version
        +ObjectId attemptId
        +Number score
        +Date assessedAt
        +Date firstPassedAt
        +String evidenceDigest
    }

    class Error {
        <<abstract>>
    }
    class HttpError {
        ..server..
    }
    class ApiError {
        ..frontend..
    }

    User "1" ..> "*" Progress : employeeId
    User "1" ..> "*" TrainingAttempt : employeeId
    User "1" ..> "*" Certificate : employeeId
    User "1" ..> "*" Audit : actorId
    User "0..1" ..> "1" Certificate : issuedBy
    Trainer "1" ..> "0..*" Module : trainerId
    Progress "*" ..> "0..1" TrainingAttempt : bestAttemptId

    TrainingAttempt "1" *-- "0..*" ActivityAnswer : activityAnswers
    TrainingAttempt "1" *-- "0..*" QuizAnswer : quizAnswers
    TrainingAttempt "1" *-- "0..*" AreaClassification : classifications
    Certificate "1" *-- "0..*" ModuleSnapshot : modules

    Error <|-- HttpError
    Error <|-- ApiError
```
