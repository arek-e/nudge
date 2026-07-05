import Foundation

enum NudgeDestination: Hashable {
    case dailyReview
    case settings
    case todayCalendar
}

enum NudgeSheet: String, Identifiable {
    case streakCalendar

    var id: String { rawValue }
}

enum NudgeAuthSessionState: Hashable {
    case loading
    case signedOut
    case signedIn
}

enum NudgeAuthSurface: Equatable {
    case loading
    case authForm
    case content
}

enum NudgeAuthPresentationPolicy {
    static func evaluate(sessionState: NudgeAuthSessionState) -> NudgeAuthSurface {
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

enum SyncStatusTone: Equatable {
    case critical
    case neutral
    case positive
    case working
}

struct SyncStatusItem: Equatable {
    let title: String
    let detail: String
    let systemImageName: String
    let tone: SyncStatusTone
}

struct SyncStatusMatrixSnapshot: Equatable {
    let global: SyncStatusItem
    let note: SyncStatusItem
    let ai: SyncStatusItem
}

enum SyncStatusMatrixPolicy {
    static func evaluate(
        isOnline: Bool,
        pendingSyncCount: Int,
        hasSyncFailure: Bool,
        localNoteSyncStatus: String?,
        hasJournal: Bool,
        stage: CaptureStage,
        retainedRows: [RetainedCaptureRow],
        statusMessage: String? = nil
    ) -> SyncStatusMatrixSnapshot {
        SyncStatusMatrixSnapshot(
            global: globalStatus(
                isOnline: isOnline,
                pendingSyncCount: pendingSyncCount,
                hasSyncFailure: hasSyncFailure,
                statusMessage: statusMessage
            ),
            note: noteStatus(
                localNoteSyncStatus: localNoteSyncStatus,
                pendingSyncCount: pendingSyncCount,
                hasSyncFailure: hasSyncFailure,
                hasJournal: hasJournal
            ),
            ai: aiStatus(stage: stage, retainedRows: retainedRows)
        )
    }

    private static func globalStatus(
        isOnline: Bool,
        pendingSyncCount: Int,
        hasSyncFailure: Bool,
        statusMessage: String?
    ) -> SyncStatusItem {
        if !isOnline {
            return SyncStatusItem(
                title: "Offline",
                detail: "Changes stay on this device.",
                systemImageName: "wifi.slash",
                tone: .critical
            )
        }

        if statusMessage == "Server sign-in required" {
            return SyncStatusItem(
                title: "Server sign-in required",
                detail: "Sign in again so Nudge can sync.",
                systemImageName: "person.crop.circle.badge.exclamationmark",
                tone: .critical
            )
        }

        if statusMessage == "Engine unavailable" {
            return SyncStatusItem(
                title: "Sync failed",
                detail: "Nudge Engine is not reachable.",
                systemImageName: "exclamationmark.arrow.triangle.2.circlepath",
                tone: .critical
            )
        }

        if hasSyncFailure {
            return SyncStatusItem(
                title: "Sync failed",
                detail: "Your local copy is still safe.",
                systemImageName: "exclamationmark.arrow.triangle.2.circlepath",
                tone: .critical
            )
        }

        if pendingSyncCount > 0 {
            return SyncStatusItem(
                title: "Syncing \(pendingSyncCount) \(pendingSyncCount == 1 ? "change" : "changes")",
                detail: "Sending local edits to Nudge.",
                systemImageName: "arrow.triangle.2.circlepath",
                tone: .working
            )
        }

        return SyncStatusItem(
            title: "Up to date",
            detail: "Latest local changes reached Nudge.",
            systemImageName: "checkmark.icloud.fill",
            tone: .positive
        )
    }

    private static func noteStatus(
        localNoteSyncStatus: String?,
        pendingSyncCount: Int,
        hasSyncFailure: Bool,
        hasJournal: Bool
    ) -> SyncStatusItem {
        if hasSyncFailure {
            return SyncStatusItem(
                title: "Needs retry",
                detail: "Nudge could not accept the latest note yet.",
                systemImageName: "arrow.counterclockwise",
                tone: .critical
            )
        }

        if localNoteSyncStatus == "pending_sync" || pendingSyncCount > 0 {
            return SyncStatusItem(
                title: "Pending sync",
                detail: "Saved locally and queued for Nudge.",
                systemImageName: "tray.and.arrow.up.fill",
                tone: .working
            )
        }

        if hasJournal {
            return SyncStatusItem(
                title: "Synced to Nudge",
                detail: "This note is backed by the shared journal.",
                systemImageName: "checkmark.seal.fill",
                tone: .positive
            )
        }

        return SyncStatusItem(
            title: "Saved on this device",
            detail: "Write locally first, then sync when ready.",
            systemImageName: "iphone",
            tone: .neutral
        )
    }

    private static func aiStatus(
        stage: CaptureStage,
        retainedRows: [RetainedCaptureRow]
    ) -> SyncStatusItem {
        let activeStage = prioritizedAIStage(stage: stage, retainedRows: retainedRows)

        switch activeStage {
        case .analysisFailed:
            return SyncStatusItem(
                title: "Analysis failed",
                detail: "The saved note remains available.",
                systemImageName: "exclamationmark.triangle.fill",
                tone: .critical
            )
        case .analysisTimedOut:
            return SyncStatusItem(
                title: "Analysis timed out",
                detail: "Nudge kept the local note.",
                systemImageName: "clock.badge.exclamationmark",
                tone: .critical
            )
        case .queued:
            return SyncStatusItem(
                title: "Nudge will review this",
                detail: "AI review starts after sync.",
                systemImageName: "sparkles",
                tone: .working
            )
        case .processing:
            return SyncStatusItem(
                title: "Nudge is reviewing this",
                detail: "Follow-ups and open loops are being checked.",
                systemImageName: "wand.and.stars",
                tone: .working
            )
        case .saved:
            return SyncStatusItem(
                title: "Review ready",
                detail: "Latest review state is available.",
                systemImageName: "checklist.checked",
                tone: .positive
            )
        case .idle, .refreshing, .saving:
            return SyncStatusItem(
                title: "Not reviewed yet",
                detail: "Save a note to ask Nudge for review.",
                systemImageName: "text.magnifyingglass",
                tone: .neutral
            )
        }
    }

    private static func prioritizedAIStage(
        stage: CaptureStage,
        retainedRows: [RetainedCaptureRow]
    ) -> CaptureStage {
        if retainedRows.contains(where: { $0.stage == .analysisFailed }) {
            return .analysisFailed
        }
        if retainedRows.contains(where: { $0.stage == .analysisTimedOut }) {
            return .analysisTimedOut
        }
        if stage == .analysisFailed || stage == .analysisTimedOut {
            return stage
        }
        if retainedRows.contains(where: { $0.stage == .processing }) || stage == .processing {
            return .processing
        }
        if retainedRows.contains(where: { $0.stage == .queued }) || stage == .queued {
            return .queued
        }
        if retainedRows.contains(where: { $0.stage == .saved }) || stage == .saved {
            return .saved
        }
        return stage
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

enum DailyReviewMetricTone: Equatable {
    case action
    case insight
    case note
    case signal
}

struct DailyReviewMetricRow: Identifiable, Equatable {
    let id: String
    let label: String
    let value: String
    let systemImageName: String
    let tone: DailyReviewMetricTone
}

struct DailyReviewNoteRow: Identifiable, Equatable {
    let id: String
    let text: String
    let stage: CaptureStage
}

struct DailyReviewActionRow: Identifiable, Equatable {
    let id: String
    let title: String
    let body: String
    let status: String
}

struct DailyReviewSignalRow: Identifiable, Equatable {
    let id: String
    let title: String
    let detail: String
}

struct DailyReviewSnapshot: Equatable {
    let localDate: String
    let title: String
    let updatedAt: String?
    let noteRows: [DailyReviewNoteRow]
    let openActionRows: [DailyReviewActionRow]
    let signalRows: [DailyReviewSignalRow]
    let metricRows: [DailyReviewMetricRow]
    let syncStatus: SyncStatusMatrixSnapshot

    var hasContent: Bool {
        !noteRows.isEmpty || !openActionRows.isEmpty || !signalRows.isEmpty
    }
}

enum DailyReviewSnapshotPolicy {
    static func evaluate(
        localDate: String,
        journal: JournalDocument?,
        retainedRows: [RetainedCaptureRow],
        actions: [ActionItem],
        signals: [EventRecord],
        syncStatus: SyncStatusMatrixSnapshot
    ) -> DailyReviewSnapshot {
        let noteRows = DailyNoteParagraphRowsPolicy.merge(
            bodyText: journal?.bodyText,
            retainedRows: retainedRows
        )
        .enumerated()
        .compactMap { index, row -> DailyReviewNoteRow? in
            let text = trimmed(row.noteText)
            guard !text.isEmpty else { return nil }
            return DailyReviewNoteRow(
                id: "\(row.id.uuidString)-\(index)",
                text: text,
                stage: row.stage
            )
        }

        let openActionRows = actions
            .filter { action in
                action.status == "proposed" || action.status == "accepted"
            }
            .prefix(6)
            .map { action in
                DailyReviewActionRow(
                    id: action.id,
                    title: trimmed(action.title).isEmpty ? action.kind.displayLabel : trimmed(action.title),
                    body: trimmed(action.body),
                    status: action.status.displayLabel
                )
            }

        let signalRows = signals
            .prefix(6)
            .map { signal in
                let title = trimmed(signal.noteText)
                let detail = [signal.source.displayLabel, signal.type.displayLabel]
                    .filter { !$0.isEmpty }
                    .joined(separator: " / ")
                return DailyReviewSignalRow(
                    id: signal.id,
                    title: title.isEmpty ? signal.type.displayLabel : title,
                    detail: detail
                )
            }

        let metrics = [
            DailyReviewMetricRow(
                id: "notes",
                label: "Notes",
                value: "\(noteRows.count)",
                systemImageName: "note.text",
                tone: .note
            ),
            DailyReviewMetricRow(
                id: "actions",
                label: "Open",
                value: "\(openActionRows.count)",
                systemImageName: "checklist",
                tone: .action
            ),
            DailyReviewMetricRow(
                id: "signals",
                label: "Signals",
                value: "\(signalRows.count)",
                systemImageName: "waveform.path.ecg",
                tone: .signal
            ),
            DailyReviewMetricRow(
                id: "ai",
                label: "AI",
                value: aiMetricValue(syncStatus.ai),
                systemImageName: syncStatus.ai.systemImageName,
                tone: .insight
            )
        ]

        let title = trimmed(journal?.title).isEmpty ? "Daily Review" : trimmed(journal?.title)
        return DailyReviewSnapshot(
            localDate: localDate,
            title: title,
            updatedAt: journal?.updatedAt,
            noteRows: noteRows,
            openActionRows: openActionRows,
            signalRows: signalRows,
            metricRows: metrics,
            syncStatus: syncStatus
        )
    }

    private static func aiMetricValue(_ item: SyncStatusItem) -> String {
        switch item.tone {
        case .critical:
            "Issue"
        case .neutral:
            "Idle"
        case .positive:
            "Ready"
        case .working:
            "Pending"
        }
    }

    private static func trimmed(_ value: String?) -> String {
        value?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
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
            statusMessage: "Saved to Nudge",
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
        var nextRows = RetainedCaptureRowsMigrationPolicy.canonicalize(rows)
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
                mutationId: row.mutationId,
                noteText: row.noteText,
                stage: stage
            )
        }
        return nextRows
    }
}

enum RetainedCaptureRowsMigrationPolicy {
    static func canonicalize(_ rows: [RetainedCaptureRow]) -> [RetainedCaptureRow] {
        rows.compactMap { row in
            guard row.mutationId != nil || !row.stage.keepsSubmittedCaptureActive else {
                return nil
            }
            return row
        }
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
    let mutationId: String?
    let noteText: String
    let stage: CaptureStage

    init(
        id: UUID = UUID(),
        mutationId: String? = nil,
        noteText: String,
        stage: CaptureStage
    ) {
        self.id = id
        self.mutationId = mutationId
        self.noteText = noteText
        self.stage = stage
    }
}

struct CaptureSubmissionTransition: Equatable {
    let leadingText: String
    let trailingText: String
}

enum CaptureSubmissionTransitionPolicy {
    static func evaluate(
        currentLeadingText: String,
        submittedNoteText: String,
        pendingNoteText: String?
    ) -> CaptureSubmissionTransition {
        return CaptureSubmissionTransition(
            leadingText: pendingNoteText == nil ? currentLeadingText : submittedNoteText,
            trailingText: ""
        )
    }
}

enum NudgeChromeAction {
    case dailyReview
    case settings
    case statusSignal
    case todayCalendar

    var destination: NudgeDestination? {
        switch self {
        case .dailyReview:
            .dailyReview
        case .settings:
            .settings
        case .statusSignal:
            nil
        case .todayCalendar:
            .todayCalendar
        }
    }

    var sheet: NudgeSheet? {
        switch self {
        case .dailyReview:
            nil
        case .settings:
            nil
        case .statusSignal:
            nil
        case .todayCalendar:
            nil
        }
    }
}
