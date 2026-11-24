import ActivityKit
import SwiftUI
import WidgetKit

let velaAppGroup = "group.com.sammk21.vela"
let velaWidgetKey = "vela.widget"

struct VelaTripAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var usedMB: Double
    var totalMB: Double
    var expiresAt: Date?
    var status: String
    var leftLabel: String
    var statusLabel: String
  }

  var iccid: String
  var label: String
  var flag: String
}

struct WidgetEsim: Codable, Hashable {
  let iccid: String
  let label: String
  let flag: String
  let usedMB: Double
  let totalMB: Double
  let leftText: String
  let ofText: String
  let expiresAt: Date?
  let status: String
  let statusText: String

  var remaining: Double {
    guard totalMB > 0 else { return 0 }
    return min(1, max(0, (totalMB - usedMB) / totalMB))
  }

  var isLow: Bool {
    status == "active" && (remaining <= 0.15 || totalMB - usedMB <= 512)
  }

  var isEnded: Bool {
    status == "expired" || status == "depleted"
  }

  var ringColor: Color {
    if isEnded { return Color("velaDanger") }
    if status == "not_started" { return Color.white.opacity(0.24) }
    return isLow ? Color("velaWarning") : Color("velaChampagne")
  }
}

struct WidgetPayload: Codable {
  let updatedAt: Date
  let esims: [WidgetEsim]
  let emptyTitle: String
  let emptyBody: String
  let leftWord: String

  static func load() -> WidgetPayload? {
    guard
      let defaults = UserDefaults(suiteName: velaAppGroup),
      let raw = defaults.string(forKey: velaWidgetKey),
      let data = raw.data(using: .utf8)
    else { return nil }
    let decoder = JSONDecoder()
    decoder.dateDecodingStrategy = .millisecondsSince1970
    return try? decoder.decode(WidgetPayload.self, from: data)
  }

  var primary: WidgetEsim? {
    esims.first { $0.status == "active" } ?? esims.first { $0.status == "not_started" } ?? esims.first
  }
}

struct VelaSymbolView: View {
  var size: CGFloat
  var color: Color = .white

  var body: some View {
    Image(size <= 32 ? "VelaSymbolSmall" : "VelaSymbol")
      .renderingMode(.template)
      .resizable()
      .scaledToFit()
      .frame(height: size)
      .foregroundStyle(color)
      .accessibilityLabel("vela")
  }
}

struct UsageRingView: View {
  var fraction: Double
  var color: Color
  var lineWidth: CGFloat

  var body: some View {
    ZStack {
      Circle().stroke(Color("velaTrack"), lineWidth: lineWidth)
      Circle()
        .trim(from: 0, to: fraction)
        .stroke(color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
        .rotationEffect(.degrees(-90))
    }
  }
}

extension View {
  @ViewBuilder
  func velaWidgetBackground() -> some View {
    if #available(iOS 17.0, *) {
      containerBackground(for: .widget) { Color("velaCanvas") }
    } else {
      background(Color("velaCanvas"))
    }
  }
}
