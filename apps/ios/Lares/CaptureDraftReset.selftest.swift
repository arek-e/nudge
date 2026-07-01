import Foundation

@main
enum CaptureDraftResetSelftest {
    static func main() {
        let editingAfterResult = CaptureDraftResetPolicy.evaluate(
            currentText: "previous note",
            nextText: "new note",
            hasLatestResult: true,
            stage: .saved
        )

        assert(editingAfterResult.clearsLatestResult)
        assert(!editingAfterResult.clearsPendingResult)
        assert(editingAfterResult.stage == .idle)

        let unchangedText = CaptureDraftResetPolicy.evaluate(
            currentText: "same note",
            nextText: "same note",
            hasLatestResult: true,
            stage: .saved
        )

        assert(!unchangedText.clearsLatestResult)
        assert(!unchangedText.clearsPendingResult)
        assert(unchangedText.stage == .saved)

        let editingProcessingResult = CaptureDraftResetPolicy.evaluate(
            currentText: "processing note",
            nextText: "processing note, edited",
            hasLatestResult: false,
            hasPendingResult: true,
            stage: .processing
        )
        assert(!editingProcessingResult.clearsLatestResult)
        assert(!editingProcessingResult.clearsPendingResult)
        assert(editingProcessingResult.stage == .processing)

        let leadingProcessingEdit = CaptureProcessingEditPolicy.evaluate(
            isLeadingDraft: true,
            currentText: "processing note",
            nextText: "processing note, edited",
            hasPendingResult: true,
            stage: .processing
        )
        assert(leadingProcessingEdit.requiresInterruptionConfirmation)

        let continuationProcessingEdit = CaptureProcessingEditPolicy.evaluate(
            isLeadingDraft: false,
            currentText: "",
            nextText: "next thought",
            hasPendingResult: true,
            stage: .processing
        )
        assert(!continuationProcessingEdit.requiresInterruptionConfirmation)

        let completedProcessingEdit = CaptureProcessingEditPolicy.evaluate(
            isLeadingDraft: true,
            currentText: "processed note",
            nextText: "processed note, edited",
            hasPendingResult: true,
            stage: .saved
        )
        assert(!completedProcessingEdit.requiresInterruptionConfirmation)

        let stalePendingResult = CaptureDraftResetPolicy.evaluate(
            currentText: "processed note",
            nextText: "next note",
            hasLatestResult: false,
            hasPendingResult: true,
            stage: .saved
        )
        assert(!stalePendingResult.clearsLatestResult)
        assert(stalePendingResult.clearsPendingResult)
        assert(stalePendingResult.stage == .idle)

        let completedResultPlacement = CaptureResultPlacementPolicy.evaluate(
            hasLatestResult: true,
            stage: .saved
        )
        assert(completedResultPlacement.showsInlineResult)
        assert(!completedResultPlacement.showsBottomResult)
        assert(completedResultPlacement.showsWritingControls)

        let processingPlacement = CaptureResultPlacementPolicy.evaluate(
            hasLatestResult: true,
            stage: .processing
        )
        assert(!processingPlacement.showsInlineResult)
        assert(!processingPlacement.showsBottomResult)
        assert(processingPlacement.showsWritingControls)

        let inlineSummary = CaptureInlineResultSummaryPolicy.evaluate(
            actionCount: 0,
            signalCount: 5,
            sourceCount: 3
        )
        assert(inlineSummary.metricTexts == ["5 signals", "0 open", "3 refs"])
        assert(
            inlineSummary.accessibilityLabel
                == "Open saved capture details: 5 signals, 0 open, 3 references"
        )

        let processingCompletion = CaptureSaveCompletionPolicy.evaluate(isProcessing: true)
        assert(processingCompletion.stage == .processing)
        assert(processingCompletion.statusMessage == "Processing in background")
        assert(!processingCompletion.showsResultRow)
        assert(processingCompletion.keepsResultPending)
        assert(!processingCompletion.autoPresentsDrawer)

        let timedOutCompletion = CaptureSaveCompletionPolicy.evaluate(
            isProcessing: false,
            errorCode: "AI_EXTRACTION_TIMEOUT"
        )
        assert(timedOutCompletion.stage == .analysisTimedOut)
        assert(timedOutCompletion.statusMessage == "Analysis timed out")
        assert(!timedOutCompletion.showsResultRow)
        assert(timedOutCompletion.keepsResultPending)
        assert(!timedOutCompletion.autoPresentsDrawer)

        let completedCompletion = CaptureSaveCompletionPolicy.evaluate(isProcessing: false)
        assert(completedCompletion.stage == .saved)
        assert(completedCompletion.statusMessage == "Saved to Lares")
        assert(completedCompletion.showsResultRow)
        assert(!completedCompletion.keepsResultPending)
        assert(!completedCompletion.autoPresentsDrawer)

        let processingWritingLayout = CaptureWritingLayoutPolicy.evaluate(
            hasAttachments: false,
            hasDraftText: true,
            hasPendingResult: true,
            stage: .processing
        )
        assert(processingWritingLayout.showsLeadingDraft)
        assert(processingWritingLayout.showsContinuationDraft)
        assert(!processingWritingLayout.leadingDraftUsesWorkingOverlay)
        assert(processingWritingLayout.keepsStatusWithSubmittedCapture)

        let failedWritingLayout = CaptureWritingLayoutPolicy.evaluate(
            hasAttachments: false,
            hasDraftText: true,
            hasPendingResult: true,
            stage: .analysisTimedOut
        )
        assert(failedWritingLayout.showsLeadingDraft)
        assert(failedWritingLayout.showsContinuationDraft)
        assert(!failedWritingLayout.leadingDraftUsesWorkingOverlay)
        assert(failedWritingLayout.keepsStatusWithSubmittedCapture)

        let savingWritingLayout = CaptureWritingLayoutPolicy.evaluate(
            hasAttachments: false,
            hasDraftText: true,
            hasPendingResult: false,
            stage: .saving
        )
        assert(savingWritingLayout.showsLeadingDraft)
        assert(!savingWritingLayout.showsContinuationDraft)
        assert(savingWritingLayout.leadingDraftUsesWorkingOverlay)
        assert(!savingWritingLayout.keepsStatusWithSubmittedCapture)

        let continuationScroll = CaptureScrollTargetPolicy.evaluate(
            focusedTarget: nil,
            showsContinuationDraft: true
        )
        assert(continuationScroll.target == .continuationDraft)
        assert(continuationScroll.usesSmoothAnimation)

        let focusedLeadingScroll = CaptureScrollTargetPolicy.evaluate(
            focusedTarget: .draft,
            showsContinuationDraft: true
        )
        assert(focusedLeadingScroll.target == .leadingDraft)
        assert(focusedLeadingScroll.usesSmoothAnimation)

        let focusedContinuationScroll = CaptureScrollTargetPolicy.evaluate(
            focusedTarget: .trailingDraft,
            showsContinuationDraft: false
        )
        assert(focusedContinuationScroll.target == .continuationDraft)
        assert(focusedContinuationScroll.usesSmoothAnimation)

        let continuationSubmission = CaptureSubmissionDraftPolicy.evaluate(
            leadingText: "Already submitted",
            trailingText: "New thought below",
            attachmentLabels: [],
            pendingNoteText: "Already submitted"
        )
        assert(continuationSubmission.hasContent)
        assert(continuationSubmission.noteText == "New thought below")
        assert(continuationSubmission.leadingNote == "New thought below")
        assert(continuationSubmission.trailingNote == "")
        assert(!continuationSubmission.includesAttachments)

        let editedProcessingSubmission = CaptureSubmissionDraftPolicy.evaluate(
            leadingText: "Already submitted, edited",
            trailingText: "",
            attachmentLabels: [],
            pendingNoteText: "Already submitted"
        )
        assert(editedProcessingSubmission.hasContent)
        assert(editedProcessingSubmission.noteText == "Already submitted, edited")
        assert(editedProcessingSubmission.leadingNote == "Already submitted, edited")

        let failedContinuationTransition = CaptureSubmissionTransitionPolicy.evaluate(
            analysisRunId: "run-failed",
            currentLeadingText: "Previous failed note",
            submittedNoteText: "New note",
            pendingNoteText: "Previous failed note",
            stage: .analysisTimedOut
        )
        assert(failedContinuationTransition.leadingText == "New note")
        assert(failedContinuationTransition.trailingText == "")
        assert(failedContinuationTransition.retainedRow?.noteText == "Previous failed note")
        assert(failedContinuationTransition.retainedRow?.stage == .analysisTimedOut)
        assert(failedContinuationTransition.retainedRow?.analysisRunId == "run-failed")

        let processingContinuationTransition = CaptureSubmissionTransitionPolicy.evaluate(
            analysisRunId: "run-processing",
            currentLeadingText: "Previous processing note",
            submittedNoteText: "New note",
            pendingNoteText: "Previous processing note",
            stage: .processing
        )
        assert(processingContinuationTransition.leadingText == "New note")
        assert(processingContinuationTransition.trailingText == "")
        assert(processingContinuationTransition.retainedRow?.noteText == "Previous processing note")
        assert(processingContinuationTransition.retainedRow?.stage == .processing)
        assert(processingContinuationTransition.retainedRow?.analysisRunId == "run-processing")

        let savedContinuationTransition = CaptureSubmissionTransitionPolicy.evaluate(
            analysisRunId: "run-saved",
            currentLeadingText: "Previous saved note",
            submittedNoteText: "New note",
            pendingNoteText: "Previous saved note",
            stage: .saved
        )
        assert(savedContinuationTransition.leadingText == "New note")
        assert(savedContinuationTransition.retainedRow == nil)

        let appendedJournalSave = JournalSaveCompositionPolicy.evaluate(
            existingJournalText: "Previous failed note",
            leadingNote: "New note",
            trailingNote: ""
        )
        assert(appendedJournalSave.journalBodyText == "Previous failed note\n\nNew note")
        assert(appendedJournalSave.captureNoteText == "New note")
    }
}
