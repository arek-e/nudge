import Foundation

struct VoiceLogResponse: Decodable {
    let route: String
    let spokenResponse: String
}

struct SignalsResponse: Decodable {
    let signals: [EventRecord]
}

struct CalendarDaysResponse: Decodable {
    let days: [CalendarDayStats]
}

struct ActionsResponse: Decodable {
    let actions: [ActionItem]
    let latestRun: AgentRun?
}

struct SummariesResponse: Decodable {
    let summaries: [SummaryDocument]
}

struct JournalResponse: Decodable {
    let document: JournalDocument?
}

struct JournalSaveResponse: Decodable {
    let analysisRun: AgentRun?
    let document: JournalDocument
}

struct AgentRunResponse: Decodable {
    let run: AgentRun?
}

struct MediaUploadResponse: Decodable {
    let byteLength: Int
    let id: String
    let kind: String
    let label: String
    let mimeType: String
    let url: String
}

struct SavedCapture {
    let analysisRun: AgentRun?
    let journal: JournalDocument
    let capture: EventRecord?
}

struct JournalSaveComposition: Equatable {
    let captureNoteText: String
    let existingJournalText: String
    let journalBodyText: String
    let leadingNote: String
    let trailingNote: String
}

enum JournalSaveCompositionPolicy {
    static func evaluate(
        existingJournalText: String?,
        leadingNote: String,
        trailingNote: String,
        treatsLeadingNoteAsFullBody: Bool = false
    ) -> JournalSaveComposition {
        let existing = existingJournalText?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let leading = leadingNote.trimmingCharacters(in: .whitespacesAndNewlines)
        let trailing = trailingNote.trimmingCharacters(in: .whitespacesAndNewlines)
        let leadingDelta = leadingDelta(existing: existing, bodyText: leading)
        let leadingForCapture = leadingDelta ?? leading
        let leadingForDocument = treatsLeadingNoteAsFullBody ? leading : leadingForCapture
        let existingForDocument = treatsLeadingNoteAsFullBody ? "" : existing
        let captureNoteText = [leadingForCapture, trailing]
            .filter { !$0.isEmpty }
            .joined(separator: "\n\n")
        let paragraphs = [existingForDocument, leadingForDocument, trailing].filter { !$0.isEmpty }

        return JournalSaveComposition(
            captureNoteText: captureNoteText,
            existingJournalText: existingForDocument,
            journalBodyText: paragraphs.joined(separator: "\n\n"),
            leadingNote: leadingForDocument,
            trailingNote: trailing
        )
    }

