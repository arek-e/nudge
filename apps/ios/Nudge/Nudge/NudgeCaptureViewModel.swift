import Foundation
import PencilKit
import SwiftUI
import UIKit

enum CaptureAttachmentKind {
    case cameraPhoto
    case drawing
    case libraryPhoto
    case voice

    var documentKind: String {
        switch self {
        case .cameraPhoto, .drawing, .libraryPhoto:
            "image"
        case .voice:
            "voice"
        }
    }

    var icon: String {
        switch self {
        case .cameraPhoto:
            "camera.fill"
        case .drawing:
            "scribble"
        case .libraryPhoto:
            "photo.fill"
        case .voice:
            "waveform"
        }
    }

    var label: String {
        switch self {
        case .cameraPhoto:
            "Camera photo"
        case .drawing:
            "Drawing"
        case .libraryPhoto:
            "Photo"
        case .voice:
            "Voice recording"
        }
    }
}

struct CaptureAttachment: Identifiable {
    let id: String
    let kind: CaptureAttachmentKind
    let drawing: PKDrawing?
    let mimeType: String
    let dataURL: String
    let thumbnail: UIImage?

    var label: String { kind.label }

    var journalAttachment: JournalMediaAttachment {
        JournalMediaAttachment(
            id: id,
            kind: kind.documentKind,
            label: label,
            mimeType: mimeType,
            dataURL: dataURL
        )
    }

    static func image(_ image: UIImage, kind: CaptureAttachmentKind) -> CaptureAttachment? {
        let prepared = image.nudgePreparedForUpload(maxDimension: 1600)
        guard let data = prepared.jpegData(compressionQuality: 0.82) else { return nil }
        return CaptureAttachment(
            id: UUID().uuidString,
            kind: kind,
            drawing: nil,
            mimeType: "image/jpeg",
            dataURL: "data:image/jpeg;base64,\(data.base64EncodedString())",
            thumbnail: prepared.nudgePreparedForUpload(maxDimension: 360)
        )
    }

    static func drawing(_ drawing: PKDrawing, id: String = UUID().uuidString) -> CaptureAttachment? {
        let bounds = drawing.bounds.insetBy(dx: -36, dy: -36)
        guard !bounds.isEmpty else { return nil }
        let image = drawing.image(from: bounds, scale: UIScreen.main.scale)
        let prepared = image.nudgeScaled(maxDimension: 1600)
        guard let data = prepared.pngData() else { return nil }

        return CaptureAttachment(
            id: id,
            kind: .drawing,
            drawing: drawing,
            mimeType: "image/png",
            dataURL: "data:image/png;base64,\(data.base64EncodedString())",
            thumbnail: prepared.nudgeScaled(maxDimension: 360)
        )
    }

    static func voiceRecording(url: URL) -> CaptureAttachment? {
        guard let data = try? Data(contentsOf: url), !data.isEmpty else { return nil }
        return CaptureAttachment(
            id: UUID().uuidString,
            kind: .voice,
            drawing: nil,
            mimeType: "audio/mp4",
            dataURL: "data:audio/mp4;base64,\(data.base64EncodedString())",
            thumbnail: nil
        )
    }

    var previewImage: UIImage? {
        if let thumbnail { return thumbnail }
        guard let encoded = dataURL.split(separator: ",", maxSplits: 1).last,
              let data = Data(base64Encoded: String(encoded)) else {
            return nil
        }
        return UIImage(data: data)
    }
}

enum TextFormatAction {
    case bold
    case bullet
    case heading
    case italic
}

struct CaptureResult: Identifiable {
    let id = UUID()
    let title: String
    let signalCount: Int
    let actionCount: Int
    let sourceCount: Int
    let summary: String
    let items: [CaptureDetailItem]
    let references: [String]
}

struct CaptureDetailItem: Identifiable {
    let id = UUID()
    let title: String
    let value: String
    let subtitle: String
    let color: Color
    let icon: String
}
