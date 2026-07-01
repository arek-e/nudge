import Foundation

enum VestaDestination: Hashable {
    case settings
    case todayCalendar
}

enum VestaSheet: String, Identifiable {
    case streakCalendar

    var id: String { rawValue }
}

enum VestaAuthSessionState: Hashable {
    case loading
    case signedOut
    case signedIn
}

enum VestaAuthSurface: Equatable {
    case loading
    case authForm
    case content
}

enum VestaAuthPresentationPolicy {
    static func evaluate(sessionState: VestaAuthSessionState) -> VestaAuthSurface {
        switch sessionState {
        case .loading:
            .loading
        case .signedOut:
            .authForm
        case .signedIn:
            .content
        }
    }
}

struct AccountSettingsSnapshot: Equatable {
    let displayName: String
    let emailAddress: String
    let emailVerification: String
    let userId: String
    let sessionId: String
}

enum AccountSettingsPolicy {
    static func evaluate(
        firstName: String?,
        lastName: String?,
        username: String?,
        emailAddress: String?,
        userId: String?,
        sessionId: String?,
        hasVerifiedEmailAddress: Bool
    ) -> AccountSettingsSnapshot {
        AccountSettingsSnapshot(
            displayName: displayName(firstName: firstName, lastName: lastName, username: username, emailAddress: emailAddress),
            emailAddress: normalized(emailAddress) ?? "No email on this account",
            emailVerification: hasVerifiedEmailAddress ? "Verified" : "Not verified",
            userId: normalized(userId) ?? "Unavailable",
            sessionId: normalized(sessionId) ?? "Unavailable"
        )
    }

    private static func displayName(
        firstName: String?,
        lastName: String?,
        username: String?,
        emailAddress: String?
    ) -> String {
        let nameParts = [normalized(firstName), normalized(lastName)].compactMap(\.self)
        if !nameParts.isEmpty {
            return nameParts.joined(separator: " ")
        }

        if let username = normalized(username) {
            return username
        }

        if let emailAddress = normalized(emailAddress) {
            return emailAddress
        }

        return "Signed in"
    }

    private static func normalized(_ value: String?) -> String? {
        guard let value else { return nil }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}

enum CaptureAlert: String, Identifiable {
    case processingEditInterruption

    var id: String { rawValue }
}

enum CaptureFocusTarget: Hashable {
    case draft
    case trailingDraft
}

enum CaptureStage: Equatable {
    case analysisFailed
    case analysisTimedOut
    case idle
    case saving
    case refreshing
    case queued
    case processing
    case saved

    var label: String? {
        switch self {
        case .analysisFailed:
            "Analysis failed"
        case .analysisTimedOut:
            "Analysis timed out"
        case .idle:
            nil
        case .saving:
            "Saving"
        case .refreshing:
            "Updating context"
        case .queued:
            "Queued"
        case .processing:
            "Processing"
        case .saved:
            "Saved"
        }
    }

    var isWorking: Bool {
        switch self {
        case .saving, .refreshing, .queued, .processing:
            true
        case .analysisFailed, .analysisTimedOut, .idle, .saved:
            false
        }
    }

    var keepsSubmittedCaptureActive: Bool {
        switch self {
        case .analysisFailed, .analysisTimedOut, .queued, .processing:
            true
        case .idle, .refreshing, .saved, .saving:
            false
        }
    }
}

enum ChromeSignalTone: Equatable {
    case critical
    case degraded
}

struct ChromeSignal: Equatable {
    let accessibilityLabel: String
    let systemImageName: String
    let tone: ChromeSignalTone
    let usesShimmer: Bool