    private static func leadingDelta(existing: String, bodyText: String) -> String? {
        guard !existing.isEmpty else { return nil }
        guard bodyText != existing else { return "" }
        guard bodyText.hasPrefix(existing) else { return nil }

        let suffixStart = bodyText.index(bodyText.startIndex, offsetBy: existing.count)
        let suffix = bodyText[suffixStart...]
        guard suffix.first?.isWhitespace == true else { return nil }
        return suffix.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

struct ConversationMessageResponse: Decodable {
    let reply: String
}

struct ActionStatusResponse: Decodable {
    let action: ActionItem
}

struct EventRecord: Decodable, Identifiable {
    let id: String
    let userId: String
    let type: String
    let source: String
    let occurredAt: String
    let schemaVersion: Int
    let idempotencyKey: String?
    let payload: JSONValue
    let createdAt: String

    var noteText: String {
        switch payload {
        case .object(let values):
            for key in ["note", "text", "changedText"] {
                if case .string(let value) = values[key] {
                    return value
                }
            }
            return payload.displayText
        case .string(let value):
            return value
        default:
            return payload.displayText
        }
    }
}

struct ActionItem: Decodable, Identifiable {
    let id: String
    let kind: String
    let title: String
    let body: String
    let status: String
    let confidence: Double
    let createdAt: String
    let updatedAt: String
}

struct AgentRun: Decodable {
    let id: String
    let status: String
    let model: String?
    let errorCode: String?
    let metadata: JSONValue

    var isProcessing: Bool {
        ["pending", "queued", "running", "processing", "in_progress"].contains(status.lowercased())
    }

    var isFailed: Bool {
        status.lowercased() == "failed"
    }

    var itemCount: Int? {
        guard case .object(let values) = metadata else { return nil }
        if case .number(let value) = values["itemCount"] {
            return Int(value)
        }
        return nil
    }

    var provider: String {
        guard case .object(let values) = metadata, case .string(let value) = values["provider"] else {
            return "cloudflare-think"
        }
        return value
    }
}

struct SummaryDocument: Decodable, Identifiable {
    let id: String
    let periodType: String
    let periodStart: String
    let title: String
    let body: String
    let status: String
    let generatedAt: String
}

struct JournalDocument: Decodable {
    let id: String
    let localDate: String
    let title: String
    let bodyText: String
    let updatedAt: String
}

enum JSONValue: Decodable {
    case array([JSONValue])
    case bool(Bool)
    case null
    case number(Double)
    case object([String: JSONValue])
    case string(String)

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode([String: JSONValue].self) {
            self = .object(value)
        } else {
            self = .array(try container.decode([JSONValue].self))
        }
    }

    var displayText: String {
        switch self {
        case .array(let values):
            return values.map(\.displayText).joined(separator: ", ")
        case .bool(let value):
            return value ? "true" : "false"
        case .null:
            return ""
        case .number(let value):
            return value.rounded() == value ? String(Int(value)) : String(value)
        case .object(let values):
            return values
                .sorted { $0.key < $1.key }
                .map { "\($0.key): \($0.value.displayText)" }
                .joined(separator: ", ")
        case .string(let value):
            return value
        }
    }
}

struct NudgeEnvironmentConfig: Equatable {
    static let convexDeploymentURLInfoKey = "NudgeConvexDeploymentURL"
    static let displayNameInfoKey = "CFBundleDisplayName"
    static let engineURLInfoKey = "NudgeEngineURL"
    static let environmentNameInfoKey = "NudgeEnvironmentName"
    static let developmentConvexDeploymentURL = "https://grandiose-hamster-855.eu-west-1.convex.cloud"
    static let localEngineURL = "http://localhost:8787"
    static let productionConvexDeploymentURL = "https://friendly-lion-904.eu-west-1.convex.cloud"
    static let productionEngineURL = "https://nudge-web.teampitch.workers.dev"
    static let stagingConvexDeploymentURL = "https://abundant-retriever-130.eu-west-1.convex.cloud"
    static let stagingEngineURL = "https://nudge-web-staging.teampitch.workers.dev"

    let name: String
    let displayName: String
    let engineURL: String
    let convexDeploymentURL: String

    static var current: NudgeEnvironmentConfig {
        let bundle = Bundle.main
        let environment = ProcessInfo.processInfo.environment
        return evaluate(
            environmentName: bundleString(environmentNameInfoKey, bundle: bundle)
                ?? normalizedBuildValue(environment["NUDGE_ENVIRONMENT_NAME"]),
            displayName: bundleString(displayNameInfoKey, bundle: bundle)
                ?? normalizedBuildValue(environment["NUDGE_DISPLAY_NAME"]),
            engineURL: bundleString(engineURLInfoKey, bundle: bundle)
                ?? normalizedBuildValue(environment["NUDGE_ENGINE_URL"]),
            convexDeploymentURL: bundleString(convexDeploymentURLInfoKey, bundle: bundle)
                ?? normalizedBuildValue(environment["NUDGE_CONVEX_DEPLOYMENT_URL"])
        )
    }

    static func evaluate(
        environmentName: String?,
        displayName: String?,
        engineURL: String?,
        convexDeploymentURL: String?
    ) -> NudgeEnvironmentConfig {
        let name = normalizedBuildValue(environmentName) ?? "production"
        return NudgeEnvironmentConfig(
            name: name,
            displayName: normalizedBuildValue(displayName) ?? fallbackDisplayName(for: name),
            engineURL: normalizedBuildValue(engineURL) ?? fallbackEngineURL(for: name),
            convexDeploymentURL: normalizedBuildValue(convexDeploymentURL) ?? fallbackConvexDeploymentURL(for: name)
        )
    }

    private static func bundleString(_ key: String, bundle: Bundle) -> String? {
        normalizedBuildValue(bundle.object(forInfoDictionaryKey: key) as? String)
    }

    private static func fallbackDisplayName(for name: String) -> String {
        switch name {
        case "local":
            "Nudge"
        case "staging":
            "Nudge"
        default:
            "Nudge"
        }
    }

    private static func fallbackEngineURL(for name: String) -> String {
        switch name {
        case "local":
            localEngineURL
        case "staging":
            stagingEngineURL
        default:
            productionEngineURL
        }
    }

    private static func fallbackConvexDeploymentURL(for name: String) -> String {
        switch name {
        case "local":
            developmentConvexDeploymentURL
        case "staging":
            stagingConvexDeploymentURL
        default:
            productionConvexDeploymentURL
        }
    }

