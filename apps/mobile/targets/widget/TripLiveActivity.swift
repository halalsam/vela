import ActivityKit
import SwiftUI
import WidgetKit

private extension VelaTripAttributes.ContentState {
  var remaining: Double {
    guard totalMB > 0 else { return 0 }
    return min(1, max(0, (totalMB - usedMB) / totalMB))
  }

  var color: Color {
    if status == "expired" || status == "depleted" { return Color("velaDanger") }
    if status == "active" && (remaining <= 0.15 || totalMB - usedMB <= 512) { return Color("velaWarning") }
    return Color("velaChampagne")
  }
}

private struct Countdown: View {
  let expiresAt: Date?

  var body: some View {
    if let expiresAt, expiresAt > .now {
      Text(timerInterval: Date.now...expiresAt, countsDown: true)
        .monospacedDigit()
    } else {
      Text("–")
    }
  }
}

private struct LockScreenActivity: View {
  let context: ActivityViewContext<VelaTripAttributes>

  var body: some View {
    let state = context.state
    HStack(spacing: 14) {
      ZStack {
        UsageRingView(fraction: state.remaining, color: state.color, lineWidth: 6)
        Text(context.attributes.flag).font(.system(size: 20))
      }
      .frame(width: 52, height: 52)
      VStack(alignment: .leading, spacing: 3) {
        HStack(spacing: 6) {
          VelaSymbolView(size: 13, color: Color("velaChampagne"))
          Text(context.attributes.label).font(.system(size: 15, weight: .semibold)).lineLimit(1)
        }
        Text(state.leftLabel)
          .font(.system(size: 22, weight: .semibold, design: .rounded))
          .monospacedDigit()
          .foregroundStyle(state.color)
        Countdown(expiresAt: state.expiresAt)
          .font(.system(size: 12, design: .rounded))
          .foregroundStyle(.white.opacity(0.64))
      }
      Spacer(minLength: 0)
    }
    .padding(16)
    .foregroundStyle(.white)
    .activityBackgroundTint(Color("velaCanvas"))
    .activitySystemActionForegroundColor(Color("velaChampagne"))
  }
}

struct VelaTripLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: VelaTripAttributes.self) { context in
      LockScreenActivity(context: context)
        .widgetURL(URL(string: "vela://usage/\(context.attributes.iccid)"))
    } dynamicIsland: { context in
      let state = context.state
      return DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          HStack(spacing: 8) {
            VelaSymbolView(size: 18, color: Color("velaChampagne"))
            Text(context.attributes.flag).font(.system(size: 20))
          }
          .padding(.leading, 4)
        }
        DynamicIslandExpandedRegion(.trailing) {
          Text(state.leftLabel)
            .font(.system(size: 20, weight: .semibold, design: .rounded))
            .monospacedDigit()
            .foregroundStyle(state.color)
            .padding(.trailing, 4)
        }
        DynamicIslandExpandedRegion(.center) {
          Text(context.attributes.label).font(.system(size: 14, weight: .semibold)).lineLimit(1)
        }
        DynamicIslandExpandedRegion(.bottom) {
          VStack(spacing: 6) {
            ProgressView(value: state.remaining).tint(state.color)
            HStack {
              Text(state.statusLabel).font(.system(size: 12)).foregroundStyle(.white.opacity(0.64))
              Spacer()
              Countdown(expiresAt: state.expiresAt).font(.system(size: 12, design: .rounded)).foregroundStyle(.white.opacity(0.64))
            }
          }
          .padding(.horizontal, 4)
        }
      } compactLeading: {
        VelaSymbolView(size: 16, color: Color("velaChampagne"))
      } compactTrailing: {
        Text(state.leftLabel)
          .font(.system(size: 13, weight: .semibold, design: .rounded))
          .monospacedDigit()
          .foregroundStyle(state.color)
          .lineLimit(1)
          .minimumScaleFactor(0.6)
      } minimal: {
        UsageRingView(fraction: state.remaining, color: state.color, lineWidth: 3)
          .frame(width: 18, height: 18)
      }
      .widgetURL(URL(string: "vela://usage/\(context.attributes.iccid)"))
      .keylineTint(Color("velaChampagne"))
    }
  }
}