    init(
        accessibilityLabel: String,
        systemImageName: String,
        tone: ChromeSignalTone,
        usesShimmer: Bool = true
    ) {
        self.accessibilityLabel = accessibilityLabel
        self.systemImageName = systemImageName
        self.tone = tone
        self.usesShimmer = usesShimmer
    }
}

enum ChromeSignalPolicy {
    static func evaluate(
        stage: CaptureStage,
        statusMessage: String,
        hasLatestResult: Bool,
        isOnline: Bool = true
    ) -> ChromeSignal? {
        if !isOnline {
            return ChromeSignal(
                accessibilityLabel: "Offline. Changes are saved on this device and will sync when online.",
                systemImageName: "exclamationmark.triangle.fill",
                tone: .degraded
            )
        }

        return nil
    }
}

struct CaptureDraftResetOutcome: Equatable {
    let clearsLatestResult: Bool
    let clearsPendingResult: Bool
    let stage: CaptureStage
}

enum CaptureDraftResetPolicy {
    static func evaluate(
        currentText: String,
        nextText: String,
        hasLatestResult: Bool,
        hasPendingResult: Bool = false,
        stage: CaptureStage
    ) -> CaptureDraftResetOutcome {
        guard currentText != nextText else {
            return CaptureDraftResetOutcome(
                clearsLatestResult: false,
                clearsPendingResult: false,
                stage: stage
            )
        }

        if hasPendingResult && stage.keepsSubmittedCaptureActive {
            return CaptureDraftResetOutcome(
                clearsLatestResult: false,
                clearsPendingResult: false,
                stage: stage
            )
        }

        if hasLatestResult || hasPendingResult || stage == .saved {
            return CaptureDraftResetOutcome(
                clearsLatestResult: hasLatestResult,
                clearsPendingResult: hasPendingResult,
                stage: .idle
            )
        }

        return CaptureDraftResetOutcome(
            clearsLatestResult: false,
            clearsPendingResult: false,
            stage: stage
        )
    }
}

struct CaptureProcessingEdit: Equatable {
    let requiresInterruptionConfirmation: Bool
}

enum CaptureProcessingEditPolicy {
    static func evaluate(
        isLeadingDraft: Bool,
        currentText: String,
        nextText: String,
        hasPendingResult: Bool,
        stage: CaptureStage
    ) -> CaptureProcessingEdit {
        CaptureProcessingEdit(
            requiresInterruptionConfirmation: isLeadingDraft
                && hasPendingResult
                && (stage == .queued || stage == .processing)
                && currentText != nextText
        )
    }
}

struct CaptureDraftAutosave: Equatable {
    let bodyText: String
}

enum DailyNoteDraftHydrationPolicy {
    static func evaluate(
        currentDraft: String,
        currentTrailingDraft: String,
        bodyText: String?
    ) -> String? {
        guard let bodyText else { return nil }
        let body = bodyText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !body.isEmpty else { return nil }
        guard currentDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              currentTrailingDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return nil
        }
        return body
    }
}

enum DailyNoteParagraphRowsPolicy {
    static func merge(
        bodyText: String?,
        retainedRows: [RetainedCaptureRow]
    ) -> [RetainedCaptureRow] {
        let bodyParagraphs = paragraphs(from: bodyText)
        guard !bodyParagraphs.isEmpty else { return retainedRows }

        var remainingRows = retainedRows
        var projectedRows: [RetainedCaptureRow] = []
        for paragraph in bodyParagraphs {
            if let retainedIndex = retainedIndex(for: paragraph, in: remainingRows) {
                projectedRows.append(remainingRows.remove(at: retainedIndex))
            } else {
                projectedRows.append(RetainedCaptureRow(noteText: paragraph, stage: .saved))
            }
        }

        let activeRemainders = remainingRows.filter { row in
            row.stage.keepsSubmittedCaptureActive
        }
        return projectedRows + activeRemainders
    }

    private static func retainedIndex(
        for paragraph: String,
        in rows: [RetainedCaptureRow]
    ) -> Int? {
        if let mutationRowIndex = rows.firstIndex(where: { row in
            row.mutationId != nil && normalized(row.noteText) == paragraph
        }) {
            return mutationRowIndex
        }

        return rows.firstIndex { row in
            normalized(row.noteText) == paragraph
        }
    }