    private static func normalizedBuildValue(_ value: String?) -> String? {
        guard let value else { return nil }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !trimmed.contains("$(") else { return nil }
        return trimmed
    }
}

enum NudgeAPI {
    static let engineURLKey = "nudge.engineURL"
    private static let legacyEngineURLKey = "nudge.backendURL"
    private static let staleLocalEngineURLs = Set([
        "http://127.0.0.1:8787",
        "http://192.168.76.133:8787",
        "http://localhost:8787"
    ])
    static var defaultEngineURL: String {
        NudgeEnvironmentConfig.current.engineURL
    }

    static var configuredEngineURL: String {
        let defaults = UserDefaults.standard
        if let engineURL = defaults.string(forKey: engineURLKey) {
            return normalizedEngineURL(engineURL, defaults: defaults)
        }
        if let legacyURL = defaults.string(forKey: legacyEngineURLKey) {
            let engineURL = normalizedEngineURL(legacyURL, defaults: defaults)
            defaults.set(engineURL, forKey: engineURLKey)
            return engineURL
        }
        return defaultEngineURL
    }

    private static let decoder = JSONDecoder()
    private static let encoder = JSONEncoder()

    private static func normalizedEngineURL(_ engineURL: String, defaults: UserDefaults) -> String {
        let fallbackURL = defaultEngineURL
        let trimmedURL = engineURL.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedURL.isEmpty else {
            defaults.set(fallbackURL, forKey: engineURLKey)
            return fallbackURL
        }
        guard !isStaleLocalEngineURL(trimmedURL) || isStaleLocalEngineURL(fallbackURL) else {
            defaults.set(fallbackURL, forKey: engineURLKey)
            return fallbackURL
        }
        return trimmedURL
    }

    private static func isStaleLocalEngineURL(_ engineURL: String) -> Bool {
        if staleLocalEngineURLs.contains(engineURL) {
            return true
        }

        guard let host = URLComponents(string: engineURL)?.host?.lowercased() else {
            return false
        }

        return host == "localhost" || host == "127.0.0.1" || host == "::1"
    }

    static func logVoice(spokenText: String) async throws -> VoiceLogResponse {
        try await post(
            "/api/voice/log",
            body: VoiceLogRequest(idempotencyKey: UUID().uuidString, spokenText: spokenText)
        )
    }

    static func listSignals(limit: Int = 50, from: String? = nil, to: String? = nil) async throws -> [EventRecord] {
        var queryItems = [URLQueryItem(name: "limit", value: String(limit))]
        if let from {
            queryItems.append(URLQueryItem(name: "from", value: from))
        }
        if let to {
            queryItems.append(URLQueryItem(name: "to", value: to))
        }

        let response: SignalsResponse = try await get(
            "/api/signals",
            queryItems: queryItems
        )
        return response.signals
    }

    static func listCalendarDays(timeZone: String = TimeZone.current.identifier) async throws -> [CalendarDayStats] {
        let response: CalendarDaysResponse = try await get(
            "/api/calendar/days",
            queryItems: [URLQueryItem(name: "timeZone", value: timeZone)]
        )
        return response.days
    }

    static func listActions(limit: Int = 100) async throws -> ActionsResponse {
        try await get(
            "/api/actions",
            queryItems: [URLQueryItem(name: "limit", value: String(limit))]
        )
    }

    static func listSummaries(limit: Int = 20) async throws -> [SummaryDocument] {
        let response: SummariesResponse = try await get(
            "/api/summaries",
            queryItems: [URLQueryItem(name: "limit", value: String(limit))]
        )
        return response.summaries
    }

    static func getJournal(localDate: String) async throws -> JournalDocument? {
        let response: JournalResponse = try await get("/api/journal/\(localDate)")
        return response.document
    }

    static func getAgentRun(runId: String) async throws -> AgentRun? {
        let escaped = runId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? runId
        let response: AgentRunResponse = try await get("/api/agent-runs/\(escaped)")
        return response.run
    }

