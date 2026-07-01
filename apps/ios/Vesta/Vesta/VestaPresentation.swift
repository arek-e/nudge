import Foundation

enum VestaDestination: Hashable {
    case todayCalendar
}

enum VestaSheet: String, Identifiable {
    case streakCalendar

    var id: String { rawValue }
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
        case .processing:
            "Processing"
        case .saved:
            "Saved"
        }
    }

    var isWorking: Bool {
        switch self {
        case .saving, .refreshing, .processing:
            true
        case .analysisFailed, .analysisTimedOut, .idle, .saved:
            false
        }
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

        if hasPendingResult && (stage == .processing || stage == .analysisTimedOut || stage == .analysisFailed) {
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
                && stage == .processing
                && currentText != nextText
        )
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
                || (hasPendingResult && (stage == .processing || stage == .analysisTimedOut || stage == .analysisFailed)),
            leadingDraftUsesWorkingOverlay: stage.isWorking && !hasPendingResult,
            keepsStatusWithSubmittedCapture: hasPendingResult
                && (stage == .processing || stage == .analysisTimedOut || stage == .analysisFailed)
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
        pendingNoteText: String?
    ) -> CaptureSubmissionDraft {
        let leading = leadingText.trimmingCharacters(in: .whitespacesAndNewlines)
        let trailing = trailingText.trimmingCharacters(in: .whitespacesAndNewlines)
        let pending = pendingNoteText?.trimmingCharacters(in: .whitespacesAndNewlines)
        let leadingWasAlreadySubmitted = pending != nil && leading == pending
        let submittedLeading = leadingWasAlreadySubmitted ? "" : leading
        let includesAttachments = pending == nil
        let typedText = [submittedLeading, trailing]
            .filter { !$0.isEmpty }
            .joined(separator: "\n\n")
        let fallbackText = includesAttachments ? attachmentLabels.joined(separator: "\n") : ""
        let noteText = typedText.isEmpty ? fallbackText : typedText
        let leadingNote = submittedLeading.isEmpty ? noteText : submittedLeading
        let submittedTrailing = submittedLeading.isEmpty ? "" : trailing

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
    let noteText: String
    let stage: CaptureStage

    init(id: UUID = UUID(), analysisRunId: String? = nil, noteText: String, stage: CaptureStage) {
        self.id = id
        self.analysisRunId = analysisRunId
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
        case .analysisFailed, .analysisTimedOut, .processing:
            return RetainedCaptureRow(analysisRunId: analysisRunId, noteText: noteText, stage: stage)
        case .idle, .refreshing, .saved, .saving:
            return nil
        }
    }
}

enum VestaChromeAction {
    case todayCalendar
    case streakCalendar

    var destination: VestaDestination? {
        switch self {
        case .todayCalendar:
            .todayCalendar
        case .streakCalendar:
            nil
        }
    }

    var sheet: VestaSheet? {
        switch self {
        case .todayCalendar:
            nil
        case .streakCalendar:
            .streakCalendar
        }
    }
}