    private static func paragraphs(from bodyText: String?) -> [String] {
        guard let bodyText else { return [] }
        var paragraphs: [String] = []
        var currentLines: [String] = []

        func flushCurrentParagraph() {
            let paragraph = currentLines
                .joined(separator: "\n")
                .trimmingCharacters(in: .whitespacesAndNewlines)
            if !paragraph.isEmpty {
                paragraphs.append(paragraph)
            }
            currentLines.removeAll()
        }

        for line in bodyText.components(separatedBy: .newlines) {
            if line.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                flushCurrentParagraph()
            } else {
                currentLines.append(line.trimmingCharacters(in: .whitespaces))
            }
        }
        flushCurrentParagraph()
        return paragraphs
    }

    private static func normalized(_ value: String) -> String {
        value.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

enum CaptureDraftAutosavePolicy {
    static func evaluate(
        existingJournalText: String?,
        leadingDraft: String,
        trailingDraft: String,
        treatsLeadingDraftAsFullBody: Bool = false
    ) -> CaptureDraftAutosave? {
        let leading = leadingDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        let trailing = trailingDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !leading.isEmpty || !trailing.isEmpty else { return nil }

        let composition = JournalSaveCompositionPolicy.evaluate(
            existingJournalText: existingJournalText,
            leadingNote: leading,
            trailingNote: trailing,
            treatsLeadingNoteAsFullBody: treatsLeadingDraftAsFullBody
        )
        guard !composition.journalBodyText.isEmpty else { return nil }
        return CaptureDraftAutosave(bodyText: composition.journalBodyText)
    }
}

struct CaptureWritingLayout: Equatable {
    let showsLeadingDraft: Bool
    let showsContinuationDraft: Bool
    let leadingDraftUsesWorkingOverlay: Bool
    let keepsStatusWithSubmittedCapture: Bool
}

enum CaptureWritingLayoutPolicy {
    static func evaluate(
        hasAttachments: Bool,
        hasDraftText: Bool,
        hasPendingResult: Bool,
        stage: CaptureStage
    ) -> CaptureWritingLayout {
        CaptureWritingLayout(
            showsLeadingDraft: !hasAttachments || hasDraftText,
            showsContinuationDraft: hasAttachments
                || (hasPendingResult && stage.keepsSubmittedCaptureActive),
            leadingDraftUsesWorkingOverlay: stage.isWorking && !hasPendingResult,
            keepsStatusWithSubmittedCapture: hasPendingResult
                && stage.keepsSubmittedCaptureActive
        )
    }
}

enum CaptureScrollTarget: Equatable {
    case leadingDraft
    case continuationDraft
}

struct CaptureScrollBehavior: Equatable {
    let target: CaptureScrollTarget
    let usesSmoothAnimation: Bool
}

enum CaptureScrollTargetPolicy {
    static func evaluate(
        focusedTarget: CaptureFocusTarget?,
        showsContinuationDraft: Bool
    ) -> CaptureScrollBehavior {
        let target: CaptureScrollTarget
        switch focusedTarget {
        case .draft:
            target = .leadingDraft
        case .trailingDraft:
            target = .continuationDraft
        case nil:
            target = showsContinuationDraft ? .continuationDraft : .leadingDraft
        }

        return CaptureScrollBehavior(target: target, usesSmoothAnimation: true)
    }
}

struct CaptureResultPlacement: Equatable {
    let showsInlineResult: Bool
    let showsBottomResult: Bool
    let showsWritingControls: Bool
}

enum CaptureResultPlacementPolicy {
    static func evaluate(hasLatestResult: Bool, stage: CaptureStage) -> CaptureResultPlacement {
        CaptureResultPlacement(
            showsInlineResult: hasLatestResult && !stage.isWorking,
            showsBottomResult: false,
            showsWritingControls: true
        )
    }
}

struct CaptureInlineResultSummary: Equatable {
    let metricTexts: [String]
    let accessibilityLabel: String
}

enum CaptureInlineResultSummaryPolicy {
    static func evaluate(
        actionCount: Int,
        signalCount: Int,
        sourceCount: Int
    ) -> CaptureInlineResultSummary {
        let signalText = "\(signalCount) \(plural("signal", count: signalCount))"
        let actionText = "\(actionCount) open"
        let sourceText = "\(sourceCount) \(sourceCount == 1 ? "ref" : "refs")"
        let fullSourceText = "\(sourceCount) \(plural("reference", count: sourceCount))"

        return CaptureInlineResultSummary(
            metricTexts: [signalText, actionText, sourceText],
            accessibilityLabel: "Open saved capture details: \(signalText), \(actionText), \(fullSourceText)"
        )
    }

    private static func plural(_ word: String, count: Int) -> String {
        count == 1 ? word : "\(word)s"
    }
}

struct CaptureSaveCompletion: Equatable {
    let stage: CaptureStage
    let statusMessage: String
    let showsResultRow: Bool
    let keepsResultPending: Bool
    let autoPresentsDrawer: Bool
}

enum CaptureSaveCompletionPolicy {
    static func evaluate(isProcessing: Bool, errorCode: String? = nil) -> CaptureSaveCompletion {
        if isProcessing {
            return CaptureSaveCompletion(
                stage: .processing,
                statusMessage: "Processing in background",
                showsResultRow: false,
                keepsResultPending: true,
                autoPresentsDrawer: false
            )
        }

        if let errorCode {
            return CaptureSaveCompletion(
                stage: errorCode == "AI_EXTRACTION_TIMEOUT" ? .analysisTimedOut : .analysisFailed,
                statusMessage: errorCode == "AI_EXTRACTION_TIMEOUT" ? "Analysis timed out" : "Analysis failed",
                showsResultRow: false,
                keepsResultPending: true,
                autoPresentsDrawer: false
            )
        }

        return CaptureSaveCompletion(
            stage: .saved,
            statusMessage: "Saved to Vesta",
            showsResultRow: true,
            keepsResultPending: false,
            autoPresentsDrawer: false
        )
    }
}

enum CaptureOptimisticLocalRowPolicy {
    static func evaluate() -> CaptureStage {
        .queued
    }
}

enum ConvexAgentStatusStagePolicy {
    static func evaluate(status: String, errorCode: String?) -> CaptureStage? {
        switch status.lowercased() {
        case "queued":
            .queued
        case "running":
            .processing
        case "ready":
            .saved
        case "failed":
            errorCode == "AI_EXTRACTION_TIMEOUT" ? .analysisTimedOut : .analysisFailed
        default:
            nil
        }
    }
}

struct ConvexAgentStatusSnapshot: Equatable {
    let idempotencyKey: String
    let status: String
    let errorCode: String?
}

enum ConvexAgentStatusProjectionPolicy {
    static func apply(
        statuses: [ConvexAgentStatusSnapshot],
        to rows: [RetainedCaptureRow]
    ) -> [RetainedCaptureRow] {
        var nextRows = rows
        for status in statuses {
            guard let stage = ConvexAgentStatusStagePolicy.evaluate(
                status: status.status,
                errorCode: status.errorCode
            ) else {
                continue
            }
            guard let index = nextRows.firstIndex(where: { row in
                row.mutationId == status.idempotencyKey
            }) else {
                continue
            }
            let row = nextRows[index]
            nextRows[index] = RetainedCaptureRow(
                id: row.id,
                analysisRunId: row.analysisRunId,
                mutationId: row.mutationId,
                noteText: row.noteText,
                stage: stage
            )
        }
        return nextRows
    }
}

struct CaptureSubmissionFailure: Equatable {
    let stage: CaptureStage
    let statusMessage: String
    let errorMessage: String
}

enum CaptureSubmissionFailurePolicy {
    static func evaluate(
        savedOnDevice: Bool,
        isTimeout: Bool,
        isAuthenticationRequired: Bool,
        localizedError: String
    ) -> CaptureSubmissionFailure {
        if savedOnDevice {
            return CaptureSubmissionFailure(
                stage: .saved,
                statusMessage: "Saved on this device",
                errorMessage: ""
            )
        }

        if isTimeout {
            return CaptureSubmissionFailure(
                stage: .processing,
                statusMessage: "Processing in background",
                errorMessage: ""
            )
        }

        if isAuthenticationRequired {
            return CaptureSubmissionFailure(
                stage: .idle,
                statusMessage: "Server sign-in required",
                errorMessage: ""
            )
        }

        return CaptureSubmissionFailure(
            stage: .idle,
            statusMessage: "Save failed",
            errorMessage: localizedError
        )
    }
}

struct CaptureSubmissionDraft: Equatable {
    let noteText: String
    let leadingNote: String
    let trailingNote: String
    let includesAttachments: Bool
    let hasContent: Bool
}

enum CaptureSubmissionDraftPolicy {
    static func evaluate(
        leadingText: String,
        trailingText: String,
        attachmentLabels: [String],
        pendingNoteText: String?,
        existingJournalText: String? = nil,
        treatsLeadingTextAsFullBody: Bool = false
    ) -> CaptureSubmissionDraft {
        let leading = leadingText.trimmingCharacters(in: .whitespacesAndNewlines)
        let trailing = trailingText.trimmingCharacters(in: .whitespacesAndNewlines)
        let pending = pendingNoteText?.trimmingCharacters(in: .whitespacesAndNewlines)
        let leadingWasAlreadySubmitted = pending != nil && leading == pending
        let submittedLeading = leadingWasAlreadySubmitted ? "" : leading
        let includesAttachments = pending == nil
        let composition = JournalSaveCompositionPolicy.evaluate(
            existingJournalText: existingJournalText,
            leadingNote: submittedLeading,
            trailingNote: trailing,
            treatsLeadingNoteAsFullBody: treatsLeadingTextAsFullBody
        )
        let typedText = composition.captureNoteText
        let fallbackText = includesAttachments ? attachmentLabels.joined(separator: "\n") : ""
        let noteText = typedText.isEmpty ? fallbackText : typedText
        let leadingNote = composition.leadingNote.isEmpty ? noteText : composition.leadingNote
        let submittedTrailing = composition.leadingNote.isEmpty ? "" : composition.trailingNote

        return CaptureSubmissionDraft(
            noteText: noteText,
            leadingNote: leadingNote,
            trailingNote: submittedTrailing,
            includesAttachments: includesAttachments,
            hasContent: !noteText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        )
    }
}

struct RetainedCaptureRow: Identifiable, Equatable {
    let id: UUID
    let analysisRunId: String?
    let mutationId: String?
    let noteText: String
    let stage: CaptureStage

    init(
        id: UUID = UUID(),
        analysisRunId: String? = nil,
        mutationId: String? = nil,
        noteText: String,
        stage: CaptureStage
    ) {
        self.id = id
        self.analysisRunId = analysisRunId
        self.mutationId = mutationId
        self.noteText = noteText
        self.stage = stage
    }
}

struct CaptureSubmissionTransition: Equatable {
    let leadingText: String
    let trailingText: String
    let retainedRow: RetainedCaptureRow?
}

enum CaptureSubmissionTransitionPolicy {
    static func evaluate(
        analysisRunId: String?,
        currentLeadingText: String,
        submittedNoteText: String,
        pendingNoteText: String?,
        stage: CaptureStage
    ) -> CaptureSubmissionTransition {
        let retainedRow = retainedRow(
            analysisRunId: analysisRunId,
            currentLeadingText: currentLeadingText,
            pendingNoteText: pendingNoteText,
            stage: stage
        )

        return CaptureSubmissionTransition(
            leadingText: pendingNoteText == nil ? currentLeadingText : submittedNoteText,
            trailingText: "",
            retainedRow: retainedRow
        )
    }

    private static func retainedRow(
        analysisRunId: String?,
        currentLeadingText: String,
        pendingNoteText: String?,
        stage: CaptureStage
    ) -> RetainedCaptureRow? {
        guard let pendingNoteText else { return nil }
        let noteText = pendingNoteText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !noteText.isEmpty else { return nil }
        guard currentLeadingText.trimmingCharacters(in: .whitespacesAndNewlines) == noteText else {
            return nil
        }

        switch stage {
        case .analysisFailed, .analysisTimedOut, .queued, .processing:
            return RetainedCaptureRow(analysisRunId: analysisRunId, noteText: noteText, stage: stage)
        case .idle, .refreshing, .saved, .saving:
            return nil
        }
    }
}

enum VestaChromeAction {
    case settings
    case statusSignal
    case todayCalendar

    var destination: VestaDestination? {
        switch self {
        case .settings:
            .settings
        case .statusSignal:
            nil
        case .todayCalendar:
            .todayCalendar
        }
    }

    var sheet: VestaSheet? {
        switch self {
        case .settings:
            nil
        case .statusSignal:
            nil
        case .todayCalendar:
            nil
        }
    }
}