    static func saveDailyNote(
        _ note: String,
        attachments: [JournalMediaAttachment] = [],
        existingJournalText: String? = nil,
        trailingNote: String = "",
        localDate: String,
        treatsNoteAsFullBody: Bool = false
    ) async throws -> SavedCapture {
        let storedAttachments = try await uploadMediaAttachments(attachments)
        let composition = JournalSaveCompositionPolicy.evaluate(
            existingJournalText: existingJournalText,
            leadingNote: note,
            trailingNote: trailingNote,
            treatsLeadingNoteAsFullBody: treatsNoteAsFullBody
        )
        var bodyDocument = composition.existingJournalText.isEmpty
            ? []
            : [RichTextBlock.paragraph(composition.existingJournalText)]
        if !composition.leadingNote.isEmpty {
            bodyDocument.append(RichTextBlock.paragraph(composition.leadingNote))
        }
        bodyDocument.append(contentsOf: storedAttachments.map(RichTextBlock.media))
        if !composition.trailingNote.isEmpty {
            bodyDocument.append(RichTextBlock.paragraph(composition.trailingNote))
        }
        let journalResponse: JournalSaveResponse = try await post(
            "/api/journal",
            body: JournalSaveRequest(
                bodyDocument: bodyDocument,
                bodyText: composition.journalBodyText,
                localDate: localDate,
                title: localDate
            )
        )
        let capture: EventRecord? = try? await post(
            "/api/captures",
            body: CaptureAppendRequest(
                idempotencyKey: UUID().uuidString,
                occurredAt: ISO8601DateFormatter().string(from: Date()),
                payload: CapturePayload(note: composition.captureNoteText, attachments: storedAttachments),
                schemaVersion: 1,
                source: "ios_app",
                type: "manual_check_in_submitted"
            )
        )
        return SavedCapture(
            analysisRun: journalResponse.analysisRun,
            journal: journalResponse.document,
            capture: capture
        )
    }

    static func sendChatMessage(_ message: String) async throws -> String {
        let response: ConversationMessageResponse = try await post(
            "/api/conversations/default/messages",
            body: ConversationMessageRequest(message: message)
        )
        return response.reply
    }

    static func updateActionStatus(itemId: String, status: String) async throws -> ActionItem {
        let escaped = itemId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? itemId
        let response: ActionStatusResponse = try await post(
            "/api/actions/\(escaped)/status",
            body: ActionStatusRequest(itemId: itemId, status: status)
        )
        return response.action
    }

    private static func get<Response: Decodable>(
        _ path: String,
        queryItems: [URLQueryItem] = []
    ) async throws -> Response {
        var request = URLRequest(url: try url(path, queryItems: queryItems))
        request.httpMethod = "GET"
        applyClientIdentity(to: &request)
        return try await send(request)
    }

    private static func post<Response: Decodable, Body: Encodable>(
        _ path: String,
        body: Body
    ) async throws -> Response {
        var request = URLRequest(url: try url(path))
        request.httpMethod = "POST"
        applyClientIdentity(to: &request)
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.httpBody = try encoder.encode(body)
        return try await send(request)
    }

    private static func uploadMediaAttachments(
        _ attachments: [JournalMediaAttachment]
    ) async throws -> [StoredJournalMediaAttachment] {
        var stored: [StoredJournalMediaAttachment] = []
        for attachment in attachments {
            stored.append(try await uploadMediaAttachment(attachment))
        }
        return stored
    }

    private static func uploadMediaAttachment(
        _ attachment: JournalMediaAttachment
    ) async throws -> StoredJournalMediaAttachment {
        guard let uploadDraft = MediaUploadDraftPolicy.evaluate(dataURL: attachment.dataURL) else {
            throw NudgeAPIError.badMediaData
        }

        let response: MediaUploadResponse = try await post(
            "/api/media",
            body: MediaUploadRequest(
                byteLength: uploadDraft.byteLength,
                dataBase64: uploadDraft.dataBase64,
                id: attachment.id,
                kind: attachment.kind == "voice" ? "voice" : "image",
                label: attachment.label,
                mimeType: attachment.mimeType
            )
        )

        return StoredJournalMediaAttachment(
            id: response.id,
            kind: response.kind,
            label: response.label,
            mimeType: response.mimeType,
            url: response.url
        )
    }

    private static func applyClientIdentity(to request: inout URLRequest) {
        request.setValue(NudgeInstallIdentity.currentUserID(), forHTTPHeaderField: "x-nudge-anonymous-user-id")
        request.setValue("ios", forHTTPHeaderField: "x-nudge-client")
    }

    private static func send<Response: Decodable>(_ request: URLRequest) async throws -> Response {
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw NudgeAPIError.badResponse
        }
        guard (200..<300).contains(httpResponse.statusCode) else {
            throw NudgeAPIError.httpStatus(httpResponse.statusCode)
        }
        return try decoder.decode(Response.self, from: data)
    }

    private static func url(_ path: String, queryItems: [URLQueryItem] = []) throws -> URL {
        guard let baseURL = URL(string: configuredEngineURL) else {
            throw NudgeAPIError.badURL
        }
        var components = URLComponents(url: baseURL.appending(path: path), resolvingAgainstBaseURL: false)
        components?.queryItems = queryItems.isEmpty ? nil : queryItems
        guard let url = components?.url else {
            throw NudgeAPIError.badURL
        }
        return url
    }
}

