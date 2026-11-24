# ProGuard rules for ScreenCast Pro
-keepattributes *Annotation*
-keepclassmembers class * {
    @org.json.* <fields>;
}
-dontwarn okhttp3.**
-dontwarn okio.**
