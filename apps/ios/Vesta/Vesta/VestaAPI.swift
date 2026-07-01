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
        trailingNote: String
    ) -> JournalSaveComposition {
        let existing = existingJournalText?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let leading = leadingNote.trimmingCharacters(in: .whitespacesAndNewlines)
        let trailing = trailingNote.trimmingCharacters(in: .whitespacesAndNewlines)
        let captureNoteText = [leading, trailing]
            .filter { !$0.isEmpty }
            .joined(separator: "\n\n")
        let paragraphs = [existing, leading, trailing].filter { !$0.isEmpty }

        return JournalSaveComposition(
            captureNoteText: captureNoteText,
            existingJournalText: existing,
            journalBodyText: paragraphs.joined(separator: "\n\n"),
            leadingNote: leading,
            trailingNote: trailing
        )
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

enum VestaAPI {
    static let engineURLKey = "vesta.engineURL"
    private static let legacyEngineURLKey = "vesta.backendURL"
    static let defaultEngineURL = "http://192.168.76.133:8787"
    static var configuredEngineURL: String {
        let defaults = UserDefaults.standard
        if let engineURL = defaults.string(forKey: engineURLKey) {
            return engineURL
        }
        if let legacyURL = defaults.string(forKey: legacyEngineURLKey) {
            defaults.set(legacyURL, forKey: engineURLKey)
            return legacyURL
        }
        return defaultEngineURL
    }

    private static let decoder = JSONDecoder()
    private static let encoder = JSONEncoder()

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
        localDate: String
    ) async throws -> SavedCapture {
        let composition = JournalSaveCompositionPolicy.evaluate(
            existingJournalText: existingJournalText,
            leadingNote: note,
            trailingNote: trailingNote
        )
        var bodyDocument = composition.existingJournalText.isEmpty
            ? []
            : [RichTextBlock.paragraph(composition.existingJournalText)]
        if !composition.leadingNote.isEmpty {
            bodyDocument.append(RichTextBlock.paragraph(composition.leadingNote))
        }
        bodyDocument.append(contentsOf: attachments.map(RichTextBlock.media))
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
                payload: CapturePayload(note: composition.captureNoteText, attachments: attachments),
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
        return try await send(request)
    }

    private static func post<Response: Decodable, Body: Encodable>(
        _ path: String,
        body: Body
    ) async throws -> Response {
        var request = URLRequest(url: try url(path))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.httpBody = try encoder.encode(body)
        return try await send(request)
    }

    private static func send<Response: Decodable>(_ request: URLRequest) async throws -> Response {
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw VestaAPIError.badResponse
        }
        guard (200..<300).contains(httpResponse.statusCode) else {
            throw VestaAPIError.httpStatus(httpResponse.statusCode)
        }
        return try decoder.decode(Response.self, from: data)
    }

    private static func url(_ path: String, queryItems: [URLQueryItem] = []) throws -> URL {
        guard let baseURL = URL(string: configuredEngineURL) else {
            throw VestaAPIError.badURL
        }
        var components = URLComponents(url: baseURL.appending(path: path), resolvingAgainstBaseURL: false)
        components?.queryItems = queryItems.isEmpty ? nil : queryItems
        guard let url = components?.url else {
            throw VestaAPIError.badURL
        }
        return url
    }
}

struct JournalMediaAttachment {
    let id: String
    let kind: String
    let label: String
    let mimeType: String
    let dataURL: String
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

    static func media(_ attachment: JournalMediaAttachment) -> RichTextBlock {
        RichTextBlock(
            type: attachment.kind == "voice" ? "audio" : "img",
            children: nil,
            attrs: RichTextMediaAttributes(
                alt: attachment.label,
                id: attachment.id,
                mimeType: attachment.mimeType,
                src: attachment.dataURL
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

    init(note: String, attachments: [JournalMediaAttachment] = []) {
        self.note = note
        self.attachments = attachments.isEmpty
            ? nil
            : attachments.map {
                CaptureAttachmentPayload(kind: $0.kind, label: $0.label, mimeType: $0.mimeType)
            }
    }
}

private struct CaptureAttachmentPayload: Encodable {
    let kind: String
    let label: String
    let mimeType: String
}

enum VestaAPIError: LocalizedError {
    case badResponse
    case badURL
    case httpStatus(Int)

    var errorDescription: String? {
        switch self {
        case .badResponse:
            return "The server returned an unreadable response."
        case .badURL:
            return "The Engine URL is invalid."
        case .httpStatus(let status):
            return "The server returned HTTP \(status)."
        }
    }
}
