import ActivityKit
import ExpoModulesCore

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

struct TripStateRecord: Record {
  @Field var usedMB: Double = 0
  @Field var totalMB: Double = 0
  @Field var expiresAt: Double? = nil
  @Field var status: String = "active"
  @Field var leftLabel: String = ""
  @Field var statusLabel: String = ""

  var contentState: VelaTripAttributes.ContentState {
    VelaTripAttributes.ContentState(
      usedMB: usedMB,
      totalMB: totalMB,
      expiresAt: expiresAt.map { Date(timeIntervalSince1970: $0 / 1000) },
      status: status,
      leftLabel: leftLabel,
      statusLabel: statusLabel
    )
  }
}

struct TripStartRecord: Record {
  @Field var iccid: String = ""
  @Field var label: String = ""
  @Field var flag: String = ""
  @Field var state: TripStateRecord = TripStateRecord()
}

public class VelaLiveActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("VelaLiveActivity")

    Function("isSupported") { () -> Bool in
      ActivityAuthorizationInfo().areActivitiesEnabled
    }

    Function("list") { () -> [[String: String]] in
      Activity<VelaTripAttributes>.activities.map { ["id": $0.id, "iccid": $0.attributes.iccid] }
    }

    AsyncFunction("start") { (input: TripStartRecord) -> String in
      for activity in Activity<VelaTripAttributes>.activities where activity.attributes.iccid == input.iccid {
        await activity.end(nil, dismissalPolicy: .immediate)
      }
      let attributes = VelaTripAttributes(iccid: input.iccid, label: input.label, flag: input.flag)
      let content = ActivityContent(state: input.state.contentState, staleDate: nil)
      let activity = try Activity.request(attributes: attributes, content: content, pushType: nil)
      return activity.id
    }

    AsyncFunction("update") { (iccid: String, state: TripStateRecord) in
      for activity in Activity<VelaTripAttributes>.activities where activity.attributes.iccid == iccid {
        await activity.update(ActivityContent(state: state.contentState, staleDate: nil))
      }
    }

    AsyncFunction("end") { (iccid: String) in
      for activity in Activity<VelaTripAttributes>.activities where activity.attributes.iccid == iccid {
        await activity.end(nil, dismissalPolicy: .immediate)
      }
    }
  }
}
