package com.greengrocc.userapp

import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import androidx.activity.OnBackPressedCallback
import androidx.core.view.WindowCompat
import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

open class MainActivity : FlutterFragmentActivity() {
    private val backChannelName = "com.greengrocc.app/back"
    private val mapsChannelName = "com.greengrocc.app/maps"
    private var backChannel: MethodChannel? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        super.onCreate(savedInstanceState)
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        val channel = MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            backChannelName,
        )
        backChannel = channel

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, mapsChannelName)
            .setMethodCallHandler { call, result ->
                if (call.method == "hasGoogleMapsKey") {
                    result.success(hasGoogleMapsKey())
                } else {
                    result.notImplemented()
                }
            }

        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    val active = backChannel
                    if (active == null) {
                        isEnabled = false
                        onBackPressedDispatcher.onBackPressed()
                        isEnabled = true
                        return
                    }

                    active.invokeMethod(
                        "onBack",
                        null,
                        object : MethodChannel.Result {
                            override fun success(result: Any?) {
                                when (result) {
                                    true -> return
                                    "exit" -> {
                                        finish()
                                        return
                                    }
                                    else -> {
                                        isEnabled = false
                                        try {
                                            onBackPressedDispatcher.onBackPressed()
                                        } finally {
                                            isEnabled = true
                                        }
                                    }
                                }
                            }

                            override fun error(
                                errorCode: String,
                                errorMessage: String?,
                                errorDetails: Any?,
                            ) {
                                isEnabled = false
                                try {
                                    onBackPressedDispatcher.onBackPressed()
                                } finally {
                                    isEnabled = true
                                }
                            }

                            override fun notImplemented() {
                                isEnabled = false
                                try {
                                    onBackPressedDispatcher.onBackPressed()
                                } finally {
                                    isEnabled = true
                                }
                            }
                        },
                    )
                }
            },
        )
    }

    private fun hasGoogleMapsKey(): Boolean = try {
        @Suppress("DEPRECATION")
        val info = packageManager.getApplicationInfo(packageName, PackageManager.GET_META_DATA)
        !info.metaData?.getString("com.google.android.geo.API_KEY").isNullOrBlank()
    } catch (_: Exception) {
        false
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
    }
}
