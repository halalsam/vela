import SwiftUI
import WidgetKit

struct UsageEntry: TimelineEntry {
  let date: Date
  let payload: WidgetPayload?
}

struct UsageProvider: TimelineProvider {
  func placeholder(in context: Context) -> UsageEntry {
    UsageEntry(date: .now, payload: nil)
  }

  func getSnapshot(in context: Context, completion: @escaping (UsageEntry) -> Void) {
    completion(UsageEntry(date: .now, payload: WidgetPayload.load()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<UsageEntry>) -> Void) {
    let entry = UsageEntry(date: .now, payload: WidgetPayload.load())
    let next = Calendar.current.date(byAdding: .minute, value: 30, to: .now) ?? .now.addingTimeInterval(1800)
    completion(Timeline(entries: [entry], policy: .after(next)))
  }
}

struct UsageWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: UsageEntry

  var body: some View {
    Group {
      if let esim = entry.payload?.primary {
        switch family {
        case .accessoryCircular: LockRing(esim: esim)
        case .accessoryRectangular: LockRectangle(esim: esim)
        case .accessoryInline: Text("\(esim.flag) \(esim.leftText) \(entry.payload?.leftWord ?? "")")
        case .systemMedium: MediumUsage(esim: esim)
        default: SmallUsage(esim: esim)
        }
      } else {
        EmptyUsage(payload: entry.payload, family: family)
      }
    }
    .widgetURL(URL(string: entry.payload?.primary.map { "vela://usage/\($0.iccid)" } ?? "vela://esims"))
    .velaWidgetBackground()
  }
}

private struct SmallUsage: View {
  let esim: WidgetEsim

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack {
        Text(esim.flag).font(.system(size: 20))
        Spacer()
        VelaSymbolView(size: 16, color: Color("velaChampagne"))
      }
      Spacer(minLength: 0)
      ZStack {
        UsageRingView(fraction: esim.isEnded ? 0 : esim.remaining, color: esim.ringColor, lineWidth: 8)
        VStack(spacing: 0) {
          Text(esim.leftText)
            .font(.system(size: 17, weight: .semibold, design: .rounded))
            .monospacedDigit()
            .minimumScaleFactor(0.6)
            .lineLimit(1)
          Text(esim.ofText).font(.system(size: 10)).foregroundStyle(.white.opacity(0.4)).lineLimit(1)
        }
        .padding(.horizontal, 10)
      }
      .frame(width: 92, height: 92)
      .frame(maxWidth: .infinity)
    }
    .foregroundStyle(.white)
  }
}

private struct MediumUsage: View {
  let esim: WidgetEsim

  var body: some View {
    HStack(spacing: 16) {
      ZStack {
        UsageRingView(fraction: esim.isEnded ? 0 : esim.remaining, color: esim.ringColor, lineWidth: 10)
        Text(esim.leftText)
          .font(.system(size: 18, weight: .semibold, design: .rounded))
          .monospacedDigit()
          .minimumScaleFactor(0.6)
          .lineLimit(1)
          .padding(.horizontal, 12)
      }
      .frame(width: 112, height: 112)
      VStack(alignment: .leading, spacing: 6) {
        HStack(spacing: 6) {
          Text(esim.flag)
          Text(esim.label).font(.system(size: 15, weight: .semibold)).lineLimit(1)
        }
        Text(esim.ofText).font(.system(size: 13)).foregroundStyle(.white.opacity(0.64))
        if let expiresAt = esim.expiresAt, !esim.isEnded {
          Text(expiresAt, style: .relative)
            .font(.system(size: 13, design: .rounded))
            .monospacedDigit()
            .foregroundStyle(.white.opacity(0.64))
        }
        Spacer(minLength: 0)
        HStack {
          Text(esim.statusText)
            .font(.system(size: 11, weight: .semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(esim.ringColor.opacity(0.16), in: Capsule())
            .foregroundStyle(esim.ringColor)
          Spacer()
          VelaSymbolView(size: 16, color: Color("velaChampagne"))
        }
      }
    }
    .foregroundStyle(.white)
  }
}

private struct LockRing: View {
  let esim: WidgetEsim

  var body: some View {
    Gauge(value: esim.isEnded ? 0 : esim.remaining) {
      VelaSymbolView(size: 10)
    } currentValueLabel: {
      Text(esim.leftText).font(.system(size: 11, weight: .semibold, design: .rounded)).minimumScaleFactor(0.5)
    }
    .gaugeStyle(.accessoryCircularCapacity)
    .widgetAccentable()
  }
}

private struct LockRectangle: View {
  let esim: WidgetEsim

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      HStack(spacing: 4) {
        VelaSymbolView(size: 11)
        Text(esim.label).font(.system(size: 13, weight: .semibold)).lineLimit(1)
      }
      Text(esim.ofText).font(.system(size: 12)).lineLimit(1)
      Gauge(value: esim.isEnded ? 0 : esim.remaining) { EmptyView() }
        .gaugeStyle(.accessoryLinearCapacity)
        .widgetAccentable()
    }
  }
}

private struct EmptyUsage: View {
  let payload: WidgetPayload?
  let family: WidgetFamily

  var body: some View {
    if family == .accessoryCircular || family == .accessoryInline || family == .accessoryRectangular {
      VelaSymbolView(size: 22)
    } else {
      VStack(alignment: .leading, spacing: 6) {
        VelaSymbolView(size: 26, color: Color("velaChampagne"))
        Spacer(minLength: 0)
        Text(payload?.emptyTitle ?? "land connected.").font(.system(size: 15, weight: .semibold))
        if let detail = payload?.emptyBody {
          Text(detail).font(.system(size: 12)).foregroundStyle(.white.opacity(0.64)).lineLimit(2)
        }
      }
      .foregroundStyle(.white)
      .frame(maxWidth: .infinity, alignment: .leading)
    }
  }
}

struct VelaUsageWidget: Widget {
  let kind = "VelaUsageWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: UsageProvider()) { entry in
      UsageWidgetView(entry: entry)
    }
    .configurationDisplayName("vela")
    .description("Data left and time left on your trip eSIM.")
    .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular, .accessoryInline])
  }
}
