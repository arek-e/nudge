import Foundation

@main
enum CaptureDraftResetSelftest {
    static func main() {
        let defaults = UserDefaults.standard
        let originalEngineURL = defaults.string(forKey: NudgeAPI.engineURLKey)
        let originalAnonymousUserID = defaults.string(forKey: NudgeInstallIdentity.userIDKey)
        defaults.set("http://127.0.0.1:53900", forKey: NudgeAPI.engineURLKey)
        assert(NudgeAPI.configuredEngineURL == NudgeAPI.defaultEngineURL)
        assert(defaults.string(forKey: NudgeAPI.engineURLKey) == NudgeAPI.defaultEngineURL)
        let stagingEnvironment = NudgeEnvironmentConfig.evaluate(
            environmentName: "staging",
            displayName: nil,
            engineURL: nil,
            convexDeploymentURL: nil
        )
        assert(stagingEnvironment.displayName == "Nudge")
        assert(stagingEnvironment.engineURL == "https://nudge-web-staging.teampitch.workers.dev")
        assert(stagingEnvironment.convexDeploymentURL == "https://abundant-retriever-130.eu-west-1.convex.cloud")
        let localEnvironment = NudgeEnvironmentConfig.evaluate(
            environmentName: "local",
            displayName: nil,
            engineURL: nil,
            convexDeploymentURL: nil
        )
        assert(localEnvironment.engineURL == "http://localhost:8787")
        assert(localEnvironment.convexDeploymentURL == "https://grandiose-hamster-855.eu-west-1.convex.cloud")
        let productionEnvironment = NudgeEnvironmentConfig.evaluate(
            environmentName: "production",
            displayName: nil,
            engineURL: nil,
            convexDeploymentURL: nil
        )
        assert(productionEnvironment.engineURL == "https://nudge-web.teampitch.workers.dev")
        assert(productionEnvironment.convexDeploymentURL == "https://friendly-lion-904.eu-west-1.convex.cloud")
        defaults.set("anon_550e8400-e29b-41d4-a716-446655440000", forKey: NudgeInstallIdentity.userIDKey)
        assert(NudgeInstallIdentity.currentUserID(defaults: defaults) == "anon_550e8400-e29b-41d4-a716-446655440000")
        assert(
            NudgeInstallIdentity.generatedUserID(uuidString: "550E8400-E29B-41D4-A716-446655440000")
                == "anon_550e8400-e29b-41d4-a716-446655440000"
        )
        if let originalEngineURL {
            defaults.set(originalEngineURL, forKey: NudgeAPI.engineURLKey)
        } else {
            defaults.removeObject(forKey: NudgeAPI.engineURLKey)
        }
        if let originalAnonymousUserID {
            defaults.set(originalAnonymousUserID, forKey: NudgeInstallIdentity.userIDKey)
        } else {
            defaults.removeObject(forKey: NudgeInstallIdentity.userIDKey)
        }
        assert(NudgeAPIError.httpStatus(401).errorDescription == "Server sign-in required.")
        assert(NudgeAuthPresentationPolicy.evaluate(sessionState: .loading) == .loading)
        assert(NudgeAuthPresentationPolicy.evaluate(sessionState: .signedOut) == .authForm)
        assert(NudgeAuthPresentationPolicy.evaluate(sessionState: .signedIn) == .content)
        let namedAccount = AccountSettingsPolicy.evaluate(
            firstName: "Alexander",
            lastName: "Eklund",
            username: nil,
            emailAddress: "alex@example.com",
            userId: "user_123",
            sessionId: "sess_123",
            hasVerifiedEmailAddress: true
        )
        assert(namedAccount.displayName == "Alexander Eklund")
        assert(namedAccount.emailAddress == "alex@example.com")
        assert(namedAccount.emailVerification == "Verified")
        assert(namedAccount.userId == "user_123")
        assert(namedAccount.sessionId == "sess_123")

        let unnamedAccount = AccountSettingsPolicy.evaluate(
            firstName: nil,
            lastName: nil,
            username: "arek-e",
            emailAddress: nil,
            userId: nil,
            sessionId: nil,
            hasVerifiedEmailAddress: false
        )
        assert(unnamedAccount.displayName == "arek-e")
        assert(unnamedAccount.emailAddress == "No email on this account")
        assert(unnamedAccount.emailVerification == "Not verified")
        assert(unnamedAccount.userId == "Unavailable")
        assert(unnamedAccount.sessionId == "Unavailable")
        let mediaBytes = Data("image bytes".utf8)
        let mediaBase64 = mediaBytes.base64EncodedString()
        let uploadDraft = MediaUploadDraftPolicy.evaluate(dataURL: "data:image/jpeg;base64,\(mediaBase64)")
        assert(uploadDraft == MediaUploadDraft(byteLength: 11, dataBase64: mediaBase64))
        assert(MediaUploadDraftPolicy.evaluate(dataURL: "not-media") == nil)
        assert(NudgeAPIError.badMediaData.errorDescription == "The attachment could not be prepared for upload.")

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
        let optimisticLocalRowStage = CaptureOptimisticLocalRowPolicy.evaluate()
        assert(optimisticLocalRowStage == .queued)
        assert(optimisticLocalRowStage.label == "Queued")
        assert(optimisticLocalRowStage.isWorking)
        assert(ConvexAgentStatusStagePolicy.evaluate(status: "queued", errorCode: nil) == .queued)
        assert(ConvexAgentStatusStagePolicy.evaluate(status: "running", errorCode: nil) == .processing)
        assert(ConvexAgentStatusStagePolicy.evaluate(status: "ready", errorCode: nil) == .saved)
        assert(ConvexAgentStatusStagePolicy.evaluate(status: "failed", errorCode: nil) == .analysisFailed)
        assert(
            ConvexAgentStatusStagePolicy.evaluate(
                status: "failed",
                errorCode: "AI_EXTRACTION_TIMEOUT"
            ) == .analysisTimedOut
        )
        assert(ConvexAgentStatusStagePolicy.evaluate(status: "unknown", errorCode: nil) == nil)
        let paragraphStatusRows = [
            RetainedCaptureRow(mutationId: "mutation-a", noteText: "First paragraph", stage: .queued),
            RetainedCaptureRow(mutationId: "mutation-b", noteText: "Second paragraph", stage: .queued),
        ]
        let paragraphStatusProjection = ConvexAgentStatusProjectionPolicy.apply(
            statuses: [
                ConvexAgentStatusSnapshot(
                    idempotencyKey: "mutation-a",
                    status: "ready",
                    errorCode: nil
                )
            ],
            to: paragraphStatusRows
        )
        assert(paragraphStatusProjection[0].stage == .saved)
        assert(paragraphStatusProjection[1].stage == .queued)

        let projectedDailyNoteRows = DailyNoteParagraphRowsPolicy.merge(
            bodyText: "Morning note\n\nAfternoon note",
            retainedRows: []
        )
        assert(projectedDailyNoteRows.map(\.noteText) == ["Morning note", "Afternoon note"])
        assert(projectedDailyNoteRows.allSatisfy { $0.stage == .saved })

        let queuedParagraphRows = DailyNoteParagraphRowsPolicy.merge(
            bodyText: "Morning note\n\nAfternoon note",
            retainedRows: [
                RetainedCaptureRow(
                    mutationId: "mutation-afternoon",
                    noteText: "Afternoon note",
                    stage: .queued
                )
            ]
        )
        assert(queuedParagraphRows.count == 2)
        assert(queuedParagraphRows[0].noteText == "Morning note")
        assert(queuedParagraphRows[0].stage == .saved)
        assert(queuedParagraphRows[1].noteText == "Afternoon note")
        assert(queuedParagraphRows[1].mutationId == "mutation-afternoon")
        assert(queuedParagraphRows[1].stage == .queued)

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
        assert(completedCompletion.statusMessage == "Saved to Nudge")
        assert(completedCompletion.showsResultRow)
        assert(!completedCompletion.keepsResultPending)
        assert(!completedCompletion.autoPresentsDrawer)

        let unauthenticatedSubmissionFailure = CaptureSubmissionFailurePolicy.evaluate(
            savedOnDevice: false,
            isTimeout: false,
            isAuthenticationRequired: true,
            localizedError: "The server returned HTTP 401."
        )
        assert(unauthenticatedSubmissionFailure.stage == .idle)
        assert(unauthenticatedSubmissionFailure.statusMessage == "Server sign-in required")
        assert(unauthenticatedSubmissionFailure.errorMessage.isEmpty)

        let localTimeoutSubmissionFailure = CaptureSubmissionFailurePolicy.evaluate(
            savedOnDevice: true,
            isTimeout: true,
            isAuthenticationRequired: false,
            localizedError: "The request timed out."
        )
        assert(localTimeoutSubmissionFailure.stage == .saved)
        assert(localTimeoutSubmissionFailure.statusMessage == "Saved on this device")
        assert(localTimeoutSubmissionFailure.errorMessage.isEmpty)

        let unavailableSignal = ChromeSignalPolicy.evaluate(
            stage: .idle,
            statusMessage: "Engine unavailable",
            hasLatestResult: false,
            isOnline: true
        )
        assert(unavailableSignal == nil)

        let authSignal = ChromeSignalPolicy.evaluate(
            stage: .idle,
            statusMessage: "Server sign-in required",
            hasLatestResult: false,
            isOnline: true
        )
        assert(authSignal == nil)

        let localSyncUnavailableSignal = ChromeSignalPolicy.evaluate(
            stage: .idle,
            statusMessage: "Local sync unavailable",
            hasLatestResult: false,
            isOnline: true
        )
        assert(localSyncUnavailableSignal == nil)

        let onlineLocalOnlySignal = ChromeSignalPolicy.evaluate(
            stage: .processing,
            statusMessage: "Saved on this device",
            hasLatestResult: false,
            isOnline: true
        )
        assert(onlineLocalOnlySignal == nil)

        let offlineSignal = ChromeSignalPolicy.evaluate(
            stage: .processing,
            statusMessage: "Saved on this device",
            hasLatestResult: false,
            isOnline: false
        )
        assert(offlineSignal?.accessibilityLabel == "Offline. Changes are saved on this device and will sync when online.")
        assert(offlineSignal?.systemImageName == "exclamationmark.triangle.fill")
        assert(offlineSignal?.tone == .degraded)
        assert(offlineSignal?.usesShimmer == true)

        let latestResultSignal = ChromeSignalPolicy.evaluate(
            stage: .saved,
            statusMessage: "Saved to Nudge",
            hasLatestResult: true
        )
        assert(latestResultSignal == nil)

        let processingSignal = ChromeSignalPolicy.evaluate(
            stage: .processing,
            statusMessage: "Processing in background",
            hasLatestResult: false
        )
        assert(processingSignal == nil)

        let savedSignal = ChromeSignalPolicy.evaluate(
            stage: .saved,
            statusMessage: "Saved to Nudge",
            hasLatestResult: false
        )
        assert(savedSignal == nil)

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

        let hydratedDailyNoteSubmission = CaptureSubmissionDraftPolicy.evaluate(
            leadingText: "Morning note\n\nAfternoon note",
            trailingText: "",
            attachmentLabels: [],
            pendingNoteText: nil,
            existingJournalText: "Morning note",
            treatsLeadingTextAsFullBody: true
        )
        assert(hydratedDailyNoteSubmission.hasContent)
        assert(hydratedDailyNoteSubmission.noteText == "Afternoon note")
        assert(hydratedDailyNoteSubmission.leadingNote == "Morning note\n\nAfternoon note")
        assert(hydratedDailyNoteSubmission.trailingNote == "")

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

        let hydratedJournalSave = JournalSaveCompositionPolicy.evaluate(
            existingJournalText: "Morning note",
            leadingNote: "Morning note\n\nAfternoon note",
            trailingNote: ""
        )
        assert(hydratedJournalSave.journalBodyText == "Morning note\n\nAfternoon note")
        assert(hydratedJournalSave.captureNoteText == "Afternoon note")
        assert(hydratedJournalSave.leadingNote == "Afternoon note")

        let hydratedEditor = DailyNoteDraftHydrationPolicy.evaluate(
            currentDraft: "",
            currentTrailingDraft: "",
            bodyText: "Morning note"
        )
        assert(hydratedEditor == "Morning note")

        let activeEditorHydration = DailyNoteDraftHydrationPolicy.evaluate(
            currentDraft: "Unsaved thought",
            currentTrailingDraft: "",
            bodyText: "Morning note"
        )
        assert(activeEditorHydration == nil)

        let emptyAutosave = CaptureDraftAutosavePolicy.evaluate(
            existingJournalText: "Already saved",
            leadingDraft: "   ",
            trailingDraft: ""
        )
        assert(emptyAutosave == nil)

        let firstAutosave = CaptureDraftAutosavePolicy.evaluate(
            existingJournalText: nil,
            leadingDraft: "First live line",
            trailingDraft: ""
        )
        assert(firstAutosave?.bodyText == "First live line")

        let continuationAutosave = CaptureDraftAutosavePolicy.evaluate(
            existingJournalText: "Already saved",
            leadingDraft: "",
            trailingDraft: "Still writing"
        )
        assert(continuationAutosave?.bodyText == "Already saved\n\nStill writing")

        let hydratedAutosave = CaptureDraftAutosavePolicy.evaluate(
            existingJournalText: "Already saved",
            leadingDraft: "Already saved\n\nStill writing",
            trailingDraft: ""
        )
        assert(hydratedAutosave?.bodyText == "Already saved\n\nStill writing")
    }
}