enum NudgeInstallIdentity {
    static let userIDKey = "nudge.anonymousUserID"

    static func currentUserID(defaults: UserDefaults = .standard) -> String {
        if let existing = defaults.string(forKey: userIDKey)?.trimmingCharacters(in: .whitespacesAndNewlines),
           existing.hasPrefix("anon_") {
            return existing.lowercased()
        }

        let userID = generatedUserID(uuidString: UUID().uuidString)
        defaults.set(userID, forKey: userIDKey)
        return userID
    }

    static func generatedUserID(uuidString: String) -> String {
        "anon_\(uuidString.lowercased())"
    }
}

struct JournalMediaAttachment {
    let id: String
    let kind: String
    let label: String
    let mimeType: String
    let dataURL: String
}

struct MediaUploadDraft: Equatable {
    let byteLength: Int
    let dataBase64: String
}

enum MediaUploadDraftPolicy {
    static func evaluate(dataURL: String) -> MediaUploadDraft? {
        guard let separatorIndex = dataURL.firstIndex(of: ",") else {
            return nil
        }
        let dataStart = dataURL.index(after: separatorIndex)
        let dataBase64 = String(dataURL[dataStart...])
        guard let data = Data(base64Encoded: dataBase64), !data.isEmpty else {
            return nil
        }
        return MediaUploadDraft(byteLength: data.count, dataBase64: dataBase64)
    }
}

private struct StoredJournalMediaAttachment {
    let id: String
    let kind: String
    let label: String
    let mimeType: String
    let url: String
}

private struct VoiceLogRequest: Encodable {
    let idempotencyKey: String
    let spokenText: String
}

private struct ConversationMessageRequest: Encodable {
    let message: String
}

private struct ActionStatusRequest: Encodable {
    let itemId: String
    let status: String
}

private struct MediaUploadRequest: Encodable {
    let byteLength: Int
    let dataBase64: String
    let id: String
    let kind: String
    let label: String
    let mimeType: String
}

private struct JournalSaveRequest: Encodable {
    let bodyDocument: [RichTextBlock]
    let bodyText: String
    let localDate: String
    let title: String
}

private struct RichTextBlock: Encodable {
    let type: String
    let children: [RichTextText]?
    let attrs: RichTextMediaAttributes?

    static func paragraph(_ text: String) -> RichTextBlock {
        RichTextBlock(type: "p", children: [RichTextText(text: text)], attrs: nil)
    }

    static func media(_ attachment: StoredJournalMediaAttachment) -> RichTextBlock {
        RichTextBlock(
            type: attachment.kind == "voice" ? "audio" : "img",
            children: nil,
            attrs: RichTextMediaAttributes(
                alt: attachment.label,
                id: attachment.id,
                mimeType: attachment.mimeType,
                src: attachment.url
            )
        )
    }
}

private struct RichTextText: Encodable {
    let text: String
}

private struct RichTextMediaAttributes: Encodable {
    let alt: String
    let id: String
    let mimeType: String
    let src: String
}

private struct CaptureAppendRequest: Encodable {
    let idempotencyKey: String
    let occurredAt: String
    let payload: CapturePayload
    let schemaVersion: Int
    let source: String
    let type: String
}

private struct CapturePayload: Encodable {
    let note: String
    let attachments: [CaptureAttachmentPayload]?

    init(note: String, attachments: [StoredJournalMediaAttachment] = []) {
        self.note = note
        self.attachments = attachments.isEmpty
            ? nil
            : attachments.map {
                CaptureAttachmentPayload(
                    id: $0.id,
                    kind: $0.kind,
                    label: $0.label,
                    mimeType: $0.mimeType,
                    url: $0.url
                )
            }
    }
}

private struct CaptureAttachmentPayload: Encodable {
    let id: String
    let kind: String
    let label: String
    let mimeType: String
    let url: String
}

enum NudgeAPIError: LocalizedError {
    case badResponse
    case badURL
    case badMediaData
    case httpStatus(Int)

    var errorDescription: String? {
        switch self {
        case .badResponse:
            return "The server returned an unreadable response."
        case .badURL:
            return "The Engine URL is invalid."
        case .badMediaData:
            return "The attachment could not be prepared for upload."
        case .httpStatus(401):
            return "Server sign-in required."
        case .httpStatus(let status):
            return "The server returned HTTP \(status)."
        }
    }
}
