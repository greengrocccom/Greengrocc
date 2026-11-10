import Flutter
import GoogleMaps
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    // Live order tracking map. Set MAPS_API_KEY in ios/Flutter/*.xcconfig.
    if let mapsKey = Bundle.main.object(forInfoDictionaryKey: "GMSApiKey") as? String,
       !mapsKey.isEmpty {
      GMSServices.provideAPIKey(mapsKey)
    }
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)

    // Lets the tracking screen fall back to OpenStreetMap when no Maps key is set.
    if let registrar = engineBridge.pluginRegistry.registrar(forPlugin: "GreenGroccMapsConfig") {
      let channel = FlutterMethodChannel(name: "com.greengrocc.app/maps", binaryMessenger: registrar.messenger())
      channel.setMethodCallHandler { call, result in
        guard call.method == "hasGoogleMapsKey" else {
          result(FlutterMethodNotImplemented)
          return
        }
        let key = Bundle.main.object(forInfoDictionaryKey: "GMSApiKey") as? String ?? ""
        result(!key.trimmingCharacters(in: .whitespaces).isEmpty)
      }
    }
  }
}
