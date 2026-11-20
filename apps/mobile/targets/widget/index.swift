import SwiftUI
import WidgetKit

@main
struct VelaWidgetBundle: WidgetBundle {
  var body: some Widget {
    VelaUsageWidget()
    VelaTripLiveActivity()
  }
}
